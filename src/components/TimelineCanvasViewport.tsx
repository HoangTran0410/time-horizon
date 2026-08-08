import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { MotionValue } from "motion/react";
import {
  Event,
  SupportedLanguage,
  TimelineOrientation,
  VerticalTimeDirection,
} from "../constants/types";
import { BIG_BANG_YEAR, SPAN_MIN_RENDER_PX } from "../constants";
import { resolveThemeMode, ThemeMode } from "../constants/theme";
import { CANVAS_FONT_PRESETS } from "../constants/typography";
import {
  formatElapsedTimelineTime,
  getEventDisplayLabel,
  formatTimelineTick,
  withAlpha,
  getCollapsedGroupOffset,
  getEventTimelineEndYear,
  getEventTimelineRange,
  getEventTimelineYear,
} from "../helpers";
import { getLocalizedEventTitle } from "../helpers/localization";
import { useI18n } from "../i18n";
import {
  CollapsedEventGroup,
  ExpandedCollapsedGroup,
  EventLayoutState,
  TimelineTick,
} from "../constants/types";

interface TimelineCanvasViewportProps {
  theme: ThemeMode;
  language: SupportedLanguage;
  containerRef: React.RefObject<HTMLDivElement | null>;
  backgroundLayer?: React.ReactNode;
  isInteractionDisabled?: boolean;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
  orientation: TimelineOrientation;
  verticalTimeDirection: VerticalTimeDirection;
  ticks: TimelineTick[];
  timelineEvents: Event[];
  collapsedGroups: CollapsedEventGroup[];
  expandedCollapsedGroup: ExpandedCollapsedGroup | null;
  visibleBounds: {
    startYear: number;
    endYear: number;
  };
  eventLayouts: Record<string, EventLayoutState>;
  focusedEventId: string | null;
  rulerEvent: Event | null;
  eventAccentColors: Record<string, string | null>;
  onRenderFrame: (now: number) => void;
  onWheel: (e: globalThis.WheelEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  consumeClickSuppression: () => boolean;
  onFocusBigBang: () => void;
  onFocusEvent: (event: Event) => void;
  onFocusCollapsedGroup: (group: CollapsedEventGroup) => void;
}

type HitTarget =
  | { type: "event"; event: Event }
  | { type: "collapsed"; group: CollapsedEventGroup }
  | { type: "bigbang" };

interface VisibleCanvasEvent {
  event: Event;
  year: number;
  /** End of a span event, or null when the event is a point in time. */
  endYear: number | null;
  label: string;
}

interface VisibleCanvasTick {
  tick: TimelineTick;
  label: string;
}

/**
 * A tick being drawn, plus the two values that ease over time: `opacity` for
 * appear/disappear and `highlight` (0..1) for the bold/major transition.
 *
 * Deliberately plain numbers advanced inside the existing render loop rather
 * than MotionValues — one animation instance and subscription per tick showed
 * up on low-end mobile, and ticks churn constantly while zooming.
 */
interface AnimatedCanvasTick extends VisibleCanvasTick {
  opacity: number;
  opacityTarget: number;
  highlight: number;
  highlightTarget: number;
}

/** Time constants (ms) for tick easing. Short, so extra frames stay bounded. */
const TICK_FADE_MS = 190;
const TICK_HIGHLIGHT_MS = 220;
/** Below this the value is treated as settled, so the loop can stop. */
const TICK_ANIM_EPSILON = 0.004;

/**
 * Frame-rate independent exponential approach. Returns the target exactly once
 * within epsilon so transitions terminate instead of asymptoting forever.
 */
const approach = (
  current: number,
  target: number,
  durationMs: number,
  deltaMs: number,
): number => {
  if (Math.abs(target - current) <= TICK_ANIM_EPSILON) return target;
  const t = 1 - Math.exp((-deltaMs * 5) / Math.max(1, durationMs));
  return current + (target - current) * t;
};

const EVENT_RADIUS = 24;
/** Thickness of a span bar, and how far past the viewport edge it may extend. */
const SPAN_BAR_THICKNESS = 10;
const SPAN_CLAMP_MARGIN_PX = 40;
const COLLAPSED_RADIUS = 22;
const EXPANDED_COLLAPSED_EVENT_RADIUS = 18;
const EXPANDED_COLLAPSED_MIN_SPACING = 42;
const EXPANDED_COLLAPSED_MAX_SPACING = 70;
const MAX_CANVAS_DPR = 1.5;
const TICK_LABEL_OFFSET_Y = 18;
const EVENT_LABEL_MAX_WIDTH = 120;
const EVENT_TITLE_LINE_HEIGHT = 14;
const EVENT_TITLE_MAX_LINES = 3;
const EVENT_LABEL_GAP = 4;
const MEDIA_BADGE_SIZE = 14;
const MEDIA_BADGE_GAP = 4;

const CANVAS_THEME = {
  dark: {
    axis: "#3c4858",
    yearZero: "rgba(148,163,184,0.24)",
    currentTimeLine: "rgba(52,211,153,0.34)",
    currentTimeFill: "rgba(11,20,24,0.94)",
    currentTimeStroke: "rgba(52,211,153,0.48)",
    currentTimeText: "#6ee7b7",
    tick: "#556274",
    tickHighlighted: "rgba(248,250,252,0.86)",
    tickText: "#8693a6",
    tickTextHighlighted: "rgba(248,250,252,0.92)",
    collapsedLine: "rgba(245,158,11,0.45)",
    collapsedLineHover: "rgba(251,191,36,0.9)",
    collapsedFill: "#10161d",
    collapsedStroke: "rgba(245,158,11,0.72)",
    collapsedStrokeHover: "rgba(251,191,36,0.95)",
    collapsedText: "#fcd34d",
    collapsedTextHover: "#fef3c7",
    defaultIdleLine: "#44505f",
    defaultIdleBorder: "#5d6879",
    defaultActiveLine: "#10b981",
    defaultActiveBorder: "#10b981",
    defaultActiveText: "#34d399",
    defaultActiveDate: "#10b981",
    eventFill: "#10161d",
    eventText: "#f5f7fa",
    eventDate: "#8a97aa",
    rulerLabelFill: "rgba(8,12,18,0.92)",
    rulerLabelText: "#fef3c7",
    bigBangLine: "rgba(245,158,11,0.5)",
    bigBangFill: "#10161d",
    bigBangStroke: "rgba(245,158,11,0.65)",
    bigBangText: "#f59e0b",
    bigBangBadgeText: "#fbbf24",
    mediaImageBadgeFill: "rgba(14,165,233,0.92)",
    mediaImageBadgeStroke: "rgba(186,230,253,0.9)",
    mediaImageBadgeIcon: "#eff6ff",
    mediaVideoBadgeFill: "rgba(239,68,68,0.92)",
    mediaVideoBadgeStroke: "rgba(254,202,202,0.9)",
    mediaVideoBadgeIcon: "#fff1f2",
  },
  light: {
    axis: "#bbb7af",
    yearZero: "rgba(98,109,122,0.16)",
    currentTimeLine: "rgba(13,148,136,0.28)",
    currentTimeFill: "rgba(240,253,250,0.96)",
    currentTimeStroke: "rgba(13,148,136,0.36)",
    currentTimeText: "#0f766e",
    tick: "#cbc6be",
    tickHighlighted: "rgba(79,89,100,0.58)",
    tickText: "#8f8a81",
    tickTextHighlighted: "#54606c",
    collapsedLine: "rgba(126,112,95,0.2)",
    collapsedLineHover: "rgba(126,112,95,0.42)",
    collapsedFill: "#f0ebe3",
    collapsedStroke: "rgba(126,112,95,0.3)",
    collapsedStrokeHover: "rgba(107,95,81,0.5)",
    collapsedText: "#7f6852",
    collapsedTextHover: "#665342",
    defaultIdleLine: "#c8c2ba",
    defaultIdleBorder: "#bbb5ad",
    defaultActiveLine: "#4d9b8b",
    defaultActiveBorder: "#4d9b8b",
    defaultActiveText: "#356f65",
    defaultActiveDate: "#447f73",
    eventFill: "#f1ece4",
    eventText: "#353d45",
    eventDate: "#767d85",
    rulerLabelFill: "rgba(243,239,232,0.96)",
    rulerLabelText: "#6c6258",
    bigBangLine: "rgba(125,114,100,0.18)",
    bigBangFill: "#ece6dd",
    bigBangStroke: "rgba(125,114,100,0.28)",
    bigBangText: "#7c6856",
    bigBangBadgeText: "#6b5a4a",
    mediaImageBadgeFill: "rgba(74,144,191,0.88)",
    mediaImageBadgeStroke: "rgba(200,225,241,0.95)",
    mediaImageBadgeIcon: "#f8fbfd",
    mediaVideoBadgeFill: "rgba(193,95,95,0.86)",
    mediaVideoBadgeStroke: "rgba(242,206,206,0.95)",
    mediaVideoBadgeIcon: "#fff9f7",
  },
} as const;

const drawImageBadgeIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.1;

