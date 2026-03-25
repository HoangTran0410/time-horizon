import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  MotionValue,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
} from "motion/react";
import { ArrowRight } from "lucide-react";
import { Event, getEventTimelineYear } from "../../types";
import { BIG_BANG_YEAR } from "../../constants";
import {
  getEventDisplayLabel,
  formatTimelineTick,
  getNiceInterval,
} from "../../utils";

export type TimelineTick = {
  year: number;
  interval: number;
  isHighlighted: boolean;
};

export type EventLayoutState = {
  y: MotionValue<number>;
  opacity: MotionValue<number>;
  targetY: number;
  targetOpacity: number;
};

export type CollapsedEventGroup = {
  id: string;
  year: number;
  side: 1 | -1;
  count: number;
  eventIds: string[];
};

export type WarpOverlayMode = "travel" | "zoom-in" | "zoom-out";
const MIN_RING_DIAMETER = 72;
const TARGET_RING_SPACING = 120;
const MIN_RING_COUNT = 3;
const RING_INTERVAL_REFRESH_MS = 180;

const formatRingTimespan = (years: number): string => {
  if (years >= 1e9) return `${(years / 1e9).toFixed(years >= 1e10 ? 0 : 1)}B yrs`;
  if (years >= 1e6) return `${(years / 1e6).toFixed(years >= 1e7 ? 0 : 1)}M yrs`;
  if (years >= 1e3) return `${(years / 1e3).toFixed(years >= 1e4 ? 0 : 1)}K yrs`;
  if (years >= 1) return `${years.toFixed(years >= 10 ? 0 : 1)} yrs`;
  if (years >= 1 / 12) {
    const months = years * 12;
    return `${months.toFixed(months >= 10 ? 0 : 1)} mo`;
  }
  const days = years * 365.25;
  if (days >= 1) return `${days.toFixed(days >= 10 ? 0 : 1)} d`;
  return `${(days * 24).toFixed(1)} h`;
};

const areIntervalsEqual = (prev: number[], next: number[]) =>
  prev.length === next.length &&
  prev.every((interval, index) => interval === next[index]);

const getZoomReferenceIntervals = (
  zoomValue: number,
  maxVisibleDiameter: number,
): number[] => {
  if (zoomValue <= 0 || maxVisibleDiameter <= MIN_RING_DIAMETER) {
    return [];
  }

  const ringCount = Math.max(
    MIN_RING_COUNT,
    Math.floor(maxVisibleDiameter / TARGET_RING_SPACING),
  );
  const diameterStep = maxVisibleDiameter / (ringCount + 1);
  const intervals = new Set<number>();

  for (let index = 1; index <= ringCount; index += 1) {
    const targetDiameter = Math.max(MIN_RING_DIAMETER, diameterStep * index);
    intervals.add(getNiceInterval(targetDiameter / zoomValue));
  }

  return Array.from(intervals).sort((a, b) => a - b);
};

interface EventMarkerProps {
  event: Event;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
  layout: EventLayoutState;
  isFocused: boolean;
  onClick: (event: Event) => void;
}

