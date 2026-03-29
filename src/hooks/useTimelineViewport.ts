import {
  ChangeEvent,
  PointerEvent,
  RefObject,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MotionValue,
  animate,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "motion/react";
import { BIG_BANG_YEAR } from "../constants";
import {
  Event,
  AutoFitRangeTarget,
  DateJumpTarget,
  ActivePointer,
  FpsSampleState,
  PinchGestureState,
  StoppableAnimation,
  CollapsedEventGroup,
  ExpandedCollapsedGroup,
  EventLayoutState,
  TimelineTick,
  WarpOverlayMode,
} from "../constants/types";
import {
  generateCalendarTimelineTickYears,
  getEventTimelineYear,
  getNiceInterval,
  getTimelineHighlightStep,
  isHighlightedTimelineTick,
} from "../helpers";
import {} from "../constants/types";
import {
  CAMERA_FIT_PADDING,
  CAMERA_SPRING,
  FOCUS_SPRING,
  FPS_SAMPLE_WINDOW_MS,
  LAYOUT_MARGIN_RATIO,
  LAYOUT_MIN_DISTANCE_PX,
  LAYOUT_ROW_OFFSET,
  LONG_TRAVEL_VIEWPORT_MULTIPLIER,
  MAX_ZOOM,
  MIN_ZOOM,
  TICK_OVERSCAN_INTERVALS,
  ZOOM_LAYOUT_THROTTLE_MS,
  ZOOM_SETTLE_DELAY_MS,
  ZOOM_UI_THROTTLE_MS,
  ZOOM_WARP_HIDE_MS,
  ZOOM_WARP_SPEED_THRESHOLD,
} from "../constants";
import {
  areCollapsedGroupsEqual,
  formatZoomRangeLabel,
  getAbsoluteYearFromDateJump,
  getStableTickLabelWidthEstimate,
  getTimelineLayoutLevels,
} from "../helpers";

type UseTimelineViewportParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  renderedTimelineEvents: Event[];
  selectedEventId: string | null;
  onSelectEvent: (event: Event | null) => void;
  setIsRulerActive: (value: boolean) => void;
};

const DEFAULT_LOG_ZOOM = Math.log(2000 / 13.8e9);

