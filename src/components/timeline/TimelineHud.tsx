import React from "react";
import { motion, MotionValue } from "motion/react";
import { ChevronDown, Maximize2, X } from "lucide-react";
import { Event } from "../../types";
import { getEventDisplayLabel } from "../../utils";

interface FpsBadgeProps {
  fps: number;
}

export const FpsBadge: React.FC<FpsBadgeProps> = ({ fps }) => (
  <div
    className="fixed top-4 right-4 z-40 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[11px] font-mono text-zinc-300"
    onPointerDown={(e) => e.stopPropagation()}
    onWheel={(e) => e.stopPropagation()}
  >
    FPS {fps}
  </div>
);

interface ZoomControllerProps {
  zoomRangeLabel: string;
  onQuickZoom: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  zoomTrackRef: React.RefObject<HTMLDivElement | null>;
  zoomThumbY: MotionValue<number>;
  onZoomDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const ZoomController: React.FC<ZoomControllerProps> = ({
  zoomRangeLabel,
  onQuickZoom,
  zoomTrackRef,
  zoomThumbY,
  onZoomDragStart,
  onZoomDragMove,
  onZoomDragEnd,
}) => (
  <div
    className="fixed right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3"
    onPointerDown={(e) => e.stopPropagation()}
    onWheel={(e) => e.stopPropagation()}
  >
    <div className="relative flex items-center justify-center">
      <select
        value="current"
        onChange={onQuickZoom}
        className="bg-zinc-950 text-zinc-300 text-[10px] font-mono rounded-full pr-3 py-1.5 border border-zinc-700 outline-none focus:border-emerald-500 text-center cursor-pointer hover:bg-zinc-800 transition-colors appearance-none"
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
      className="w-8 h-32 rounded-full border border-zinc-700 relative cursor-ns-resize touch-none flex items-center justify-center"
      onPointerDown={onZoomDragStart}
      onPointerMove={onZoomDragMove}
      onPointerUp={onZoomDragEnd}
      onPointerCancel={onZoomDragEnd}
    >
      <motion.div
        className="absolute w-8 h-8 bg-zinc-700 hover:bg-zinc-600 rounded-full border border-zinc-600 flex flex-col items-center justify-center gap-0.5"
        style={{ y: zoomThumbY }}
      >
        <div className="w-3 h-px bg-zinc-400 rounded-full" />
        <div className="w-3 h-px bg-zinc-400 rounded-full" />
        <div className="w-3 h-px bg-zinc-400 rounded-full" />
      </motion.div>
    </div>
  </div>
);

interface EventInfoPanelProps {
  event: Event;
  onFocus: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export const EventInfoPanel: React.FC<EventInfoPanelProps> = ({
  event,
  onFocus,
  onEdit,
  onClose,
}) => (
  <div
    className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-xl w-[min(92vw,560px)]"
    onPointerDown={(e) => e.stopPropagation()}
    onWheel={(e) => e.stopPropagation()}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 shrink-0 bg-zinc-800 rounded-full flex items-center justify-center text-lg border border-zinc-700">
          {event.emoji}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {event.title}
          </h3>
          <p className="text-emerald-500 font-mono text-xs mt-0.5 truncate">
            {getEventDisplayLabel(event)}
          </p>
          <p className="text-zinc-300 text-xs mt-1.5 line-clamp-2">
            {event.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onFocus}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-emerald-500"
          title="Center camera on this event"
        >
          Focus
        </button>
        <button
          onClick={onEdit}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-zinc-700"
        >
          Edit
        </button>
        <button
          onClick={onClose}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white p-1.5 rounded-md transition-colors border border-zinc-700"
          aria-label="Close"
        >
          <X width={16} height={16} />
        </button>
      </div>
    </div>
  </div>
);

interface AutoFitButtonProps {
  onClick: () => void;
}

export const AutoFitButton: React.FC<AutoFitButtonProps> = ({ onClick }) => (
  <div
    className="fixed bottom-6 right-6 z-40 flex flex-col gap-2"
    onPointerDown={(e) => e.stopPropagation()}
  >
    <button
      onClick={onClick}
      title="Auto-fit visible events"
      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
    >
      <Maximize2 width={18} height={18} />
    </button>
  </div>
);
