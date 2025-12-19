import React, { useMemo, useRef, useCallback, useState } from "react";
import { ViewportState, TimelineEvent } from "../types";

interface MiniMapProps {
  viewport: ViewportState;
  events: TimelineEvent[];
  onNavigate: (year: number) => void;
  containerWidth: number;
}

const MiniMap: React.FC<MiniMapProps> = ({
  viewport,
  events,
  onNavigate,
  containerWidth,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate the full timeline range from events
  const { minYear, totalSpan } = useMemo(() => {
    if (events.length === 0) {
      return { minYear: 0, maxYear: 13_800_000_000, totalSpan: 13_800_000_000 };
    }

    let min = Infinity;
    let max = -Infinity;

    events.forEach((event) => {
      min = Math.min(min, event.yearsFromStart);
      max = Math.max(max, event.endYearsFromStart ?? event.yearsFromStart);
    });

    // Add 5% padding on each side
    const span = max - min;
    const padding = span * 0.05;
    min = Math.max(0, min - padding);
    max = max + padding;

    return { minYear: min, maxYear: max, totalSpan: max - min };
  }, [events]);

  // Calculate the visible range in the main timeline
  const visibleRange = useMemo(() => {
    const visibleWidth = containerWidth;
    const startYear = viewport.startYear;
    const endYear = startYear + visibleWidth / viewport.zoom;
    return { startYear, endYear };
  }, [viewport, containerWidth]);

  // Convert clientX to year
  const clientXToYear = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return minYear;
      const rect = container.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return minYear + totalSpan * ratio;
    },
    [minYear, totalSpan]
  );

  // Handle navigation (both click and drag)
  const navigateToX = useCallback(
    (clientX: number) => {
      const targetYear = clientXToYear(clientX);
      onNavigate(targetYear);
    },
    [clientXToYear, onNavigate]
  );

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    navigateToX(e.clientX);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      navigateToX(e.clientX);
    },
    [isDragging, navigateToX]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    navigateToX(e.touches[0].clientX);
  };

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      navigateToX(e.touches[0].clientX);
    },
    [isDragging, navigateToX]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global event listeners when dragging
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isDragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  // Calculate highlight box position and width using percentages for smooth updates
  const highlightStyle = useMemo(() => {
    const leftPercent = ((visibleRange.startYear - minYear) / totalSpan) * 100;
    const rightPercent = ((visibleRange.endYear - minYear) / totalSpan) * 100;
    const widthPercent = rightPercent - leftPercent;

    // Clamp values
    const clampedLeft = Math.max(0, Math.min(100, leftPercent));
    const clampedWidth = Math.max(
      0.1,
      Math.min(100 - clampedLeft, widthPercent)
    );

    return {
      left: `${clampedLeft}%`,
      width: `${clampedWidth}%`,
    };
  }, [visibleRange, minYear, totalSpan]);

  // Event markers on minimap
  const eventMarkers = useMemo(() => {
    return events.map((event) => {
      const x = ((event.yearsFromStart - minYear) / totalSpan) * 100;
      const endX = event.endYearsFromStart
        ? ((event.endYearsFromStart - minYear) / totalSpan) * 100
        : null;

      return {
        id: event.id,
        x,
        endX,
        color: event.color || "#6366f1",
        importance: event.importance,
      };
    });
  }, [events, minYear, totalSpan]);

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-sm border-t border-white/10 px-2 md:px-4 py-2 shrink-0">
      <div className="flex items-center gap-2 md:gap-3">
        {/* Labels */}
        <span className="text-[8px] md:text-[10px] text-slate-500 font-medium whitespace-nowrap">
          Big Bang
        </span>

        {/* MiniMap Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`flex-1 h-5 md:h-6 bg-slate-800/50 rounded-full relative overflow-hidden border border-white/5 touch-none select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* Event markers */}
          {eventMarkers.map((marker) => (
            <div
              key={marker.id}
              className="absolute top-1 bottom-1 rounded-full opacity-60 pointer-events-none"
              style={{
                left: `${marker.x}%`,
                width: marker.endX
                  ? `${Math.max(0.5, marker.endX - marker.x)}%`
                  : "2px",
                backgroundColor: marker.color,
              }}
            />
          ))}

          {/* Visible range highlight */}
          <div
            className={`absolute top-0 bottom-0 bg-indigo-500/30 border-x-2 border-indigo-400 pointer-events-none ${
              isDragging ? "border-indigo-300" : ""
            }`}
            style={highlightStyle}
          >
            {/* Center line indicator */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-400 -translate-x-1/2" />
          </div>
        </div>

        {/* Labels */}
        <span className="text-[8px] md:text-[10px] text-slate-500 font-medium whitespace-nowrap">
          Future
        </span>
      </div>
    </div>
  );
};

export default MiniMap;
