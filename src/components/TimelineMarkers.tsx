import React, { useEffect, useMemo, useState } from "react";
import {
  motion,
  MotionValue,
  useTransform,
  useMotionValueEvent,
  useMotionValue,
  animate,
} from "motion/react";
import { ThemeMode } from "../constants/theme";
import { WarpOverlayMode } from "../constants/types";

const MIN_RING_DIAMETER = 12;
const RING_FADE_IN_START = 10;
const RING_FADE_IN_END = 72;
const RING_LABEL_FADE_IN_START = 44;
const RING_LABEL_FADE_IN_END = 88;
const REFERENCE_RING_INTERVALS = [
  1 / 365.25,
  1 / 52,
  1 / 12,
  1,
  5,
  10,
  50,
  100,
  500,
  1000,
  5000,
  1e4,
  5e4,
  1e5,
  5e5,
  1e6,
  5e6,
  1e7,
  5e7,
  1e8,
  5e8,
  1e9,
  5e9,
  1e10,
] as const;

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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const getFadeProgress = (value: number, start: number, end: number) => {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
};

const getZoomReferenceIntervals = (
  zoomValue: number,
  maxVisibleDiameter: number,
): number[] => {
  if (zoomValue <= 0 || maxVisibleDiameter <= MIN_RING_DIAMETER) {
    return [];
  }

  return REFERENCE_RING_INTERVALS.filter((interval) => {
    const diameter = interval * zoomValue;
    return diameter >= MIN_RING_DIAMETER && diameter <= maxVisibleDiameter;
  });
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
    if (nextDiameter > maxVisibleDiameter) return 0;

    const baseOpacity = Math.max(0.18, 0.56 - index * 0.12);
    const fadeInProgress = getFadeProgress(
      nextDiameter,
      RING_FADE_IN_START,
      RING_FADE_IN_END,
    );

    return baseOpacity * fadeInProgress;
  });
  const labelOpacity = useTransform(() => {
    const nextDiameter = intervalYears * zoom.get();
    if (nextDiameter > maxVisibleDiameter) return 0;

    return getFadeProgress(
      nextDiameter,
      RING_LABEL_FADE_IN_START,
      RING_LABEL_FADE_IN_END,
    );
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
          opacity: labelOpacity,
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
    const nextIntervals = getZoomReferenceIntervals(value, maxVisibleDiameter);
    setRingIntervals((prev) =>
      areIntervalsEqual(prev, nextIntervals) ? prev : nextIntervals,
    );
  });

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
