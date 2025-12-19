import React, { useState, useRef, useEffect } from "react";
import { ChevronUp, ChevronDown, MoveVertical, ZoomIn, X } from "lucide-react";
import { ViewportState } from "../types";

interface Props {
  onZoom: (delta: number) => void;
  onFastScale: (scale: "millennium" | "year" | "month" | "day") => void;
  viewport: ViewportState;
}

const ZoomController: React.FC<Props> = ({ onZoom, onFastScale, viewport }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);

  // Auto-expand on desktop
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let animationFrame: number;
    const loop = () => {
      if (Math.abs(offset) > 5) {
        const direction = offset < 0 ? 1 : -1;
        const magnitude = Math.pow(Math.abs(offset) / 50, 2);
        const speed = direction * magnitude * 0.05;
        onZoom(speed);
      }
      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [isDragging, offset, onZoom]);

  const handleStart = (clientY: number) => {
    setIsDragging(true);
    setOffset(0);
    startYRef.current = clientY;
  };

  const handleMove = (clientY: number) => {
    if (!isDragging || !dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const newOffset = Math.max(-60, Math.min(60, clientY - centerY));
    setOffset(newOffset);
  };

  const handleEnd = () => {
    setIsDragging(false);
    setOffset(0);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientY);
  const handleMouseMove = (e: MouseEvent) => handleMove(e.clientY);
  const handleMouseUp = () => handleEnd();

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
  };
  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  };
  const handleTouchEnd = () => handleEnd();

  useEffect(() => {
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
  }, [isDragging]);

  const getVisibleSpanLabel = () => {
    const canvasWidth = window.innerWidth - (window.innerWidth > 768 ? 320 : 0);
    const spanYears = canvasWidth / viewport.zoom;

    if (spanYears >= 1_000_000_000)
      return `${(spanYears / 1_000_000_000).toFixed(1)}B Years`;
    if (spanYears >= 1_000_000)
      return `${(spanYears / 1_000_000).toFixed(1)}M Years`;
    if (spanYears >= 1_000) return `${(spanYears / 1_000).toFixed(1)}k Years`;
    if (spanYears >= 1) return `${spanYears.toFixed(1)} Years`;

    const spanDays = spanYears * 365.25;
    if (spanDays >= 1) return `${spanDays.toFixed(1)} Days`;

    const spanHours = spanDays * 24;
    if (spanHours >= 1) return `${spanHours.toFixed(1)} Hours`;

    const spanMinutes = spanHours * 60;
    return `${spanMinutes.toFixed(1)} Minutes`;
  };

  const showControls = !isMobile || isExpanded;

  return (
    <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-40">
      {/* Mobile Toggle Button */}
      {isMobile && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-2.5 rounded-full shadow-xl transition-all ${
            isExpanded
              ? "bg-indigo-600 text-white"
              : "bg-slate-900/90 text-slate-400 border border-white/10"
          }`}
        >
          {isExpanded ? (
            <X className="w-5 h-5" />
          ) : (
            <ZoomIn className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Zoom Controls - Hidden on mobile until toggled */}
      {showControls && (
        <>
          <div className="flex flex-col items-center bg-slate-900/80 backdrop-blur-md border border-white/10 p-1.5 md:p-2 rounded-full shadow-2xl">
            <button
              className="text-slate-500 mb-1 pointer-events-none"
              title="Drag to Zoom"
            >
              <ChevronUp className="w-3 h-3 md:w-4 md:h-4" />
            </button>
            <div
              ref={dragRef}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              className="relative w-7 h-28 md:w-9 md:h-40 bg-slate-800 rounded-full flex items-center justify-center cursor-ns-resize overflow-hidden touch-none"
            >
              <div className="absolute h-px w-3 md:w-4 bg-white/10 top-1/4" />
              <div className="absolute h-px w-4 md:w-5 bg-white/20 top-1/2" />
              <div className="absolute h-px w-3 md:w-4 bg-white/10 top-3/4" />

              <div
                style={{ transform: `translateY(${offset}px)` }}
                className={`w-5 h-8 md:w-7 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-shadow shadow-lg ${
                  isDragging
                    ? "bg-indigo-500 shadow-indigo-500/40"
                    : "bg-slate-700"
                }`}
              >
                <MoveVertical className="w-3 h-3 md:w-4 md:h-4 text-white" />
              </div>
            </div>
            <button
              className="text-slate-500 mt-1 pointer-events-none"
              title="Drag to Zoom"
            >
              <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Combined Scale Label + Fast Scale Buttons */}
          <div className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-xl shadow-xl overflow-hidden">
            {/* Visible Span Label */}
            <div className="px-2 md:px-3 py-1.5 text-center border-b border-white/10">
              <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                {getVisibleSpanLabel()}
              </div>
            </div>

            {/* Fast Scale Buttons Row */}
            <div className="flex">
              <button
                onClick={() => onFastScale("millennium")}
                className="flex-1 px-1.5 md:px-2 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold text-slate-400 hover:text-white hover:bg-indigo-600/30 transition-colors border-r border-white/5"
              >
                1kY
              </button>
              <button
                onClick={() => onFastScale("year")}
                className="flex-1 px-1.5 md:px-2 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold text-slate-400 hover:text-white hover:bg-indigo-600/30 transition-colors border-r border-white/5"
              >
                1Y
              </button>
              <button
                onClick={() => onFastScale("month")}
                className="flex-1 px-1.5 md:px-2 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold text-slate-400 hover:text-white hover:bg-indigo-600/30 transition-colors border-r border-white/5"
              >
                1M
              </button>
              <button
                onClick={() => onFastScale("day")}
                className="flex-1 px-1.5 md:px-2 py-1 md:py-1.5 text-[8px] md:text-[9px] font-bold text-slate-400 hover:text-white hover:bg-indigo-600/30 transition-colors"
              >
                1D
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ZoomController;
