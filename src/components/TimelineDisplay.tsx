import React, {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { ViewportState, TimelineEvent } from "../types";
import { UNIVERSE_AGE_YEARS, YEAR_ZERO_FROM_BANG } from "../constants";
import { formatGranularTimeLines } from "../utils/format";
import { MAX_ZOOM, MIN_ZOOM } from "../constants";

interface Props {
  viewport: ViewportState;
  setViewport: (v: ViewportState) => void;
  events: TimelineEvent[];
  onSelectEvent: (id: string) => void;
  selectedEventId: string | null;
}

const MIN_STEP_ALLOWED = 1e-7;

const ERAS = [
  { year: 0, label: "BIG BANG" },
  { year: 1e9, label: "FIRST GALAXIES" },
  { year: 9.3e9, label: "EARTH FORMS" },
  { year: YEAR_ZERO_FROM_BANG, label: "JESUS YEAR" },
  { year: UNIVERSE_AGE_YEARS, label: "TODAY" },
];

const GRID_POWERS = [12, 9, 6, 3, 0, -2];

const TimelineDisplay: React.FC<Props> = ({
  viewport,
  setViewport,
  events,
  onSelectEvent,
  selectedEventId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const hasMovedSignificant = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  // Pre-sort and filter events for better performance
  const processedEvents = useMemo(() => {
    return [...events].sort((a, b) =>
      a.id === selectedEventId
        ? 1
        : b.id === selectedEventId
        ? -1
        : a.importance - b.importance
    );
  }, [events, selectedEventId]);

  // Handle resize with debounce
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (canvasRef.current) {
          const { width, height } =
            canvasRef.current.parentElement!.getBoundingClientRect();
          const dpr = window.devicePixelRatio;
          setDimensions({ width, height });
          canvasRef.current.width = width * dpr;
          canvasRef.current.height = height * dpr;
        }
      }, 16); // ~60fps debounce
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Main draw effect with requestAnimationFrame for star twinkle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    const { startYear, zoom } = viewport;
    const { width, height } = dimensions;
    const centerY = height / 2;
    const zoomLog = Math.log10(zoom);

    // Helper function
    const yearToX = (year: number) => (year - startYear) * zoom;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Base dark background
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);

      // Draw hierarchical grid (batched by opacity)
      ctx.lineWidth = 1;
      for (const p of GRID_POWERS) {
        const step = Math.pow(10, p);
        if (step < MIN_STEP_ALLOWED) continue;
        const xStep = step * zoom;
        if (xStep < 10 || xStep > 5000) continue;

        const opacity = Math.min(0.3, xStep / 300);
        ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;

        const first = Math.floor(startYear / step) * step;
        const last = Math.ceil((startYear + width / zoom) / step) * step;

        ctx.beginPath();
        for (let y = first; y <= last; y += step) {
          const x = yearToX(y);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        ctx.stroke();
      }

      // Draw era labels
      ctx.font = "900 120px Inter";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      for (const era of ERAS) {
        const x = yearToX(era.year);
        if (x < -1000 || x > width + 1000) continue;
        ctx.save();
        ctx.translate(x, centerY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(era.label, 0, 0);
        ctx.restore();
      }

      // Draw ruler
      let step =
        zoom < 1e-12
          ? 1_000_000_000
          : zoom < 1e-9
          ? 100_000_000
          : zoom < 1e-6
          ? 1_000_000
          : zoom < 0.1
          ? 1000
          : zoom < 1
          ? 100
          : zoom < 10
          ? 10
          : zoom < 100
          ? 1
          : zoom < 1000
          ? 1 / 12
          : zoom < 100000
          ? 1 / 365
          : 1 / (365 * 24);

      while (step * zoom < 80) {
        if (step < 1 / 12) step *= 2;
        else if (step === 1 / 12) step = 1;
        else if (step === 1) step = 5;
        else if (step === 5) step = 10;
        else step *= 10;
      }
      while (step * zoom > 200) {
        if (step > 1) step /= 2;
        else if (step === 1) step = 1 / 12;
        else step /= 10;
        if (step < MIN_STEP_ALLOWED) break;
      }

      const firstYear = Math.floor(startYear / step) * step;
      const lastYear = Math.ceil((startYear + width / zoom) / step) * step;

      // Batch tick drawing
      ctx.beginPath();
      const majorTicks: { x: number; y: number }[] = [];
      const minorTicks: { x: number; y: number }[] = [];

      for (let y = firstYear; y <= lastYear; y += step) {
        const x = yearToX(y);
        const jesusYear = Math.round(y - YEAR_ZERO_FROM_BANG);
        const isMajor =
          step >= 1
            ? jesusYear % (step * 5) === 0
            : Math.abs(y % (step * 4)) < step * 0.1;
        const tickHeight = isMajor ? 18 : 8;

        if (isMajor) {
          majorTicks.push({ x, y });
        } else {
          minorTicks.push({ x, y });
        }

        // Draw tick
        ctx.moveTo(x, centerY - tickHeight);
        ctx.lineTo(x, centerY + tickHeight);
      }

      // Draw minor ticks
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.stroke();

      // Draw major ticks
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      for (const tick of majorTicks) {
        ctx.moveTo(tick.x, centerY - 18);
        ctx.lineTo(tick.x, centerY + 18);
      }
      ctx.stroke();

      // Draw labels (text is expensive, minimize)
      for (let y = firstYear; y <= lastYear; y += step) {
        const x = yearToX(y);
        if (x < -200 || x > width + 200) continue;

        const jesusYear = Math.round(y - YEAR_ZERO_FROM_BANG);
        const isMajor =
          step >= 1
            ? jesusYear % (step * 5) === 0
            : Math.abs(y % (step * 4)) < step * 0.1;

        const lines = formatGranularTimeLines(y, zoom, width);
        ctx.fillStyle = isMajor ? "#ffffff" : "rgba(255, 255, 255, 0.35)";
        ctx.font = isMajor ? "700 13px Inter" : "500 10px Inter";
        ctx.textAlign = "center";

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], x, centerY + 34 + i * 16);
        }
      }

      // Center line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Draw events
      const baseImportanceThreshold = Math.max(1, 9 - (zoomLog + 8) * 1.5);
      const drawnXPoints: number[] = [];

      for (const event of processedEvents) {
        const eventStartX = yearToX(event.yearsFromStart);
        const eventEndX = event.endYearsFromStart
          ? yearToX(event.endYearsFromStart)
          : eventStartX;

        if (eventEndX < -500 || eventStartX > width + 500) continue;

        const isSelected = event.id === selectedEventId;
        if (!isSelected) {
          if (event.importance < baseImportanceThreshold) continue;
          let tooClose = false;
          for (const px of drawnXPoints) {
            if (Math.abs(px - eventStartX) < 100) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;
        }

        drawnXPoints.push(eventStartX);
        const color = event.color || "#6366f1";

        // Draw range if applicable
        if (
          event.endYearsFromStart &&
          event.endYearsFromStart !== event.yearsFromStart
        ) {
          ctx.fillStyle = color + "08";
          ctx.fillRect(eventStartX, centerY - 12, eventEndX - eventStartX, 24);
          ctx.strokeStyle = color + "20";
          ctx.strokeRect(
            eventStartX,
            centerY - 12,
            eventEndX - eventStartX,
            24
          );
        }

        // Draw stem
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(eventStartX, centerY);
        ctx.lineTo(eventStartX, centerY - (isSelected ? 120 : 60));
        ctx.stroke();

        // Draw point
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(eventStartX, centerY, isSelected ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw icon
        if (event.icon) {
          ctx.font = isSelected ? "32px Inter" : "20px Inter";
          ctx.textAlign = "center";
          ctx.fillText(
            event.icon,
            eventStartX,
            centerY - (isSelected ? 150 : 90)
          );
        }

        // Draw title
        ctx.fillStyle = isSelected ? "#fff" : "rgba(255, 255, 255, 0.9)";
        ctx.font = isSelected ? "700 14px Inter" : "500 12px Inter";
        ctx.textAlign = "center";
        ctx.fillText(
          event.title,
          eventStartX,
          centerY - (isSelected ? 125 : 68)
        );
      }
    };

    // Draw once
    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, viewport, processedEvents, selectedEventId]);

  // Track drag start state for precision at high zoom levels
  const dragStartRef = useRef<{ x: number; startYear: number } | null>(null);

  const handleStart = useCallback(
    (x: number, y: number) => {
      isDragging.current = true;
      hasMovedSignificant.current = false;
      lastPos.current = { x, y };
      // Store initial state for precision calculation
      dragStartRef.current = { x, startYear: viewport.startYear };
    },
    [viewport.startYear]
  );

  const handleMove = useCallback(
    (x: number, y: number) => {
      if (!isDragging.current || !dragStartRef.current) return;

      const dx = x - lastPos.current.x;
      if (Math.abs(dx) > 1) hasMovedSignificant.current = true;
      lastPos.current = { x, y };

      // Calculate total drag distance from start for precision
      // This avoids accumulating small floating point errors
      const totalDx = x - dragStartRef.current.x;
      const newStartYear =
        dragStartRef.current.startYear - totalDx / viewport.zoom;

      setViewport({
        ...viewport,
        startYear: newStartYear,
      });
    },
    [viewport, setViewport]
  );

  const handleEnd = useCallback(
    (x: number) => {
      if (isDragging.current && !hasMovedSignificant.current) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = x - rect.left;
          const clickYear = mouseX / viewport.zoom + viewport.startYear;
          let closest: TimelineEvent | null = null;
          let minDistance = 60 / viewport.zoom;
          for (const event of events) {
            const dist = Math.abs(event.yearsFromStart - clickYear);
            if (dist < minDistance) {
              minDistance = dist;
              closest = event;
            }
          }
          if (closest) onSelectEvent(closest.id);
        }
      }
      isDragging.current = false;
      dragStartRef.current = null;
    },
    [viewport, events, onSelectEvent]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;

      const zoomFactor = 1 - e.deltaY * 0.001;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, viewport.zoom * zoomFactor)
      );
      const anchorYear = mouseX / viewport.zoom + viewport.startYear;

      setViewport({
        startYear: anchorYear - mouseX / newZoom,
        zoom: newZoom,
      });
    },
    [viewport, setViewport]
  );

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={(e) => handleEnd(e.clientX)}
      onTouchStart={(e) =>
        handleStart(e.touches[0].clientX, e.touches[0].clientY)
      }
      onTouchMove={(e) =>
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
      onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)}
      onWheel={handleWheel}
      className="w-full h-full block"
    />
  );
};

export default TimelineDisplay;