  ctx.beginPath();
  ctx.arc(x + 4.1, y + 4, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 2.6, y + 10.3);
  ctx.lineTo(x + 5.8, y + 7.1);
  ctx.lineTo(x + 7.8, y + 8.9);
  ctx.lineTo(x + 10.4, y + 5.9);
  ctx.lineTo(x + 12, y + 7.7);
  ctx.stroke();
};

const drawVideoBadgeIcon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 4);
  ctx.lineTo(x + 10.6, y + 7);
  ctx.lineTo(x + 5, y + 10);
  ctx.closePath();
  ctx.fill();
};

const splitLongToken = (
  ctx: CanvasRenderingContext2D,
  token: string,
  maxWidth: number,
) => {
  if (ctx.measureText(token).width <= maxWidth) return [token];

  const parts: string[] = [];
  let current = "";
  for (const char of token) {
    const next = current + char;
    if (current && ctx.measureText(next).width > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
};

const truncateCanvasLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
) => {
  const ellipsis = "…";
  let next = line.trimEnd();
  while (next.length > 0 && ctx.measureText(next + ellipsis).width > maxWidth) {
    next = next.slice(0, -1).trimEnd();
  }
  return next.length > 0 ? next + ellipsis : ellipsis;
};

const wrapCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) => {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => splitLongToken(ctx, word, maxWidth));

  const rawLines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    rawLines.push(current);
    current = word;
  }

  if (current) rawLines.push(current);
  if (rawLines.length <= maxLines) return rawLines;

  const visibleLines = rawLines.slice(0, maxLines);
  visibleLines[maxLines - 1] = truncateCanvasLine(
    ctx,
    rawLines.slice(maxLines - 1).join(" "),
    maxWidth,
  );
  return visibleLines;
};

const getCurrentAbsoluteYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return year + (now.getTime() - start) / (end - start);
};

