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
  TimelineOrientation,
  VerticalTimeDirection,
  VerticalWheelBehavior,
} from "../constants/types";
import {
  generateCalendarTimelineTickYears,
  getEventTimelineYear,
  getNiceInterval,
  getTimelineHighlightStep,
  isHighlightedTimelineTick,
} from "../helpers";
import {
  CAMERA_FIT_PADDING,
  CAMERA_SPRING,
  EVENT_LAYOUT_SPRING,
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
import { getSearchableLocalizedText } from "../helpers/localization";

type UseTimelineViewportParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  renderedTimelineEvents: Event[];
  selectedEventId: string | null;
  onSelectEvent: (event: Event | null) => void;
  onViewportChange?: (viewport: { focusYear: number; logZoom: number }) => void;
  setIsRulerActive: (value: boolean) => void;
  orientation: TimelineOrientation;
  verticalWheelBehavior: VerticalWheelBehavior;
  verticalTimeDirection: VerticalTimeDirection;
  /** Optional: deep-link focus year. When provided, viewport boots to this year instead of auto-fit. */
  initialFocusYear?: number | null;
  /** Optional: deep-link log-zoom. When provided, viewport boots to this zoom instead of auto-fit. */
  initialLogZoom?: number | null;
};

const DEFAULT_LOG_ZOOM = Math.log(2000 / 13.8e9);
const WHEEL_PINCH_GESTURE_GAP_MS = 140;

