import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  MotionValue,
  useTransform,
  useMotionValueEvent,
  useMotionValue,
  animate,
} from "motion/react";
import { getNiceInterval } from "../../utils";
import { ThemeMode } from "../../theme";

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
  if (years >= 1e9)
    return `${(years / 1e9).toFixed(years >= 1e10 ? 0 : 1)}B yrs`;
  if (years >= 1e6)
    return `${(years / 1e6).toFixed(years >= 1e7 ? 0 : 1)}M yrs`;
  if (years >= 1e3)
    return `${(years / 1e3).toFixed(years >= 1e4 ? 0 : 1)}K yrs`;
  if (years >= 1) return `${years.toFixed(0)} yrs`;
  if (years >= 1 / 12) {
    const months = years * 12;
    return `${months.toFixed(0)} mo`;
  }
  const days = years * 365.25;
  if (days >= 1) return `${days.toFixed(0)} d`;
  return `${(days * 24).toFixed(0)} h`;
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

interface WarpOverlayProps {
  isWarping: boolean;
  mode: WarpOverlayMode;
  direction: 1 | -1;
  theme: ThemeMode;
  zoom: MotionValue<number>;
  zoomPivotX: MotionValue<number>;
}

interface ZoomReferenceRingProps {
  intervalYears: number;
  zoom: MotionValue<number>;
  maxVisibleDiameter: number;
  mode: Exclude<WarpOverlayMode, "travel">;
  index: number;
  theme: ThemeMode;
}

const ZoomReferenceRing: React.FC<ZoomReferenceRingProps> = ({
  intervalYears,
  zoom,
  maxVisibleDiameter,
  mode,
  index,
  theme,
}) => {
  const diameter = useTransform(() => intervalYears * zoom.get());
  const opacity = useTransform(() => {
    const nextDiameter = intervalYears * zoom.get();
    if (nextDiameter < 56 || nextDiameter > maxVisibleDiameter) return 0;
    return Math.max(0.4, 0.6 - index * 0.15);
  });
  return (
    <motion.div
      className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: diameter,
        height: diameter,
        opacity,
        border:
          theme === "dark"
            ? "1px solid rgba(255,255,255,0.45)"
            : "1px solid rgba(71,85,105,0.28)",
      }}
    >
      <motion.div
        className="absolute left-1/2 top-0 w-max whitespace-nowrap -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-500/90 bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-100"
        style={{
          borderColor:
            theme === "dark"
              ? "rgba(100,116,139,0.8)"
              : "rgba(148,163,184,0.72)",
        }}
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
  theme,
  zoom,
  zoomPivotX,
}) => {
  const maxVisibleDiameter = useMemo(() => {
    if (typeof window === "undefined") return 1280;
    return Math.max(window.innerWidth, window.innerHeight);
  }, []);
  const [ringIntervals, setRingIntervals] = useState<number[]>(() =>
    getZoomReferenceIntervals(zoom.get(), maxVisibleDiameter),
  );
  const ringIntervalTimeoutRef = useRef<number | null>(null);
  // Smooth pivot: spring-animates to zoomPivotX so rings glide, not snap.
  // useMotionValueEvent gives us the new value directly (not stale like .get() in useEffect).
  const pivotX = useMotionValue(zoomPivotX.get());

  useMotionValueEvent(zoomPivotX, "change", (newX: number) => {
    // Only animate when not in travel mode.
    if (mode === "travel") return;
    const controls = animate(pivotX, newX, {
      type: "spring",
      stiffness: 350,
      damping: 35,
    });
    return controls.stop;
  });

  useEffect(() => {
    if (mode === "travel") return;
    setRingIntervals(getZoomReferenceIntervals(zoom.get(), maxVisibleDiameter));
  }, [maxVisibleDiameter, mode, zoom]);

  useMotionValueEvent(zoom, "change", (value: number) => {
    if (mode === "travel") return;
    if (ringIntervalTimeoutRef.current !== null) return;

    ringIntervalTimeoutRef.current = window.setTimeout(() => {
      ringIntervalTimeoutRef.current = null;
      const nextIntervals = getZoomReferenceIntervals(
        value,
        maxVisibleDiameter,
      );
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
      className="warp-overlay pointer-events-none fixed inset-0 z-70 overflow-hidden"
      style={{
        opacity: isWarping ? 1 : 0,
        transition:
          mode === "travel"
            ? "opacity 700ms ease-out"
            : "opacity 400ms ease-out",
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
                className="absolute"
                style={{
                  top: `${top}%`,
                  left: direction === 1 ? (short ? "-20%" : "-40%") : undefined,
                  right:
                    direction === -1 ? (short ? "-20%" : "-40%") : undefined,
                  width: short ? "30%" : "60%",
                  height: "1px",
                  background:
                    theme === "dark"
                      ? "linear-gradient(90deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.55) 55%, transparent 100%)"
                      : "linear-gradient(90deg, rgba(15,23,42,0.05) 0%, rgba(15,23,42,0.22) 55%, transparent 100%)",
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
                  ? theme === "dark"
                    ? "radial-gradient(ellipse 60% 40% at 100% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)"
                    : "radial-gradient(ellipse 60% 40% at 100% 50%, rgba(15,23,42,0.06) 0%, transparent 70%)"
                  : theme === "dark"
                    ? "radial-gradient(ellipse 60% 40% at 0% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)"
                    : "radial-gradient(ellipse 60% 40% at 0% 50%, rgba(15,23,42,0.06) 0%, transparent 70%)",
            }}
          />
        </>
      ) : mode !== "travel" ? (
        <motion.div
          className="absolute left-0 top-0 h-0 w-0"
          style={{ x: pivotX, top: "50%" }}
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
                theme={theme}
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
                    ? theme === "dark"
                      ? "radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 55%, transparent 100%)"
                      : "radial-gradient(circle, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.04) 55%, transparent 100%)"
                    : theme === "dark"
                      ? "radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 72%)"
                      : "radial-gradient(circle, rgba(15,23,42,0.12) 0%, transparent 72%)",
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
