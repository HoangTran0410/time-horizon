import React from "react";
import { motion, MotionValue } from "motion/react";
import {
  CalendarDays,
  ChevronDown,
  Locate,
  Maximize2,
  Pencil,
  Ruler,
  Search,
  SlidersVertical,
  X,
  ZoomIn,
} from "lucide-react";
import { Event } from "../../types";
import { getEventDisplayLabel } from "../../utils";

interface FpsBadgeProps {
  logicFps: number;
  renderFps: number;
}

export const FpsBadge: React.FC<FpsBadgeProps> = ({ logicFps, renderFps }) => (
  <div
    className="fixed top-4 right-4 z-40 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[11px] font-mono text-zinc-300"
    onPointerDown={(e) => e.stopPropagation()}
    onWheel={(e) => e.stopPropagation()}
  >
    Logic {logicFps} | Canvas {renderFps}
  </div>
);

interface ZoomControllerProps {
  zoomRangeLabel: string;
  onQuickZoom: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onJumpToDate: (target: DateJumpTarget) => void;
  zoomTrackRef: React.RefObject<HTMLDivElement | null>;
  zoomThumbY: MotionValue<number>;
  onZoomDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export interface DateJumpTarget {
  year: number;
  month: number | null;
  day: number | null;
}

const getMaxDay = (year: number, month: number): number => {
  const date = new Date(Date.UTC(0, month, 0));
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
};

export const ZoomController: React.FC<ZoomControllerProps> = ({
  zoomRangeLabel,
  onQuickZoom,
  onJumpToDate,
  zoomTrackRef,
  zoomThumbY,
  onZoomDragStart,
  onZoomDragMove,
  onZoomDragEnd,
}) => {
  const [isZoomPanelOpen, setIsZoomPanelOpen] = React.useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 640px)").matches;
  });
  const [isJumpPanelOpen, setIsJumpPanelOpen] = React.useState(false);
  const [yearInput, setYearInput] = React.useState("");
  const [monthInput, setMonthInput] = React.useState("");
  const [dayInput, setDayInput] = React.useState("");
  const [jumpError, setJumpError] = React.useState<string | null>(null);

  const handleJumpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedYear = yearInput.trim();
    if (!trimmedYear) {
      setJumpError("Year is required.");
      return;
    }

    const year = Number(trimmedYear);
    if (!Number.isFinite(year) || !Number.isInteger(year)) {
      setJumpError("Year must be an integer.");
      return;
    }

    const month = monthInput.trim() === "" ? null : Number(monthInput);
    if (month !== null) {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        setJumpError("Month must be 1-12.");
        return;
      }
    }

    const day = dayInput.trim() === "" ? null : Number(dayInput);
    if (day !== null && month === null) {
      setJumpError("Pick a month before entering a day.");
      return;
    }

    if (day !== null && month !== null) {
      const maxDay = getMaxDay(year, month);
      if (!Number.isInteger(day) || day < 1 || day > maxDay) {
        setJumpError(`Day must be 1-${maxDay}.`);
        return;
      }
    }

    setJumpError(null);
    onJumpToDate({ year, month, day });
    setIsJumpPanelOpen(false);
  };

  return (
    <div
      className="fixed right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end gap-2"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsZoomPanelOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 shadow-lg transition-colors hover:bg-zinc-800 hover:text-white"
        aria-label={
          isZoomPanelOpen ? "Collapse zoom controls" : "Expand zoom controls"
        }
        title={
          isZoomPanelOpen ? "Collapse zoom controls" : "Expand zoom controls"
        }
      >
        {isZoomPanelOpen ? (
          <X width={18} height={18} />
        ) : (
          <ZoomIn width={18} height={18} />
        )}
      </button>

      <div className="ui-popover" data-open={isZoomPanelOpen}>
        <div className="mt-0.5 flex flex-col items-end gap-2 rounded-2xl border border-zinc-700 p-2.5 shadow-lg">
          <div className="relative flex items-center justify-center self-center">
            <select
              value="current"
              onChange={onQuickZoom}
              className="text-zinc-300 text-[10px] font-mono rounded-full pr-3 py-1.5 border border-zinc-700 outline-none focus:border-emerald-500 text-center cursor-pointer hover:bg-zinc-800 transition-colors appearance-none"
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
            className="h-32 w-8 self-center rounded-full border border-zinc-700 relative cursor-ns-resize touch-none flex items-center justify-center"
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

      <button
        type="button"
        onClick={() => {
          setIsJumpPanelOpen((prev) => !prev);
          setJumpError(null);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 shadow-lg transition-colors hover:bg-zinc-800 hover:text-white"
        aria-label={isJumpPanelOpen ? "Close jump form" : "Open jump form"}
        title={isJumpPanelOpen ? "Close jump form" : "Jump to date"}
      >
        {isJumpPanelOpen ? (
          <X width={16} height={16} />
        ) : (
          <CalendarDays width={16} height={16} />
        )}
      </button>

      <div className="ui-popover" data-open={isJumpPanelOpen}>
        <form
          onSubmit={handleJumpSubmit}
          className="mt-0.5 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2.5 shadow-lg"
        >
          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            Jump To
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            placeholder="Year"
            className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              placeholder="Month"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={dayInput}
              onChange={(e) => setDayInput(e.target.value)}
              placeholder="Day"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          {jumpError && (
            <div className="mb-2 text-[11px] leading-4 text-red-400">
              {jumpError}
            </div>
          )}
          <button
            type="submit"
            className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15"
          >
            OK
          </button>
        </form>
      </div>
    </div>
  );
};

interface EventInfoPanelProps {
  event: Event;
  isRulerActive: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onToggleRuler: () => void;
  onClose: () => void;
}

export const EventInfoPanel: React.FC<EventInfoPanelProps> = ({
  event,
  isRulerActive,
  onFocus,
  onEdit,
  onToggleRuler,
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
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-emerald-500 flex items-center gap-1"
          title="Center camera on this event"
        >
          <Locate width={14} height={14} /> Focus
        </button>
        <button
          onClick={onEdit}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border border-zinc-700 flex items-center gap-1"
        >
          <Pencil width={12} height={12} /> Edit
        </button>
        <button
          onClick={onToggleRuler}
          className={`px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium border flex items-center gap-1 ${
            isRulerActive
              ? "bg-amber-500/15 hover:bg-amber-500/20 text-amber-100 border-amber-400/60"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
          }`}
          title="Measure time from this event to the cursor"
        >
          <Ruler width={12} height={12} /> Ruler
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
    className="fixed bottom-2 right-2 z-40 flex flex-col gap-2"
    onPointerDown={(e) => e.stopPropagation()}
  >
    <button
      onClick={onClick}
      title="Auto-fit visible events"
      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
    >
      <Locate width={18} height={18} />
    </button>
  </div>
);