export const EventMarker: React.FC<EventMarkerProps> = ({
  event,
  focusPixel,
  focusYear,
  zoom,
  layout,
  isFocused,
  onClick,
}) => {
  const timelineYear = getEventTimelineYear(event);
  const yearMV = useMotionValue(timelineYear);

  useEffect(() => {
    yearMV.set(timelineYear);
  }, [timelineYear, yearMV]);

  const markerX = useTransform(() => {
    const pos =
      focusPixel.get() + (yearMV.get() - focusYear.get()) * zoom.get();
    if (pos < -100000) return -100000;
    if (pos > 100000) return 100000;
    return pos;
  });

  const yOffset = layout.y;
  const opacity = layout.opacity;
  const pointerEvents = useTransform(opacity, (v: number) =>
    v > 0.5 ? "auto" : "none",
  );
  const lineTop = useTransform(yOffset, (y: number) => (y < 0 ? 48 : -y + 24));
  const lineHeight = useTransform(yOffset, (y: number) =>
    Math.max(0, Math.abs(y) - 24),
  );
  const textTop = useTransform(yOffset, (y: number) =>
    y < 0 ? "auto" : "56px",
  );
  const textBottom = useTransform(yOffset, (y: number) =>
    y < 0 ? "56px" : "auto",
  );
  const scale = useTransform(opacity, (v: number) =>
    isFocused ? Math.max(v, 1) : v,
  );

  return (
    <motion.div
      className="absolute top-1/2 z-10 pointer-events-none"
      style={{
        x: markerX,
        y: yOffset,
        translateY: "-50%",
        opacity,
        pointerEvents: pointerEvents as any,
        scale,
        zIndex: isFocused ? 30 : 10,
      }}
    >
      <div className="flex flex-col items-center -translate-x-1/2 group">
        <motion.div
          className="absolute w-px bg-zinc-700 group-hover:bg-emerald-500 transition-colors z-0"
          style={{
            height: lineHeight,
            top: lineTop,
            left: "50%",
            backgroundColor: isFocused ? "#10b981" : undefined,
          }}
        />

        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick(event);
          }}
          className={`
            w-12 h-12 bg-zinc-900 border-2 rounded-full flex items-center
            justify-center text-2xl group-hover:scale-125 transition-all
            cursor-pointer z-10 relative
            ${
              isFocused
                ? "border-emerald-500"
                : "border-zinc-700 group-hover:border-emerald-500"
            }
          `}
        >
          {event.emoji}
        </div>

        <motion.div
          className="absolute flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity w-48 text-center"
          style={{ top: textTop, bottom: textBottom }}
        >
          <span
            className={`text-sm font-medium ${
              isFocused ? "text-emerald-400" : "text-zinc-200"
            }`}
          >
            {event.title}
          </span>
          <span
            className={`text-xs ${
              isFocused ? "text-emerald-500" : "text-zinc-500"
            }`}
          >
            {getEventDisplayLabel(event)}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};

interface CollapsedMarkerProps {
  group: CollapsedEventGroup;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
  onClick: (group: CollapsedEventGroup) => void;
}

export const CollapsedMarker: React.FC<CollapsedMarkerProps> = ({
  group,
  focusPixel,
  focusYear,
  zoom,
  onClick,
}) => {
  const markerX = useTransform(() => {
    const pos = focusPixel.get() + (group.year - focusYear.get()) * zoom.get();
    if (pos < -100000) return -100000;
    if (pos > 100000) return 100000;
    return pos;
  });

  const yOffset = group.side * 320;
  const lineTop = yOffset < 0 ? 48 : -yOffset + 24;
  const lineHeight = Math.max(0, Math.abs(yOffset) - 24);
  const countLabel = group.count > 99 ? "99+" : `${group.count}`;

  return (
    <motion.div
      className="absolute top-1/2 z-20 pointer-events-none"
      style={{
        x: markerX,
        y: yOffset,
        translateY: "-50%",
      }}
    >
      <div className="group flex -translate-x-1/2 flex-col items-center">
        <div
          className="absolute left-1/2 z-0 w-px bg-amber-500/40 transition-colors group-hover:bg-amber-400/70"
          style={{
            height: lineHeight,
            top: lineTop,
          }}
        />

        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onClick(group);
          }}
          title={`Zoom to ${group.count} hidden events`}
          className="pointer-events-auto relative z-10 flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-amber-500/50 bg-zinc-900 px-3 text-xs font-semibold text-amber-300 transition-all group-hover:scale-110 group-hover:border-amber-400 group-hover:text-amber-200"
        >
          +{countLabel}
        </button>
      </div>
    </motion.div>
  );
};

interface BigBangMarkerProps {
  zoom: MotionValue<number>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  getViewportWidth: () => number;
  onClick: () => void;
}

