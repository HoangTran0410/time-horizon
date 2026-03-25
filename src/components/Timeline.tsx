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
import { Event, getEventTimelineYear } from "../types";
import { BIG_BANG_YEAR, EVENTS } from "../constants";
import { Sidebar } from "./Sidebar";
import { EventEditor } from "./EventEditor";
import {
  getEventDisplayLabel,
  formatTimelineTick,
  getNiceInterval,
} from "../utils";

const EventMarker: React.FC<{
  event: Event;
  zoom: MotionValue<number>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  layout: any;
  onClick: (e: Event) => void;
}> = ({ event, zoom, focusPixel, focusYear, layout, onClick }) => {
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

  return (
    <motion.div
      className="absolute top-1/2 z-10"
      style={{
        x: markerX,
        y: yOffset,
        translateY: "-50%",
        opacity,
        pointerEvents: pointerEvents as any,
      }}
    >
      <div className="flex flex-col items-center -translate-x-1/2 group">
        <motion.div
          className="absolute w-px bg-zinc-700 group-hover:bg-emerald-500 transition-colors z-0"
          style={{ height: lineHeight, top: lineTop, left: "50%" }}
        />

        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClick(event);
          }}
          className="w-12 h-12 bg-zinc-900 border-2 border-zinc-700 group-hover:border-emerald-500 rounded-full flex items-center justify-center text-2xl group-hover:scale-125 transition-all cursor-pointer shadow-lg z-10 relative"
        >
          {event.emoji}
        </div>

        <motion.div
          className="absolute flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity w-48 text-center"
          style={{ top: textTop, bottom: textBottom }}
        >
          <span className="text-sm font-medium text-zinc-200">
            {event.title}
          </span>
          <span className="text-xs text-zinc-500">
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

