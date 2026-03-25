import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  startTransition,
} from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  animate,
  MotionValue,
} from "motion/react";
import { Event, getEventTimelineYear } from "../types";
import { BIG_BANG_YEAR } from "../constants";
import {
  EVENT_COLLECTIONS,
  PLAYGROUND_COLLECTION,
  SYNCABLE_COLLECTION_IDS,
  loadEventCollection,
} from "../data/collections";
import { Sidebar } from "./Sidebar";
import { EventEditor } from "./EventEditor";
import {
  AutoFitButton,
  EventInfoPanel,
  FpsBadge,
  ZoomController,
} from "./timeline/TimelineHud";
import {
  CollapsedEventGroup,
  EventLayoutState,
  TimelineTick,
  WarpOverlayMode,
  WarpOverlay,
} from "./timeline/TimelineMarkers";
import { TimelineViewport } from "./timeline/TimelineViewport";
import {
  formatTimelineTick,
  getNiceInterval,
  getTimelineHighlightStep,
  isHighlightedTimelineTick,
} from "../utils";

const tickLabelWidthEstimateCache = new Map<number, number>();
const TICK_OVERSCAN_INTERVALS = 2;
const COLLECTION_CACHE_KEY = "time-horizon:collection-cache:v1";
const ZOOM_UI_THROTTLE_MS = 80;
const ZOOM_LAYOUT_THROTTLE_MS = 1000;
const ZOOM_SETTLE_DELAY_MS = 140;
const ZOOM_WARP_HIDE_MS = 260;
const ZOOM_WARP_SPEED_THRESHOLD = 0.0024;
type CollectionCache = {
  version: number;
  collections: Record<string, Event[]>;
  visibleCollectionIds?: string[];
};

const readCollectionCache = (): {
  collections: Record<string, Event[]>;
  visibleCollectionIds: string[];
} => {
  if (typeof window === "undefined") {
    return { collections: {}, visibleCollectionIds: [] };
  }

  try {
    const raw = window.localStorage.getItem(COLLECTION_CACHE_KEY);
    if (!raw) {
      return { collections: {}, visibleCollectionIds: [] };
    }

    const parsed = JSON.parse(raw) as CollectionCache;
    if (!parsed || !parsed.collections) {
      return { collections: {}, visibleCollectionIds: [] };
    }

    const fallbackVisibleCollectionIds = Object.keys(parsed.collections);
    const nextVisibleCollectionIds = Array.isArray(parsed.visibleCollectionIds)
      ? parsed.visibleCollectionIds
      : fallbackVisibleCollectionIds;

    return {
      collections: parsed.collections,
      visibleCollectionIds: nextVisibleCollectionIds.filter(
        (collectionId, index, allIds) =>
          allIds.indexOf(collectionId) === index &&
          Object.prototype.hasOwnProperty.call(
            parsed.collections,
            collectionId,
          ),
      ),
    };
  } catch (error) {
    console.error("Failed to restore cached collections", error);
    return { collections: {}, visibleCollectionIds: [] };
  }
};

const getStableTickLabelWidthEstimate = (interval: number) => {
  const cached = tickLabelWidthEstimateCache.get(interval);
  if (cached !== undefined) return cached;

  const sampleYears =
    interval >= 1 ? [BIG_BANG_YEAR, 0, 2000] : [2024, 2024.25, 2024.5];
  const estimate = Math.max(
    80,
    ...sampleYears.map(
      (year) => formatTimelineTick(year, interval).length * 8 + 40,
    ),
  );
  tickLabelWidthEstimateCache.set(interval, estimate);
  return estimate;
};

const formatZoomRangeLabel = (
  currentLogZoom: number,
  viewportWidth: number,
): string => {
  const currentZoom = Math.exp(currentLogZoom);
  const rangeInYears = viewportWidth / currentZoom;
  if (rangeInYears >= 1e9) {
    return `${(rangeInYears / 1e9).toFixed(0)}B Yrs`;
  }
  if (rangeInYears >= 1e6) {
    return `${(rangeInYears / 1e6).toFixed(0)}M Yrs`;
  }
  if (rangeInYears >= 1000) {
    return `${(rangeInYears / 1000).toFixed(0)}K Yrs`;
  }
  if (rangeInYears >= 1) {
    return `${rangeInYears.toFixed(0)} Yrs`;
  }
  if (rangeInYears >= 1 / 12) {
    return `${(rangeInYears * 12).toFixed(0)} Mos`;
  }
  if (rangeInYears >= 1 / 365.25) {
    return `${(rangeInYears * 365.25).toFixed(0)} Days`;
  }
  return `${(rangeInYears * 365.25 * 24).toFixed(0)} Hrs`;
};

const areCollapsedGroupsEqual = (
  prevGroups: CollapsedEventGroup[],
  nextGroups: CollapsedEventGroup[],
) =>
  prevGroups.length === nextGroups.length &&
  prevGroups.every((group, index) => {
    const nextGroup = nextGroups[index];
    const nextEventIds = new Set(nextGroup.eventIds);
    return (
      group.id === nextGroup.id &&
      group.year === nextGroup.year &&
      group.side === nextGroup.side &&
      group.count === nextGroup.count &&
      group.eventIds.length === nextEventIds.size &&
      group.eventIds.every((eventId) => nextEventIds.has(eventId))
    );
  });

// Motion Values
const MIN_ZOOM = 100 / 13.8e9;
const MAX_ZOOM = 1000 / (1 / 365.25);