export const useTimelineViewport = ({
  containerRef,
  renderedTimelineEvents,
  selectedEventId,
  onSelectEvent,
  setIsRulerActive,
}: UseTimelineViewportParams) => {
  const [ticks, setTicks] = useState<TimelineTick[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedEventGroup[]>(
    [],
  );
  const [expandedCollapsedGroup, setExpandedCollapsedGroup] =
    useState<ExpandedCollapsedGroup | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const [warpMode, setWarpMode] = useState<WarpOverlayMode>("travel");
  const [warpDirection, setWarpDirection] = useState<1 | -1>(1);
  const [logicFps, setLogicFps] = useState(0);
  const [renderFps, setRenderFps] = useState(0);
  const [zoomRangeLabel, setZoomRangeLabel] = useState("");
  const [isViewportBeforeBigBang, setIsViewportBeforeBigBang] =
    useState(false);

  const logicFpsSampleRef = useRef<FpsSampleState>({
    sampleStart: 0,
    frames: 0,
  });
  const renderFpsSampleRef = useRef<FpsSampleState>({
    sampleStart: 0,
    frames: 0,
  });
  const focusedEventIdRef = useRef<string | null>(selectedEventId);
  const zoomWarpTimeoutRef = useRef<number | null>(null);
  const prevZoomWarpSampleRef = useRef<{
    logZoom: number;
    time: number;
  } | null>(null);
  const visibleBoundsRef = useRef({ startYear: 0, endYear: 1 });
  const tickStateRef = useRef<{
    interval: number;
    highlightStep: number;
    firstTick: number;
    lastTick: number;
  } | null>(null);
  const eventLayouts = useRef<Record<string, EventLayoutState>>({});
  const tickUpdateFrame = useRef<number | null>(null);
  const layoutUpdateFrame = useRef<number | null>(null);
  const prevLogZoom = useRef<number | null>(null);
  const zoomTickTimeoutRef = useRef<number | null>(null);
  const zoomLayoutTimeoutRef = useRef<number | null>(null);
  const zoomLabelTimeoutRef = useRef<number | null>(null);
  const zoomSettleTimeoutRef = useRef<number | null>(null);
  const pendingZoomLabelRef = useRef(DEFAULT_LOG_ZOOM);
  const hasBootstrappedRef = useRef(false);
  const collapsedGroupCycleRef = useRef<Record<string, number>>({});

  const focusPixel = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 500,
  );
  const focusYear = useMotionValue(0);
  const logZoom = useMotionValue(DEFAULT_LOG_ZOOM);
  const zoom = useTransform(logZoom, Math.exp);
  const panX = useTransform(
    () => focusPixel.get() - focusYear.get() * zoom.get(),
  );

  const targetLogZoom = useRef(DEFAULT_LOG_ZOOM);
  const focusPixelAnimationRef = useRef<StoppableAnimation | null>(null);
  const focusYearAnimationRef = useRef<StoppableAnimation | null>(null);
  const logZoomAnimationRef = useRef<StoppableAnimation | null>(null);

  const isDragging = useRef(false);
  const lastX = useRef(0);
  const lastDragTime = useRef(0);
  const pendingDragX = useRef<number | null>(null);
  const pendingDragTime = useRef(0);
  const dragFrame = useRef<number | null>(null);
  const velocity = useRef(0);
  const inertiaFrame = useRef<number | null>(null);
  const activePointersRef = useRef(new Map<number, ActivePointer>());
  const pinchGestureRef = useRef<PinchGestureState | null>(null);
  const suppressNextClickRef = useRef(false);
  const dragDistanceRef = useRef(0);

  const zoomTrackRef = useRef<HTMLDivElement>(null);
  const zoomThumbY = useMotionValue(0);
  const isZoomDragging = useRef(false);

  const timelineEventIndexMap = useMemo(
    () =>
      new Map(renderedTimelineEvents.map((event, index) => [event.id, index])),
    [renderedTimelineEvents],
  );

  const getViewportWidth = () =>
    containerRef.current?.clientWidth ??
    (typeof window !== "undefined" ? window.innerWidth : 1000);

  const getViewportHeight = () =>
    containerRef.current?.clientHeight ??
    (typeof window !== "undefined" ? window.innerHeight : 800);

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

  const animateFocusPixel = (
    target: number,
    options: Record<string, unknown>,
  ) => {
    focusPixelAnimationRef.current?.stop();
    focusPixelAnimationRef.current = animate(
      focusPixel,
      target,
      options,
    ) as unknown as StoppableAnimation;
  };

  const animateFocusYear = (
    target: number,
    options: Record<string, unknown>,
  ) => {
    focusYearAnimationRef.current?.stop();
    focusYearAnimationRef.current = animate(
      focusYear,
      target,
      options,
    ) as unknown as StoppableAnimation;
  };

  const animateLogZoom = (target: number, options: Record<string, unknown>) => {
    logZoomAnimationRef.current?.stop();
    logZoomAnimationRef.current = animate(
      logZoom,
      target,
      options,
    ) as unknown as StoppableAnimation;
  };

  const stopCameraAnimations = () => {
    focusPixelAnimationRef.current?.stop();
    focusYearAnimationRef.current?.stop();
    logZoomAnimationRef.current?.stop();
    focusPixelAnimationRef.current = null;
    focusYearAnimationRef.current = null;
    logZoomAnimationRef.current = null;
    targetLogZoom.current = logZoom.get();
    setIsWarping(false);
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
    setIsViewportBeforeBigBang((prev) => {
      const nextValue = endYear < BIG_BANG_YEAR;
      return prev === nextValue ? prev : nextValue;
    });

    return { width, currentZoom, startYear, endYear };
  };

  const updateLayout = (immediate = false) => {
    const currentZoom = Math.exp(logZoom.get());
    const minDistYears = LAYOUT_MIN_DISTANCE_PX / currentZoom;
    const layoutLevels = getTimelineLayoutLevels(getViewportHeight());
    const { startYear, endYear } = visibleBoundsRef.current;
    const margin = (endYear - startYear) * LAYOUT_MARGIN_RATIO;
    const layoutStart = startYear - margin;
    const layoutEnd = endYear + margin;

    const focusedId = focusedEventIdRef.current;
    const visibleEvents = renderedTimelineEvents.filter((event) => {
      const timelineYear = getEventTimelineYear(event);
      if (timelineYear < BIG_BANG_YEAR) return false;
      if (event.id === focusedId) return true;
      if (timelineYear < layoutStart || timelineYear > layoutEnd) return false;
      return true;
    });
    const visibleEventIds = new Set(visibleEvents.map((event) => event.id));

    const sortedEvents = [...visibleEvents].sort((a, b) => {
      if (a.id === focusedId) return -1;
      if (b.id === focusedId) return 1;
      return b.priority - a.priority;
    });

    const occupied: { year: number; level: number }[] = [];
    const nextCollapsedGroups: CollapsedEventGroup[] = [];

    sortedEvents.forEach((event) => {
      const layout = eventLayouts.current[event.id];
      if (!layout) return;

      const eventYear = getEventTimelineYear(event);
      const originalIndex = timelineEventIndexMap.get(event.id) as number;
      const side = originalIndex % 2 === 0 ? 1 : -1;

      let placedLevel: number | null = null;
      for (const level of layoutLevels) {
        const actualLevel = level * side;
        const collision = occupied.some(
          (occupiedEvent) =>
            occupiedEvent.level === actualLevel &&
            Math.abs(occupiedEvent.year - eventYear) < minDistYears,
        );
        if (!collision) {
          placedLevel = actualLevel;
          occupied.push({ year: eventYear, level: actualLevel });
          break;
        }
      }

      if (placedLevel !== null) {
        const targetY = placedLevel * LAYOUT_ROW_OFFSET;
        if (layout.targetY !== targetY) {
          layout.targetY = targetY;
          if (immediate) {
            layout.y.set(targetY);
          } else {
            animate(layout.y, targetY, {
              type: "spring",
              stiffness: 600,
              damping: 32,
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
        const existingGroup = nextCollapsedGroups.find(
          (group) =>
            group.side === side &&
            Math.abs(group.year - eventYear) < minDistYears,
        );

        if (existingGroup) {
          existingGroup.count += 1;
          existingGroup.eventIds.push(event.id);
        } else {
          nextCollapsedGroups.push({
            id: `${event.id}-collapsed`,
            year: eventYear,
            side,
            count: 1,
            eventIds: [event.id],
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

    renderedTimelineEvents.forEach((event) => {
      if (visibleEventIds.has(event.id)) return;
      const layout = eventLayouts.current[event.id];
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
    const targetHighlightedTicks = Math.max(
      2,
      Math.min(5, Math.round(width / 320)),
    );
    const highlightStep = getTimelineHighlightStep(
      Math.max(interval, visibleYears / targetHighlightedTicks),
    );

    const bufferedStartYear = startYear - interval * TICK_OVERSCAN_INTERVALS;
    const bufferedEndYear = endYear + interval * TICK_OVERSCAN_INTERVALS;
    const calendarTickYears = generateCalendarTimelineTickYears(
      bufferedStartYear,
      bufferedEndYear,
      interval,
    );
    const firstTick =
      calendarTickYears && calendarTickYears.length > 0
        ? calendarTickYears[0]
        : Math.floor(bufferedStartYear / interval) * interval;
    const tickYears =
      calendarTickYears ??
      (() => {
        const generatedTickYears: number[] = [];
        for (let year = firstTick; year <= bufferedEndYear; year += interval) {
          if (year >= BIG_BANG_YEAR) {
            generatedTickYears.push(year);
          }
        }
        return generatedTickYears;
      })();

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

    const nextTicks: TimelineTick[] = tickYears.map((year) => ({
      year,
      interval,
      isHighlighted: isHighlightedTimelineTick(year, highlightStep, interval),
    }));
    startTransition(() => {
      setTicks(nextTicks);
    });
  };

  const scheduleTickUpdate = () => {
    if (tickUpdateFrame.current !== null) return;
    tickUpdateFrame.current = requestAnimationFrame(() => {
      tickUpdateFrame.current = null;
      updateTicks();
    });
  };

  const scheduleLayoutUpdate = () => {
    if (layoutUpdateFrame.current !== null) return;
    layoutUpdateFrame.current = requestAnimationFrame(() => {
      layoutUpdateFrame.current = null;
      updateVisibleBounds();
      updateLayout();
    });
  };

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
    const years = events.map((event) => getEventTimelineYear(event));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    if (Math.abs(maxYear - minYear) < 1e-9) {
      const targetYear = minYear;
      const targetZoom = Math.min(Math.max(zoom.get() * 2, MIN_ZOOM), MAX_ZOOM);

      if (immediate) {
        stopCameraAnimations();
        focusPixel.set(width / 2);
        focusYear.set(targetYear);
        targetLogZoom.current = Math.log(targetZoom);
        logZoom.set(targetLogZoom.current);
      } else {
        stopCameraAnimations();
        animateFocusPixel(width / 2, CAMERA_SPRING);
        animateFocusYear(targetYear, CAMERA_SPRING);
        targetLogZoom.current = Math.log(targetZoom);
        animateLogZoom(targetLogZoom.current, CAMERA_SPRING);
      }
      return;
    }

    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min(
        (width * (1 - CAMERA_FIT_PADDING * 2)) / (maxYear - minYear),
        MAX_ZOOM,
      ),
    );
    const centerYear = (minYear + maxYear) / 2;
    const pixelDist = Math.abs(centerYear - focusYear.get()) * fitZoom;

    if (immediate) {
      stopCameraAnimations();
      focusPixel.set(width / 2);
      focusYear.set(centerYear);
      targetLogZoom.current = Math.log(fitZoom);
      logZoom.set(targetLogZoom.current);
    } else if (pixelDist > width * 0.5) {
      stopCameraAnimations();
      const duration = Math.min(1.0, 0.2 + pixelDist / 4000);
      animateFocusPixel(width / 2, { duration, ease: "easeInOut" });
      animateFocusYear(centerYear, { duration, ease: "easeInOut" });
      targetLogZoom.current = Math.log(fitZoom);
      animateLogZoom(targetLogZoom.current, {
        duration,
        ease: "easeInOut",
      });
    } else {
      stopCameraAnimations();
      animateFocusPixel(width / 2, CAMERA_SPRING);
      animateFocusYear(centerYear, CAMERA_SPRING);
      targetLogZoom.current = Math.log(fitZoom);
      animateLogZoom(targetLogZoom.current, CAMERA_SPRING);
    }
  };

  const animateCameraToYearRange = (
    startYear: number,
    endYear: number,
    immediate = false,
  ) => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const minYear = Math.min(startYear, endYear);
    const maxYear = Math.max(startYear, endYear);
    const rangeYears = Math.max(maxYear - minYear, 1);
    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min((width * (1 - CAMERA_FIT_PADDING * 2)) / rangeYears, MAX_ZOOM),
    );
    const centerYear = (minYear + maxYear) / 2;
    const pixelDist = Math.abs(centerYear - focusYear.get()) * fitZoom;

    if (immediate) {
      stopCameraAnimations();
      focusPixel.set(width / 2);
      focusYear.set(centerYear);
      targetLogZoom.current = Math.log(fitZoom);
      logZoom.set(targetLogZoom.current);
      return;
    }

    if (pixelDist > width * 0.5) {
      stopCameraAnimations();
      const duration = Math.min(1.0, 0.2 + pixelDist / 4000);
      animateFocusPixel(width / 2, { duration, ease: "easeInOut" });
      animateFocusYear(centerYear, { duration, ease: "easeInOut" });
      targetLogZoom.current = Math.log(fitZoom);
      animateLogZoom(targetLogZoom.current, {
        duration,
        ease: "easeInOut",
      });
      return;
    }

    stopCameraAnimations();
    animateFocusPixel(width / 2, CAMERA_SPRING);
    animateFocusYear(centerYear, CAMERA_SPRING);
    targetLogZoom.current = Math.log(fitZoom);
    animateLogZoom(targetLogZoom.current, CAMERA_SPRING);
  };

  const handleAutoFit = (immediate = false) => {
    const visible = renderedTimelineEvents.filter(
      (event) => getEventTimelineYear(event) >= BIG_BANG_YEAR,
    );
    if (visible.length === 0) return;

    const years = visible.map((event) => getEventTimelineYear(event));
    animateCameraToYearRange(Math.min(...years), Math.max(...years), immediate);
  };

  const handleAutoFitRange = ({ startYear, endYear }: AutoFitRangeTarget) => {
    animateCameraToYearRange(startYear, endYear);
  };

  const clearFocusedEvent = () => {
    onSelectEvent(null);
    setIsRulerActive(false);
    focusedEventIdRef.current = null;
    setExpandedCollapsedGroup(null);
  };

  const handleFocusCollapsedGroup = (group: CollapsedEventGroup) => {
    const groupedEvents = group.eventIds
      .map((eventId) =>
        renderedTimelineEvents.find((event) => event.id === eventId),
      )
      .filter((event): event is Event => event !== undefined);

    if (groupedEvents.length === 0) return;

    const sortedGroupEvents = [...groupedEvents].sort((left, right) => {
      const leftIndex = timelineEventIndexMap.get(left.id) ?? 0;
      const rightIndex = timelineEventIndexMap.get(right.id) ?? 0;
      return leftIndex - rightIndex;
    });

    const minYear = Math.min(
      ...sortedGroupEvents.map((event) => getEventTimelineYear(event)),
    );
    const maxYear = Math.max(
      ...sortedGroupEvents.map((event) => getEventTimelineYear(event)),
    );

    if (Math.abs(maxYear - minYear) < 1e-9) {
      const shouldExpandHorizontally = sortedGroupEvents.length > 0;
      if (shouldExpandHorizontally) {
        setExpandedCollapsedGroup((currentGroup) => {
          if (
            currentGroup &&
            currentGroup.side === group.side &&
            Math.abs(currentGroup.year - group.year) < 1e-9
          ) {
            return null;
          }

          return {
            id: `${group.side}:${group.year}`,
            year: group.year,
            side: group.side,
            eventIds: sortedGroupEvents.map((event) => event.id),
          };
        });
        return;
      }

      const cycleKey = `${group.side}:${group.year}`;
      const nextIndex = collapsedGroupCycleRef.current[cycleKey] ?? 0;
      const nextEvent = sortedGroupEvents[nextIndex % sortedGroupEvents.length];
      if (!nextEvent) return;

      collapsedGroupCycleRef.current[cycleKey] = nextIndex + 1;

      onSelectEvent(nextEvent);
      setIsRulerActive(false);
      focusedEventIdRef.current = nextEvent.id;
      setExpandedCollapsedGroup(null);

      const width = getViewportWidth();
      stopCameraAnimations();
      animateFocusPixel(width / 2, FOCUS_SPRING);
      animateFocusYear(group.year, FOCUS_SPRING);

      const boostedZoom = Math.max(zoom.get(), MAX_ZOOM);
      targetLogZoom.current = Math.log(boostedZoom);
      animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
      return;
    }

    setExpandedCollapsedGroup(null);
    animateCameraToEvents(sortedGroupEvents);
  };

  const handleFocusEvent = (event: Event) => {
    onSelectEvent(event);
    setIsRulerActive(false);
    focusedEventIdRef.current = event.id;
    setExpandedCollapsedGroup(null);

    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;

    const eventYear = getEventTimelineYear(event);
    const currentZoom = Math.exp(logZoom.get());
    const currentYear = focusYear.get();

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

    const pixelDist = Math.abs(eventYear - currentYear) * targetZoom;
    const isLongTravel = pixelDist > width * LONG_TRAVEL_VIEWPORT_MULTIPLIER;

    stopCameraAnimations();

    if (isLongTravel) {
      const duration = Math.min(1.2, 0.3 + pixelDist / 4000);
      setWarpMode("travel");
      setIsWarping(true);
      setWarpDirection(eventYear > currentYear ? -1 : 1);

      const travelOptions = {
        duration,
        ease: "easeInOut",
      } as const;

      animateFocusPixel(width / 2, travelOptions);
      animateFocusYear(eventYear, {
        ...travelOptions,
        onComplete: () => {
          setIsWarping(false);
        },
      });

      if (hasDuration) {
        targetLogZoom.current = Math.log(targetZoom);
        animateLogZoom(targetLogZoom.current, travelOptions);
      }

      return;
    }

    if (hasDuration) {
      targetLogZoom.current = Math.log(targetZoom);
      animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
    }
    animateFocusPixel(width / 2, FOCUS_SPRING);
    animateFocusYear(eventYear, FOCUS_SPRING);
  };

  const handleFocusBigBang = () => {
    const bigBangEvent = renderedTimelineEvents.find(
      (event) => event.id === "big-bang",
    );
    if (bigBangEvent) {
      handleFocusEvent(bigBangEvent);
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    stopCameraAnimations();
    animateFocusPixel(width / 2, FOCUS_SPRING);
    animateFocusYear(BIG_BANG_YEAR, FOCUS_SPRING);
  };

  const handleWheel = (event: globalThis.WheelEvent) => {
    event.preventDefault();

    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }

    stopCameraAnimations();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    const currentZoom = zoom.get();
    const hasZoomIntent = Math.abs(event.deltaY) > 0;
    const shouldApplyHorizontalPan =
      Math.abs(event.deltaX) > 0 &&
      (!hasZoomIntent || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.6);
    const nextPanX = shouldApplyHorizontalPan
      ? panX.get() - event.deltaX
      : panX.get();

    setCameraFromPanX(nextPanX, currentZoom, mouseX);

    if (Math.abs(event.deltaY) > 0) {
      focusPixel.set(mouseX);
      focusYear.set((mouseX - nextPanX) / currentZoom);

      const targetZoom = Math.exp(targetLogZoom.current);
      const zoomFactor = Math.pow(1.002, Math.abs(event.deltaY));
      const direction = event.deltaY < 0 ? 1 : -1;
      let newZoom =
        direction > 0 ? targetZoom * zoomFactor : targetZoom / zoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      targetLogZoom.current = Math.log(newZoom);
      animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
    }
  };

  const getYearAtPixel = (pixel: number) => (pixel - panX.get()) / zoom.get();

  const clearInertia = () => {
    if (inertiaFrame.current === null) return;
    cancelAnimationFrame(inertiaFrame.current);
    inertiaFrame.current = null;
  };

  const clearDragFrame = () => {
    if (dragFrame.current === null) return;
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
  };

  const getGesturePointers = () => {
    const pointers = Array.from(
      activePointersRef.current.values(),
    ) as ActivePointer[];
    if (pointers.length < 2) return null;
    return [pointers[0]!, pointers[1]!] as const;
  };

  const getFirstActivePointer = () => {
    const iterator = activePointersRef.current.values().next();
    return iterator.done ? null : (iterator.value as ActivePointer);
  };

  const getPinchMetrics = (first: ActivePointer, second: ActivePointer) => ({
    centerX: (first.clientX + second.clientX) / 2,
    distance: Math.hypot(
      first.clientX - second.clientX,
      first.clientY - second.clientY,
    ),
  });

  const startDragAt = (clientX: number) => {
    isDragging.current = true;
    velocity.current = 0;
    dragDistanceRef.current = 0;
    const now = performance.now();
    lastDragTime.current = now;
    lastX.current = clientX;
    pendingDragX.current = null;
    pendingDragTime.current = now;
  };

  const resetDragState = () => {
    isDragging.current = false;
    velocity.current = 0;
    pendingDragX.current = null;
    pendingDragTime.current = 0;
    dragDistanceRef.current = 0;
  };

  const beginPinchGesture = () => {
    const pointers = getGesturePointers();
    if (!pointers) return;

    const [first, second] = pointers;
    const { centerX, distance } = getPinchMetrics(first, second);
    if (distance <= 0) return;

    pinchGestureRef.current = {
      anchorYear: getYearAtPixel(centerX),
      startDistance: distance,
      startLogZoom: logZoom.get(),
    };

    focusPixel.set(centerX);
    focusYear.set(pinchGestureRef.current.anchorYear);
    suppressNextClickRef.current = true;
  };

  const updatePinchGesture = () => {
    const pinchGesture = pinchGestureRef.current;
    const pointers = getGesturePointers();
    if (!pinchGesture || !pointers) return;

    const [first, second] = pointers;
    const { centerX, distance } = getPinchMetrics(first, second);
    if (distance <= 0) return;

    const nextLogZoom = Math.max(
      Math.log(MIN_ZOOM),
      Math.min(
        Math.log(MAX_ZOOM),
        pinchGesture.startLogZoom +
          Math.log(distance / pinchGesture.startDistance),
      ),
    );

    focusPixel.set(centerX);
    focusYear.set(pinchGesture.anchorYear);
    targetLogZoom.current = nextLogZoom;
    logZoom.set(nextLogZoom);
  };

  const consumeClickSuppression = () => {
    const shouldSuppress = suppressNextClickRef.current;
    suppressNextClickRef.current = false;
    return shouldSuppress;
  };

  const flushPendingDrag = () => {
    if (!isDragging.current || pendingDragX.current === null) return;

    const nextX = pendingDragX.current;
    const now = pendingDragTime.current || performance.now();
    const deltaX = nextX - lastX.current;
    const dt = now - lastDragTime.current;

    if (dt > 0) velocity.current = deltaX / dt;
    dragDistanceRef.current += Math.abs(deltaX);
    if (dragDistanceRef.current > 6) {
      suppressNextClickRef.current = true;
    }

    const currentZoom = zoom.get();
    setCameraFromPanX(panX.get() + deltaX, currentZoom);

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

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    stopCameraAnimations();
    clearInertia();
    clearDragFrame();
    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    containerRef.current?.setPointerCapture(event.pointerId);

    if (activePointersRef.current.size >= 2) {
      flushPendingDrag();
      resetDragState();
      beginPinchGesture();
      return;
    }

    pinchGestureRef.current = null;
    suppressNextClickRef.current = false;
    startDragAt(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    if (!pinchGestureRef.current && activePointersRef.current.size >= 2) {
      beginPinchGesture();
    }

    if (pinchGestureRef.current) {
      updatePinchGesture();
      return;
    }

    if (!isDragging.current) return;
    pendingDragX.current = event.clientX;
    pendingDragTime.current = performance.now();
    scheduleDragFrame();
  };

  const handlePointerUp = (event: PointerEvent) => {
    activePointersRef.current.delete(event.pointerId);
    clearDragFrame();
    flushPendingDrag();
    const finalVelocity = velocity.current;

    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }

    if (pinchGestureRef.current) {
      if (activePointersRef.current.size >= 2) {
        beginPinchGesture();
        updatePinchGesture();
        return;
      }

      pinchGestureRef.current = null;

      if (activePointersRef.current.size === 1) {
        const remainingPointer = getFirstActivePointer();
        if (remainingPointer) {
          startDragAt(remainingPointer.clientX);
          return;
        }
      }

      resetDragState();
      return;
    }

    resetDragState();

    const startVelocity =
      Math.sign(finalVelocity) * Math.min(Math.abs(finalVelocity) * 20, 80);
    if (Math.abs(startVelocity) < 0.1) return;
    const friction = 0.985;
    let currentVelocity = startVelocity;

    const inertiaLoop = () => {
      currentVelocity *= friction;
      const currentZoom = zoom.get();
      setCameraFromPanX(panX.get() + currentVelocity, currentZoom);
      if (Math.abs(currentVelocity) > 0.1) {
        inertiaFrame.current = requestAnimationFrame(inertiaLoop);
      } else {
        inertiaFrame.current = null;
      }
    };
    inertiaFrame.current = requestAnimationFrame(inertiaLoop);
  };

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

  const flushZoomLayoutUpdate = () => {
    updateVisibleBounds();
    updateLayout();
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

  const recordRenderFrame = (now: number) => {
    const sample = renderFpsSampleRef.current;
    if (sample.sampleStart === 0) {
      sample.sampleStart = now;
    }
    sample.frames += 1;

    if (now - sample.sampleStart >= FPS_SAMPLE_WINDOW_MS) {
      const sampleDuration = now - sample.sampleStart;
      const nextFps = Math.round((sample.frames * 1000) / sampleDuration);
      setRenderFps((prev) => (prev === nextFps ? prev : nextFps));
      sample.sampleStart = now;
      sample.frames = 0;
    }
  };

  const handleZoomDragStart = (event: PointerEvent<HTMLDivElement>) => {
    stopCameraAnimations();
    isZoomDragging.current = true;
    zoomTrackRef.current?.setPointerCapture(event.pointerId);

    const centerPixel = getViewportCenter();
    const centerYear = getCenterYear(centerPixel);
    focusPixel.set(centerPixel);
    focusYear.set(centerYear);
  };

  const handleZoomDragMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isZoomDragging.current || !zoomTrackRef.current) return;
    const rect = zoomTrackRef.current.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const deltaY = event.clientY - centerY;
    zoomThumbY.set(Math.max(-40, Math.min(40, deltaY)));
  };

  const handleZoomDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    isZoomDragging.current = false;
    zoomTrackRef.current?.releasePointerCapture(event.pointerId);
    animate(zoomThumbY, 0, FOCUS_SPRING);
  };

  const handleQuickZoom = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!event.target.value || event.target.value === "current") return;
    stopCameraAnimations();
    const rangeInYears = parseFloat(event.target.value);
    const targetZoom = getViewportWidth() / rangeInYears;
    const nextLogZoom = Math.max(
      Math.log(MIN_ZOOM),
      Math.min(Math.log(MAX_ZOOM), Math.log(targetZoom)),
    );

    const centerPixel = getViewportCenter();
    const centerYear = getCenterYear(centerPixel);
    focusPixel.set(centerPixel);
    focusYear.set(centerYear);

    targetLogZoom.current = nextLogZoom;
    animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
  };

  const handleJumpToDate = (target: DateJumpTarget) => {
    const targetYear = getAbsoluteYearFromDateJump(target);
    const width = getViewportWidth();
    const currentZoom = Math.exp(logZoom.get());
    const pixelDist = Math.abs(targetYear - focusYear.get()) * currentZoom;

    clearFocusedEvent();
    stopCameraAnimations();

    if (pixelDist > width * LONG_TRAVEL_VIEWPORT_MULTIPLIER) {
      const duration = Math.min(1.2, 0.3 + pixelDist / 4000);
      const phase1Duration = duration * 0.7;
      const isWarpingLeft = targetYear > focusYear.get();

      setWarpMode("travel");
      setIsWarping(true);
      setWarpDirection(isWarpingLeft ? -1 : 1);

      animateFocusPixel(isWarpingLeft ? width * 0.88 : width * 0.12, {
        duration: phase1Duration,
        ease: "easeInOut",
      });
      animateFocusYear(targetYear, {
        duration: phase1Duration,
        ease: "easeInOut",
        onComplete: () => {
          setIsWarping(false);
          animateFocusPixel(width / 2, CAMERA_SPRING);
        },
      });
      return;
    }

    animateFocusPixel(width / 2, FOCUS_SPRING);
    animateFocusYear(targetYear, FOCUS_SPRING);
  };

  const handleMinimapSeek = (targetYear: number) => {
    clearInertia();
    clearDragFrame();
    resetDragState();
    pinchGestureRef.current = null;
    activePointersRef.current.clear();
    stopCameraAnimations();

    const centerPixel = getViewportCenter();
    focusPixel.set(centerPixel);
    focusYear.set(targetYear);
  };

  useEffect(() => {
    focusedEventIdRef.current = selectedEventId;
    setExpandedCollapsedGroup(null);
  }, [selectedEventId]);

  useEffect(() => {
    const nextEventIds = new Set(
      renderedTimelineEvents.map((event) => event.id),
    );

    for (const eventId of Object.keys(eventLayouts.current)) {
      if (!nextEventIds.has(eventId)) {
        delete eventLayouts.current[eventId];
      }
    }

    renderedTimelineEvents.forEach((event) => {
      if (!eventLayouts.current[event.id]) {
        eventLayouts.current[event.id] = {
          y: new MotionValue(0),
          opacity: new MotionValue(0),
          targetY: 0,
          targetOpacity: 0,
        };
      }
    });
  }, [renderedTimelineEvents]);

  useEffect(() => {
    setExpandedCollapsedGroup((currentGroup) => {
      if (!currentGroup) return currentGroup;

      const nextEventIds = new Set(
        renderedTimelineEvents.map((event) => event.id),
      );
      const hasAllEvents = currentGroup.eventIds.every((eventId) =>
        nextEventIds.has(eventId),
      );

      return hasAllEvents ? currentGroup : null;
    });
  }, [renderedTimelineEvents]);

  useMotionValueEvent(panX, "change", () => {
    const bounds = updateVisibleBounds();
    const tickState = tickStateRef.current;
    if (!bounds || !tickState) {
      scheduleLayoutUpdate();
      scheduleTickUpdate();
      return;
    }

    scheduleLayoutUpdate();

    if (
      bounds.startYear < tickState.firstTick + tickState.interval ||
      bounds.endYear > tickState.lastTick - tickState.interval
    ) {
      scheduleTickUpdate();
    }
  });

  useMotionValueEvent(logZoom, "change", (value) => {
    if (
      prevLogZoom.current !== null &&
      Math.abs(value - prevLogZoom.current) < 1e-6
    ) {
      return;
    }

    const now = performance.now();
    const prevZoomSample = prevZoomWarpSampleRef.current;
    if (
      prevZoomSample &&
      prevZoomSample.time < now &&
      !(isWarping && warpMode === "travel")
    ) {
      const delta = value - prevZoomSample.logZoom;
      const speed = Math.abs(delta) / (now - prevZoomSample.time);

      if (speed >= ZOOM_WARP_SPEED_THRESHOLD) {
        triggerZoomWarp(delta > 0 ? "zoom-in" : "zoom-out", value);
      }
    }
    prevZoomWarpSampleRef.current = { logZoom: value, time: now };

    prevLogZoom.current = value;
    scheduleZoomSettle();
    scheduleZoomTickUpdate();
    scheduleZoomLayoutUpdate();
    scheduleZoomRangeLabelUpdate(value);
  });

  useEffect(() => {
    const isBootstrapping = !hasBootstrappedRef.current;
    handleAutoFit(isBootstrapping);
    updateTicks();
    updateLayout(isBootstrapping);
    hasBootstrappedRef.current = true;
  }, [renderedTimelineEvents]);

  useEffect(() => {
    updateVisibleBounds();
    updateLayout();
  }, [selectedEventId]);

  useEffect(() => {
    let frameId = 0;

    const loop = (now: number) => {
      const sample = logicFpsSampleRef.current;
      if (sample.sampleStart === 0) {
        sample.sampleStart = now;
      }
      sample.frames += 1;

      if (now - sample.sampleStart >= FPS_SAMPLE_WINDOW_MS) {
        const sampleDuration = now - sample.sampleStart;
        const nextFps = Math.round((sample.frames * 1000) / sampleDuration);
        setLogicFps((prev) => (prev === nextFps ? prev : nextFps));
        sample.sampleStart = now;
        sample.frames = 0;
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
      if (layoutUpdateFrame.current !== null) {
        cancelAnimationFrame(layoutUpdateFrame.current);
      }
      if (dragFrame.current !== null) {
        cancelAnimationFrame(dragFrame.current);
      }
      if (inertiaFrame.current !== null) {
        cancelAnimationFrame(inertiaFrame.current);
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
      if (zoomWarpTimeoutRef.current !== null) {
        window.clearTimeout(zoomWarpTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const loop = () => {
      const thumbY = zoomThumbY.get();
      if (thumbY !== 0) {
        const zoomSpeed = -thumbY * 0.0005;
        const currentLogZoom = targetLogZoom.current;
        const nextLogZoom = Math.max(
          Math.log(MIN_ZOOM),
          Math.min(Math.log(MAX_ZOOM), currentLogZoom + zoomSpeed),
        );

        targetLogZoom.current = nextLogZoom;
        logZoom.set(nextLogZoom);
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
  }, [logZoom, zoomThumbY]);

  return {
    focusPixel,
    focusYear,
    zoom,
    ticks,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds: visibleBoundsRef.current,
    eventLayouts: eventLayouts.current,
    logicFps,
    renderFps,
    zoomRangeLabel,
    zoomTrackRef,
    zoomThumbY,
    isViewportBeforeBigBang,
    isWarping,
    warpMode,
    warpDirection,
    recordRenderFrame,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeClickSuppression,
    handleFocusBigBang,
    handleFocusEvent,
    handleFocusCollapsedGroup,
    handleAutoFit,
    handleAutoFitRange,
    handleQuickZoom,
    handleJumpToDate,
    handleMinimapSeek,
    handleZoomDragStart,
    handleZoomDragMove,
    handleZoomDragEnd,
    clearFocusedEvent,
  };
};
