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
  TimelineLayoutMode,
  VerticalTimeDirection,
  VerticalWheelBehavior,
} from "../constants/types";
import {
  generateCalendarTimelineTickYears,
  generateSubDayTimelineTickYears,
  getEventTimelineRange,
  getEventTimelineYear,
  getTimelineHighlightStep,
  isHighlightedTimelineTick,
} from "../helpers";
import {
  CAMERA_FIT_PADDING,
  DIMMED_EVENT_OPACITY,
  FOCUS_SPAN_VIEWPORT_FRACTION,
  MIN_FIT_RANGE_YEARS,
  CAMERA_SPRING,
  EVENT_LAYOUT_SPRING,
  FOCUS_SPRING,
  FPS_SAMPLE_WINDOW_MS,
  LAYOUT_MARGIN_RATIO,
  LAYOUT_MIN_DISTANCE_PX,
  LAYOUT_REFRESH_SHIFT_RATIO,
  LAYOUT_ROW_OFFSET,
  LONG_TRAVEL_VIEWPORT_MULTIPLIER,
  COLLAPSED_GROUP_EXPAND_ZOOM,
  getMaxZoomForYear,
  MIN_ZOOM,
  SPAN_MIN_RENDER_PX,
  TICK_OVERSCAN_INTERVALS,
  ZOOM_LAYOUT_THROTTLE_MS,
  ZOOM_SETTLE_DELAY_MS,
  ZOOM_UI_THROTTLE_MS,
  ZOOM_WARP_HIDE_MS,
  ZOOM_WARP_MIN_LOG_DELTA,
  ZOOM_WARP_SAMPLE_STALE_MS,
} from "../constants";
import {
  areCollapsedGroupsEqual,
  formatZoomRangeLabel,
  getAbsoluteYearFromDateJump,
  getStableTickLabelWidthEstimate,
  getTickIntervalThatFitsLabels,
  getTimelineLayoutLevels,
  resolveZoomFixedPointPixel,
  shouldStartDragInertia,
  type TimelineCameraSample,
} from "../helpers";
import { getSearchableLocalizedText } from "../helpers/localization";
import { resolveViewportDimension } from "../helpers/viewportSize";
import {
  packTimelineLaneEvents,
  type TimelineLaneDescriptor,
} from "../helpers/laneLayout";

type UseTimelineViewportParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  renderedTimelineEvents: Event[];
  selectedEventId: string | null;
  onSelectEvent: (event: Event | null) => void;
  onViewportChange?: (viewport: { focusYear: number; logZoom: number }) => void;
  setIsRulerActive: (value: boolean) => void;
  orientation: TimelineOrientation;
  layoutMode?: TimelineLayoutMode;
  timelineLanes?: TimelineLaneDescriptor[];
  eventLaneIds?: Readonly<Record<string, string>>;
  verticalWheelBehavior: VerticalWheelBehavior;
  verticalTimeDirection: VerticalTimeDirection;
  /** Runtime ids of muted events: drawn faint and excluded from row packing. */
  dimmedEventIds: ReadonlySet<string>;
  /** Optional: deep-link focus year. When provided, viewport boots to this year instead of auto-fit. */
  initialFocusYear?: number | null;
  /** Optional: deep-link log-zoom. When provided, viewport boots to this zoom instead of auto-fit. */
  initialLogZoom?: number | null;
};

const DEFAULT_LOG_ZOOM = Math.log(2000 / 13.8e9);
const EMPTY_TIMELINE_LANES: TimelineLaneDescriptor[] = [];
const EMPTY_EVENT_LANE_IDS: Readonly<Record<string, string>> = {};
const WHEEL_PINCH_GESTURE_GAP_MS = 140;
/** Shortest gap a drag sample may claim, so a near-zero one cannot fake speed. */
const DRAG_VELOCITY_MIN_DT_MS = 8;

/**
 * Extra headroom a finer tick rung must clear before it is adopted. Keeping
 * the current rung only requires it to still fit, so the pair forms a Schmitt
 * trigger and zoom jitter cannot flip the interval back and forth.
 */
const TICK_FIT_ADOPT_SLACK = 1.25;