export const Timeline: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialCacheRef = useRef(readCollectionCache());

  // App State
  const [collectionEventsById, setCollectionEventsById] = useState<
    Record<string, Event[]>
  >(initialCacheRef.current.collections);
  const [selectedEventInfo, setSelectedEventInfo] = useState<Event | null>(
    null,
  );
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [addingCollectionId, setAddingCollectionId] = useState<string | null>(
    null,
  );
  const [isWarping, setIsWarping] = useState(false);
  const [warpMode, setWarpMode] = useState<WarpOverlayMode>("travel");
  const [warpDirection, setWarpDirection] = useState<1 | -1>(1);
  const [visibleCollectionIds, setVisibleCollectionIds] = useState<string[]>(
    initialCacheRef.current.visibleCollectionIds,
  );
  const [downloadingCollectionIds, setDownloadingCollectionIds] = useState<
    string[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ticks, setTicks] = useState<TimelineTick[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedEventGroup[]>(
    [],
  );
  const [fps, setFps] = useState(0);

  const addVisibleCollection = (collectionId: string) => {
    setVisibleCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );
  };

  const ensurePlaygroundCollection = () => {
    setCollectionEventsById((prev) =>
      Object.prototype.hasOwnProperty.call(prev, PLAYGROUND_COLLECTION.id)
        ? prev
        : { ...prev, [PLAYGROUND_COLLECTION.id]: [] },
    );
  };

  const getCollectionEvents = (collectionId: string) =>
    collectionEventsById[collectionId] ?? [];

  const collections = useMemo(
    () =>
      Object.prototype.hasOwnProperty.call(
        collectionEventsById,
        PLAYGROUND_COLLECTION.id,
      )
        ? [...EVENT_COLLECTIONS, PLAYGROUND_COLLECTION]
        : EVENT_COLLECTIONS,
    [collectionEventsById],
  );

  const timelineEvents = useMemo(
    () =>
      collections
        .filter((collection) => visibleCollectionIds.includes(collection.id))
        .flatMap((collection) => getCollectionEvents(collection.id)),
    [collectionEventsById, collections, visibleCollectionIds],
  );
  const timelineEventIndexMap = useMemo(
    () => new Map(timelineEvents.map((event, index) => [event.id, index])),
    [timelineEvents],
  );

  const singleVisibleCollectionId =
    visibleCollectionIds.length === 1 ? visibleCollectionIds[0] : null;

  const findEventCollectionId = (eventId: string) => {
    for (const collectionId of Object.keys(collectionEventsById)) {
      const collectionEvents = collectionEventsById[collectionId] ?? [];
      if (collectionEvents.some((event) => event.id === eventId)) {
        return collectionId;
      }
    }

    return null;
  };

  const zoomWarpTimeoutRef = useRef<number | null>(null);
  const prevZoomWarpSampleRef = useRef<{
    logZoom: number;
    time: number;
  } | null>(null);

  const triggerZoomWarp = (
    mode: Exclude<WarpOverlayMode, "travel">,
    _currentLogZoom: number,
  ) => {
    setWarpMode(mode);
    setIsWarping(true);

    if (zoomWarpTimeoutRef.current !== null) {
      window.clearTimeout(zoomWarpTimeoutRef.current);
    }

    zoomWarpTimeoutRef.current = window.setTimeout(() => {
      setIsWarping(false);
      zoomWarpTimeoutRef.current = null;
    }, ZOOM_WARP_HIDE_MS);
  };

  const animateCameraToEvents = (events: Event[], immediate = false) => {
    const container = containerRef.current;
    if (!container || events.length === 0) return;

    const width = container.clientWidth;
    const PADDING = 0.12;
    const years = events.map((event) => getEventTimelineYear(event));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    if (Math.abs(maxYear - minYear) < 1e-9) {
      const targetYear = minYear;
      const targetZoom = Math.min(Math.max(zoom.get() * 2, MIN_ZOOM), MAX_ZOOM);

      if (immediate) {
        focusPixel.set(width / 2);
        focusYear.set(targetYear);
        targetLogZoom.current = Math.log(targetZoom);
        logZoom.set(targetLogZoom.current);
      } else {
        animate(focusPixel, width / 2, {
          type: "spring",
          stiffness: 300,
          damping: 30,
        });
        animate(focusYear, targetYear, {
          type: "spring",
          stiffness: 300,
          damping: 30,
        });
        targetLogZoom.current = Math.log(targetZoom);
        animate(logZoom, targetLogZoom.current, {
          type: "spring",
          stiffness: 300,
          damping: 30,
        });
      }
      return;
    }

    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min((width * (1 - PADDING * 2)) / (maxYear - minYear), MAX_ZOOM),
    );
    const centerYear = (minYear + maxYear) / 2;
    const pixelDist = Math.abs(centerYear - focusYear.get()) * fitZoom;

    if (immediate) {
      focusPixel.set(width / 2);
      focusYear.set(centerYear);
      targetLogZoom.current = Math.log(fitZoom);
      logZoom.set(targetLogZoom.current);
    } else if (pixelDist > width * 0.5) {
      const duration = Math.min(1.0, 0.2 + pixelDist / 4000);
      animate(focusPixel, width / 2, { duration, ease: "easeInOut" });
      animate(focusYear, centerYear, { duration, ease: "easeInOut" });
      targetLogZoom.current = Math.log(fitZoom);
      animate(logZoom, targetLogZoom.current, { duration, ease: "easeInOut" });
    } else {
      animate(focusPixel, width / 2, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
      animate(focusYear, centerYear, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
      targetLogZoom.current = Math.log(fitZoom);
      animate(logZoom, targetLogZoom.current, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const persistedVisibleCollectionIds = visibleCollectionIds.filter(
        (collectionId, index, allIds) =>
          allIds.indexOf(collectionId) === index &&
          Object.prototype.hasOwnProperty.call(
            collectionEventsById,
            collectionId,
          ),
      );

      window.localStorage.setItem(
        COLLECTION_CACHE_KEY,
        JSON.stringify({
          version: 2,
          collections: collectionEventsById,
          visibleCollectionIds: persistedVisibleCollectionIds,
        }),
      );
    } catch (error) {
      console.error("Failed to persist collection cache", error);
    }
  }, [collectionEventsById, visibleCollectionIds]);

  // Ref version of the currently focused event — read inside updateLayout (rAF path)
  // so it sees the latest value without triggering React re-renders.
  const focusedEventIdRef = useRef<string | null>(null);

  const focusPixel = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 500,
  );
  const focusYear = useMotionValue(0);
  const logZoom = useMotionValue(Math.log(2000 / 13.8e9));
  const zoom = useTransform(logZoom, Math.exp);
  const panX = useTransform(
    () => focusPixel.get() - focusYear.get() * zoom.get(),
  );

  const getViewportWidth = () =>
    containerRef.current?.clientWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 1000);
  const getViewportCenter = () => getViewportWidth() / 2;
  const setCameraFromPanX = (
    nextPanX: number,
    currentZoom: number,
    anchorPixel = focusPixel.get(),
  ) => {
    focusPixel.set(anchorPixel);
    focusYear.set((anchorPixel - nextPanX) / currentZoom);
    return nextPanX;
  };
  const getCenterYear = (centerPixel = getViewportCenter()) =>
    (centerPixel - panX.get()) / zoom.get();

  const targetLogZoom = useRef(Math.log(2000 / 13.8e9));
  const hasBootstrappedRef = useRef(false);

  // Visible year range — computed from camera state, kept in a ref so
  // updateLayout and the render filter can both read it without triggering
  // React re-renders. Updated inside updateTicks (already called on every pan/zoom).
  const visibleBoundsRef = useRef({ startYear: 0, endYear: 1 });
  const tickStateRef = useRef<{
    interval: number;
    highlightStep: number;
    firstTick: number;
    lastTick: number;
  } | null>(null);

  // Layout State (MotionValues to bypass React renders)
  const eventLayouts = useRef<Record<string, EventLayoutState>>({});

  // Initialize layout motion values
  useMemo(() => {
    timelineEvents.forEach((e) => {
      if (!eventLayouts.current[e.id]) {
        eventLayouts.current[e.id] = {
          y: new MotionValue(0),
          opacity: new MotionValue(0),
          targetY: 0,
          targetOpacity: 0,
        };
      }
    });
  }, [timelineEvents]);

  // ── Layout Engine ───────────────────────────────────────────────────────────
  // Assigns each event a stable vertical lane (left/right alternating, up to 3 rows)
  // using collision detection against the current zoom level. The focused event is
  // always shown, but it still lives in a normal lane so it does not cover the axis.
  const updateLayout = (immediate = false) => {
    const currentZoom = Math.exp(logZoom.get());
    const MIN_DIST_PX = 90;
    const minDistYears = MIN_DIST_PX / currentZoom;
    const { startYear, endYear } = visibleBoundsRef.current;
    const margin = (endYear - startYear) * 0.3;
    const layoutStart = startYear - margin;
    const layoutEnd = endYear + margin;

    const focusedId = focusedEventIdRef.current;
    const lowerSearchQuery = searchQuery.trim().toLowerCase();
    const hasSearchQuery = lowerSearchQuery.length > 0;

    // 1. Filter: visible + pass search/group. Always include focused event.
    const visibleEvents = timelineEvents.filter((e) => {
      const ty = getEventTimelineYear(e);
      if (ty < BIG_BANG_YEAR) return false;
      if (e.id === focusedId) return true;
      if (ty < layoutStart || ty > layoutEnd) return false;
      if (!hasSearchQuery) return true;
      return (
        e.title.toLowerCase().includes(lowerSearchQuery) ||
        e.description.toLowerCase().includes(lowerSearchQuery)
      );
    });
    const visibleEventIds = new Set(visibleEvents.map((event) => event.id));

    // 2. Sort by priority, but keep focused event at top so it gets first lane choice.
    const sortedEvents = [...visibleEvents].sort((a, b) => {
      if (a.id === focusedId) return -1;
      if (b.id === focusedId) return 1;
      return b.priority - a.priority;
    });

    const LEVELS = [1, 2, 3];
    const occupied: { year: number; level: number }[] = [];
    const nextCollapsedGroups: CollapsedEventGroup[] = [];

    sortedEvents.forEach((ev) => {
      const layout = eventLayouts.current[ev.id];
      if (!layout) return;

      const evYear = getEventTimelineYear(ev);

      // Stable side assignment: prefer left (even original index) or right (odd).
      const originalIndex = timelineEventIndexMap.get(ev.id) as number;
      const side = originalIndex % 2 === 0 ? 1 : -1;

      // Find first non-colliding level.
      let placedLevel: number | null = null;
      for (const level of LEVELS) {
        const actualLevel = level * side;
        const collision = occupied.some(
          (occ) =>
            occ.level === actualLevel &&
            Math.abs(occ.year - evYear) < minDistYears,
        );
        if (!collision) {
          placedLevel = actualLevel;
          occupied.push({ year: evYear, level: actualLevel });
          break;
        }
      }

      if (placedLevel !== null) {
        const targetY = placedLevel * 80;
        if (layout.targetY !== targetY) {
          layout.targetY = targetY;
          if (immediate) {
            layout.y.set(targetY);
          } else {
            animate(layout.y, targetY, {
              type: "spring",
              stiffness: 400,
              damping: 40,
            });
          }
        }
        if (layout.targetOpacity !== 1) {
          layout.targetOpacity = 1;
          if (immediate) {
            layout.opacity.set(1);
          } else {
            animate(layout.opacity, 1, { duration: 0.2 });
          }
        }
      } else {
        // No free lane — collapse instead of overlap.
        const existingGroup = nextCollapsedGroups.find(
          (group) =>
            group.side === side && Math.abs(group.year - evYear) < minDistYears,
        );

        if (existingGroup) {
          existingGroup.count += 1;
          existingGroup.eventIds.push(ev.id);
        } else {
          nextCollapsedGroups.push({
            id: `${ev.id}-collapsed`,
            year: evYear,
            side,
            count: 1,
            eventIds: [ev.id],
          });
        }

        if (layout.targetOpacity !== 0) {
          layout.targetOpacity = 0;
          if (immediate) {
            layout.opacity.set(0);
          } else {
            animate(layout.opacity, 0, { duration: 0.2 });
          }
        }
      }
    });

    // 4. Collapse filtered-out events.
    timelineEvents.forEach((ev) => {
      if (visibleEventIds.has(ev.id)) return;
      const layout = eventLayouts.current[ev.id];
      if (!layout) return;
      if (layout.targetOpacity !== 0) {
        layout.targetOpacity = 0;
        if (immediate) {
          layout.opacity.set(0);
        } else {
          animate(layout.opacity, 0, { duration: 0.2 });
        }
      }
    });

    setCollapsedGroups((prevGroups) =>
      areCollapsedGroupsEqual(prevGroups, nextCollapsedGroups)
        ? prevGroups
        : nextCollapsedGroups,
    );
  };

  // Throttle all tick updates into a single rAF per frame — prevents duplicate
  // panX + logZoom change handlers from triggering two separate updates.
  const tickUpdateFrame = useRef<number | null>(null);

  const scheduleTickUpdate = () => {
    if (tickUpdateFrame.current !== null) return;
    tickUpdateFrame.current = requestAnimationFrame(() => {
      tickUpdateFrame.current = null;
      updateTicks();
    });
  };

  const updateVisibleBounds = () => {
    const container = containerRef.current;
    if (!container) return null;

    const width = container.clientWidth;
    const currentX = panX.get();
    const currentZoom = Math.exp(logZoom.get());

    const startYear = (-width - currentX) / currentZoom;
    const endYear = (width * 2 - currentX) / currentZoom;
    visibleBoundsRef.current = { startYear, endYear };

    return { width, currentZoom, startYear, endYear };
  };

  const updateTicks = () => {
    const bounds = updateVisibleBounds();
    if (!bounds) return;
    const { width, currentZoom, startYear, endYear } = bounds;

    const visibleYears = width / currentZoom;
    const roughInterval = getNiceInterval(visibleYears / 10);
    const estimatedWidthPx = getStableTickLabelWidthEstimate(roughInterval);

    const maxTicks = Math.max(2, Math.floor(width / estimatedWidthPx));
    const idealInterval = visibleYears / maxTicks;
    const interval = getNiceInterval(idealInterval);
    const baseHighlightStep = getTimelineHighlightStep(interval);

    // Generate tick years aligned to the interval so they remain stable across
    // consecutive panning frames — the same absolute years stay visible, they
    // just shift pixel position. Only zoom changes (which changes `interval`)
    // produce a new set of tick years.
    const tickYears: number[] = [];
    const bufferedStartYear = startYear - interval * TICK_OVERSCAN_INTERVALS;
    const bufferedEndYear = endYear + interval * TICK_OVERSCAN_INTERVALS;
    const firstTick = Math.floor(bufferedStartYear / interval) * interval;
    for (let y = firstTick; y <= bufferedEndYear; y += interval) {
      if (y >= BIG_BANG_YEAR) {
        tickYears.push(y);
      }
    }

    const maxHighlightedTicks = Math.max(1, Math.floor(tickYears.length * 0.3));
    const ticksPerBaseHighlight = Math.max(
      1,
      Math.round(baseHighlightStep / interval),
    );
    const desiredTicksPerHighlight = Math.max(
      1,
      Math.ceil(tickYears.length / maxHighlightedTicks),
    );
    const highlightMultiplier = Math.max(
      1,
      Math.ceil(desiredTicksPerHighlight / ticksPerBaseHighlight),
    );
    const highlightStep = baseHighlightStep * highlightMultiplier;
    const lastTick =
      tickYears.length > 0 ? tickYears[tickYears.length - 1] : firstTick;
    const prevTickState = tickStateRef.current;

    if (
      prevTickState &&
      prevTickState.interval === interval &&
      prevTickState.highlightStep === highlightStep &&
      prevTickState.firstTick === firstTick &&
      prevTickState.lastTick === lastTick
    ) {
      return;
    }

    tickStateRef.current = {
      interval,
      highlightStep,
      firstTick,
      lastTick,
    };

    const newTicks: TimelineTick[] = tickYears.map((year) => ({
      year,
      interval,
      isHighlighted: isHighlightedTimelineTick(year, highlightStep),
    }));
    startTransition(() => {
      setTicks(newTicks);
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Stop inertia on scroll to prevent conflict
    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const currentZ = zoom.get();
    const nextPanX = panX.get() - e.deltaX;

    // Keep the world position under the cursor stable while panning/zooming,
    // but never let the Big Bang marker drift right of the viewport center.
    setCameraFromPanX(nextPanX, currentZ, mouseX);

    // Apply zoom if there is vertical scrolling
    if (Math.abs(e.deltaY) > 0) {
      // Re-anchor zoom to the exact world position under the cursor before
      // starting the zoom spring so the timeline does not wobble in place.
      focusPixel.set(mouseX);
      focusYear.set((mouseX - nextPanX) / currentZ);

      const targetZ = Math.exp(targetLogZoom.current);
      const zoomFactor = Math.pow(1.002, Math.abs(e.deltaY));
      const direction = e.deltaY < 0 ? 1 : -1;
      let newZoom = direction > 0 ? targetZ * zoomFactor : targetZ / zoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      targetLogZoom.current = Math.log(newZoom);
      animate(logZoom, targetLogZoom.current, {
        type: "spring",
        stiffness: 400,
        damping: 40,
      });
    }
  };

  const isDragging = useRef(false);
  const lastX = useRef(0);
  const lastDragTime = useRef(0);
  const pendingDragX = useRef<number | null>(null);
  const pendingDragTime = useRef(0);
  const dragFrame = useRef<number | null>(null);
  const velocity = useRef(0);
  const inertiaFrame = useRef<number | null>(null);

  const flushPendingDrag = () => {
    if (!isDragging.current || pendingDragX.current === null) return;

    const nextX = pendingDragX.current;
    const now = pendingDragTime.current || performance.now();
    const deltaX = nextX - lastX.current;
    const dt = now - lastDragTime.current;

    if (dt > 0) velocity.current = deltaX / dt;

    const currentZ = zoom.get();
    setCameraFromPanX(panX.get() + deltaX, currentZ);

    lastX.current = nextX;
    lastDragTime.current = now;
    pendingDragX.current = null;
  };

  const scheduleDragFrame = () => {
    if (dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      flushPendingDrag();
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
    isDragging.current = true;
    velocity.current = 0;
    const now = performance.now();
    lastDragTime.current = now;
    lastX.current = e.clientX;
    pendingDragX.current = null;
    pendingDragTime.current = now;
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    pendingDragX.current = e.clientX;
    pendingDragTime.current = performance.now();
    scheduleDragFrame();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
    flushPendingDrag();
    isDragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);

    // Inertia: coast with velocity * 20 multiplier and slow friction decay
    const startVelocity =
      Math.sign(velocity.current) *
      Math.min(Math.abs(velocity.current) * 20, 80);
    if (Math.abs(startVelocity) < 0.1) return;
    const friction = 0.985;
    let v = startVelocity;

    const inertiaLoop = () => {
      v *= friction;
      const currentZ = zoom.get();
      setCameraFromPanX(panX.get() + v, currentZ);
      if (Math.abs(v) > 0.1) {
        inertiaFrame.current = requestAnimationFrame(inertiaLoop);
      } else {
        inertiaFrame.current = null;
      }
    };
    inertiaFrame.current = requestAnimationFrame(inertiaLoop);
  };

  const [zoomRangeLabel, setZoomRangeLabel] = useState("");
  const prevLogZoom = useRef<number | null>(null);
  const zoomTickTimeoutRef = useRef<number | null>(null);
  const zoomLayoutTimeoutRef = useRef<number | null>(null);
  const zoomLabelTimeoutRef = useRef<number | null>(null);
  const zoomSettleTimeoutRef = useRef<number | null>(null);
  const pendingZoomLabelRef = useRef(logZoom.get());

  const flushZoomRangeLabel = (
    currentLogZoom = pendingZoomLabelRef.current,
  ) => {
    const nextLabel = formatZoomRangeLabel(currentLogZoom, getViewportWidth());
    startTransition(() => {
      setZoomRangeLabel((prev) => (prev !== nextLabel ? nextLabel : prev));
    });
  };

  const scheduleZoomRangeLabelUpdate = (currentLogZoom: number) => {
    pendingZoomLabelRef.current = currentLogZoom;
    if (zoomLabelTimeoutRef.current !== null) {
      return;
    }

    zoomLabelTimeoutRef.current = window.setTimeout(() => {
      zoomLabelTimeoutRef.current = null;
      flushZoomRangeLabel();
    }, ZOOM_UI_THROTTLE_MS);
  };

  const flushTickUpdate = () => {
    if (tickUpdateFrame.current !== null) return;
    tickUpdateFrame.current = requestAnimationFrame(() => {
      tickUpdateFrame.current = null;
      updateTicks();
    });
  };

  const scheduleZoomTickUpdate = () => {
    if (zoomTickTimeoutRef.current !== null) {
      return;
    }

    zoomTickTimeoutRef.current = window.setTimeout(() => {
      zoomTickTimeoutRef.current = null;
      flushTickUpdate();
    }, ZOOM_UI_THROTTLE_MS);
  };

  const flushZoomLayoutUpdate = () => {
    updateVisibleBounds();
    updateLayout();
  };

  const scheduleZoomLayoutUpdate = () => {
    if (zoomLayoutTimeoutRef.current !== null) {
      return;
    }

    zoomLayoutTimeoutRef.current = window.setTimeout(() => {
      zoomLayoutTimeoutRef.current = null;
      flushZoomLayoutUpdate();
    }, ZOOM_LAYOUT_THROTTLE_MS);
  };

  const scheduleZoomSettle = () => {
    if (zoomSettleTimeoutRef.current !== null) {
      window.clearTimeout(zoomSettleTimeoutRef.current);
    }

    zoomSettleTimeoutRef.current = window.setTimeout(() => {
      zoomSettleTimeoutRef.current = null;

      if (zoomTickTimeoutRef.current !== null) {
        window.clearTimeout(zoomTickTimeoutRef.current);
        zoomTickTimeoutRef.current = null;
      }
      if (zoomLayoutTimeoutRef.current !== null) {
        window.clearTimeout(zoomLayoutTimeoutRef.current);
        zoomLayoutTimeoutRef.current = null;
      }
      if (zoomLabelTimeoutRef.current !== null) {
        window.clearTimeout(zoomLabelTimeoutRef.current);
        zoomLabelTimeoutRef.current = null;
      }

      flushTickUpdate();
      flushZoomRangeLabel(logZoom.get());
      flushZoomLayoutUpdate();
    }, ZOOM_SETTLE_DELAY_MS);
  };

  useMotionValueEvent(panX, "change", () => {
    const bounds = updateVisibleBounds();
    const tickState = tickStateRef.current;
    if (!bounds || !tickState) {
      scheduleTickUpdate();
      return;
    }

    if (
      bounds.startYear < tickState.firstTick + tickState.interval ||
      bounds.endYear > tickState.lastTick - tickState.interval
    ) {
      scheduleTickUpdate();
    }
  });
  useMotionValueEvent(logZoom, "change", (val) => {
    if (
      prevLogZoom.current !== null &&
      Math.abs(val - prevLogZoom.current) < 1e-6
    )
      return;

    const now = performance.now();
    const prevZoomSample = prevZoomWarpSampleRef.current;
    if (
      prevZoomSample &&
      prevZoomSample.time < now &&
      !(isWarping && warpMode === "travel")
    ) {
      const delta = val - prevZoomSample.logZoom;
      const speed = Math.abs(delta) / (now - prevZoomSample.time);

      if (speed >= ZOOM_WARP_SPEED_THRESHOLD) {
        triggerZoomWarp(delta > 0 ? "zoom-in" : "zoom-out", val);
      }
    }
    prevZoomWarpSampleRef.current = { logZoom: val, time: now };

    prevLogZoom.current = val;
    scheduleZoomSettle();
    scheduleZoomTickUpdate();
    scheduleZoomLayoutUpdate();
    scheduleZoomRangeLabelUpdate(val);
  });

  useEffect(() => {
    const isBootstrapping = !hasBootstrappedRef.current;
    handleAutoFit(isBootstrapping);
    updateTicks();
    updateLayout(isBootstrapping);
    hasBootstrappedRef.current = true;
  }, [timelineEvents, searchQuery]);

  useEffect(() => {
    updateVisibleBounds();
    updateLayout();
  }, [selectedEventInfo?.id]);

  useEffect(() => {
    let frameId = 0;
    let sampleStart = performance.now();
    let frames = 0;

    const loop = (now: number) => {
      frames += 1;

      if (now - sampleStart >= 250) {
        const sampleDuration = now - sampleStart;
        const nextFps = Math.round((frames * 1000) / sampleDuration);
        setFps((prev) => (prev === nextFps ? prev : nextFps));
        sampleStart = now;
        frames = 0;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    flushZoomRangeLabel(logZoom.get());

    return () => {
      if (tickUpdateFrame.current !== null) {
        cancelAnimationFrame(tickUpdateFrame.current);
      }
      if (zoomTickTimeoutRef.current !== null) {
        window.clearTimeout(zoomTickTimeoutRef.current);
      }
      if (zoomLayoutTimeoutRef.current !== null) {
        window.clearTimeout(zoomLayoutTimeoutRef.current);
      }
      if (zoomLabelTimeoutRef.current !== null) {
        window.clearTimeout(zoomLabelTimeoutRef.current);
      }
      if (zoomSettleTimeoutRef.current !== null) {
        window.clearTimeout(zoomSettleTimeoutRef.current);
      }
    };
  }, []);

  // Animates camera to fit all currently-visible events with padding.
  // Call this any time you want to frame the visible event set.
  const handleAutoFit = (immediate = false) => {
    const visible = timelineEvents.filter((e) => {
      if (getEventTimelineYear(e) < BIG_BANG_YEAR) return false;
      return (
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
    animateCameraToEvents(visible, immediate);
  };

  const handleFocusCollapsedGroup = (group: CollapsedEventGroup) => {
    const groupedEvents = group.eventIds
      .map((eventId) => timelineEvents.find((event) => event.id === eventId))
      .filter((event): event is Event => event !== undefined);

    animateCameraToEvents(groupedEvents);
  };

  const handleDownloadCollection = async (collectionId: string) => {
    if (collectionEventsById[collectionId]) {
      addVisibleCollection(collectionId);
      return;
    }

    setDownloadingCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );

    try {
      const loadedEvents = await loadEventCollection(collectionId);
      addVisibleCollection(collectionId);
      setCollectionEventsById((prev) => ({
        ...prev,
        [collectionId]: loadedEvents,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setDownloadingCollectionIds((prev) =>
        prev.filter((id) => id !== collectionId),
      );
    }
  };

  const handleSyncCollection = async (collectionId: string) => {
    if (
      downloadingCollectionIds.includes(collectionId) ||
      !SYNCABLE_COLLECTION_IDS.includes(collectionId)
    ) {
      return;
    }

    setDownloadingCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );

    try {
      const loadedEvents = await loadEventCollection(collectionId);
      setCollectionEventsById((prev) => ({
        ...prev,
        [collectionId]: loadedEvents,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setDownloadingCollectionIds((prev) =>
        prev.filter((id) => id !== collectionId),
      );
    }
  };

  const handleSetCollectionVisibility = async (
    collectionId: string,
    visible: boolean,
  ) => {
    if (!visible) {
      setVisibleCollectionIds((prev) =>
        prev.filter((id) => id !== collectionId),
      );
      return;
    }

    addVisibleCollection(collectionId);
  };

  const handleFocusEvent = (event: Event) => {
    setSelectedEventInfo(event);
    focusedEventIdRef.current = event.id;
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;

    const eventYear = getEventTimelineYear(event);
    const currentZoom = Math.exp(logZoom.get());
    const currentYear = focusYear.get();

    // Determine target zoom. If event has a duration, zoom to show that neighborhood;
    // otherwise keep current zoom.
    const hasDuration = event.duration && event.duration > 0;
    let targetZoom = currentZoom;
    if (hasDuration) {
      const targetRangeYears = Math.min(
        Math.max(event.duration * 20, 1 / 365.25),
        1e9,
      );
      targetZoom = Math.max(
        MIN_ZOOM,
        Math.min(width / targetRangeYears, MAX_ZOOM),
      );
    }

    // Calculate pixel distance at the *final* zoom level — this is what the camera
    // actually needs to travel visually.
    const pixelDist = Math.abs(eventYear - currentYear) * targetZoom;

    // PIXEL_THRESHOLD: beyond ~2.5 screen widths of travel, activate warp overlay.
    const PIXEL_THRESHOLD = width * 2.5;

    if (pixelDist > PIXEL_THRESHOLD) {
      // Two-phase: Phase 1 — easeInOut to bring event to ~25% from left edge.
      // Phase 2 — spring from edge into center for a satisfying "arrival" feel.
      const totalDuration = Math.min(1.2, 0.3 + pixelDist / 4000);
      const phase1Duration = totalDuration * 0.7;

      setWarpMode("travel");
      setIsWarping(true);
      setWarpDirection(eventYear > currentYear ? -1 : 1);

      // Phase 1: event appears just inside the screen edge we are approaching from.
      // Warp LEFT (eventYear > currentYear): arriving from the right edge.
      // Warp RIGHT (eventYear < currentYear): arriving from the left edge.
      const isWarpingLeft = eventYear > currentYear;
      const phase1Target = isWarpingLeft ? width * 0.88 : width * 0.12;
      animate(focusPixel, phase1Target, {
        duration: phase1Duration,
        ease: "easeInOut",
      });
      animate(focusYear, eventYear, {
        duration: phase1Duration,
        ease: "easeInOut",
        onComplete: () => {
          setIsWarping(false);
          // Phase 2: spring the final leg into screen center.
          animate(focusPixel, width / 2, {
            type: "spring",
            stiffness: 300,
            damping: 30,
          });
        },
      });

      if (hasDuration) {
        targetLogZoom.current = Math.log(targetZoom);
        animate(logZoom, targetLogZoom.current, {
          duration: phase1Duration,
          ease: "easeInOut",
        });
      }
    } else {
      const opt = { type: "spring" as const, stiffness: 400, damping: 40 };
      if (hasDuration) {
        targetLogZoom.current = Math.log(targetZoom);
        animate(logZoom, targetLogZoom.current, opt);
      }
      animate(focusPixel, width / 2, opt);
      animate(focusYear, eventYear, opt);
    }
  };

  const handleFocusBigBang = () => {
    const bigBangEvent = timelineEvents.find(
      (event) => event.id === "big-bang",
    );
    if (bigBangEvent) {
      handleFocusEvent(bigBangEvent);
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const opt = { type: "spring" as const, stiffness: 400, damping: 40 };
    animate(focusPixel, width / 2, opt);
    animate(focusYear, BIG_BANG_YEAR, opt);
  };

  const zoomTrackRef = useRef<HTMLDivElement>(null);
  const zoomThumbY = useMotionValue(0);
  const isZoomDragging = useRef(false);

  useEffect(() => {
    let frame: number;
    const loop = () => {
      const y = zoomThumbY.get();
      if (y !== 0) {
        const zoomSpeed = -y * 0.0005; // Adjust speed
        const currentLogZoom = targetLogZoom.current;
        const newLogZoom = Math.max(
          Math.log(MIN_ZOOM),
          Math.min(Math.log(MAX_ZOOM), currentLogZoom + zoomSpeed),
        );

        targetLogZoom.current = newLogZoom;
        logZoom.set(newLogZoom);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      if (zoomWarpTimeoutRef.current !== null) {
        window.clearTimeout(zoomWarpTimeoutRef.current);
      }
    };
  }, []);

  const handleZoomDragStart = (e: React.PointerEvent) => {
    isZoomDragging.current = true;
    zoomTrackRef.current?.setPointerCapture(e.pointerId);

    const centerPixel = getViewportCenter();
    const centerYear = getCenterYear(centerPixel);
    focusPixel.set(centerPixel);
    focusYear.set(centerYear);
  };

  const handleZoomDragMove = (e: React.PointerEvent) => {
    if (!isZoomDragging.current || !zoomTrackRef.current) return;
    const rect = zoomTrackRef.current.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const deltaY = e.clientY - centerY;
    zoomThumbY.set(Math.max(-40, Math.min(40, deltaY)));
  };

  const handleZoomDragEnd = (e: React.PointerEvent) => {
    isZoomDragging.current = false;
    zoomTrackRef.current?.releasePointerCapture(e.pointerId);
    animate(zoomThumbY, 0, { type: "spring", stiffness: 400, damping: 40 });
  };

  const handleQuickZoom = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value || e.target.value === "current") return;
    const rangeInYears = parseFloat(e.target.value);
    const targetZoom = getViewportWidth() / rangeInYears;
    const newLogZoom = Math.max(
      Math.log(MIN_ZOOM),
      Math.min(Math.log(MAX_ZOOM), Math.log(targetZoom)),
    );

    const centerPixel = getViewportCenter();
    const centerYear = getCenterYear(centerPixel);
    focusPixel.set(centerPixel);
    focusYear.set(centerYear);

    targetLogZoom.current = newLogZoom;
    animate(logZoom, targetLogZoom.current, {
      type: "spring",
      stiffness: 400,
      damping: 40,
    });
  };

  const handleSaveEvent = (updatedEvent: Event) => {
    const ownerCollectionId = findEventCollectionId(updatedEvent.id);
    if (!ownerCollectionId) return;

    setCollectionEventsById((prev) => ({
      ...prev,
      [ownerCollectionId]: prev[ownerCollectionId].map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    }));
    setEditingEvent(null);
    setAddingEvent(false);
  };

  const handleStartAddEvent = () => {
    const targetCollectionId =
      visibleCollectionIds.length === 1 &&
      Object.prototype.hasOwnProperty.call(
        collectionEventsById,
        visibleCollectionIds[0],
      )
        ? visibleCollectionIds[0]
        : PLAYGROUND_COLLECTION.id;

    if (targetCollectionId === PLAYGROUND_COLLECTION.id) {
      ensurePlaygroundCollection();
      addVisibleCollection(PLAYGROUND_COLLECTION.id);
    }

    setAddingCollectionId(targetCollectionId);
    setAddingEvent(true);
  };

  const handleAddEvent = (newEvent: Event) => {
    const targetCollectionId = addingCollectionId ?? singleVisibleCollectionId;
    if (!targetCollectionId) return;

    setCollectionEventsById((prev) => ({
      ...prev,
      [targetCollectionId]: [...(prev[targetCollectionId] ?? []), newEvent],
    }));
    addVisibleCollection(targetCollectionId);
    setAddingCollectionId(null);
    setAddingEvent(false);
  };

  const handleCloseAddEvent = () => {
    setAddingCollectionId(null);
    setAddingEvent(false);
  };

  const createNewEvent = (): Event => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    description: "",
    emoji: "📅",
    time: [new Date().getFullYear(), null, null, null, null, null],
    groups: [],
    priority: 50,
  });

  return (
    <>
      <Sidebar
        collections={collections}
        onDownloadCollection={handleDownloadCollection}
        onSyncCollection={handleSyncCollection}
        syncableCollectionIds={SYNCABLE_COLLECTION_IDS}
        visibleCollectionIds={visibleCollectionIds}
        onSetCollectionVisibility={handleSetCollectionVisibility}
        downloadingCollectionIds={downloadingCollectionIds}
        collectionEventsById={collectionEventsById}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFocusEvent={handleFocusEvent}
        onEditEvent={setEditingEvent}
        onAddEvent={handleStartAddEvent}
      />

      <TimelineViewport
        containerRef={containerRef}
        focusPixel={focusPixel}
        focusYear={focusYear}
        zoom={zoom}
        ticks={ticks}
        timelineEvents={timelineEvents}
        collapsedGroups={collapsedGroups}
        visibleBounds={visibleBoundsRef.current}
        eventLayouts={eventLayouts.current}
        focusedEventId={selectedEventInfo?.id ?? null}
        getViewportWidth={getViewportWidth}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onFocusBigBang={handleFocusBigBang}
        onFocusEvent={handleFocusEvent}
        onFocusCollapsedGroup={handleFocusCollapsedGroup}
      />

      <FpsBadge fps={fps} />

      <ZoomController
        zoomRangeLabel={zoomRangeLabel}
        onQuickZoom={handleQuickZoom}
        zoomTrackRef={zoomTrackRef}
        zoomThumbY={zoomThumbY}
        onZoomDragStart={handleZoomDragStart}
        onZoomDragMove={handleZoomDragMove}
        onZoomDragEnd={handleZoomDragEnd}
      />

      {selectedEventInfo && (
        <EventInfoPanel
          event={selectedEventInfo}
          onFocus={() => {
            handleFocusEvent(selectedEventInfo);
          }}
          onEdit={() => {
            setEditingEvent(selectedEventInfo);
            setSelectedEventInfo(null);
            focusedEventIdRef.current = null;
          }}
          onClose={() => {
            setSelectedEventInfo(null);
            focusedEventIdRef.current = null;
          }}
        />
      )}

      {editingEvent && (
        <EventEditor
          mode="edit"
          event={editingEvent}
          onSave={handleSaveEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {addingEvent && (
        <EventEditor
          mode="create"
          event={createNewEvent()}
          onSave={handleAddEvent}
          onClose={handleCloseAddEvent}
        />
      )}

      <AutoFitButton onClick={() => handleAutoFit()} />

      {/* Warp speed overlay — active during long-distance camera jumps */}
      <WarpOverlay
        isWarping={isWarping}
        mode={warpMode}
        direction={warpDirection}
        zoom={zoom}
        zoomPivotX={focusPixel}
      />
    </>
  );
};
