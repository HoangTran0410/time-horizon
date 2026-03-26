import React, { useEffect, useMemo, useRef } from "react";
import { MotionValue } from "motion/react";
import { Event, getEventTimelineYear } from "../../types";
import { BIG_BANG_YEAR } from "../../constants";
import {
  getEventDisplayLabel,
  formatTimelineTick,
  withAlpha,
} from "../../utils";
import {
  CollapsedEventGroup,
  EventLayoutState,
  TimelineTick,
} from "./TimelineMarkers";

interface TimelineCanvasViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
  ticks: TimelineTick[];
  timelineEvents: Event[];
  collapsedGroups: CollapsedEventGroup[];
  visibleBounds: {
    startYear: number;
    endYear: number;
  };
  eventLayouts: Record<string, EventLayoutState>;
  focusedEventId: string | null;
  eventAccentColors: Record<string, string | null>;
  onWheel: (e: React.WheelEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
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
  label: string;
}

interface VisibleCanvasTick {
  tick: TimelineTick;
  label: string;
}

const EVENT_RADIUS = 24;
const COLLAPSED_RADIUS = 22;
const MAX_CANVAS_DPR = 1.5;
const TICK_LABEL_OFFSET_Y = 18;
const EVENT_LABEL_MAX_WIDTH = 120;
const EVENT_TITLE_LINE_HEIGHT = 14;
const EVENT_TITLE_MAX_LINES = 3;
const EVENT_LABEL_GAP = 4;

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