export const BigBangMarker: React.FC<BigBangMarkerProps> = ({
  zoom,
  focusPixel,
  focusYear,
  getViewportWidth,
  onClick,
}) => {
  const getRawMarkerX = () =>
    focusPixel.get() + (BIG_BANG_YEAR - focusYear.get()) * zoom.get();

  const markerX = useTransform(() => {
    const pos = getRawMarkerX();
    if (pos < -100000) return -100000;
    if (pos > 100000) return 100000;
    return pos;
  });
  const pinnedOpacity = useTransform(() =>
    getRawMarkerX() > getViewportWidth() ? 1 : 0,
  );
  const normalOpacity = useTransform(pinnedOpacity, (v) => 1 - v);
  const pinnedPointerEvents = useTransform(pinnedOpacity, (v) =>
    v > 0.5 ? "auto" : "none",
  );
  const normalPointerEvents = useTransform(normalOpacity, (v) =>
    v > 0.5 ? "auto" : "none",
  );

  return (
    <>
      <motion.div
        className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
        style={{
          x: markerX,
          opacity: normalOpacity,
          pointerEvents: normalPointerEvents as any,
        }}
      >
        <div className="w-1 h-full bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-zinc-900 border border-amber-500/30 rounded-full text-amber-500 font-bold text-sm tracking-widest uppercase hover:border-amber-400/60 hover:bg-zinc-900 transition-colors"
        >
          Big Bang
        </button>
      </motion.div>

      <motion.button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-amber-500/40 rounded-full text-amber-400 font-bold text-sm uppercase tracking-widest hover:border-amber-300/70 hover:bg-zinc-900 transition-colors"
        style={{
          opacity: pinnedOpacity,
          pointerEvents: pinnedPointerEvents as any,
        }}
        title="Jump back to the Big Bang"
      >
        <span>Big Bang</span>
        <ArrowRight width={16} height={16} />
      </motion.button>
    </>
  );
};

interface WarpOverlayProps {
  isWarping: boolean;
  mode: WarpOverlayMode;
  direction: 1 | -1;
  zoom: MotionValue<number>;
  zoomPivotX: MotionValue<number>;
}

interface ZoomReferenceRingProps {
  intervalYears: number;
  zoom: MotionValue<number>;
  maxVisibleDiameter: number;
  mode: Exclude<WarpOverlayMode, "travel">;
  index: number;
}

const ZoomReferenceRing: React.FC<ZoomReferenceRingProps> = ({
  intervalYears,
  zoom,
  maxVisibleDiameter,
  mode,
  index,
}) => {
  const diameter = useTransform(() => intervalYears * zoom.get());
  const opacity = useTransform(() => {
    const nextDiameter = intervalYears * zoom.get();
    if (nextDiameter < 56 || nextDiameter > maxVisibleDiameter) return 0;
    return Math.max(0.2, 0.42 - index * 0.045);
  });
  return (
    <motion.div
      className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45"
      style={{
        width: diameter,
        height: diameter,
        opacity,
      }}
    >
      <motion.div
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-500/90 bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-100"
        style={{ opacity }}
      >
        {formatRingTimespan(intervalYears)}
      </motion.div>
    </motion.div>
  );
};