export const useTimelineViewport = ({
  containerRef,
  renderedTimelineEvents,
  selectedEventId,
  onSelectEvent,
  onViewportChange,
  setIsRulerActive,
  orientation,
  layoutMode = "compact",
  timelineLanes = EMPTY_TIMELINE_LANES,
  eventLaneIds = EMPTY_EVENT_LANE_IDS,
  verticalWheelBehavior,
  verticalTimeDirection,
  dimmedEventIds,
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
  /**
   * True while a touch pinch is feeding `warpPivot` the literal point between
   * the fingers. The overlay smooths the pivot because the camera-derived one
   * is noisy; an exact one must not be smoothed, or the rings crawl after the
   * hand instead of sitting under it.
   */
  const [isWarpPivotExact, setIsWarpPivotExact] = useState(false);
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
  const warpModeRef = useRef<WarpOverlayMode>("travel");
  const prevZoomWarpSampleRef = useRef<{
    logZoom: number;
    camera: TimelineCameraSample;
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
  const panSettleTimeoutRef = useRef<number | null>(null);
  const layoutBoundsRef = useRef<{ startYear: number; endYear: number } | null>(
    null,
  );
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
  /**
   * zoom/panX are derived MotionValues, and a derived value is only
   * recomputed by the motion frame loop: right after a synchronous
   * focusYear/logZoom .set() its .get() still returns the previous camera,
   * and after a subscription reset (StrictMode remount) it can catch up
   * without ever firing "change". The bootstrap effect hit exactly that —
   * ticks and layout were generated for the stale camera and nothing ever
   * regenerated them, leaving the timeline blank until the first zoom
   * gesture. All imperative math must therefore read the camera through
   * these source-value getters; panX/zoom stay subscription drivers only.
   */
  const getCurrentZoom = () => Math.exp(logZoom.get());
  const getCurrentPanX = () =>
    focusPixel.get() - focusYear.get() * getCurrentZoom() * axisDirection;
  /**
   * Pixel the warp overlay centres its reference rings on: the point the
   * timeline is expanding from, not the middle of the viewport.
   *
   * They coincide for a wheel or pinch zoom, which pins focusPixel/focusYear to
   * the pointer. They do not when the camera pans while it zooms — the landing
   * tour does exactly that — and centring on focusPixel there makes every ring
   * edge slide across the timeline at the pan rate.
   */
  const warpPivot = useMotionValue(focusPixel.get());

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
  const dragStartTimeRef = useRef(0);
  /** This drag is what a pinch left behind, not one the user started. */
  const isPinchTailDragRef = useRef(false);
  const pinchGestureRef = useRef<PinchGestureState | null>(null);
  /**
   * While a touch pinch runs, the warp rings take their centre and direction
   * straight from the gesture instead of the camera-derived fixed point — see
   * the logZoom listener for why the derived one is unusable here.
   */
  const pinchWarpPivotRef = useRef<number | null>(null);
  const pinchWarpModeRef = useRef<Exclude<WarpOverlayMode, "travel"> | null>(
    null,
  );
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
    resolveViewportDimension(
      containerRef.current?.clientWidth,
      typeof window !== "undefined" ? window.innerWidth : 1000,
    );

  const getViewportHeight = () =>
    resolveViewportDimension(
      containerRef.current?.clientHeight,
      typeof window !== "undefined" ? window.innerHeight : 800,
    );

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

  /**
   * The zoom ceiling depends on where you are: fractional-year positions run
   * out of float precision as |year| grows, so a flat cap either forbids
   * second-level zoom at modern dates or permits visible jitter in deep time.
   */
  const getZoomCeiling = (atYear: number = focusYear.get()) =>
    getMaxZoomForYear(atYear);

  const clampZoom = (nextZoom: number, atYear?: number) =>
    Math.max(MIN_ZOOM, Math.min(nextZoom, getZoomCeiling(atYear)));

  const clampLogZoom = (nextLogZoom: number, atYear?: number) =>
    Math.max(
      Math.log(MIN_ZOOM),
      Math.min(Math.log(getZoomCeiling(atYear)), nextLogZoom),
    );

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
    currentPanX = getCurrentPanX(),
    currentZoom = getCurrentZoom(),
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
    // Only a travel warp belongs to the animation being stopped. Clearing the
    // zoom rings here too meant every wheel event dropped them for a frame and
    // cancelled their hold, so they faded the moment a gesture ended instead of
    // staying up long enough to read.
    setIsWarping((previous) =>
      warpModeRef.current === "travel" ? false : previous,
    );
  };

  const updateVisibleBounds = () => {
    const container = containerRef.current;
    if (!container) return null;

    const primarySize = getViewportPrimarySize();
    const currentX = getCurrentPanX();
    const currentZoom = getCurrentZoom();

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
      const range = getEventTimelineRange(event);
      if (range.endYear < BIG_BANG_YEAR) return false;
      if (event.id === focusedId) return true;
      // Overlap, not containment: a span wider than the viewport has both
      // endpoints outside it and would otherwise be culled away entirely.
      if (range.endYear < layoutStart || range.startYear > layoutEnd) {
        return false;
      }
      return true;
    });
    const visibleEventIds = new Set(visibleEvents.map((event) => event.id));

    if (layoutMode === "layers" && timelineLanes.length > 0) {
      const laneLayout = packTimelineLaneEvents({
        lanes: timelineLanes,
        crossSize: getViewportCrossSize(),
        minDistanceYears: minDistYears,
        events: visibleEvents.flatMap((event) => {
          if (dimmedEventIds.has(event.id)) return [];
          const laneId = eventLaneIds[event.id];
          if (!laneId) return [];
          const range = getEventTimelineRange(event);
          return [
            {
              id: event.id,
              laneId,
              startYear: range.startYear,
              endYear: range.endYear,
              priority: event.id === focusedId ? Number.MAX_SAFE_INTEGER : event.priority,
            },
          ];
        }),
      });
      const laneGeometry = new Map(
        laneLayout.geometry.map((lane) => [lane.id, lane]),
      );

      for (const event of visibleEvents) {
        const layout = eventLayouts.current[event.id];
        if (!layout) continue;

        const isDimmed = dimmedEventIds.has(event.id);
        const placement = laneLayout.placements.get(event.id);
        const lane = laneGeometry.get(eventLaneIds[event.id]);
        const targetCross = isDimmed ? lane?.cross : placement?.cross;
        const targetOpacity = isDimmed ? DIMMED_EVENT_OPACITY : placement ? 1 : 0;

        if (targetCross !== undefined && layout.targetY !== targetCross) {
          layout.targetY = targetCross;
          if (immediate) layout.y.set(targetCross);
          else animate(layout.y, targetCross, EVENT_LAYOUT_SPRING);
        }
        if (layout.targetOpacity !== targetOpacity) {
          layout.targetOpacity = targetOpacity;
          if (immediate) layout.opacity.set(targetOpacity);
          else animate(layout.opacity, targetOpacity, { duration: 0.2 });
        }
      }

      renderedTimelineEvents.forEach((event) => {
        if (visibleEventIds.has(event.id)) return;
        const layout = eventLayouts.current[event.id];
        if (!layout || layout.targetOpacity === 0) return;
        layout.targetOpacity = 0;
        if (immediate) layout.opacity.set(0);
        else animate(layout.opacity, 0, { duration: 0.2 });
      });

      const nextCollapsedGroups: CollapsedEventGroup[] = laneLayout.collapsed.map(
        (group) => ({
          id: group.id,
          year: group.year,
          side: group.cross < 0 ? -1 : 1,
          cross: group.cross,
          laneId: group.laneId,
          count: group.eventIds.length,
          eventIds: group.eventIds,
        }),
      );
      setCollapsedGroups((prevGroups) =>
        areCollapsedGroupsEqual(prevGroups, nextCollapsedGroups)
          ? prevGroups
          : nextCollapsedGroups,
      );
      layoutBoundsRef.current = { startYear, endYear };
      return;
    }

    const sortedEvents = [...visibleEvents].sort((a, b) => {
      if (a.id === focusedId) return -1;
      if (b.id === focusedId) return 1;
      return b.priority - a.priority;
    });

    const occupied: { startYear: number; endYear: number; level: number }[] = [];
    const nextCollapsedGroups: CollapsedEventGroup[] = [];

    sortedEvents.forEach((event) => {
      const layout = eventLayouts.current[event.id];
      if (!layout) return;

      const { startYear: eventStart, endYear: eventEnd } =
        getEventTimelineRange(event);
      const eventYear = getEventTimelineYear(event);
      const originalIndex = timelineEventIndexMap.get(event.id) as number;
      const side = originalIndex % 2 === 0 ? 1 : -1;

      /**
       * A muted event keeps its row but stops reserving space, which is the
       * whole point: muting a 540-million-year era has to give the events
       * inside it their rows back, not just make the bar fainter.
       */
      const isDimmed = dimmedEventIds.has(event.id);
      if (isDimmed) {
        const targetY = side * LAYOUT_ROW_OFFSET;
        if (layout.targetY !== targetY) {
          layout.targetY = targetY;
          if (immediate) layout.y.set(targetY);
          else animate(layout.y, targetY, EVENT_LAYOUT_SPRING);
        }
        if (layout.targetOpacity !== DIMMED_EVENT_OPACITY) {
          layout.targetOpacity = DIMMED_EVENT_OPACITY;
          if (immediate) layout.opacity.set(DIMMED_EVENT_OPACITY);
          else animate(layout.opacity, DIMMED_EVENT_OPACITY, { duration: 0.2 });
        }
        return;
      }

      // A span only deserves its own row once it is actually wide on screen.
      // Below that it is visually a point and may collapse like one.
      const spanWidthPx = (eventEnd - eventStart) * currentZoom;
      const isWideSpan = spanWidthPx >= SPAN_MIN_RENDER_PX;

      let placedLevel: number | null = null;
      for (const level of layoutLevels) {
        const actualLevel = level * side;
        // Interval overlap with the same padding the point test used. For two
        // points this reduces exactly to |a - b| < minDistYears.
        const collision = occupied.some(
          (occupiedEvent) =>
            occupiedEvent.level === actualLevel &&
            eventStart < occupiedEvent.endYear + minDistYears &&
            occupiedEvent.startYear < eventEnd + minDistYears,
        );
        if (!collision) {
          placedLevel = actualLevel;
          occupied.push({
            startYear: eventStart,
            endYear: eventEnd,
            level: actualLevel,
          });
          break;
        }
      }

      // Collapsing a visibly wide bar into a dot loses the very thing it is
      // meant to show, so a wide span takes the outermost row instead.
      if (placedLevel === null && isWideSpan) {
        const fallbackLevel =
          (layoutLevels[layoutLevels.length - 1] ?? 1) * side;
        placedLevel = fallbackLevel;
        occupied.push({
          startYear: eventStart,
          endYear: eventEnd,
          level: fallbackLevel,
        });
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

    // Remember the window this pass covered so panning can tell how stale it is.
    layoutBoundsRef.current = { startYear, endYear };
  };

  const updateTicks = () => {
    const bounds = updateVisibleBounds();
    if (!bounds) return;
    const { primarySize, currentZoom, startYear, endYear } = bounds;

    const visibleYears = primarySize / currentZoom;

    /**
     * The interval is chosen by asking which rung's labels actually fit, not
     * by rounding to the nearest nice value: the ladder has wide gaps (nothing
     * between a year and a month) and label width jumps at the rung
     * boundaries, so rounding spaced ticks for a label it was not going to
     * print and they overlapped.
     *
     * Adopting a finer rung needs headroom, but keeping the current one only
     * needs it to still fit — a Schmitt trigger. Zoom jitters frame to frame
     * during a gesture, and a single threshold would flip the rung back and
     * forth right at the boundary, which is what the old hysteresis existed to
     * prevent. Because the kept value is re-tested against the bare fit, the
     * stickiness can never hold a colliding interval.
     */
    const previousInterval = tickStateRef.current?.interval ?? null;
    // Widest label in view decides the budget: at the year rung "1942" and
    // "13.8 Billion BC" differ by a factor of two.
    const referenceYear =
      Math.abs(startYear) > Math.abs(endYear) ? startYear : endYear;
    const fitsAtCurrentZoom = (candidate: number, slack: number) =>
      candidate * currentZoom >=
      getStableTickLabelWidthEstimate(candidate, referenceYear) * slack;

    let interval = getTickIntervalThatFitsLabels(
      visibleYears,
      primarySize,
      referenceYear,
    );
    if (
      previousInterval !== null &&
      previousInterval !== interval &&
      fitsAtCurrentZoom(previousInterval, 1) &&
      !fitsAtCurrentZoom(interval, TICK_FIT_ADOPT_SLACK)
    ) {
      interval = previousInterval;
    }

    const targetHighlightedTicks = Math.max(
      2,
      Math.min(5, Math.round(primarySize / 320)),
    );
    const highlightStep = getTimelineHighlightStep(
      Math.max(interval, visibleYears / targetHighlightedTicks),
    );

    const bufferedStartYear = startYear - interval * TICK_OVERSCAN_INTERVALS;
    const bufferedEndYear = endYear + interval * TICK_OVERSCAN_INTERVALS;
    const calendarTickYears =
      generateSubDayTimelineTickYears(
        bufferedStartYear,
        bufferedEndYear,
        interval,
      ) ??
      generateCalendarTimelineTickYears(
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

  const clearZoomWarpTimeout = () => {
    if (zoomWarpTimeoutRef.current !== null) {
      window.clearTimeout(zoomWarpTimeoutRef.current);
      zoomWarpTimeoutRef.current = null;
    }
  };

  /** Raise a travel warp, and drop the zoom rings' pending hide with it. */
  const startTravelWarp = () => {
    clearZoomWarpTimeout();
    warpModeRef.current = "travel";
    setWarpMode("travel");
    setIsWarping(true);
  };

  const triggerZoomWarp = (mode: Exclude<WarpOverlayMode, "travel">) => {
    warpModeRef.current = mode;
    setWarpMode(mode);
    setIsWarping(true);

    clearZoomWarpTimeout();

    zoomWarpTimeoutRef.current = window.setTimeout(() => {
      setIsWarping(false);
      zoomWarpTimeoutRef.current = null;
    }, ZOOM_WARP_HIDE_MS);
  };

  const animateCameraToEvents = (events: Event[], immediate = false) => {
    const container = containerRef.current;
    if (!container || events.length === 0) return;

    const primarySize = getViewportPrimarySize();
    // Spans must be fitted by their whole extent, otherwise focusing an era
    // frames only the instant it began.
    const ranges = events.map((event) => getEventTimelineRange(event));
    const minYear = Math.min(...ranges.map((range) => range.startYear));
    const maxYear = Math.max(...ranges.map((range) => range.endYear));

    if (Math.abs(maxYear - minYear) < 1e-9) {
      const targetYear = minYear;
      const targetZoom = clampZoom(getCurrentZoom() * 2, targetYear);

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

    const fitZoom = clampZoom(
      (primarySize * (1 - CAMERA_FIT_PADDING * 2)) / (maxYear - minYear),
      (minYear + maxYear) / 2,
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
    viewportFraction = 1 - CAMERA_FIT_PADDING * 2,
  ) => {
    const container = containerRef.current;
    if (!container) return;

    const primarySize = getViewportPrimarySize();
    const minYear = Math.min(startYear, endYear);
    const maxYear = Math.max(startYear, endYear);
    // A real range is framed by its own extent, floored at one day. Only a
    // degenerate zero-width range (fitting a lone point event) falls back to a
    // year — the old flat floor of 1 clamped every sub-year span, so focusing
    // an eight-day event landed on a twelve-month view.
    const rawRangeYears = maxYear - minYear;
    const rangeYears =
      rawRangeYears > 0 ? Math.max(rawRangeYears, MIN_FIT_RANGE_YEARS) : 1;
    const centerYear = (minYear + maxYear) / 2;
    const fitZoom = clampZoom(
      (primarySize * viewportFraction) / rangeYears,
      centerYear,
    );
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
      (event) => getEventTimelineRange(event).endYear >= BIG_BANG_YEAR,
    );
    if (visible.length === 0) return;

    const ranges = visible.map((event) => getEventTimelineRange(event));
    animateCameraToYearRange(
      Math.min(...ranges.map((range) => range.startYear)),
      Math.max(...ranges.map((range) => range.endYear)),
      immediate,
    );
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
            currentGroup.laneId === group.laneId &&
            Math.abs(currentGroup.year - group.year) < 1e-9
          ) {
            return null;
          }

          return {
            id: `${group.side}:${group.year}`,
            year: group.year,
            side: group.side,
            cross: group.cross,
            laneId: group.laneId,
            eventIds: sortedGroupEvents.map((event) => event.id),
          };
        });
        return;
      }

      const cycleKey = `${group.laneId ?? "compact"}:${group.side}:${group.year}`;
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

      // Expanding a cluster means zooming in hard enough to separate it. This
      // used to reach for MAX_ZOOM, which now sits at second-level and would
      // fling the camera far past anything useful.
      const boostedZoom = clampZoom(
        Math.max(getCurrentZoom(), COLLAPSED_GROUP_EXPAND_ZOOM),
        group.year,
      );
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

    // A span is framed by its own extent, which is more precise than the
    // duration zoom hint and is what the user means by "focus this era" —
    // but only to half the viewport, so its neighbours stay visible.
    const focusRange = getEventTimelineRange(event);
    if (focusRange.endYear > focusRange.startYear) {
      animateCameraToYearRange(
        focusRange.startYear,
        focusRange.endYear,
        false,
        FOCUS_SPAN_VIEWPORT_FRACTION,
      );
      return;
    }

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
      targetZoom = clampZoom(primarySize / targetRangeYears, eventYear);
    }

    const pixelDist = Math.abs(eventYear - currentYear) * targetZoom;
    const isLongTravel =
      pixelDist > primarySize * LONG_TRAVEL_VIEWPORT_MULTIPLIER;

    stopCameraAnimations();

    if (isLongTravel) {
      const duration = Math.min(1.2, 0.3 + pixelDist / 4000);
      startTravelWarp();
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

    const currentZoom = getCurrentZoom();
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
        // Anchor at the cursor, not at focusPixel: focusPixel only moves on
        // pan/zoom, so it is stale the moment the mouse moves elsewhere. The
        // anchor still locks for the whole gesture to avoid mid-pinch skitter.
        const anchorPixel = Math.max(
          0,
          Math.min(primaryRectSize, primaryPointer),
        );
        wheelPinchGestureRef.current = {
          anchorPixel,
          anchorYear: getYearFromPan(anchorPixel, getCurrentPanX(), currentZoom),
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
      focusYear.set(getYearFromPan(primaryPointer, getCurrentPanX(), currentZoom));

      const targetZoom = Math.exp(targetLogZoom.current);
      const zoomFactor = Math.pow(1.002, Math.abs(zoomDelta));
      const direction = zoomDelta < 0 ? 1 : -1;
      let newZoom =
        direction > 0 ? targetZoom * zoomFactor : targetZoom / zoomFactor;
      newZoom = clampZoom(newZoom);

      targetLogZoom.current = Math.log(newZoom);
      animateLogZoom(targetLogZoom.current, FOCUS_SPRING);
      return;
    }

    if (event.deltaMode === 0 && Math.abs(normalizedDeltaX) > 0) {
      setCameraFromPanX(
        getCurrentPanX() - normalizedDeltaX,
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
      ? getCurrentPanX() - normalizedDeltaX
      : getCurrentPanX();

    setCameraFromPanX(nextPanX, currentZoom, primaryPointer);

    if (Math.abs(zoomDelta) > 0) {
      focusPixel.set(primaryPointer);
      focusYear.set(getYearFromPan(primaryPointer, nextPanX, currentZoom));

      const targetZoom = Math.exp(targetLogZoom.current);
      const zoomFactor = Math.pow(1.002, Math.abs(zoomDelta));
      const direction = zoomDelta < 0 ? 1 : -1;
      let newZoom =
        direction > 0 ? targetZoom * zoomFactor : targetZoom / zoomFactor;
      newZoom = clampZoom(newZoom);

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
    setCameraFromPanX(getCurrentPanX() - step, getCurrentZoom(), anchorPixel);

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

  /**
   * `centerPrimary` comes back in *container* pixels — the space focusPixel and
   * getYearAtPixel work in. Raw client coordinates offset the pinch anchor by
   * the container's rect, and at a wide zoom that offset is worth hundreds of
   * millions of years. `distance` stays in client space; only its ratio matters.
   */
  const getPinchMetrics = (first: ActivePointer, second: ActivePointer) => {
    const rect = containerRef.current?.getBoundingClientRect() ?? null;
    const toPrimary = (clientX: number, clientY: number) =>
      rect
        ? getPrimaryPixelFromClient(rect, clientX, clientY)
        : getPrimaryPointerValue(clientX, clientY);

    return {
      centerPrimary:
        (toPrimary(first.clientX, first.clientY) +
          toPrimary(second.clientX, second.clientY)) /
        2,
      distance: Math.hypot(
        first.clientX - second.clientX,
        first.clientY - second.clientY,
      ),
    };
  };

  const startDragAt = (clientPrimary: number) => {
    isDragging.current = true;
    velocity.current = 0;
    dragDistanceRef.current = 0;
    const now = performance.now();
    lastDragTime.current = now;
    dragStartTimeRef.current = now;
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

    pinchWarpPivotRef.current = centerPrimary;
    pinchWarpModeRef.current = null;
    setIsWarpPivotExact(true);
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
        Math.log(getZoomCeiling(pinchGesture.anchorYear)),
        pinchGesture.startLogZoom +
          Math.log(distance / pinchGesture.startDistance),
      ),
    );

    // Both refs have to land before logZoom.set, which notifies its listener
    // synchronously — that listener is what reads them.
    pinchWarpPivotRef.current = centerPrimary;
    const netLogZoomDelta = nextLogZoom - pinchGesture.startLogZoom;
    if (Math.abs(netLogZoomDelta) >= ZOOM_WARP_MIN_LOG_DELTA) {
      // Net delta, not frame-to-frame: fingers wobble by a pixel or two every
      // frame, and a per-frame sign flipped the rings between zoom-in and
      // zoom-out for the whole gesture.
      pinchWarpModeRef.current = netLogZoomDelta > 0 ? "zoom-in" : "zoom-out";
    }

    focusPixel.set(centerPrimary);
    focusYear.set(pinchGesture.anchorYear);
    targetLogZoom.current = nextLogZoom;
    logZoom.set(nextLogZoom);
  };

  const endPinchGesture = () => {
    pinchGestureRef.current = null;
    pinchWarpPivotRef.current = null;
    pinchWarpModeRef.current = null;
    setIsWarpPivotExact(false);
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

    // flushPendingDrag also runs straight off pointerdown/pointerup, which can
    // land a millisecond after the last rAF flush. Dividing by that raw gap
    // turns a 3px slide into a 3px/ms "flick"; the floor keeps a sample honest
    // without touching real 8-16ms frames.
    if (dt > 0) {
      velocity.current = deltaX / Math.max(dt, DRAG_VELOCITY_MIN_DT_MS);
    }
    dragDistanceRef.current += Math.abs(deltaX);
    if (dragDistanceRef.current > 6) {
      suppressNextClickRef.current = true;
    }

    const currentZoom = getCurrentZoom();
    setCameraFromPanX(getCurrentPanX() + deltaX, currentZoom);

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

    endPinchGesture();
    suppressNextClickRef.current = false;
    isPinchTailDragRef.current = false;
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

      endPinchGesture();

      if (activePointersRef.current.size === 1) {
        // Second finger lifted — transition to single-finger drag. The
        // survivor is still rolling off the glass, so mark the drag as a pinch
        // tail: shouldStartDragInertia makes it earn a fling rather than
        // trusting velocity, which the two-millisecond slide inflates wildly.
        resetDragState();
        const remainingPointer = getFirstActivePointer();
        if (remainingPointer) {
          startDragAt(
            getPrimaryPointerValue(
              remainingPointer.clientX,
              remainingPointer.clientY,
            ),
          );
          isPinchTailDragRef.current = true;
          return;
        }
      }

      resetDragState();
      isPinchTailDragRef.current = false;
      return;
    }

    // Normal single-finger pan release: flush pending drag first to capture
    // velocity, THEN reset state so inertia can use the captured value.
    flushPendingDrag();
    const finalVelocity = velocity.current;
    const releaseTime = performance.now();
    const inertiaRelease = {
      velocity: finalVelocity,
      msSinceLastMove: releaseTime - lastDragTime.current,
      isPinchTail: isPinchTailDragRef.current,
      dragDurationMs: releaseTime - dragStartTimeRef.current,
      dragDistancePx: dragDistanceRef.current,
    };
    resetDragState();
    isPinchTailDragRef.current = false;

    if (!shouldStartDragInertia(inertiaRelease)) return;

    const startVelocity =
      Math.sign(finalVelocity) * Math.min(Math.abs(finalVelocity) * 20, 80);
    const friction = 0.985;
    let currentVelocity = startVelocity;

    const inertiaLoop = () => {
      currentVelocity *= friction;
      const currentZoom = getCurrentZoom();
      setCameraFromPanX(getCurrentPanX() + currentVelocity, currentZoom);
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

  /**
   * A pan that was skipped for being too small still has to land eventually,
   * otherwise the last fraction of a drag never gets a layout pass.
   */
  const schedulePanSettle = () => {
    if (panSettleTimeoutRef.current !== null) {
      window.clearTimeout(panSettleTimeoutRef.current);
    }

    panSettleTimeoutRef.current = window.setTimeout(() => {
      panSettleTimeoutRef.current = null;
      updateVisibleBounds();
      updateLayout();
    }, ZOOM_SETTLE_DELAY_MS);
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
    const centerPixel = getViewportCenter();
    const centerYear = getCenterYear(centerPixel);
    const nextLogZoom = clampLogZoom(Math.log(targetZoom), centerYear);
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
    const jumpZoom = clampZoom(primarySize / 2, targetYear);
    targetLogZoom.current = Math.log(jumpZoom);

    if (pixelDist > primarySize * LONG_TRAVEL_VIEWPORT_MULTIPLIER) {
      const duration = Math.min(1.2, 0.3 + pixelDist / 4000);
      const phase1Duration = duration * 0.7;
      const isWarpingLeft = targetYear > focusYear.get();

      startTravelWarp();
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
    endPinchGesture();
    isPinchTailDragRef.current = false;
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

    // panX derives from zoom, so it changes on every zoom frame too. Running a
    // full re-layout here during a zoom bypassed ZOOM_LAYOUT_THROTTLE_MS and
    // restarted every event's 0.2s opacity tween each frame, so nothing ever
    // finished fading in. While a zoom is in flight the throttled zoom path
    // plus the settle pass own layout; panning alone still relayouts per frame.
    const isZoomInFlight = zoomSettleTimeoutRef.current !== null;

    if (!bounds || !tickState) {
      if (!isZoomInFlight) {
        scheduleLayoutUpdate();
        scheduleTickUpdate();
      }
      return;
    }

    // Panning keeps zoom fixed, so existing row assignments remain valid and a
    // full re-layout per frame is wasted work — with thousands of events it was
    // the single most expensive thing in a drag. Relayout only once the
    // viewport has drifted meaningfully, and debounce the remainder.
    if (!isZoomInFlight) {
      const lastLayoutBounds = layoutBoundsRef.current;
      const visibleSpan = bounds.endYear - bounds.startYear;
      const hasDriftedEnough =
        lastLayoutBounds === null ||
        visibleSpan <= 0 ||
        Math.abs(bounds.startYear - lastLayoutBounds.startYear) >
          visibleSpan * LAYOUT_REFRESH_SHIFT_RATIO;

      if (hasDriftedEnough) {
        scheduleLayoutUpdate();
      } else {
        schedulePanSettle();
      }
    }
    scheduleViewportPersistence();

    // Zooming out grows the bounds past the generated tick range on almost
    // every frame, so without this guard ticks were regenerated per frame while
    // zooming. The throttled zoom path plus the settle pass cover that case.
    if (
      !isZoomInFlight &&
      (bounds.startYear < tickState.firstTick + tickState.interval ||
        bounds.endYear > tickState.lastTick - tickState.interval)
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
    const nextZoom = Math.exp(value);
    const nextCamera: TimelineCameraSample = {
      panPixel: focusPixel.get() - focusYear.get() * nextZoom * axisDirection,
      zoom: nextZoom,
    };
    const pinchWarpPivot = pinchWarpPivotRef.current;
    if (pinchWarpPivot !== null) {
      /**
       * A touch pinch already knows its centre exactly — it is the point
       * between the fingers — and the derived fixed point cannot be used here.
       * The pinch centre travels with the hand, so between two frames the
       * camera both pans and zooms; solving for the fixed point of that pair
       * divides the pan by a per-frame zoom step near zero, and the answer
       * lands hundreds of pixels off, or off screen entirely, on a different
       * side every frame. That is the warp skittering around mid-pinch. Wheel
       * and trackpad never hit it because they pin focusPixel for the whole
       * gesture, which leaves the pan term at zero.
       */
      const primarySize = getViewportPrimarySize();
      warpPivot.set(Math.max(0, Math.min(primarySize, pinchWarpPivot)));

      // Null until the gesture has actually changed zoom, so a two-finger pan
      // does not raise zoom rings.
      const pinchWarpMode = pinchWarpModeRef.current;
      if (pinchWarpMode && !(isWarping && warpMode === "travel")) {
        triggerZoomWarp(pinchWarpMode);
      }

      prevZoomWarpSampleRef.current = {
        logZoom: value,
        camera: nextCamera,
        time: now,
      };
    } else {
      // A sample from before the last pause belongs to an earlier gesture, and
      // whatever panning happened in between would poison the pivot it derives.
      const prevZoomSample =
        prevZoomWarpSampleRef.current &&
        now - prevZoomWarpSampleRef.current.time <= ZOOM_WARP_SAMPLE_STALE_MS
          ? prevZoomWarpSampleRef.current
          : null;

      if (
        prevZoomSample &&
        Math.abs(value - prevZoomSample.logZoom) >= ZOOM_WARP_MIN_LOG_DELTA
      ) {
        const pivot = resolveZoomFixedPointPixel(
          prevZoomSample.camera,
          nextCamera,
          axisDirection,
        );
        // A pivot outside the viewport means the pan is outrunning the zoom by
        // enough that there is no useful centre on screen; the last one stays.
        const primarySize = getViewportPrimarySize();
        if (pivot !== null && pivot >= 0 && pivot <= primarySize) {
          warpPivot.set(pivot);
        }

        if (!(isWarping && warpMode === "travel")) {
          triggerZoomWarp(
            value > prevZoomSample.logZoom ? "zoom-in" : "zoom-out",
          );
        }

        prevZoomWarpSampleRef.current = {
          logZoom: value,
          camera: nextCamera,
          time: now,
        };
      } else if (!prevZoomSample) {
        prevZoomWarpSampleRef.current = {
          logZoom: value,
          camera: nextCamera,
          time: now,
        };
      }
    }

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

  // Muting changes row packing, so it has to re-layout even though the camera
  // has not moved.
  useEffect(() => {
    if (!hasBootstrappedRef.current) return;
    updateLayout();
  }, [dimmedEventIds, layoutMode, timelineLanes, eventLaneIds]);

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
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let previousWidth = 0;
    let previousHeight = 0;
    let frameId: number | null = null;
    const syncViewportGeometry = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (
        width <= 0 ||
        height <= 0 ||
        (width === previousWidth && height === previousHeight)
      ) {
        return;
      }
      previousWidth = width;
      previousHeight = height;
      if (!hasBootstrappedRef.current || frameId !== null) return;

      frameId = requestAnimationFrame(() => {
        frameId = null;
        updateVisibleBounds();
        updateTicks();
        updateLayout(true);
      });
    };

    const observer = new ResizeObserver(syncViewportGeometry);
    observer.observe(container);
    syncViewportGeometry();
    return () => {
      observer.disconnect();
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [
    containerRef,
    dimmedEventIds,
    eventLaneIds,
    layoutMode,
    orientation,
    renderedTimelineEvents,
    timelineLanes,
    verticalTimeDirection,
  ]);

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
      if (panSettleTimeoutRef.current !== null) {
        window.clearTimeout(panSettleTimeoutRef.current);
        panSettleTimeoutRef.current = null;
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
        const nextLogZoom = clampLogZoom(currentLogZoom + zoomSpeed);

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
    warpPivot,
    isWarpPivotExact,
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