export const TimelineCanvasViewport: React.FC<TimelineCanvasViewportProps> = ({
  containerRef,
  focusPixel,
  focusYear,
  zoom,
  ticks,
  timelineEvents,
  collapsedGroups,
  visibleBounds,
  eventLayouts,
  focusedEventId,
  eventAccentColors,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onFocusBigBang,
  onFocusEvent,
  onFocusCollapsedGroup,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef({
    ticks: [] as VisibleCanvasTick[],
    timelineEvents,
    collapsedGroups,
    visibleBounds,
    visibleEvents: [] as VisibleCanvasEvent[],
    eventLayouts,
    focusedEventId,
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
  const cursorRef = useRef<"grab" | "grabbing" | "pointer">("grab");

  const requestRender = () => {
    if (renderFrameRef.current !== null) return;
    renderFrameRef.current = requestAnimationFrame(() => {
      renderFrameRef.current = null;
      renderCanvasRef.current();
    });
  };

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
      if (
        event.id !== focusedEventId &&
        (year < minVisibleYear || year > maxVisibleYear)
      ) {
        continue;
      }
      nextVisibleEvents.push({
        event,
        year,
        label: getEventDisplayLabel(event),
      });
    }

    const nextTicks: VisibleCanvasTick[] = [];
    for (const tick of ticks) {
      nextTicks.push({
        tick,
        label: formatTimelineTick(tick.year, tick.interval),
      });
    }

    latestRef.current = {
      ticks: nextTicks,
      timelineEvents,
      collapsedGroups,
      visibleBounds,
      visibleEvents: nextVisibleEvents,
      eventLayouts,
      focusedEventId,
      eventAccentColors,
    };
  }, [
    ticks,
    timelineEvents,
    collapsedGroups,
    visibleBounds,
    eventLayouts,
    focusedEventId,
    eventAccentColors,
  ]);

  useEffect(() => {
    requestRender();
  }, [
    ticks,
    timelineEvents,
    collapsedGroups,
    visibleBounds,
    eventLayouts,
    focusedEventId,
    eventAccentColors,
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
  }, [containerRef]);

  const getScreenX = (year: number) =>
    focusPixel.get() + (year - focusYear.get()) * zoom.get();

  const findHitTarget = (
    clientX: number,
    clientY: number,
  ): HitTarget | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centerY = rect.height / 2;
    const {
      visibleEvents: currentVisibleEvents,
      collapsedGroups: currentCollapsedGroups,
      eventLayouts: currentEventLayouts,
    } = latestRef.current;

    for (const group of currentCollapsedGroups) {
      const groupX = getScreenX(group.year);
      const groupY = centerY + group.side * 320;
      if (Math.hypot(x - groupX, y - groupY) <= COLLAPSED_RADIUS) {
        return { type: "collapsed", group };
      }
    }

    for (let index = currentVisibleEvents.length - 1; index >= 0; index -= 1) {
      const visibleEvent = currentVisibleEvents[index];
      const layout = currentEventLayouts[visibleEvent.event.id];
      if (!layout || layout.opacity.get() < 0.35) continue;
      const eventX = getScreenX(visibleEvent.year);
      const eventY = centerY + layout.y.get();
      if (Math.hypot(x - eventX, y - eventY) <= EVENT_RADIUS) {
        return { type: "event", event: visibleEvent.event };
      }
    }

    const bigBangX = getScreenX(BIG_BANG_YEAR);
    if (bigBangX >= 0 && bigBangX <= rect.width) {
      if (Math.abs(x - bigBangX) <= 24 && Math.abs(y - centerY) <= 28) {
        return { type: "bigbang" };
      }
    } else {
      const pinnedX = rect.width - 78;
      if (Math.abs(x - pinnedX) <= 54 && Math.abs(y - centerY) <= 24) {
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
        ticks: currentTicks,
        visibleEvents: currentVisibleEvents,
        collapsedGroups: currentCollapsedGroups,
        eventLayouts: currentEventLayouts,
        focusedEventId: currentFocusedEventId,
        eventAccentColors: currentEventAccentColors,
      } = latestRef.current;
      const hoveredTarget = hoveredRef.current;

      const centerY = height / 2;
      const snap = (value: number) => Math.round(value * dpr) / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, snap(centerY));
      ctx.lineTo(width, snap(centerY));
      ctx.stroke();

      for (const { tick, label } of currentTicks) {
        const x = getScreenX(tick.year);
        if (x < -120 || x > width + 120) continue;
        const tickX = snap(x);
        const tickLabelY = snap(
          centerY + TICK_LABEL_OFFSET_Y + (tick.isHighlighted ? 5 : 0),
        );
        ctx.strokeStyle = tick.isHighlighted
          ? "rgba(255,255,255,0.8)"
          : "#52525b";
        ctx.beginPath();
        ctx.moveTo(tickX, snap(centerY - 6));
        ctx.lineTo(tickX, snap(centerY + (tick.isHighlighted ? 14 : 9)));
        ctx.stroke();

        ctx.font = tick.isHighlighted
          ? "600 11px ui-monospace, monospace"
          : "10px ui-monospace, monospace";
        ctx.fillStyle = tick.isHighlighted
          ? "rgba(255,255,255,0.9)"
          : "#71717a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, tickX, tickLabelY);
      }

      for (const group of currentCollapsedGroups) {
        const x = getScreenX(group.year);
        const y = centerY + group.side * 320;
        const groupX = snap(x);
        const groupY = snap(y);
        const isHovered =
          hoveredTarget.type === "collapsed" && hoveredTarget.id === group.id;
        const radius = isHovered ? 24 : COLLAPSED_RADIUS;
        ctx.strokeStyle = isHovered
          ? "rgba(251,191,36,0.9)"
          : "rgba(245,158,11,0.45)";
        ctx.beginPath();
        ctx.moveTo(groupX, snap(centerY));
        ctx.lineTo(groupX, groupY);
        ctx.stroke();

        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = isHovered
          ? "rgba(251,191,36,0.95)"
          : "rgba(245,158,11,0.7)";
        ctx.beginPath();
        ctx.arc(groupX, groupY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isHovered ? "#fde68a" : "#fcd34d";
        ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `+${group.count > 99 ? "99+" : group.count}`,
          groupX,
          groupY,
        );
      }

      for (const visibleEvent of currentVisibleEvents) {
        const { event, year, label } = visibleEvent;
        const layout = currentEventLayouts[event.id];
        if (!layout) continue;
        const alpha = layout.opacity.get();
        if (alpha <= 0.02) continue;

        const x = getScreenX(year);
        const y = centerY + layout.y.get();
        const eventX = snap(x);
        const eventY = snap(y);
        const isHovered =
          hoveredTarget.type === "event" && hoveredTarget.id === event.id;
        const isFocused = event.id === currentFocusedEventId;
        const isHighlighted = isFocused || isHovered;
        const radius = isHighlighted ? 26 : 24;
        const accentColor = currentEventAccentColors[event.id] ?? null;
        const idleLineColor = accentColor
          ? withAlpha(accentColor, 0.55)
          : "#3f3f46";
        const activeLineColor = accentColor ?? "#10b981";
        const idleBorderColor = accentColor ?? "#52525b";
        const activeBorderColor = accentColor ?? "#10b981";
        const activeTextColor = accentColor ?? "#34d399";
        const activeDateColor = accentColor ?? "#10b981";

        ctx.save();
        ctx.globalAlpha = isHovered ? Math.max(alpha, 0.95) : alpha;

        ctx.strokeStyle = isHighlighted ? activeLineColor : idleLineColor;
        ctx.beginPath();
        ctx.moveTo(eventX, snap(centerY));
        ctx.lineTo(eventX, eventY);
        ctx.stroke();

        ctx.fillStyle = "#18181b";
        ctx.beginPath();
        ctx.arc(eventX, eventY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isHighlighted ? activeBorderColor : idleBorderColor;
        ctx.stroke();

        ctx.font =
          "24px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(event.emoji, eventX, snap(eventY + 1));

        ctx.font = "500 12px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = isHighlighted ? activeTextColor : "#e4e4e7";
        const titleLines = wrapCanvasText(
          ctx,
          event.title,
          EVENT_LABEL_MAX_WIDTH,
          EVENT_TITLE_MAX_LINES,
        );
        const isBelowMarker = layout.y.get() > 0;
        ctx.textBaseline = isBelowMarker ? "top" : "bottom";

        if (isBelowMarker) {
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

        ctx.font = "10px ui-monospace, monospace";
        ctx.fillStyle = isHighlighted ? activeDateColor : "#71717a";
        const dateY = isBelowMarker
          ? eventY +
            34 +
            titleLines.length * EVENT_TITLE_LINE_HEIGHT +
            EVENT_LABEL_GAP
          : eventY -
            34 -
            titleLines.length * EVENT_TITLE_LINE_HEIGHT -
            EVENT_LABEL_GAP;
        ctx.fillText(label, eventX, snap(dateY));

        ctx.restore();
      }

      const bigBangX = getScreenX(BIG_BANG_YEAR);
      if (bigBangX >= 0 && bigBangX <= width) {
        const snappedBigBangX = snap(bigBangX);
        ctx.strokeStyle = "rgba(245,158,11,0.5)";
        ctx.beginPath();
        ctx.moveTo(snappedBigBangX, 0);
        ctx.lineTo(snappedBigBangX, height);
        ctx.stroke();

        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = "rgba(245,158,11,0.65)";
        const labelWidth = 86;
        const labelHeight = 28;
        ctx.beginPath();
        ctx.roundRect(
          snap(snappedBigBangX - labelWidth / 2),
          snap(centerY - labelHeight / 2),
          labelWidth,
          labelHeight,
          14,
        );
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f59e0b";
        ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Big Bang", snappedBigBangX, snap(centerY));
      } else if (bigBangX > width) {
        const badgeX = snap(width - 78);
        const badgeWidth = 92;
        const badgeHeight = 32;
        ctx.fillStyle = "#18181b";
        ctx.strokeStyle = "rgba(245,158,11,0.65)";
        ctx.beginPath();
        ctx.roundRect(
          snap(badgeX - badgeWidth / 2),
          snap(centerY - badgeHeight / 2),
          badgeWidth,
          badgeHeight,
          16,
        );
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fbbf24";
        ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Big Bang", badgeX, snap(centerY));
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
  }, [containerRef, focusPixel, focusYear, zoom]);

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

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    const target = findHitTarget(e.clientX, e.clientY);
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
    onPointerMove(e);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    updateCursor("grabbing");
    onPointerDown(e);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    const target = findHitTarget(e.clientX, e.clientY);
    updateCursor(target ? "pointer" : "grab");
    requestRender();
    onPointerUp(e);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
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
    () => "absolute inset-0 h-full w-full touch-none select-none",
    [],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full overflow-hidden bg-zinc-950 text-white touch-none select-none"
      onWheel={onWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={(e) => {
        hoveredRef.current = { type: null, id: null };
        updateCursor("grab");
        requestRender();
        onPointerUp(e);
      }}
      onPointerLeave={() => {
        hoveredRef.current = { type: null, id: null };
        updateCursor("grab");
        requestRender();
      }}
      onClick={handleCanvasClick}
    >
      <canvas ref={canvasRef} className={canvasClassName} />
    </div>
  );
};
