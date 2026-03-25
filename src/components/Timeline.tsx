import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionValueEvent,
  animate,
  MotionValue,
  useSpring,
} from "motion/react";
import { Menu, X, Maximize2, ChevronDown, Pencil } from "lucide-react";
import { Event, getEventTimelineYear } from "../types";
import { BIG_BANG_YEAR, EVENTS } from "../constants";
import { Sidebar } from "./Sidebar";
import { EventEditor } from "./EventEditor";
import {
  getEventDisplayLabel,
  formatTimelineTick,
  getNiceInterval,
  getTimelineHighlightStep,
  isHighlightedTimelineTick,
} from "../utils";

type TimelineTick = {
  year: number;
  interval: number;
  isHighlighted: boolean;
};

const tickLabelWidthEstimateCache = new Map<number, number>();
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

const EventMarker: React.FC<{
  event: Event;
  zoom: MotionValue<number>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  layout: any;
  isFocused: boolean;
  onClick: (e: Event) => void;
}> = ({ event, zoom, focusPixel, focusYear, layout, isFocused, onClick }) => {
  const timelineYear = getEventTimelineYear(event);
  const yearMV = useMotionValue(timelineYear);
  useEffect(() => {
    yearMV.set(timelineYear);
  }, [timelineYear, yearMV]);

  const markerX = useTransform(() => {
    const z = zoom.get();
    const fp = focusPixel.get();
    const fy = focusYear.get();
    const pos = (yearMV.get() - fy) * z + fp;
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

  // Scale: focused/hovered → 1.25, default → 1
  const scale = useTransform(opacity, (v: number) =>
    isFocused ? Math.max(v, 1) : v,
  );

  return (
    <motion.div
      className="absolute top-1/2 z-10"
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
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClick(event);
          }}
          className={`
            w-12 h-12 bg-zinc-900 border-2 rounded-full flex items-center
            justify-center text-2xl group-hover:scale-125 transition-all
            cursor-pointer shadow-lg z-10 relative
            ${
              isFocused
                ? "border-emerald-500 shadow-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
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

const BigBangMarker: React.FC<{
  zoom: MotionValue<number>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
}> = ({ zoom, focusPixel, focusYear }) => {
  const markerX = useTransform(() => {
    const z = zoom.get();
    const fp = focusPixel.get();
    const fy = focusYear.get();
    const pos = (BIG_BANG_YEAR - fy) * z + fp;
    if (pos < -100000) return -100000;
    if (pos > 100000) return 100000;
    return pos;
  });

  return (
    <motion.div
      className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
      style={{ x: markerX }}
    >
      <div className="w-1 h-full bg-gradient-to-b from-transparent via-amber-500/50 to-transparent" />
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-zinc-900/80 backdrop-blur-sm border border-amber-500/30 rounded-full text-amber-500 font-bold text-sm tracking-widest uppercase shadow-[0_0_30px_rgba(245,158,11,0.2)]">
        Big Bang
      </div>
    </motion.div>
  );
};

// ── Warp Overlay ────────────────────────────────────────────────────────────
// CSS-animated star-streak effect shown during long-distance camera jumps.
// Direction: 1 = fly forward (left→right), -1 = fly backward (right→left).
const WarpOverlay: React.FC<{ isWarping: boolean; direction: 1 | -1 }> = ({
  isWarping,
  direction,
}) => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    style={{
      opacity: isWarping ? 1 : 0,
      transition: "opacity 150ms ease",
    }}
  >
    {/* Speed lines */}
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

    {/* Vanishing-point glow on the destination edge */}
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          direction === 1
            ? "radial-gradient(ellipse 60% 40% at 100% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)"
            : "radial-gradient(ellipse 60% 40% at 0% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)",
      }}
    />

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

const TickMarker: React.FC<{
  tick: TimelineTick;
  zoom: MotionValue<number>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
}> = ({ tick, zoom, focusPixel, focusYear }) => {
  const markerX = useTransform(() => {
    const z = zoom.get();
    const fp = focusPixel.get();
    const fy = focusYear.get();
    const pos = (tick.year - fy) * z + fp;
    if (pos < -100000) return -100000;
    if (pos > 100000) return 100000;
    return pos;
  });
  return (
    <motion.div className="absolute top-1/2" style={{ x: markerX }}>
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

// Motion Values
const MIN_ZOOM = 100 / 13.8e9;
const MAX_ZOOM = 1000 / (1 / 365.25);

export const Timeline: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // App State
  const [events, setEvents] = useState<Event[]>(EVENTS);
  const [selectedEventInfo, setSelectedEventInfo] = useState<Event | null>(
    null,
  );
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [isWarping, setIsWarping] = useState(false);
  const [warpDirection, setWarpDirection] = useState<1 | -1>(1);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [ticks, setTicks] = useState<TimelineTick[]>([]);

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
  const clampPanX = (nextPanX: number, currentZoom: number) =>
    Math.min(nextPanX, getViewportCenter() - BIG_BANG_YEAR * currentZoom);
  const setCameraFromPanX = (
    nextPanX: number,
    currentZoom: number,
    anchorPixel = focusPixel.get(),
  ) => {
    const clampedPanX = clampPanX(nextPanX, currentZoom);
    focusPixel.set(anchorPixel);
    focusYear.set((anchorPixel - clampedPanX) / currentZoom);
    return clampedPanX;
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
  const eventLayouts = useRef<
    Record<
      string,
      {
        y: MotionValue<number>;
        opacity: MotionValue<number>;
        targetY: number;
        targetOpacity: number;
      }
    >
  >({});

  // Initialize layout motion values
  useMemo(() => {
    events.forEach((e) => {
      if (!eventLayouts.current[e.id]) {
        eventLayouts.current[e.id] = {
          y: new MotionValue(0),
          opacity: new MotionValue(0),
          targetY: 0,
          targetOpacity: 0,
        };
      }
    });
  }, [events]);

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

    // 1. Filter: visible + pass search/group. Always include focused event.
    const visibleEvents = events.filter((e) => {
      const ty = getEventTimelineYear(e);
      if (ty < BIG_BANG_YEAR) return false;
      if (ty < layoutStart || ty > layoutEnd) return false;
      if (e.id === focusedId) return true;
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup =
        selectedGroups.length === 0 ||
        e.groups.some((g) => selectedGroups.includes(g));
      return matchesSearch && matchesGroup;
    });

    // 2. Sort by priority, but keep focused event at top so it gets first lane choice.
    const sortedEvents = [...visibleEvents].sort((a, b) => {
      if (a.id === focusedId) return -1;
      if (b.id === focusedId) return 1;
      return b.priority - a.priority;
    });

    // 3. Build stable side map ONCE to avoid repeated findIndex inside the loop.
    const eventIndexMap = new Map(events.map((e, i) => [e.id, i]));

    const LEVELS = [1, 2, 3];
    const occupied: { year: number; level: number }[] = [];

    sortedEvents.forEach((ev) => {
      const layout = eventLayouts.current[ev.id];
      if (!layout) return;

      const evYear = getEventTimelineYear(ev);

      // Stable side assignment: prefer left (even original index) or right (odd).
      const originalIndex = eventIndexMap.get(ev.id) as number;
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
    events.forEach((ev) => {
      if (visibleEvents.some((v) => v.id === ev.id)) return;
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

  const updateTicks = () => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const currentX = panX.get();
    const currentZoom = Math.exp(logZoom.get());

    const startYear = (-width - currentX) / currentZoom;
    const endYear = (width * 2 - currentX) / currentZoom;

    // Propagate bounds to the layout engine and the render filter.
    // The layout engine already calls getEventTimelineYear per event — feeding it the
    // same bounds via a ref avoids a second panX/zoom.get() round.
    visibleBoundsRef.current = { startYear, endYear };

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
    const firstTick = Math.floor(startYear / interval) * interval;
    for (let y = firstTick; y <= endYear; y += interval) {
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
    setTicks(newTicks);
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

    // Keep the world position under the cursor stable while panning/zooming,
    // but never let the Big Bang marker drift right of the viewport center.
    setCameraFromPanX(panX.get() - e.deltaX, currentZ, mouseX);

    // Apply zoom if there is vertical scrolling
    if (Math.abs(e.deltaY) > 0) {
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
  const velocity = useRef(0);
  const inertiaFrame = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (inertiaFrame.current !== null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
    isDragging.current = true;
    velocity.current = 0;
    lastDragTime.current = performance.now();
    setSelecting(true);
    lastX.current = e.clientX;
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const now = performance.now();
    const deltaX = e.clientX - lastX.current;
    const dt = now - lastDragTime.current;
    if (dt > 0) velocity.current = deltaX / dt;

    const currentZ = zoom.get();
    setCameraFromPanX(panX.get() + deltaX, currentZ);

    lastX.current = e.clientX;
    lastDragTime.current = now;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    setSelecting(false);
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

  const layoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevLogZoom = useRef<number | null>(null);

  useMotionValueEvent(panX, "change", scheduleTickUpdate);
  useMotionValueEvent(logZoom, "change", (val) => {
    // Only recalculate ticks when zoom actually changes (not during spring animation).
    // scheduleTickUpdate will be called once after the spring settles.
    if (
      prevLogZoom.current !== null &&
      Math.abs(val - prevLogZoom.current) < 1e-6
    )
      return;
    prevLogZoom.current = val;
    scheduleTickUpdate();

    if (layoutTimeoutRef.current) clearTimeout(layoutTimeoutRef.current);
    layoutTimeoutRef.current = setTimeout(() => {
      updateLayout();
    }, 50);

    const currentZoom = Math.exp(val);
    const currentPanX = focusPixel.get() - focusYear.get() * currentZoom;
    const clampedPanX = clampPanX(currentPanX, currentZoom);
    if (Math.abs(clampedPanX - currentPanX) > 1e-6) {
      setCameraFromPanX(clampedPanX, currentZoom);
    }

    const rangeInYears = getViewportWidth() / currentZoom;
    let newLabel = "";
    if (rangeInYears >= 1e9)
      newLabel = `${(rangeInYears / 1e9).toFixed(0)}B Yrs`;
    else if (rangeInYears >= 1e6)
      newLabel = `${(rangeInYears / 1e6).toFixed(0)}M Yrs`;
    else if (rangeInYears >= 1000)
      newLabel = `${(rangeInYears / 1000).toFixed(0)}K Yrs`;
    else if (rangeInYears >= 1) newLabel = `${rangeInYears.toFixed(0)} Yrs`;
    else if (rangeInYears >= 1 / 12)
      newLabel = `${(rangeInYears * 12).toFixed(0)} Mos`;
    else if (rangeInYears >= 1 / 365.25)
      newLabel = `${(rangeInYears * 365.25).toFixed(0)} Days`;
    else newLabel = `${(rangeInYears * 365.25 * 24).toFixed(0)} Hrs`;

    setZoomRangeLabel((prev) => (prev !== newLabel ? newLabel : prev));
  });

  useEffect(() => {
    const isBootstrapping = !hasBootstrappedRef.current;
    handleAutoFit(isBootstrapping);
    updateTicks();
    updateLayout(isBootstrapping);
    hasBootstrappedRef.current = true;
  }, [events, selectedGroups, searchQuery]);

  // Animates camera to fit all currently-visible events with padding.
  // Call this any time you want to frame the visible event set.
  const handleAutoFit = (immediate = false) => {
    const visible = events.filter((e) => {
      if (getEventTimelineYear(e) < BIG_BANG_YEAR) return false;
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup =
        selectedGroups.length === 0 ||
        e.groups.some((g) => selectedGroups.includes(g));
      return matchesSearch && matchesGroup;
    });

    const container = containerRef.current;
    if (!container || visible.length === 0) return;
    const width = container.clientWidth;
    const PADDING = 0.12;

    const years = visible.map((e) => getEventTimelineYear(e));
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    if (Math.abs(maxYear - minYear) < 1e-9) {
      if (immediate) {
        focusPixel.set(width / 2);
        focusYear.set(minYear);
      } else {
        animate(focusPixel, width / 2, {
          type: "spring",
          stiffness: 300,
          damping: 30,
        });
        animate(focusYear, minYear, {
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

  const handleToggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
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
    return () => cancelAnimationFrame(frame);
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
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
    );
    setEditingEvent(null);
    setAddingEvent(false);
  };

  const handleAddEvent = (newEvent: Event) => {
    setEvents((prev) => [...prev, newEvent]);
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
        events={events}
        selectedGroups={selectedGroups}
        onToggleGroup={handleToggleGroup}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFocusEvent={handleFocusEvent}
        onEditEvent={setEditingEvent}
        onAddEvent={() => setAddingEvent(true)}
      />

      <div
        ref={containerRef}
        className={`w-full h-screen overflow-hidden bg-zinc-950 text-white cursor-grab active:cursor-grabbing relative touch-none${selecting ? " select-none" : ""}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Horizon Line */}
        <div className="absolute left-0 right-0 h-px bg-zinc-700 top-1/2 -translate-y-1/2 z-0" />

        {/* Moving Container for perfect sync */}
        <div className="absolute inset-0 z-10">
          <BigBangMarker
            zoom={zoom}
            focusPixel={focusPixel}
            focusYear={focusYear}
          />

          {/* Ticks */}
          {ticks.map((tick) => (
            <TickMarker
              key={tick.year}
              tick={tick}
              zoom={zoom}
              focusPixel={focusPixel}
              focusYear={focusYear}
            />
          ))}

          {/* Events — only render those within the visible year range + margin.
              The margin lets events that are slightly off-screen start animating
              in before the user sees them, so there's no pop-in. */}
          {events
            .filter((e) => {
              const ty = getEventTimelineYear(e);
              const { startYear, endYear } = visibleBoundsRef.current;
              const margin = (endYear - startYear) * 0.3;
              return ty >= startYear - margin && ty <= endYear + margin;
            })
            .map((event) => (
              <EventMarker
                key={event.id}
                event={event}
                zoom={zoom}
                focusPixel={focusPixel}
                focusYear={focusYear}
                layout={eventLayouts.current[event.id]}
                isFocused={event.id === selectedEventInfo?.id}
                onClick={handleFocusEvent}
              />
            ))}
        </div>
      </div>

      {/* Zoom Controller */}
      <div
        className="fixed right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center">
          <select
            value="current"
            onChange={handleQuickZoom}
            className="bg-zinc-950 text-zinc-300 text-[10px] font-mono rounded-full pr-3 py-1.5 border border-zinc-700 outline-none focus:border-emerald-500 text-center cursor-pointer hover:bg-zinc-800 transition-colors appearance-none shadow-sm"
          >
            <option value="current">{zoomRangeLabel || "Zoom"}</option>
            <option disabled>──────────</option>
            <option value="1000000000">1B Years</option>
            <option value="1000000">1M Years</option>
            <option value="100">100 Years</option>
            <option value="10">10 Years</option>
            <option value="1">1 Year</option>
            <option value={(1 / 12).toString()}>1 Month</option>
            <option value={(7 / 365.25).toString()}>1 Week</option>
            <option value={(1 / 365.25).toString()}>1 Day</option>
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <ChevronDown width={10} height={10} />
          </div>
        </div>

        <div
          ref={zoomTrackRef}
          className="w-8 h-32 rounded-full border border-zinc-700 relative cursor-ns-resize touch-none shadow-inner flex items-center justify-center"
          onPointerDown={handleZoomDragStart}
          onPointerMove={handleZoomDragMove}
          onPointerUp={handleZoomDragEnd}
          onPointerCancel={handleZoomDragEnd}
        >
          <motion.div
            className="absolute w-8 h-8 bg-zinc-700 hover:bg-zinc-600 rounded-full shadow-md border border-zinc-600 flex flex-col items-center justify-center gap-0.5"
            style={{ y: zoomThumbY }}
          >
            <div className="w-3 h-px bg-zinc-400 rounded-full" />
            <div className="w-3 h-px bg-zinc-400 rounded-full" />
            <div className="w-3 h-px bg-zinc-400 rounded-full" />
          </motion.div>
        </div>
      </div>

      {/* Floating Info Panel */}
      {selectedEventInfo && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 border border-zinc-700 px-4 py-3 rounded-xl shadow-2xl w-[min(92vw,560px)]"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 bg-zinc-800 rounded-full flex items-center justify-center text-lg border border-zinc-700">
                {selectedEventInfo.emoji}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">
                  {selectedEventInfo.title}
                </h3>
                <p className="text-emerald-500 font-mono text-xs mt-0.5 truncate">
                  {getEventDisplayLabel(selectedEventInfo)}
                </p>
                <p className="text-zinc-300 text-xs mt-1.5 line-clamp-2">
                  {selectedEventInfo.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  // Re-trigger camera animation to re-center on this event.
                  handleFocusEvent(selectedEventInfo);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-emerald-500"
                title="Center camera on this event"
              >
                Focus
              </button>
              <button
                onClick={() => {
                  setEditingEvent(selectedEventInfo);
                  setSelectedEventInfo(null);
                  focusedEventIdRef.current = null;
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-zinc-700"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setSelectedEventInfo(null);
                  focusedEventIdRef.current = null;
                }}
                className="text-zinc-500 hover:text-white p-1"
                aria-label="Close"
              >
                <X width={16} height={16} />
              </button>
            </div>
          </div>
        </div>
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
          onClose={() => setAddingEvent(false)}
        />
      )}

      {/* Bottom-right action buttons */}
      <div
        className="fixed bottom-6 right-6 z-40 flex flex-col gap-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleAutoFit}
          title="Auto-fit visible events"
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors"
        >
          <Maximize2 width={18} height={18} />
        </button>
      </div>

      {/* Warp speed overlay — active during long-distance camera jumps */}
      <WarpOverlay isWarping={isWarping} direction={warpDirection} />
    </>
  );
};