export const TimelineCanvasViewport: React.FC<TimelineCanvasViewportProps> = ({
  theme,
  language,
  containerRef,
  backgroundLayer = null,
  isInteractionDisabled = false,
  focusPixel,
  focusYear,
  zoom,
  orientation,
  verticalTimeDirection,
  ticks,
  timelineEvents,
  collapsedGroups,
  expandedCollapsedGroup,
  visibleBounds,
  eventLayouts,
  focusedEventId,
  rulerEvent,
  eventAccentColors,
  onRenderFrame,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  consumeClickSuppression,
  onFocusBigBang,
  onFocusEvent,
  onFocusCollapsedGroup,
}) => {
  const { t } = useI18n();
  const axisDirection =
    orientation === "vertical" && verticalTimeDirection === "up" ? -1 : 1;
  const canvasTheme = CANVAS_THEME[resolveThemeMode(theme)];
  const currentTimeLabel = t("rightNow");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef({
    timelineEvents,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds,
    visibleEvents: [] as VisibleCanvasEvent[],
    eventLayouts,
    focusedEventId,
    rulerEvent,
    eventAccentColors,
  });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const hoveredRef = useRef<{
    type: HitTarget["type"] | null;
    id: string | null;
  }>({
    type: null,
    id: null,
  });
  const renderFrameRef = useRef<number | null>(null);
  const renderCanvasRef = useRef<() => void>(() => {});
  const onRenderFrameRef = useRef(onRenderFrame);
  const wrappedEventTitleCacheRef = useRef(new Map<string, string[]>());
  const cursorRef = useRef<"grab" | "grabbing" | "pointer">("grab");
  const rulerPointerRef = useRef<{
    x: number;
    y: number;
    isVisible: boolean;
  }>({
    x: 0,
    y: 0,
    isVisible: false,
  });
  const hoverFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const tickTransitionsRef = useRef(new Map<number, AnimatedCanvasTick>());
  const lastTickAnimTimeRef = useRef<number | null>(null);
  const prefersReducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      prefersReducedMotionRef.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    onRenderFrameRef.current = onRenderFrame;
  }, [onRenderFrame]);

  useEffect(() => {
    wrappedEventTitleCacheRef.current.clear();
  }, [language, timelineEvents]);

  const requestRender = useCallback(() => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame((now) => {
      renderFrameRef.current = null;
      renderCanvasRef.current();
      onRenderFrameRef.current(now);
    });
  }, []);

  const renderNow = useCallback((now: number) => {
    if (renderFrameRef.current !== null) {
      cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
    }

    renderCanvasRef.current();
    onRenderFrameRef.current(now);
  }, []);

  /**
   * Is any canvas-owned animation still in flight? Only visible events are
   * checked — an off-screen event easing into place needs no frames — so this
   * stays far cheaper than the repaint it guards.
   */
  const hasPendingCanvasAnimation = useCallback(() => {
    const { visibleEvents, eventLayouts: layouts } = latestRef.current;

    for (const { event } of visibleEvents) {
      const layout = layouts[event.id];
      if (!layout) continue;
      // Epsilons, not equality: a spring approaches its target asymptotically
      // and equality could keep the loop spinning forever.
      if (Math.abs(layout.opacity.get() - layout.targetOpacity) > 0.002) {
        return true;
      }
      if (Math.abs(layout.y.get() - layout.targetY) > 0.05) return true;
    }

    for (const entry of tickTransitionsRef.current.values()) {
      if (entry.opacity !== entry.opacityTarget) return true;
      if (entry.highlight !== entry.highlightTarget) return true;
    }

    return false;
  }, []);

  const updateCursor = (nextCursor: "grab" | "grabbing" | "pointer") => {
    if (cursorRef.current === nextCursor) return;
    cursorRef.current = nextCursor;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.cursor =
      nextCursor === "pointer"
        ? "pointer"
        : nextCursor === "grabbing"
          ? "grabbing"
          : "grab";
  };

  useEffect(() => {
    const margin = (visibleBounds.endYear - visibleBounds.startYear) * 0.3;
    const minVisibleYear = visibleBounds.startYear - margin;
    const maxVisibleYear = visibleBounds.endYear + margin;
    const nextVisibleEvents: VisibleCanvasEvent[] = [];
    for (const event of timelineEvents) {
      const year = getEventTimelineYear(event);
      const endYear = getEventTimelineEndYear(event);
      // Overlap test so a span crossing the whole viewport is not culled for
      // having both of its endpoints off screen.
      if (
        event.id !== focusedEventId &&
        ((endYear ?? year) < minVisibleYear || year > maxVisibleYear)
      ) {
        continue;
      }
      nextVisibleEvents.push({
        event,
        year,
        endYear,
        label: getEventDisplayLabel(event, language),
      });
    }

    // Reconcile the animated tick map. Ticks that left the incoming set are
    // kept around with opacityTarget 0 so they fade out instead of vanishing;
    // the render loop drops them once they reach zero.
    const animated = tickTransitionsRef.current;
    const incomingYears = new Set<number>();

    for (const tick of ticks) {
      incomingYears.add(tick.year);
      const label = formatTimelineTick(tick.year, tick.interval, language);
      const highlightTarget = tick.isHighlighted ? 1 : 0;
      const existing = animated.get(tick.year);

      if (existing) {
        existing.tick = tick;
        existing.label = label;
        existing.opacityTarget = 1;
        existing.highlightTarget = highlightTarget;
      } else {
        animated.set(tick.year, {
          tick,
          label,
          // Appear from transparent, but snap when motion is unwanted.
          opacity: prefersReducedMotionRef.current ? 1 : 0,
          opacityTarget: 1,
          highlight: highlightTarget,
          highlightTarget,
        });
      }
    }

    for (const [year, entry] of animated) {
      if (!incomingYears.has(year)) {
        entry.opacityTarget = 0;
      }
    }

    latestRef.current = {
      timelineEvents,
      collapsedGroups,
      expandedCollapsedGroup,
      visibleBounds,
      visibleEvents: nextVisibleEvents,
      eventLayouts,
      focusedEventId,
      rulerEvent,
      eventAccentColors,
    };
  }, [
    language,
    ticks,
    timelineEvents,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds,
    eventLayouts,
    focusedEventId,
    rulerEvent,
    eventAccentColors,
    orientation,
    verticalTimeDirection,
  ]);

  useEffect(() => {
    requestRender();
  }, [
    language,
    ticks,
    timelineEvents,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds,
    eventLayouts,
    focusedEventId,
    rulerEvent,
    eventAccentColors,
    orientation,
    verticalTimeDirection,
    requestRender,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      updateCursor(cursorRef.current);
      requestRender();
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, requestRender]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (isInteractionDisabled) {
        return;
      }
      onWheel(event);
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, [containerRef, isInteractionDisabled, onWheel]);

  const getPrimaryScreenPosition = (year: number) =>
    focusPixel.get() + (year - focusYear.get()) * zoom.get() * axisDirection;

  const getCrossCenter = (width: number, height: number) =>
    orientation === "horizontal" ? height / 2 : width / 2;

  const toCanvasPoint = (
    primary: number,
    cross: number,
    width: number,
    height: number,
  ) => {
    const crossCenter = getCrossCenter(width, height);
    return orientation === "horizontal"
      ? { x: primary, y: crossCenter + cross }
      : { x: crossCenter + cross, y: primary };
  };

  const getPrimarySize = (width: number, height: number) =>
    orientation === "horizontal" ? width : height;

  const getCrossSize = (width: number, height: number) =>
    orientation === "horizontal" ? height : width;

  const getExpandedCollapsedEventPositions = (
    group: ExpandedCollapsedGroup,
    width: number,
    height: number,
    viewportHeight: number,
  ) => {
    const events = group.eventIds
      .map((eventId) => timelineEvents.find((event) => event.id === eventId))
      .filter((event): event is Event => event !== undefined);
    const anchorPrimary = getPrimaryScreenPosition(group.year);
    const rowCross = group.side * getCollapsedGroupOffset(viewportHeight);

    if (events.length === 0) {
      return {
        anchorPrimary,
        rowCross,
        events: [] as Array<{
          event: Event;
          primary: number;
          cross: number;
          x: number;
          y: number;
        }>,
      };
    }

    const availablePrimarySpace = Math.max(
      200,
      getPrimarySize(width, height) - 120,
    );
    const spacing =
      events.length <= 1
        ? 0
        : Math.max(
            EXPANDED_COLLAPSED_MIN_SPACING,
            Math.min(
              EXPANDED_COLLAPSED_MAX_SPACING,
              availablePrimarySpace / (events.length - 1),
            ),
          );
    const totalPrimarySpan = spacing * Math.max(0, events.length - 1);
    const startPrimary = anchorPrimary - totalPrimarySpan / 2;

    return {
      anchorPrimary,
      rowCross,
      events: events.map((event, index) => ({
        event,
        primary: startPrimary + index * spacing,
        cross: rowCross,
        ...toCanvasPoint(startPrimary + index * spacing, rowCross, width, height),
      })),
    };
  };

  const getPointerPosition = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      primary:
        orientation === "horizontal" ? clientX - rect.left : clientY - rect.top,
      cross:
        orientation === "horizontal" ? clientY - rect.top : clientX - rect.left,
      width: rect.width,
      height: rect.height,
    };
  };

  const findHitTarget = (
    clientX: number,
    clientY: number,
  ): HitTarget | null => {
    const pointer = getPointerPosition(clientX, clientY);
    if (!pointer) return null;

    const { x, y, width, height } = pointer;
    const crossSize = getCrossSize(width, height);
    const {
      visibleEvents: currentVisibleEvents,
      collapsedGroups: currentCollapsedGroups,
      expandedCollapsedGroup: currentExpandedCollapsedGroup,
      eventLayouts: currentEventLayouts,
    } = latestRef.current;

    if (currentExpandedCollapsedGroup) {
      const expandedLayout = getExpandedCollapsedEventPositions(
        currentExpandedCollapsedGroup,
        width,
        height,
        crossSize,
      );

      for (const item of expandedLayout.events) {
        if (
          Math.hypot(x - item.x, y - item.y) <= EXPANDED_COLLAPSED_EVENT_RADIUS
        ) {
          return { type: "event", event: item.event };
        }
      }

      if (
        Math.hypot(
          x - toCanvasPoint(expandedLayout.anchorPrimary, expandedLayout.rowCross, width, height).x,
          y - toCanvasPoint(expandedLayout.anchorPrimary, expandedLayout.rowCross, width, height).y,
        ) <=
        COLLAPSED_RADIUS
      ) {
        return {
          type: "collapsed",
          group: {
            id: currentExpandedCollapsedGroup.id,
            year: currentExpandedCollapsedGroup.year,
            side: currentExpandedCollapsedGroup.side,
            count: currentExpandedCollapsedGroup.eventIds.length,
            eventIds: currentExpandedCollapsedGroup.eventIds,
          },
        };
      }
    }

    for (const group of currentCollapsedGroups) {
      const groupPoint = toCanvasPoint(
        getPrimaryScreenPosition(group.year),
        group.side * getCollapsedGroupOffset(crossSize),
        width,
        height,
      );
      const groupX = groupPoint.x;
      const groupY = groupPoint.y;
      if (Math.hypot(x - groupX, y - groupY) <= COLLAPSED_RADIUS) {
        return { type: "collapsed", group };
      }
    }

    const hitPrimarySize = getPrimarySize(width, height);

    for (let index = currentVisibleEvents.length - 1; index >= 0; index -= 1) {
      const visibleEvent = currentVisibleEvents[index];
      const layout = currentEventLayouts[visibleEvent.event.id];
      if (!layout || layout.opacity.get() < 0.35) continue;

      // Mirror the draw path: the marker of a span sits at the middle of the
      // clamped bar, not at its start, so the circle test must use the same
      // anchor or the clickable area drifts away from what is drawn.
      const startPrimary = getPrimaryScreenPosition(visibleEvent.year);
      const endPrimary =
        visibleEvent.endYear === null
          ? null
          : getPrimaryScreenPosition(visibleEvent.endYear);
      const hasVisibleSpan =
        endPrimary !== null &&
        Math.abs(endPrimary - startPrimary) >= SPAN_MIN_RENDER_PX;

      let markerPrimary = startPrimary;
      let barStartPrimary = startPrimary;
      let barEndPrimary = startPrimary;
      if (hasVisibleSpan && endPrimary !== null) {
        barStartPrimary = Math.max(
          Math.min(startPrimary, endPrimary),
          -SPAN_CLAMP_MARGIN_PX,
        );
        barEndPrimary = Math.min(
          Math.max(startPrimary, endPrimary),
          hitPrimarySize + SPAN_CLAMP_MARGIN_PX,
        );
        markerPrimary = (barStartPrimary + barEndPrimary) / 2;
      }

      const { x: eventX, y: eventY } = toCanvasPoint(
        markerPrimary,
        layout.y.get(),
        width,
        height,
      );
      if (Math.hypot(x - eventX, y - eventY) <= EVENT_RADIUS) {
        return { type: "event", event: visibleEvent.event };
      }

      // Anywhere along the bar is a valid target too.
      if (hasVisibleSpan) {
        const barStart = toCanvasPoint(
          barStartPrimary,
          layout.y.get(),
          width,
          height,
        );
        const barEnd = toCanvasPoint(
          barEndPrimary,
          layout.y.get(),
          width,
          height,
        );
        const halfThickness = SPAN_BAR_THICKNESS / 2 + 4;
        const withinBar =
          orientation === "horizontal"
            ? x >= Math.min(barStart.x, barEnd.x) &&
              x <= Math.max(barStart.x, barEnd.x) &&
              Math.abs(y - barStart.y) <= halfThickness
            : y >= Math.min(barStart.y, barEnd.y) &&
              y <= Math.max(barStart.y, barEnd.y) &&
              Math.abs(x - barStart.x) <= halfThickness;

        if (withinBar) {
          return { type: "event", event: visibleEvent.event };
        }
      }
    }

    const primarySize = hitPrimarySize;
    const bigBangPrimary = getPrimaryScreenPosition(BIG_BANG_YEAR);
    const shouldRenderBigBangBadge =
      axisDirection === 1 ? bigBangPrimary > primarySize : bigBangPrimary < 0;
    if (bigBangPrimary >= 0 && bigBangPrimary <= primarySize) {
      const bigBangPoint = toCanvasPoint(bigBangPrimary, 0, width, height);
      if (Math.abs(x - bigBangPoint.x) <= 24 && Math.abs(y - bigBangPoint.y) <= 28) {
        return { type: "bigbang" };
      }
    } else if (shouldRenderBigBangBadge) {
      const badgePrimary = primarySize - 78;
      const badgePoint = toCanvasPoint(badgePrimary, 0, width, height);
      if (Math.abs(x - badgePoint.x) <= 54 && Math.abs(y - badgePoint.y) <= 24) {
        return { type: "bigbang" };
      }
    }

    return null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderCanvasRef.current = () => {
      const { width, height, dpr } = sizeRef.current;
      if (width <= 0 || height <= 0) return;

      const {
        visibleEvents: currentVisibleEvents,
        collapsedGroups: currentCollapsedGroups,
        expandedCollapsedGroup: currentExpandedCollapsedGroup,
        eventLayouts: currentEventLayouts,
        focusedEventId: currentFocusedEventId,
        rulerEvent: currentRulerEvent,
        eventAccentColors: currentEventAccentColors,
      } = latestRef.current;
      const hoveredTarget = hoveredRef.current;

      const primarySize = getPrimarySize(width, height);
      const crossSize = getCrossSize(width, height);
      const crossCenter = getCrossCenter(width, height);
      const currentTimeYear = getCurrentAbsoluteYear();
      const snap = (value: number) => Math.round(value * dpr) / dpr;
      const setTextStyle = ({
        font,
        fillStyle,
        textAlign,
        textBaseline,
      }: {
        font?: string;
        fillStyle?: string;
        textAlign?: CanvasTextAlign;
        textBaseline?: CanvasTextBaseline;
      }) => {
        if (font && ctx.font !== font) {
          ctx.font = font;
        }
        if (fillStyle && ctx.fillStyle !== fillStyle) {
          ctx.fillStyle = fillStyle;
        }
        if (textAlign && ctx.textAlign !== textAlign) {
          ctx.textAlign = textAlign;
        }
        if (textBaseline && ctx.textBaseline !== textBaseline) {
          ctx.textBaseline = textBaseline;
        }
      };
      const getWrappedEventTitle = (event: Event) => {
        const localizedTitle = getLocalizedEventTitle(event, language);
        const cacheKey = [
          event.id,
          localizedTitle,
          CANVAS_FONT_PRESETS.eventTitle,
          EVENT_LABEL_MAX_WIDTH,
          EVENT_TITLE_MAX_LINES,
        ].join("|");
        const cached = wrappedEventTitleCacheRef.current.get(cacheKey);
        if (cached) return cached;

        setTextStyle({ font: CANVAS_FONT_PRESETS.eventTitle });
        const wrapped = wrapCanvasText(
          ctx,
          localizedTitle,
          EVENT_LABEL_MAX_WIDTH,
          EVENT_TITLE_MAX_LINES,
        );
        wrappedEventTitleCacheRef.current.set(cacheKey, wrapped);
        return wrapped;
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = canvasTheme.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (orientation === "horizontal") {
        ctx.moveTo(0, snap(crossCenter));
        ctx.lineTo(width, snap(crossCenter));
      } else {
        ctx.moveTo(snap(crossCenter), 0);
        ctx.lineTo(snap(crossCenter), height);
      }
      ctx.stroke();

      const yearZeroPrimary = getPrimaryScreenPosition(0);
      if (yearZeroPrimary >= 0 && yearZeroPrimary <= primarySize) {
        const yearZeroPoint = toCanvasPoint(yearZeroPrimary, 0, width, height);
        ctx.strokeStyle = canvasTheme.yearZero;
        ctx.beginPath();
        if (orientation === "horizontal") {
          ctx.moveTo(snap(yearZeroPoint.x), 0);
          ctx.lineTo(snap(yearZeroPoint.x), height);
        } else {
          ctx.moveTo(0, snap(yearZeroPoint.y));
          ctx.lineTo(width, snap(yearZeroPoint.y));
        }
        ctx.stroke();
      }

      const currentTimePrimary = getPrimaryScreenPosition(currentTimeYear);
      if (currentTimePrimary >= 0 && currentTimePrimary <= primarySize) {
        const currentTimePoint = toCanvasPoint(currentTimePrimary, 0, width, height);
        const snappedCurrentTimeX = snap(currentTimePoint.x);
        const snappedCurrentTimeY = snap(currentTimePoint.y);
        ctx.strokeStyle = canvasTheme.currentTimeLine;
        ctx.beginPath();
        if (orientation === "horizontal") {
          ctx.moveTo(snappedCurrentTimeX, 0);
          ctx.lineTo(snappedCurrentTimeX, height);
        } else {
          ctx.moveTo(0, snappedCurrentTimeY);
          ctx.lineTo(width, snappedCurrentTimeY);
        }
        ctx.stroke();

        const labelHeight = 24;
        const labelPaddingX = 10;
        setTextStyle({
          font: CANVAS_FONT_PRESETS.tickHighlighted,
          textAlign: "center",
          textBaseline: "middle",
        });
        const labelWidth =
          ctx.measureText(currentTimeLabel).width + labelPaddingX * 2;
        ctx.fillStyle = canvasTheme.currentTimeFill;
        ctx.strokeStyle = canvasTheme.currentTimeStroke;
        ctx.beginPath();
        ctx.roundRect(
          snap(snappedCurrentTimeX - labelWidth / 2),
          snap(snappedCurrentTimeY - labelHeight / 2),
          labelWidth,
          labelHeight,
          12,
        );
        ctx.fill();
        ctx.stroke();

        setTextStyle({
          font: CANVAS_FONT_PRESETS.tickHighlighted,
          fillStyle: canvasTheme.currentTimeText,
          textAlign: "center",
          textBaseline: "middle",
        });
        ctx.fillText(currentTimeLabel, snappedCurrentTimeX, snappedCurrentTimeY);
      }

      // Advance tick easing once per frame, then draw. `hasActiveTickAnimation`
      // decides whether we need to keep the loop alive after this frame.
      const animatedTicks = tickTransitionsRef.current;
      const nowMs = performance.now();
      const lastAnimTime = lastTickAnimTimeRef.current;
      // Clamp dt so a backgrounded tab does not resume with one giant step.
      const deltaMs =
        lastAnimTime === null ? 16.7 : Math.min(64, nowMs - lastAnimTime);
      lastTickAnimTimeRef.current = nowMs;
      const skipTickAnimation = prefersReducedMotionRef.current;
      let hasActiveTickAnimation = false;

      for (const [year, entry] of animatedTicks) {
        if (skipTickAnimation) {
          entry.opacity = entry.opacityTarget;
          entry.highlight = entry.highlightTarget;
        } else {
          entry.opacity = approach(
            entry.opacity,
            entry.opacityTarget,
            TICK_FADE_MS,
            deltaMs,
          );
          entry.highlight = approach(
            entry.highlight,
            entry.highlightTarget,
            TICK_HIGHLIGHT_MS,
            deltaMs,
          );
        }

        if (entry.opacity <= 0 && entry.opacityTarget === 0) {
          animatedTicks.delete(year);
          continue;
        }

        if (
          entry.opacity !== entry.opacityTarget ||
          entry.highlight !== entry.highlightTarget
        ) {
          hasActiveTickAnimation = true;
        }

        const { tick, label, opacity, highlight } = entry;
        const primary = getPrimaryScreenPosition(tick.year);
        if (primary < -120 || primary > primarySize + 120) continue;
        const tickPoint = toCanvasPoint(primary, 0, width, height);

        // Geometry eases continuously; font and colour swap at the midpoint,
        // where the moving length already carries the change.
        const isMostlyHighlighted = highlight >= 0.5;
        const tickLength = 9 + highlight * 5;
        const labelShift = highlight * 5;

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = isMostlyHighlighted
          ? canvasTheme.tickHighlighted
          : canvasTheme.tick;
        ctx.beginPath();
        if (orientation === "horizontal") {
          ctx.moveTo(snap(tickPoint.x), snap(crossCenter - 6));
          ctx.lineTo(snap(tickPoint.x), snap(crossCenter + tickLength));
        } else {
          ctx.moveTo(snap(crossCenter - 6), snap(tickPoint.y));
          ctx.lineTo(snap(crossCenter + tickLength), snap(tickPoint.y));
        }
        ctx.stroke();

        setTextStyle({
          font: isMostlyHighlighted
            ? CANVAS_FONT_PRESETS.tickHighlighted
            : CANVAS_FONT_PRESETS.tick,
          fillStyle: isMostlyHighlighted
            ? canvasTheme.tickTextHighlighted
            : canvasTheme.tickText,
          textAlign: "center",
          textBaseline: "middle",
        });
        const labelPoint =
          orientation === "horizontal"
            ? {
                x: snap(tickPoint.x),
                y: snap(crossCenter + TICK_LABEL_OFFSET_Y + labelShift),
              }
            : {
                x: snap(crossCenter + TICK_LABEL_OFFSET_Y + labelShift),
                y: snap(tickPoint.y),
              };
        ctx.fillText(label, labelPoint.x, labelPoint.y);
        ctx.globalAlpha = 1;
      }

      for (const group of currentCollapsedGroups) {
        const isExpanded =
          currentExpandedCollapsedGroup?.side === group.side &&
          Math.abs(currentExpandedCollapsedGroup.year - group.year) < 1e-9;
        const groupPoint = toCanvasPoint(
          getPrimaryScreenPosition(group.year),
          group.side * getCollapsedGroupOffset(crossSize),
          width,
          height,
        );
        const groupX = snap(groupPoint.x);
        const groupY = snap(groupPoint.y);
        const isHovered =
          hoveredTarget.type === "collapsed" && hoveredTarget.id === group.id;
        const radius = isHovered ? 24 : COLLAPSED_RADIUS;
        ctx.strokeStyle = isHovered
          ? canvasTheme.collapsedLineHover
          : canvasTheme.collapsedLine;
        ctx.beginPath();
        if (orientation === "horizontal") {
          ctx.moveTo(groupX, snap(crossCenter));
        } else {
          ctx.moveTo(snap(crossCenter), groupY);
        }
        ctx.lineTo(groupX, groupY);
        ctx.stroke();

        if (isExpanded && currentExpandedCollapsedGroup) {
          const expandedLayout = getExpandedCollapsedEventPositions(
            currentExpandedCollapsedGroup,
            width,
            height,
            crossSize,
          );

          if (expandedLayout.events.length > 0) {
            ctx.strokeStyle = isHovered
              ? canvasTheme.collapsedLineHover
              : canvasTheme.collapsedLine;
            ctx.beginPath();
            const firstPoint = expandedLayout.events[0]!;
            const lastPoint =
              expandedLayout.events[expandedLayout.events.length - 1]!;
            ctx.moveTo(snap(firstPoint.x), snap(firstPoint.y));
            ctx.lineTo(snap(lastPoint.x), snap(lastPoint.y));
            ctx.stroke();
          }

          for (const item of expandedLayout.events) {
            const itemX = snap(item.x);
            const itemY = snap(item.y);
            const isItemHovered =
              hoveredTarget.type === "event" &&
              hoveredTarget.id === item.event.id;
            const isItemFocused = item.event.id === currentFocusedEventId;
            const isItemHighlighted = isItemHovered || isItemFocused;
            const accentColor =
              currentEventAccentColors[item.event.id] ??
              canvasTheme.defaultActiveBorder;

            ctx.beginPath();
            ctx.moveTo(groupX, groupY);
            ctx.lineTo(itemX, itemY);
            ctx.strokeStyle = withAlpha(accentColor, 0.35);
            ctx.stroke();

            ctx.fillStyle = canvasTheme.eventFill;
            ctx.strokeStyle = isItemHighlighted
              ? accentColor
              : withAlpha(accentColor, 0.7);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
              itemX,
              itemY,
              isItemHighlighted
                ? EXPANDED_COLLAPSED_EVENT_RADIUS + 2
                : EXPANDED_COLLAPSED_EVENT_RADIUS,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.stroke();

            setTextStyle({
              font: CANVAS_FONT_PRESETS.collapsedEventEmoji,
              fillStyle: "#ffffff",
              textAlign: "center",
              textBaseline: "middle",
            });
            ctx.fillText(item.event.emoji, itemX, snap(itemY + 1));
          }
        }

        ctx.fillStyle = canvasTheme.collapsedFill;
        ctx.strokeStyle = isHovered
          ? canvasTheme.collapsedStrokeHover
          : canvasTheme.collapsedStroke;
        ctx.beginPath();
        ctx.arc(groupX, groupY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        setTextStyle({
          font: CANVAS_FONT_PRESETS.collapsedCounter,
          fillStyle: isHovered
            ? canvasTheme.collapsedTextHover
            : canvasTheme.collapsedText,
          textAlign: "center",
          textBaseline: "middle",
        });
        ctx.fillText(
          isExpanded ? "−" : group.count > 99 ? "+99" : `+${group.count}`,
          groupX,
          groupY,
        );
      }

      // Move hovered and selected events to the end so they render on top (selected on very top).
      if (hoveredTarget.type === "event" && hoveredTarget.id !== currentFocusedEventId) {
        const idx = currentVisibleEvents.findIndex(
          (v) => v.event.id === hoveredTarget.id,
        );
        if (idx !== -1) {
          const [hovered] = currentVisibleEvents.splice(idx, 1);
          currentVisibleEvents.push(hovered);
        }
      }
      if (currentFocusedEventId) {
        const idx = currentVisibleEvents.findIndex(
          (v) => v.event.id === currentFocusedEventId,
        );
        if (idx !== -1) {
          const [focused] = currentVisibleEvents.splice(idx, 1);
          currentVisibleEvents.push(focused);
        }
      }

      for (const visibleEvent of currentVisibleEvents) {
        const { event, year, endYear, label } = visibleEvent;
        const layout = currentEventLayouts[event.id];
        if (!layout) continue;
        const alpha = layout.opacity.get();
        if (alpha <= 0.02) continue;

        // Span geometry. The bar is clamped to the viewport before drawing —
        // at high zoom the untruncated rect is millions of pixels wide, which
        // some canvas implementations refuse to fill at all.
        const spanStartPrimary = getPrimaryScreenPosition(year);
        const spanEndPrimary =
          endYear === null ? null : getPrimaryScreenPosition(endYear);
        const hasVisibleSpan =
          spanEndPrimary !== null &&
          Math.abs(spanEndPrimary - spanStartPrimary) >= SPAN_MIN_RENDER_PX;

        // Anchor the marker to the middle of whatever part of the bar is on
        // screen, so the label of a long era stays readable while panning.
        let markerPrimary = spanStartPrimary;
        let clampedSpanStart = spanStartPrimary;
        let clampedSpanEnd = spanStartPrimary;
        if (hasVisibleSpan && spanEndPrimary !== null) {
          const rawStart = Math.min(spanStartPrimary, spanEndPrimary);
          const rawEnd = Math.max(spanStartPrimary, spanEndPrimary);
          clampedSpanStart = Math.max(rawStart, -SPAN_CLAMP_MARGIN_PX);
          clampedSpanEnd = Math.min(
            rawEnd,
            primarySize + SPAN_CLAMP_MARGIN_PX,
          );
          markerPrimary = (clampedSpanStart + clampedSpanEnd) / 2;
        }

        const point = toCanvasPoint(
          markerPrimary,
          layout.y.get(),
          width,
          height,
        );
        const eventX = snap(point.x);
        const eventY = snap(point.y);
        const isHovered =
          hoveredTarget.type === "event" && hoveredTarget.id === event.id;
        const isFocused = event.id === currentFocusedEventId;
        const isHighlighted = isFocused || isHovered;
        const radius = isHighlighted ? 26 : 24;
        const accentColor = currentEventAccentColors[event.id] ?? null;
        const idleLineColor = accentColor
          ? withAlpha(accentColor, 0.55)
          : canvasTheme.defaultIdleLine;
        const activeLineColor = accentColor ?? canvasTheme.defaultActiveLine;
        const idleBorderColor = accentColor ?? canvasTheme.defaultIdleBorder;
        const activeBorderColor =
          accentColor ?? canvasTheme.defaultActiveBorder;
        const activeTextColor = accentColor ?? canvasTheme.defaultActiveText;
        const activeDateColor = accentColor ?? canvasTheme.defaultActiveDate;

        ctx.save();
        ctx.globalAlpha = isHovered ? Math.max(alpha, 0.95) : alpha;

        // The span bar sits behind the stem and marker so the circle still
        // reads as the event's handle.
        if (hasVisibleSpan) {
          const barStart = toCanvasPoint(
            clampedSpanStart,
            layout.y.get(),
            width,
            height,
          );
          const barEnd = toCanvasPoint(
            clampedSpanEnd,
            layout.y.get(),
            width,
            height,
          );
          const barFill = accentColor
            ? withAlpha(accentColor, isHighlighted ? 0.42 : 0.26)
            : withAlpha(canvasTheme.defaultActiveLine, isHighlighted ? 0.36 : 0.22);
          const barStroke = accentColor
            ? withAlpha(accentColor, isHighlighted ? 0.95 : 0.6)
            : idleBorderColor;

          ctx.fillStyle = barFill;
          ctx.strokeStyle = barStroke;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (orientation === "horizontal") {
            const left = Math.min(barStart.x, barEnd.x);
            const barWidth = Math.abs(barEnd.x - barStart.x);
            ctx.roundRect(
              snap(left),
              snap(eventY - SPAN_BAR_THICKNESS / 2),
              barWidth,
              SPAN_BAR_THICKNESS,
              SPAN_BAR_THICKNESS / 2,
            );
          } else {
            const top = Math.min(barStart.y, barEnd.y);
            const barHeight = Math.abs(barEnd.y - barStart.y);
            ctx.roundRect(
              snap(eventX - SPAN_BAR_THICKNESS / 2),
              snap(top),
              SPAN_BAR_THICKNESS,
              barHeight,
              SPAN_BAR_THICKNESS / 2,
            );
          }
          ctx.fill();
          ctx.stroke();
        }

        ctx.strokeStyle = isHighlighted ? activeLineColor : idleLineColor;
        ctx.beginPath();
        if (orientation === "horizontal") {
          ctx.moveTo(eventX, snap(crossCenter));
        } else {
          ctx.moveTo(snap(crossCenter), eventY);
        }
        ctx.lineTo(eventX, eventY);
        ctx.stroke();

        ctx.fillStyle = canvasTheme.eventFill;
        ctx.beginPath();
        ctx.arc(eventX, eventY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isHighlighted ? activeBorderColor : idleBorderColor;
        ctx.stroke();

        const mediaBadges: Array<"image" | "video"> = [];
        if (event.image) mediaBadges.push("image");
        if (event.video) mediaBadges.push("video");

        mediaBadges.forEach((badge, index) => {
          const badgeX = snap(
            eventX +
              (orientation === "horizontal"
                ? radius - 4 - MEDIA_BADGE_SIZE / 2
                : -radius + 4 + MEDIA_BADGE_SIZE / 2),
          );
          const badgeY = snap(
            eventY - radius + 3 + index * (MEDIA_BADGE_SIZE + MEDIA_BADGE_GAP),
          );
          const isImageBadge = badge === "image";
          const fill = isImageBadge
            ? canvasTheme.mediaImageBadgeFill
            : canvasTheme.mediaVideoBadgeFill;
          const stroke = isImageBadge
            ? canvasTheme.mediaImageBadgeStroke
            : canvasTheme.mediaVideoBadgeStroke;
          const icon = isImageBadge
            ? canvasTheme.mediaImageBadgeIcon
            : canvasTheme.mediaVideoBadgeIcon;

          ctx.fillStyle = isHighlighted ? fill : withAlpha(fill, 0.88);
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(
            badgeX - MEDIA_BADGE_SIZE / 2,
            badgeY - MEDIA_BADGE_SIZE / 2,
            MEDIA_BADGE_SIZE,
            MEDIA_BADGE_SIZE,
            5,
          );
          ctx.fill();
          ctx.stroke();

          if (isImageBadge) {
            drawImageBadgeIcon(
              ctx,
              badgeX - MEDIA_BADGE_SIZE / 2,
              badgeY - MEDIA_BADGE_SIZE / 2,
              icon,
            );
          } else {
            drawVideoBadgeIcon(
              ctx,
              badgeX - MEDIA_BADGE_SIZE / 2,
              badgeY - MEDIA_BADGE_SIZE / 2,
              icon,
            );
          }
        });

        setTextStyle({
          font: CANVAS_FONT_PRESETS.eventEmoji,
          fillStyle: "#ffffff",
          textAlign: "center",
          textBaseline: "middle",
        });
        ctx.fillText(event.emoji, eventX, snap(eventY + 1));

        setTextStyle({
          font: CANVAS_FONT_PRESETS.eventTitle,
          fillStyle: isHighlighted ? activeTextColor : canvasTheme.eventText,
          textAlign: "center",
        });
        const titleLines = getWrappedEventTitle(event);
        const isBelowMarker = layout.y.get() > 0;
        const useStackedLabels =
          orientation === "horizontal" ||
          (orientation === "vertical" && width < 640);
        const stackedLabelsBelowEvent =
          orientation === "vertical" && width < 640 ? true : isBelowMarker;

        if (useStackedLabels) {
          setTextStyle({
            textBaseline: stackedLabelsBelowEvent ? "top" : "bottom",
          });

          if (stackedLabelsBelowEvent) {
            const titleTop = eventY + 34;
            titleLines.forEach((line, index) => {
              ctx.fillText(
                line,
                eventX,
                snap(titleTop + index * EVENT_TITLE_LINE_HEIGHT),
              );
            });
          } else {
            const titleBottom = eventY - 34;
            const firstLineY =
              titleBottom - (titleLines.length - 1) * EVENT_TITLE_LINE_HEIGHT;
            titleLines.forEach((line, index) => {
              ctx.fillText(
                line,
                eventX,
                snap(firstLineY + index * EVENT_TITLE_LINE_HEIGHT),
              );
            });
          }
        } else {
          setTextStyle({
            textBaseline: "middle",
            textAlign: isBelowMarker ? "left" : "right",
          });
          const titleX = eventX + (isBelowMarker ? 34 : -34);
          const firstLineY =
            eventY - ((titleLines.length - 1) * EVENT_TITLE_LINE_HEIGHT) / 2;
          titleLines.forEach((line, index) => {
            ctx.fillText(
              line,
              snap(titleX),
              snap(firstLineY + index * EVENT_TITLE_LINE_HEIGHT),
            );
          });
        }

        setTextStyle({
          font: CANVAS_FONT_PRESETS.eventDate,
          fillStyle: isHighlighted ? activeDateColor : canvasTheme.eventDate,
          textAlign:
            useStackedLabels
              ? "center"
              : isBelowMarker
                ? "left"
                : "right",
          textBaseline: useStackedLabels ? ctx.textBaseline : "middle",
        });
        if (useStackedLabels) {
          const dateY = stackedLabelsBelowEvent
            ? eventY +
              34 +
              titleLines.length * EVENT_TITLE_LINE_HEIGHT +
              EVENT_LABEL_GAP
            : eventY -
              34 -
              titleLines.length * EVENT_TITLE_LINE_HEIGHT -
              EVENT_LABEL_GAP;
          ctx.fillText(label, eventX, snap(dateY));
        } else {
          const labelX =
            eventX +
            (isBelowMarker
              ? 34
              : -34);
          const labelY =
            eventY +
            (titleLines.length * EVENT_TITLE_LINE_HEIGHT) / 2 +
            EVENT_LABEL_GAP +
            EVENT_TITLE_LINE_HEIGHT / 2;
          ctx.fillText(label, snap(labelX), snap(labelY));
        }

        ctx.restore();
      }

      if (currentRulerEvent && rulerPointerRef.current.isVisible) {
        const originLayout = currentEventLayouts[currentRulerEvent.id];
        if (originLayout && originLayout.opacity.get() > 0.02) {
          let targetX = rulerPointerRef.current.x;
          let targetY = rulerPointerRef.current.y;

          /**
           * A span has two ends worth measuring from, so the ruler anchors to
           * whichever is nearer the pointer. It used to always anchor to the
           * start, which for a long era sits far off-screen.
           */
          const anchorFor = (event: Event, layoutY: number) => {
            const range = getEventTimelineRange(event);
            const candidates =
              range.endYear > range.startYear
                ? [range.startYear, range.endYear]
                : [getEventTimelineYear(event)];

            let bestYear = candidates[0];
            let bestPoint = toCanvasPoint(
              getPrimaryScreenPosition(bestYear),
              layoutY,
              width,
              height,
            );
            let bestDistance = Math.hypot(
              targetX - bestPoint.x,
              targetY - bestPoint.y,
            );

            for (const year of candidates.slice(1)) {
              const point = toCanvasPoint(
                getPrimaryScreenPosition(year),
                layoutY,
                width,
                height,
              );
              const distance = Math.hypot(targetX - point.x, targetY - point.y);
              if (distance < bestDistance) {
                bestYear = year;
                bestPoint = point;
                bestDistance = distance;
              }
            }

            return { year: bestYear, point: bestPoint };
          };

          const originAnchor = anchorFor(currentRulerEvent, originLayout.y.get());
          const originYear = originAnchor.year;
          const originX = originAnchor.point.x;
          const originY = originAnchor.point.y;
          let targetYear =
            originYear +
            ((orientation === "horizontal" ? targetX - originX : targetY - originY) /
              zoom.get());
          const rulerHoveredEvent =
            hoveredTarget.type === "event" &&
            hoveredTarget.id !== currentRulerEvent.id
              ? currentVisibleEvents.find(
                  (visibleEvent) => visibleEvent.event.id === hoveredTarget.id,
                )
              : null;

          if (rulerHoveredEvent) {
            const hoveredLayout = currentEventLayouts[rulerHoveredEvent.event.id];
            if (hoveredLayout && hoveredLayout.opacity.get() > 0.02) {
              // Snap to the nearer end of the hovered event too, so a
              // span-to-span measurement can pick any pair of endpoints.
              const hoveredAnchor = anchorFor(
                rulerHoveredEvent.event,
                hoveredLayout.y.get(),
              );
              targetYear = hoveredAnchor.year;
              targetX = hoveredAnchor.point.x;
              targetY = hoveredAnchor.point.y;
            }
          }

          const originAccent =
            currentEventAccentColors[currentRulerEvent.id] ??
            canvasTheme.bigBangText;
          const deltaYears = targetYear - originYear;
          const rulerLabel = formatElapsedTimelineTime(deltaYears, language);
          const lineLength = Math.hypot(targetX - originX, targetY - originY);

          if (lineLength >= 8) {
            const snappedOriginX = snap(originX);
            const snappedOriginY = snap(originY);
            const snappedPointerX = snap(targetX);
            const snappedPointerY = snap(targetY);
            const normalX = -(targetY - originY) / lineLength;
            const normalY = (targetX - originX) / lineLength;
            const labelX = snap(targetX + normalX * 22);
            const labelY = snap(targetY + normalY * 22);
            const labelPaddingX = 10;
            const labelHeight = 24;

            ctx.save();
            ctx.setLineDash([8, 8]);
            ctx.strokeStyle = withAlpha(originAccent, 0.95);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(snappedOriginX, snappedOriginY);
            ctx.lineTo(snappedPointerX, snappedPointerY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = withAlpha(originAccent, 0.12);
            ctx.beginPath();
            ctx.arc(snappedOriginX, snappedOriginY, 30, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = originAccent;
            ctx.beginPath();
            ctx.arc(snappedPointerX, snappedPointerY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(snappedOriginX, snappedOriginY, 4.5, 0, Math.PI * 2);
            ctx.fill();

            setTextStyle({
              font: CANVAS_FONT_PRESETS.rulerLabel,
            });
            const labelWidth =
              ctx.measureText(rulerLabel).width + labelPaddingX * 2;
            ctx.fillStyle = canvasTheme.rulerLabelFill;
            ctx.strokeStyle = withAlpha(originAccent, 0.65);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(
              snap(labelX - labelWidth / 2),
              snap(labelY - labelHeight / 2),
              labelWidth,
              labelHeight,
              12,
            );
            ctx.fill();
            ctx.stroke();

            setTextStyle({
              fillStyle: canvasTheme.rulerLabelText,
              textAlign: "center",
              textBaseline: "middle",
            });
            ctx.fillText(rulerLabel, labelX, labelY);
            ctx.restore();
          }
        }
      }

      const bigBangPrimary = getPrimaryScreenPosition(BIG_BANG_YEAR);
      const shouldRenderBigBangBadge =
        axisDirection === 1 ? bigBangPrimary > primarySize : bigBangPrimary < 0;
      if (bigBangPrimary >= 0 && bigBangPrimary <= primarySize) {
        const bigBangPoint = toCanvasPoint(bigBangPrimary, 0, width, height);
        const snappedBigBangX = snap(bigBangPoint.x);
        const snappedBigBangY = snap(bigBangPoint.y);
        ctx.strokeStyle = canvasTheme.bigBangLine;
        ctx.beginPath();
        if (orientation === "horizontal") {
          ctx.moveTo(snappedBigBangX, 0);
          ctx.lineTo(snappedBigBangX, height);
        } else {
          ctx.moveTo(0, snappedBigBangY);
          ctx.lineTo(width, snappedBigBangY);
        }
        ctx.stroke();

        ctx.fillStyle = canvasTheme.bigBangFill;
        ctx.strokeStyle = canvasTheme.bigBangStroke;
        const labelWidth = 86;
        const labelHeight = 28;
        ctx.beginPath();
        ctx.roundRect(
          snap(snappedBigBangX - labelWidth / 2),
          snap(snappedBigBangY - labelHeight / 2),
          labelWidth,
          labelHeight,
          14,
        );
        ctx.fill();
        ctx.stroke();
        setTextStyle({
          font: CANVAS_FONT_PRESETS.bigBang,
          fillStyle: canvasTheme.bigBangText,
          textAlign: "center",
          textBaseline: "middle",
        });
        ctx.fillText("Big Bang", snappedBigBangX, snappedBigBangY);
      } else if (shouldRenderBigBangBadge) {
        const badgePoint = toCanvasPoint(primarySize - 78, 0, width, height);
        const badgeX = snap(badgePoint.x);
        const badgeY = snap(badgePoint.y);
        const badgeWidth = 92;
        const badgeHeight = 32;
        ctx.fillStyle = canvasTheme.bigBangFill;
        ctx.strokeStyle = canvasTheme.bigBangStroke;
        ctx.beginPath();
        ctx.roundRect(
          snap(badgeX - badgeWidth / 2),
          snap(badgeY - badgeHeight / 2),
          badgeWidth,
          badgeHeight,
          16,
        );
        ctx.fill();
        ctx.stroke();
        setTextStyle({
          font: CANVAS_FONT_PRESETS.bigBang,
          fillStyle: canvasTheme.bigBangBadgeText,
          textAlign: "center",
          textBaseline: "middle",
        });
        ctx.fillText("Big Bang", badgeX, badgeY);
      }

      // Keep the loop alive only while a tick is still easing. When everything
      // has settled this stops, so an idle timeline costs no frames.
      if (hasActiveTickAnimation) {
        requestRender();
      } else {
        lastTickAnimTimeRef.current = null;
      }
    };

    requestRender();
    return () => {
      renderCanvasRef.current = () => {};
      if (renderFrameRef.current !== null) {
        cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [
    axisDirection,
    canvasTheme,
    containerRef,
    focusPixel,
    focusYear,
    language,
    orientation,
    zoom,
  ]);

  useEffect(() => {
    const unsubscribeFocusPixel = focusPixel.on("change", requestRender);
    const unsubscribeFocusYear = focusYear.on("change", requestRender);
    const unsubscribeZoom = zoom.on("change", requestRender);

    return () => {
      unsubscribeFocusPixel();
      unsubscribeFocusYear();
      unsubscribeZoom();
    };
  }, [focusPixel, focusYear, zoom]);

  useEffect(() => {
    const needsAnimationLoop =
      timelineEvents.length > 0 ||
      collapsedGroups.length > 0 ||
      expandedCollapsedGroup !== null ||
      rulerEvent !== null;

    if (!needsAnimationLoop) {
      return;
    }

    // Canvas needs an explicit RAF loop while Motion animates event layout
    // values — those are mutated outside React, so there is no other signal.
    // Camera-only movement is handled by the MotionValue subscriptions above.
    //
    // The loop keeps ticking, but only *renders* when something is actually
    // moving. It previously redrew unconditionally, which meant a full canvas
    // repaint every frame forever as soon as a single event was loaded.
    let frameId = 0;
    const loop = (now: number) => {
      if (hasPendingCanvasAnimation()) {
        renderNow(now);
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    collapsedGroups.length,
    expandedCollapsedGroup,
    hasPendingCanvasAnimation,
    renderNow,
    rulerEvent,
    timelineEvents.length,
  ]);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    [],
  );

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isInteractionDisabled) return;
    const pointer = getPointerPosition(e.clientX, e.clientY);
    if (pointer) {
      rulerPointerRef.current = {
        x: pointer.x,
        y: pointer.y,
        isVisible: latestRef.current.rulerEvent !== null,
      };
    }

    onPointerMove(e);

    pendingPointerRef.current = { x: e.clientX, y: e.clientY };
    if (hoverFrameRef.current !== null) {
      return;
    }

    // Batch hover hit-testing to one pass per frame during pointer scrubs.
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const pendingPointer = pendingPointerRef.current;
      if (!pendingPointer) {
        return;
      }

      const target = findHitTarget(pendingPointer.x, pendingPointer.y);
      hoveredRef.current =
        target?.type === "event"
          ? { type: "event", id: target.event.id }
          : target?.type === "collapsed"
            ? { type: "collapsed", id: target.group.id }
            : target?.type === "bigbang"
              ? { type: "bigbang", id: "bigbang" }
              : { type: null, id: null };
      updateCursor(target ? "pointer" : "grab");
      requestRender();
    });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (isInteractionDisabled) return;
    updateCursor("grabbing");
    onPointerDown(e);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (isInteractionDisabled) return;
    const pointer = getPointerPosition(e.clientX, e.clientY);
    if (pointer) {
      rulerPointerRef.current = {
        x: pointer.x,
        y: pointer.y,
        isVisible: latestRef.current.rulerEvent !== null,
      };
    }

    const target = findHitTarget(e.clientX, e.clientY);
    updateCursor(target ? "pointer" : "grab");
    requestRender();
    onPointerUp(e);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isInteractionDisabled) return;
    if (consumeClickSuppression()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const target = findHitTarget(e.clientX, e.clientY);
    if (!target) return;

    e.stopPropagation();
    if (target.type === "event") {
      onFocusEvent(target.event);
      return;
    }
    if (target.type === "collapsed") {
      onFocusCollapsedGroup(target.group);
      return;
    }
    onFocusBigBang();
  };

  const canvasClassName = useMemo(
    () =>
      [
        "absolute inset-0 h-full w-full touch-none select-none",
        isInteractionDisabled ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" "),
    [isInteractionDisabled],
  );

  return (
    <div
      ref={containerRef}
      className="timeline-viewport relative h-screen w-full overflow-hidden bg-transparent text-white touch-none select-none"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={(e) => {
        if (hoverFrameRef.current !== null) {
          cancelAnimationFrame(hoverFrameRef.current);
          hoverFrameRef.current = null;
        }
        pendingPointerRef.current = null;
        hoveredRef.current = { type: null, id: null };
        rulerPointerRef.current = {
          ...rulerPointerRef.current,
          isVisible: false,
        };
        updateCursor("grab");
        requestRender();
        onPointerUp(e);
      }}
      onPointerLeave={() => {
        if (hoverFrameRef.current !== null) {
          cancelAnimationFrame(hoverFrameRef.current);
          hoverFrameRef.current = null;
        }
        pendingPointerRef.current = null;
        hoveredRef.current = { type: null, id: null };
        rulerPointerRef.current = {
          ...rulerPointerRef.current,
          isVisible: false,
        };
        updateCursor("grab");
        requestRender();
      }}
      onClick={handleCanvasClick}
    >
      {backgroundLayer}
      <canvas ref={canvasRef} className={canvasClassName} />
    </div>
  );
};