export const WarpOverlay: React.FC<WarpOverlayProps> = ({
  isWarping,
  mode,
  direction,
  zoom,
  zoomPivotX,
}) => {
  const maxVisibleDiameter = useMemo(
    () => {
      if (typeof window === "undefined") return 1280;
      return Math.max(window.innerWidth, window.innerHeight);
    },
    [],
  );
  const [ringIntervals, setRingIntervals] = useState<number[]>(() =>
    getZoomReferenceIntervals(zoom.get(), maxVisibleDiameter),
  );
  const ringIntervalTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode === "travel") return;
    setRingIntervals(getZoomReferenceIntervals(zoom.get(), maxVisibleDiameter));
  }, [maxVisibleDiameter, mode, zoom]);

  useMotionValueEvent(zoom, "change", (value: number) => {
    if (mode === "travel") return;
    if (ringIntervalTimeoutRef.current !== null) return;

    ringIntervalTimeoutRef.current = window.setTimeout(() => {
      ringIntervalTimeoutRef.current = null;
      const nextIntervals = getZoomReferenceIntervals(value, maxVisibleDiameter);
      setRingIntervals((prev) =>
        areIntervalsEqual(prev, nextIntervals) ? prev : nextIntervals,
      );
    }, RING_INTERVAL_REFRESH_MS);
  });

  useEffect(
    () => () => {
      if (ringIntervalTimeoutRef.current !== null) {
        window.clearTimeout(ringIntervalTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
      style={{
        opacity: isWarping ? 1 : 0,
        transition: "opacity 700ms ease-out",
      }}
    >
    {mode === "travel" ? (
      <>
        {Array.from({ length: 24 }).map((_, i) => {
          const top = (i / 24) * 100;
          const delay = (i * 0.041) % 1;
          const short = i % 3 === 0;
          return (
            <div
              key={i}
              className="absolute bg-gradient-to-r from-white/20 via-white/60 to-transparent"
              style={{
                top: `${top}%`,
                left: direction === 1 ? (short ? "-20%" : "-40%") : undefined,
                right: direction === -1 ? (short ? "-20%" : "-40%") : undefined,
                width: short ? "30%" : "60%",
                height: "1px",
                animation: `warp-streak ${0.35 + (i % 5) * 0.05}s linear ${delay}s infinite`,
                transform: direction === -1 ? "scaleX(-1)" : undefined,
              }}
            />
          );
        })}

        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              direction === 1
                ? "radial-gradient(ellipse 60% 40% at 100% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)"
                : "radial-gradient(ellipse 60% 40% at 0% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)",
          }}
        />
      </>
    ) : mode !== "travel" ? (
      <motion.div
        className="absolute left-0 top-0 h-0 w-0"
        style={{ x: zoomPivotX, top: "50%" }}
      >
        <div className="relative">
          {ringIntervals.map((intervalYears, index) => (
            <ZoomReferenceRing
              key={intervalYears}
              intervalYears={intervalYears}
              zoom={zoom}
              maxVisibleDiameter={maxVisibleDiameter}
              mode={mode}
              index={index}
            />
          ))}

          <div
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-100 ease-out"
            style={{
              width: "10px",
              height: "10px",
              opacity: mode === "zoom-in" ? 0.22 : 0.14,
              background:
                mode === "zoom-in"
                  ? "radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 55%, transparent 100%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 72%)",
            }}
          />
        </div>
      </motion.div>
    ) : null}

    <style>{`
      @keyframes warp-streak {
        0%   { transform: translateX(0) scaleX(0.3); opacity: 0; }
        10%  { opacity: 1; }
        90%  { opacity: 1; }
        100% { transform: translateX(${direction === 1 ? "100vw" : "-100vw"}) scaleX(1.5); opacity: 0; }
      }
    `}</style>
    </div>
  );
};

interface TickMarkerProps {
  tick: TimelineTick;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
}

export const TickMarker: React.FC<TickMarkerProps> = ({
  tick,
  focusPixel,
  focusYear,
  zoom,
}) => {
  const markerX = useTransform(() => {
    const pos =
      focusPixel.get() + (tick.year - focusYear.get()) * zoom.get();
    if (pos < -100000) return -100000;
    if (pos > 100000) return 100000;
    return pos;
  });

  return (
    <motion.div
      className="absolute top-1/2 pointer-events-none"
      style={{ x: markerX }}
    >
      <div className="flex flex-col items-center -translate-x-1/2">
        <div
          className={`w-px -mt-1.5 ${
            tick.isHighlighted ? "h-5 bg-white/80" : "h-3 bg-zinc-600"
          }`}
        />
        <span
          className={`mt-2 font-mono select-none whitespace-nowrap ${
            tick.isHighlighted
              ? "text-[11px] text-white/90 font-semibold"
              : "text-[10px] text-zinc-500"
          }`}
        >
          {formatTimelineTick(tick.year, tick.interval)}
        </span>
      </div>
    </motion.div>
  );
};
