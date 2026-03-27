import React from "react";
import { motion, MotionValue } from "motion/react";
import { ChevronDown } from "lucide-react";

interface ZoomPanelProps {
  isOpen: boolean;
  zoomRangeLabel: string;
  onQuickZoom: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  zoomTrackRef: React.RefObject<HTMLDivElement | null>;
  zoomThumbY: MotionValue<number>;
  onZoomDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const ZoomPanel: React.FC<ZoomPanelProps> = ({
  isOpen,
  zoomRangeLabel,
  onQuickZoom,
  zoomTrackRef,
  zoomThumbY,
  onZoomDragStart,
  onZoomDragMove,
  onZoomDragEnd,
}) => (
  <div className="ui-popover" data-open={isOpen}>
    <div className="mt-0.5 flex flex-col items-end gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 p-2.5">
      <div className="relative flex items-center justify-center self-center">
        <select
          value="current"
          onChange={onQuickZoom}
          className="text-zinc-300 text-[10px] font-mono rounded-full pr-3 py-1.5 border border-zinc-700 outline-none focus:border-emerald-500 text-center cursor-pointer hover:bg-zinc-800 transition-colors appearance-none"
        >
          <option value="current">{zoomRangeLabel || "Zoom"}</option>
          <option disabled>──────────</option>
          <option value="1000000000">1B Years</option>
          <option value="100000000">100M Years</option>
          <option value="1000000">1M Years</option>
          <option value="100000">100K Years</option>
          <option value="10000">10K Years</option>
          <option value="1000">1K Years</option>
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
        className="relative flex h-32 w-8 touch-none cursor-ns-resize items-center justify-center self-center rounded-full border border-zinc-700"
        onPointerDown={onZoomDragStart}
        onPointerMove={onZoomDragMove}
        onPointerUp={onZoomDragEnd}
        onPointerCancel={onZoomDragEnd}
      >
        <motion.div
          className="absolute flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-full border border-zinc-600 bg-zinc-700 hover:bg-zinc-600"
          style={{ y: zoomThumbY }}
        >
          <div className="h-px w-3 rounded-full bg-zinc-400" />
          <div className="h-px w-3 rounded-full bg-zinc-400" />
          <div className="h-px w-3 rounded-full bg-zinc-400" />
        </motion.div>
      </div>
    </div>
  </div>
);