const TickMarker: React.FC<{
  tick: any;
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
        <div className="w-px h-3 bg-zinc-600 -mt-1.5" />
        <span className="mt-2 text-[10px] text-zinc-500 font-mono select-none whitespace-nowrap">
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
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [ticks, setTicks] = useState<{ year: number; interval: number }[]>([]);

  const focusPixel = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 500,
  );
  const focusYear = useMotionValue(0);
  const logZoom = useMotionValue(Math.log(2000 / 13.8e9));
  const zoom = useTransform(logZoom, Math.exp);
  const panX = useTransform(
    () => focusPixel.get() - focusYear.get() * zoom.get(),
  );

  const targetLogZoom = useRef(Math.log(2000 / 13.8e9));

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

  const updateLayout = () => {
    const currentZoom = Math.exp(logZoom.get());
    const MIN_DIST_PX = 90; // Minimum pixels between events
    const minDistYears = MIN_DIST_PX / currentZoom;

    const visibleEvents = events.filter((e) => {
      if (getEventTimelineYear(e) < BIG_BANG_YEAR) return false;
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup =
        selectedGroups.length === 0 ||
        e.groups.some((g) => selectedGroups.includes(g));
      return matchesSearch && matchesGroup;
    });

    const sortedEvents = [...visibleEvents].sort(
      (a, b) => b.priority - a.priority,
    );
    const occupied: { year: number; level: number }[] = [];

    const LEVELS = [1, 2, 3];

    for (const ev of sortedEvents) {
      let placedLevel = null;

      // Assign a stable preferred side based on the original array index
      const originalIndex = events.findIndex((e) => e.id === ev.id);
      const side = originalIndex % 2 === 0 ? 1 : -1;

      for (const level of LEVELS) {
        const actualLevel = level * side;
        const collision = occupied.some(
          (occ) =>
            occ.level === actualLevel &&
            Math.abs(occ.year - getEventTimelineYear(ev)) < minDistYears,
        );
        if (!collision) {
          placedLevel = actualLevel;
          occupied.push({ year: getEventTimelineYear(ev), level: actualLevel });
          break;
        }
      }

      const layout = eventLayouts.current[ev.id];
      if (placedLevel !== null) {
        const targetY = placedLevel * 80;
        if (layout.targetY !== targetY) {
          layout.targetY = targetY;
          animate(layout.y, targetY, {
            type: "spring",
            stiffness: 400,
            damping: 40,
          });
        }
        if (layout.targetOpacity !== 1) {
          layout.targetOpacity = 1;
          animate(layout.opacity, 1, { duration: 0.2 });
        }
      } else {
        if (layout.targetOpacity !== 0) {
          layout.targetOpacity = 0;
          animate(layout.opacity, 0, { duration: 0.2 });
        }
      }
    }

    // Hide filtered out events
    for (const ev of events) {
      if (!visibleEvents.includes(ev)) {
        const layout = eventLayouts.current[ev.id];
        if (layout.targetOpacity !== 0) {
          layout.targetOpacity = 0;
          animate(layout.opacity, 0, { duration: 0.2 });
        }
      }
    }
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
    const visibleYears = width / currentZoom;

    const roughInterval = getNiceInterval(visibleYears / 10);
    const sampleString = formatTimelineTick(startYear, roughInterval);
    const estimatedWidthPx = Math.max(80, sampleString.length * 8 + 40);

    const maxTicks = Math.max(2, Math.floor(width / estimatedWidthPx));
    const idealInterval = visibleYears / maxTicks;
    const interval = getNiceInterval(idealInterval);

    // Generate tick years aligned to the interval so they remain stable across
    // consecutive panning frames — the same absolute years stay visible, they
    // just shift pixel position. Only zoom changes (which changes `interval`)
    // produce a new set of tick years.
    const newTicks: { year: number; interval: number }[] = [];
    const firstTick = Math.floor(startYear / interval) * interval;
    for (let y = firstTick; y <= endYear; y += interval) {
      if (y >= BIG_BANG_YEAR) {
        newTicks.push({ year: y, interval });
      }
    }

    setTicks((prev) => {
      // Only trigger re-render when tick years actually change (zoom changes).
      // During panning, absolute tick years stay identical — no flicker.
      if (
        prev.length === newTicks.length &&
        prev.every(
          (t, i) =>
            t.year === newTicks[i].year && t.interval === newTicks[i].interval,
        )
      ) {
        return prev;
      }
      return newTicks;
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
    const currentX = panX.get();

    // Calculate new X after applying horizontal pan
    const nextX = currentX - e.deltaX;

    // Calculate the year under the mouse based on the NEW X position
    const yearUnderMouse = (mouseX - nextX) / currentZ;

    // Update focus points to keep the year under the mouse stable
    focusPixel.set(mouseX);
    focusYear.set(yearUnderMouse);

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

    const currentX = panX.get();
    const currentZ = zoom.get();
    const minFocusPixel = -BIG_BANG_YEAR * currentZ + window.innerWidth / 2;
    const nextX = Math.min(currentX + deltaX, minFocusPixel);

    focusPixel.set(nextX);
    focusYear.set(0);

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
      // Clamp: Big Bang (BIG_BANG_YEAR yrs) can go no further right than screen center
      const minFocusPixel = -BIG_BANG_YEAR * currentZ + window.innerWidth / 2;
      const nextX = Math.min(panX.get() + v, minFocusPixel);
      focusPixel.set(nextX);
      focusYear.set(0);
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
    const rangeInYears =
      (typeof window !== "undefined" ? window.innerWidth : 1000) / currentZoom;
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
    updateTicks();
    updateLayout();
  }, [events, selectedGroups, searchQuery]);

  const handleToggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const handleFocusEvent = (event: Event) => {
    setSelectedEventInfo(event);
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;

    const eventYear = getEventTimelineYear(event);

    animate(focusPixel, width / 2, {
      type: "spring",
      stiffness: 400,
      damping: 40,
    });
    animate(focusYear, eventYear, {
      type: "spring",
      stiffness: 400,
      damping: 40,
    });

    // If event has duration, auto-zoom to show neighborhood around that duration.
    if (event.duration && event.duration > 0) {
      // Rule of thumb: show ~20x duration around center, clamped to sane bounds.
      const targetRangeYears = Math.min(
        Math.max(event.duration * 20, 1 / 365.25),
        1e9,
      );
      const targetZoom = width / targetRangeYears;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(targetZoom, MAX_ZOOM));
      targetLogZoom.current = Math.log(clampedZoom);
      animate(logZoom, targetLogZoom.current, {
        type: "spring",
        stiffness: 400,
        damping: 40,
      });
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

    const centerPixel = window.innerWidth / 2;
    const centerYear = (centerPixel - panX.get()) / zoom.get();
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
    const targetZoom = window.innerWidth / rangeInYears;
    const newLogZoom = Math.max(
      Math.log(MIN_ZOOM),
      Math.min(Math.log(MAX_ZOOM), Math.log(targetZoom)),
    );

    const centerPixel = window.innerWidth / 2;
    const centerYear = (centerPixel - panX.get()) / zoom.get();
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
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
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
    <div
      ref={containerRef}
      className={`w-full h-screen overflow-hidden bg-zinc-950 text-white cursor-grab active:cursor-grabbing relative touch-none${selecting ? " select-none" : ""}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
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

        {/* Events */}
        {events
          .filter((e) => getEventTimelineYear(e) >= BIG_BANG_YEAR)
          .map((event) => (
            <EventMarker
              key={event.id}
              event={event}
              zoom={zoom}
              focusPixel={focusPixel}
              focusYear={focusYear}
              layout={eventLayouts.current[event.id]}
              onClick={handleFocusEvent}
            />
          ))}
      </div>

      {/* Zoom Controller */}
      <div
        className="fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center">
          <select
            value="current"
            onChange={handleQuickZoom}
            className="bg-zinc-950 text-zinc-300 text-[10px] font-mono rounded-full pl-3 pr-6 py-1.5 border border-zinc-700 outline-none focus:border-emerald-500 text-center cursor-pointer hover:bg-zinc-800 transition-colors appearance-none shadow-sm"
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
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <div
          ref={zoomTrackRef}
          className="w-8 h-32 bg-zinc-950 rounded-full border border-zinc-700 relative cursor-ns-resize touch-none shadow-inner flex items-center justify-center"
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
                  setEditingEvent(selectedEventInfo);
                  setSelectedEventInfo(null);
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-zinc-700"
              >
                Edit
              </button>
              <button
                onClick={() => setSelectedEventInfo(null)}
                className="text-zinc-500 hover:text-white p-1"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
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
    </div>
  );
};