export const useTimelineViewport = ({
  containerRef,
  renderedTimelineEvents,
  selectedEventId,
  onSelectEvent,
  onViewportChange,
  setIsRulerActive,
  orientation,
  verticalWheelBehavior,
  verticalTimeDirection,
  initialFocusYear = null,
  initialLogZoom = null,
}: UseTimelineViewportParams) => {
  const axisDirection =
    orientation === "vertical" && verticalTimeDirection === "up" ? -1 : 1;
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
  const [isViewportBeforeBigBang, setIsViewportBeforeBigBang] = useState(false);

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
  const persistViewportTimeoutRef = useRef<number | null>(null);
  const pendingZoomLabelRef = useRef(DEFAULT_LOG_ZOOM);
  const hasBootstrappedRef = useRef(false);
  const collapsedGroupCycleRef = useRef<Record<string, number>>({});

  const focusPixel = useMotionValue(
    typeof window !== "undefined"
      ? (orientation === "horizontal"
          ? window.innerWidth / 2
          : window.innerHeight / 2)
      : 500,
  );
  const focusYear = useMotionValue(0);
  const logZoom = useMotionValue(DEFAULT_LOG_ZOOM);
  const zoom = useTransform(logZoom, Math.exp);
  const panX = useTransform(
    () => focusPixel.get() - focusYear.get() * zoom.get() * axisDirection,
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
  const wheelPinchGestureRef = useRef<{
    anchorPixel: number;
    anchorYear: number;
    lastEventTime: number;
  } | null>(null);
  const wheelPanResidualRef = useRef(0);
  const wheelPanAnchorPixelRef = useRef<number | null>(null);
  const wheelPanFrameRef = useRef<number | null>(null);
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

  const getViewportPrimarySize = () =>
    orientation === "horizontal" ? getViewportWidth() : getViewportHeight();

  const getViewportCrossSize = () =>
    orientation === "horizontal" ? getViewportHeight() : getViewportWidth();

  const getViewportCenter = () => getViewportPrimarySize() / 2;

  const getPrimaryPixelFromClient = (
    rect: DOMRect,
    clientX: number,
    clientY: number,
  ) => (orientation === "horizontal" ? clientX - rect.left : clientY - rect.top);

  const getPrimaryPointerValue = (clientX: number, clientY: number) =>
    orientation === "horizontal" ? clientX : clientY;

  const clampLogZoom = (nextLogZoom: number) =>
    Math.max(Math.log(MIN_ZOOM), Math.min(Math.log(MAX_ZOOM), nextLogZoom));

  const normalizeWheelDelta = (delta: number, deltaMode: number) => {
    switch (deltaMode) {
      case 1:
        return delta * 16;
      case 2:
        return delta * getViewportPrimarySize();
      default:
        return delta;
    }
  };

  const flushViewportPersistence = () => {
    if (!onViewportChange) return;

    onViewportChange({
      focusYear: focusYear.get(),
      logZoom: logZoom.get(),
    });
  };

  const scheduleViewportPersistence = () => {
    if (!onViewportChange || !hasBootstrappedRef.current) return;

    if (persistViewportTimeoutRef.current !== null) {
      window.clearTimeout(persistViewportTimeoutRef.current);
    }

    persistViewportTimeoutRef.current = window.setTimeout(() => {
      persistViewportTimeoutRef.current = null;
      flushViewportPersistence();
    }, 150);
  };

  const setCameraFromPanX = (
    nextPanX: number,
    currentZoom: number,
    anchorPixel = focusPixel.get(),
  ) => {
    focusPixel.set(anchorPixel);
    focusYear.set((anchorPixel - nextPanX) / (currentZoom * axisDirection));
    return nextPanX;
  };

  const getYearFromPan = (
    pixel: number,
    currentPanX = panX.get(),
    currentZoom = zoom.get(),
  ) => (pixel - currentPanX) / (currentZoom * axisDirection);

  const getCenterYear = (centerPixel = getViewportCenter()) =>
    getYearFromPan(centerPixel);

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

    const primarySize = getViewportPrimarySize();
    const currentX = panX.get();
    const currentZoom = Math.exp(logZoom.get());

    const startYearRaw =
      (-primarySize - currentX) / (currentZoom * axisDirection);
    const endYearRaw =
      (primarySize * 2 - currentX) / (currentZoom * axisDirection);
    const startYear = Math.min(startYearRaw, endYearRaw);
    const endYear = Math.max(startYearRaw, endYearRaw);
    visibleBoundsRef.current = { startYear, endYear };
    setIsViewportBeforeBigBang((prev) => {
      const nextValue = endYear < BIG_BANG_YEAR;
      return prev === nextValue ? prev : nextValue;
    });

    return { primarySize, currentZoom, startYear, endYear };
  };

  const updateLayout = (immediate = false) => {
    const currentZoom = Math.exp(logZoom.get());
    const minDistYears = LAYOUT_MIN_DISTANCE_PX / currentZoom;
    const layoutLevels = getTimelineLayoutLevels(getViewportCrossSize());
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
            animate(layout.y, targetY, EVENT_LAYOUT_SPRING);
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
    const { primarySize, currentZoom, startYear, endYear } = bounds;

    const visibleYears = primarySize / currentZoom;
    const roughInterval = getNiceInterval(visibleYears / 10);
    const estimatedWidthPx = getStableTickLabelWidthEstimate(roughInterval);

    const maxTicks = Math.max(2, Math.floor(primarySize / estimatedWidthPx));
    const idealInterval = visibleYears / maxTicks;
    const interval = getNiceInterval(idealInterval);
    const targetHighlightedTicks = Math.max(
      2,
      Math.min(5, Math.round(primarySize / 320)),
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

    const primarySize = getViewportPrimarySize();
    const years = events.map((event) => getEventTimelineYear(event));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    if (Math.abs(maxYear - minYear) < 1e-9) {
      const targetYear = minYear;
      const targetZoom = Math.min(Math.max(zoom.get() * 2, MIN_ZOOM), MAX_ZOOM);

      if (immediate) {
        stopCameraAnimations();
        focusPixel.set(primarySize / 2);
        focusYear.set(targetYear);
        targetLogZoom.current = Math.log(targetZoom);
        logZoom.set(targetLogZoom.current);
      } else {
        stopCameraAnimations();
        animateFocusPixel(primarySize / 2, CAMERA_SPRING);
        animateFocusYear(targetYear, CAMERA_SPRING);
        targetLogZoom.current = Math.log(targetZoom);
        animateLogZoom(targetLogZoom.current, CAMERA_SPRING);
      }
      return;
    }

    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min(
        (primarySize * (1 - CAMERA_FIT_PADDING * 2)) / (maxYear - minYear),
        MAX_ZOOM,
      ),
    );
    const centerYear = (minYear + maxYear) / 2;
    const pixelDist = Math.abs(centerYear - focusYear.get()) * fitZoom;

    if (immediate) {
      stopCameraAnimations();
      focusPixel.set(primarySize / 2);
      focusYear.set(centerYear);
      targetLogZoom.current = Math.log(fitZoom);
      logZoom.set(targetLogZoom.current);
    } else if (pixelDist > primarySize * 0.5) {
      stopCameraAnimations();
      const duration = Math.min(1.0, 0.2 + pixelDist / 4000);
      animateFocusPixel(primarySize / 2, { duration, ease: "easeInOut" });
      animateFocusYear(centerYear, { duration, ease: "easeInOut" });
      targetLogZoom.current = Math.log(fitZoom);
      animateLogZoom(targetLogZoom.current, {
        duration,
        ease: "easeInOut",
      });
    } else {
      stopCameraAnimations();
      animateFocusPixel(primarySize / 2, CAMERA_SPRING);
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

    const primarySize = getViewportPrimarySize();
    const minYear = Math.min(startYear, endYear);
    const maxYear = Math.max(startYear, endYear);
    const rangeYears = Math.max(maxYear - minYear, 1);
    const fitZoom = Math.max(
      MIN_ZOOM,
      Math.min((primarySize * (1 - CAMERA_FIT_PADDING * 2)) / rangeYears, MAX_ZOOM),
    );
    const centerYear = (minYear + maxYear) / 2;
    const pixelDist = Math.abs(centerYear - focusYear.get()) * fitZoom;

    if (immediate) {
      stopCameraAnimations();
      focusPixel.set(primarySize / 2);
      focusYear.set(centerYear);
      targetLogZoom.current = Math.log(fitZoom);
      logZoom.set(targetLogZoom.current);
      return;
    }

    if (pixelDist > primarySize * 0.5) {
      stopCameraAnimations();
      const duration = Math.min(1.0, 0.2 + pixelDist / 4000);
      animateFocusPixel(primarySize / 2, { duration, ease: "easeInOut" });
      animateFocusYear(centerYear, { duration, ease: "easeInOut" });
      targetLogZoom.current = Math.log(fitZoom);
      animateLogZoom(targetLogZoom.current, {
        duration,
        ease: "easeInOut",
      });
      return;
    }

    stopCameraAnimations();
    animateFocusPixel(primarySize / 2, CAMERA_SPRING);
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

      const primarySize = getViewportPrimarySize();
      stopCameraAnimations();
      animateFocusPixel(primarySize / 2, FOCUS_SPRING);
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
    const primarySize = getViewportPrimarySize();

    const eventYear = getEventTimelineYear(event);
    const currentZoom = Math.exp(logZoom.get());
    const currentYear = focusYear.get();

    const hasDuration = event.duration && event.duration > 0;
    let targetZoom = currentZoom;
    if (hasDuration) {
      const targetRangeYears = Math.min(
        Math.max((event?.duration || 0) * 20, 1 / 365.25),
        1e9,
      );
      targetZoom = Math.max(
        MIN_ZOOM,
        Math.min(primarySize / targetRangeYears, MAX_ZOOM),
      );
    }

    const pixelDist = Math.abs(eventYear - currentYear) * targetZoom;
    const isLongTravel =
      pixelDist > primarySize * LONG_TRAVEL_VIEWPORT_MULTIPLIER;

    stopCameraAnimations();

    if (isLongTravel) {
      const duration = Math.min(1.2, 0.3 + pixelDist / 4000);
      setWarpMode("travel");
      setIsWarping(true);
      const travelDirection = eventYear > currentYear ? -1 : 1;
      setWarpDirection(
        orientation === "vertical"
          ? (travelDirection * axisDirection as 1 | -1)
          : travelDirection,
      );

      const travelOptions = {
        duration,
        ease: "easeInOut",
      } as const;

      animateFocusPixel(primarySize / 2, travelOptions);
      animateFocusYear(eventYear, {
        ...travelOptions,
        onComplete: () => {
          setIsWarping(false);
        },
      });

      // Always animate zoom alongside pan — even when the target zoom equals
      // the current zoom (duration=0), animating with easeInOut keeps all three
      // motion values (focusPixel, focusYear, logZoom) in sync so the derived
      // panX produces a smooth, coherent motion.
      targetLogZoom.current = Math.log(targetZoom);
      animateLogZoom(targetLogZoom.current, travelOptions);

      return;
    }

    // Short travel: spring for all three — zoom always included so pan and zoom
    // settle together, even when targetZoom ≈ currentZoom.
    targetLogZoom.current = Math.log(targetZoom);
    animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
    animateFocusPixel(primarySize / 2, FOCUS_SPRING);
    animateFocusYear(eventYear, FOCUS_SPRING);
  };

  const handleFocusBigBang = () => {
    const bigBangEvent = renderedTimelineEvents.find(
      (event) =>
        getSearchableLocalizedText(event.title)
          .toLowerCase()
          .includes("big bang") && event.time[0] === BIG_BANG_YEAR,
    );
    if (bigBangEvent) {
      handleFocusEvent(bigBangEvent);
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    const primarySize = getViewportPrimarySize();
    stopCameraAnimations();
    animateFocusPixel(primarySize / 2, FOCUS_SPRING);
    animateFocusYear(BIG_BANG_YEAR, FOCUS_SPRING);
  };

  const handleWheel = (event: globalThis.WheelEvent) => {
    event.preventDefault();

    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }

    if (!(orientation === "vertical" && verticalWheelBehavior === "pan")) {
      clearWheelPanFrame();
      wheelPanResidualRef.current = 0;
      wheelPanAnchorPixelRef.current = null;
    }

    stopCameraAnimations();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const primaryPointer = getPrimaryPixelFromClient(
      rect,
      event.clientX,
      event.clientY,
    );
    const primaryRectSize =
      orientation === "horizontal" ? rect.width : rect.height;

    const currentZoom = zoom.get();
    const normalizedDeltaX = normalizeWheelDelta(event.deltaX, event.deltaMode);
    const normalizedDeltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);
    const primaryScrollDelta =
      orientation === "horizontal" ? normalizedDeltaX : normalizedDeltaY;
    const zoomDelta = normalizedDeltaY;
    const isTrackpadPinch = event.ctrlKey;

    if (isTrackpadPinch) {
      const now = performance.now();
      const currentWheelPinchGesture = wheelPinchGestureRef.current;
      const shouldStartNewWheelPinchGesture =
        !currentWheelPinchGesture ||
        now - currentWheelPinchGesture.lastEventTime >
          WHEEL_PINCH_GESTURE_GAP_MS;

      if (shouldStartNewWheelPinchGesture) {
        const anchorPixel = Math.max(
          0,
          Math.min(primaryRectSize, focusPixel.get() || primaryRectSize / 2),
        );
        wheelPinchGestureRef.current = {
          anchorPixel,
          anchorYear: getYearFromPan(anchorPixel, panX.get(), currentZoom),
          lastEventTime: now,
        };
      } else {
        currentWheelPinchGesture.lastEventTime = now;
      }

      const wheelPinchGesture = wheelPinchGestureRef.current;
      if (!wheelPinchGesture) return;
      const nextLogZoom = clampLogZoom(
        targetLogZoom.current - zoomDelta * 0.015,
      );

      focusPixel.set(wheelPinchGesture.anchorPixel);
      focusYear.set(wheelPinchGesture.anchorYear);
      targetLogZoom.current = nextLogZoom;
      logZoom.set(nextLogZoom);
      return;
    }

    wheelPinchGestureRef.current = null;

    if (orientation === "vertical" && verticalWheelBehavior === "pan") {
      if (Math.abs(primaryScrollDelta) > 0) {
        queueWheelPan(primaryScrollDelta, primaryPointer);
      }
      return;
    }

    if (orientation === "vertical" && Math.abs(zoomDelta) > 0) {
      focusPixel.set(primaryPointer);
      focusYear.set(getYearFromPan(primaryPointer, panX.get(), currentZoom));

      const targetZoom = Math.exp(targetLogZoom.current);
      const zoomFactor = Math.pow(1.002, Math.abs(zoomDelta));
      const direction = zoomDelta < 0 ? 1 : -1;
      let newZoom =
        direction > 0 ? targetZoom * zoomFactor : targetZoom / zoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      targetLogZoom.current = Math.log(newZoom);
      animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
      return;
    }

    if (event.deltaMode === 0 && Math.abs(normalizedDeltaX) > 0) {
      setCameraFromPanX(
        panX.get() - normalizedDeltaX,
        currentZoom,
        primaryPointer,
      );
      return;
    }

    const hasZoomIntent = Math.abs(zoomDelta) > 0;
    const shouldApplyHorizontalPan =
      Math.abs(normalizedDeltaX) > 0 &&
      (!hasZoomIntent ||
        Math.abs(normalizedDeltaX) > Math.abs(zoomDelta) * 0.6);
    const nextPanX = shouldApplyHorizontalPan
      ? panX.get() - normalizedDeltaX
      : panX.get();

    setCameraFromPanX(nextPanX, currentZoom, primaryPointer);

    if (Math.abs(zoomDelta) > 0) {
      focusPixel.set(primaryPointer);
      focusYear.set(getYearFromPan(primaryPointer, nextPanX, currentZoom));

      const targetZoom = Math.exp(targetLogZoom.current);
      const zoomFactor = Math.pow(1.002, Math.abs(zoomDelta));
      const direction = zoomDelta < 0 ? 1 : -1;
      let newZoom =
        direction > 0 ? targetZoom * zoomFactor : targetZoom / zoomFactor;
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

      targetLogZoom.current = Math.log(newZoom);
      animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
      // NOTE: do NOT call scheduleLayoutUpdate() here — layout is driven
      // solely by scheduleZoomSettle() in the logZoom "change" listener.
      // Calling it here restarts every event's y-spring on every wheel delta,
      // causing visible jitter/flicker during active zooming.
    }
  };

  const getYearAtPixel = (pixel: number) => getYearFromPan(pixel);

  const clearWheelPanFrame = () => {
    if (wheelPanFrameRef.current === null) return;
    cancelAnimationFrame(wheelPanFrameRef.current);
    wheelPanFrameRef.current = null;
  };

  const flushWheelPan = () => {
    const residual = wheelPanResidualRef.current;
    const anchorPixel =
      wheelPanAnchorPixelRef.current ?? focusPixel.get() ?? getViewportCenter();
    if (Math.abs(residual) <= 0.05) {
      wheelPanResidualRef.current = 0;
      wheelPanAnchorPixelRef.current = null;
      clearWheelPanFrame();
      return;
    }

    const step = residual * 0.34;
    wheelPanResidualRef.current -= step;
    setCameraFromPanX(panX.get() - step, zoom.get(), anchorPixel);

    wheelPanFrameRef.current = requestAnimationFrame(flushWheelPan);
  };

  const queueWheelPan = (delta: number, anchorPixel: number) => {
    wheelPanResidualRef.current += delta;
    wheelPanAnchorPixelRef.current = anchorPixel;
    if (wheelPanFrameRef.current !== null) return;
    wheelPanFrameRef.current = requestAnimationFrame(flushWheelPan);
  };

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
    centerPrimary:
      orientation === "horizontal"
        ? (first.clientX + second.clientX) / 2
        : (first.clientY + second.clientY) / 2,
    distance: Math.hypot(
      first.clientX - second.clientX,
      first.clientY - second.clientY,
    ),
  });

  const startDragAt = (clientPrimary: number) => {
    isDragging.current = true;
    velocity.current = 0;
    dragDistanceRef.current = 0;
    const now = performance.now();
    lastDragTime.current = now;
    lastX.current = clientPrimary;
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
    const { centerPrimary, distance } = getPinchMetrics(first, second);
    if (distance <= 0) return;

    pinchGestureRef.current = {
      anchorYear: getYearAtPixel(centerPrimary),
      startDistance: distance,
      startLogZoom: logZoom.get(),
    };

    focusPixel.set(centerPrimary);
    focusYear.set(pinchGestureRef.current.anchorYear);
    suppressNextClickRef.current = true;
  };

  const updatePinchGesture = () => {
    const pinchGesture = pinchGestureRef.current;
    const pointers = getGesturePointers();
    if (!pinchGesture || !pointers) return;

    const [first, second] = pointers;
    const { centerPrimary, distance } = getPinchMetrics(first, second);
    if (distance <= 0) return;

    const nextLogZoom = Math.max(
      Math.log(MIN_ZOOM),
      Math.min(
        Math.log(MAX_ZOOM),
        pinchGesture.startLogZoom +
          Math.log(distance / pinchGesture.startDistance),
      ),
    );

    focusPixel.set(centerPrimary);
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
    clearWheelPanFrame();
    wheelPanResidualRef.current = 0;
    wheelPanAnchorPixelRef.current = null;
    stopCameraAnimations();
    wheelPinchGestureRef.current = null;
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
    startDragAt(getPrimaryPointerValue(event.clientX, event.clientY));
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
    pendingDragX.current = getPrimaryPointerValue(event.clientX, event.clientY);
    pendingDragTime.current = performance.now();
    scheduleDragFrame();
  };

  const handlePointerUp = (event: PointerEvent) => {
    activePointersRef.current.delete(event.pointerId);

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
        // Second finger lifted — transition to single-finger drag.
        // startDragAt resets velocity=0; the pending finger's eventual
        // pointer-up will read velocity≈0 and skip inertia naturally.
        resetDragState();
        const remainingPointer = getFirstActivePointer();
        if (remainingPointer) {
          startDragAt(
            getPrimaryPointerValue(
              remainingPointer.clientX,
              remainingPointer.clientY,
            ),
          );
          return;
        }
      }

      resetDragState();
      return;
    }

    // Normal single-finger pan release: flush pending drag first to capture
    // velocity, THEN reset state so inertia can use the captured value.
    flushPendingDrag();
    const finalVelocity = velocity.current;
    resetDragState();

    if (Math.abs(finalVelocity) < 0.1) return;

    const startVelocity =
      Math.sign(finalVelocity) * Math.min(Math.abs(finalVelocity) * 20, 80);
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
    const nextLabel = formatZoomRangeLabel(
      currentLogZoom,
      getViewportPrimarySize(),
    );
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
      // Cancel any pending RAF from scheduleLayoutUpdate so only one layout
      // pass fires (flushZoomLayoutUpdate), avoiding double-layout jank.
      if (layoutUpdateFrame.current !== null) {
        cancelAnimationFrame(layoutUpdateFrame.current);
        layoutUpdateFrame.current = null;
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
    clearWheelPanFrame();
    wheelPanResidualRef.current = 0;
    wheelPanAnchorPixelRef.current = null;
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
    const targetZoom = getViewportPrimarySize() / rangeInYears;
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
    const primarySize = getViewportPrimarySize();
    const currentZoom = Math.exp(logZoom.get());
    const pixelDist = Math.abs(targetYear - focusYear.get()) * currentZoom;

    clearFocusedEvent();
    stopCameraAnimations();

    // Animate zoom to a reasonable level for the target year so that pan and
    // zoom settle together (keeping all three motion values in sync).
    // Show roughly ±1 year around the target.
    const jumpZoom = Math.max(MIN_ZOOM, Math.min(primarySize / 2, MAX_ZOOM));
    targetLogZoom.current = Math.log(jumpZoom);

    if (pixelDist > primarySize * LONG_TRAVEL_VIEWPORT_MULTIPLIER) {
      const duration = Math.min(1.2, 0.3 + pixelDist / 4000);
      const phase1Duration = duration * 0.7;
      const isWarpingLeft = targetYear > focusYear.get();

      setWarpMode("travel");
      setIsWarping(true);
      const travelDirection = isWarpingLeft ? -1 : 1;
      setWarpDirection(
        orientation === "vertical"
          ? (travelDirection * axisDirection as 1 | -1)
          : travelDirection,
      );

      const travelOptions = {
        duration: phase1Duration,
        ease: "easeInOut" as const,
      };
      animateFocusPixel(
        isWarpingLeft ? primarySize * 0.88 : primarySize * 0.12,
        travelOptions,
      );
      animateFocusYear(targetYear, travelOptions);
      animateLogZoom(targetLogZoom.current, travelOptions);

      // Phase 2: snap to center
      const phase2Options = {
        duration: duration * 0.3,
        ease: "easeInOut" as const,
      };
      animateFocusPixel(primarySize / 2, {
        ...phase2Options,
        onComplete: () => setIsWarping(false),
      });
      return;
    }

    animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
    animateFocusPixel(primarySize / 2, FOCUS_SPRING);
    animateFocusYear(targetYear, FOCUS_SPRING);
  };

  const handleMinimapSeek = (targetYear: number) => {
    clearInertia();
    clearDragFrame();
    clearWheelPanFrame();
    wheelPanResidualRef.current = 0;
    wheelPanAnchorPixelRef.current = null;
    resetDragState();
    pinchGestureRef.current = null;
    wheelPinchGestureRef.current = null;
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
    scheduleViewportPersistence();

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
    scheduleViewportPersistence();
  });

  useEffect(() => {
    const isBootstrapping = !hasBootstrappedRef.current;
    if (!isBootstrapping) return;

    if (initialFocusYear !== null && initialLogZoom !== null) {
      // Deep-link: restore exact viewport from URL params
      const primarySize = getViewportPrimarySize();
      stopCameraAnimations();
      focusPixel.set(primarySize / 2);
      focusYear.set(initialFocusYear);
      targetLogZoom.current = initialLogZoom;
      logZoom.set(initialLogZoom);
      updateTicks();
      updateLayout(true);
    } else {
      // Default: auto-fit to all rendered events
      handleAutoFit(true);
      updateTicks();
      updateLayout(true);
    }

    hasBootstrappedRef.current = true;
    flushViewportPersistence();
  }, [renderedTimelineEvents]);

  useEffect(() => {
    if (!hasBootstrappedRef.current) return;

    updateVisibleBounds();
    updateTicks();
    updateLayout();
  }, [renderedTimelineEvents]);

  useEffect(() => {
    updateVisibleBounds();
    updateLayout();
  }, [selectedEventId]);

  useEffect(() => {
    if (!hasBootstrappedRef.current) return;
    clearWheelPanFrame();
    wheelPanResidualRef.current = 0;
    wheelPanAnchorPixelRef.current = null;
    stopCameraAnimations();
    focusPixel.set(getViewportCenter());
    updateVisibleBounds();
    updateTicks();
    updateLayout(true);
    scheduleViewportPersistence();
  }, [orientation, verticalTimeDirection]);

  useEffect(() => {
    clearWheelPanFrame();
    wheelPanResidualRef.current = 0;
    wheelPanAnchorPixelRef.current = null;
  }, [verticalWheelBehavior]);

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
      if (wheelPanFrameRef.current !== null) {
        cancelAnimationFrame(wheelPanFrameRef.current);
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
      if (persistViewportTimeoutRef.current !== null) {
        window.clearTimeout(persistViewportTimeoutRef.current);
        persistViewportTimeoutRef.current = null;
        flushViewportPersistence();
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
    currentLogZoom: logZoom,
    hasBootstrappedRef,
  };
};
