import React from "react";
import { AnimatePresence, motion, MotionValue } from "motion/react";
import {
  CalendarDays,
  ChevronUp,
  ChevronDown,
  Locate,
  Maximize2,
  MoonStar,
  Pencil,
  Ruler,
  Search,
  SlidersVertical,
  SunMedium,
  X,
  ZoomIn,
} from "lucide-react";
import { Event } from "../../types";
import { getEventDisplayLabel } from "../../utils";
import { ThemeMode } from "../../theme";

interface FpsBadgeProps {
  logicFps: number;
  renderFps: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const FpsBadge: React.FC<FpsBadgeProps> = ({
  logicFps,
  renderFps,
  theme,
  onToggleTheme,
}) => (
  <div
    className="fixed top-4 right-4 z-40 flex items-center gap-2"
    onPointerDown={(e) => e.stopPropagation()}
    onWheel={(e) => e.stopPropagation()}
  >
    <div className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[11px] font-mono text-zinc-300 shadow-lg">
      Logic {logicFps} | Canvas {renderFps}
    </div>
    <button
      type="button"
      onClick={onToggleTheme}
      className="flex h-9 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 text-xs font-medium text-zinc-200 shadow-lg transition-colors hover:bg-zinc-800 hover:text-white"
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? (
        <SunMedium width={15} height={15} />
      ) : (
        <MoonStar width={15} height={15} />
      )}
      <span className="hidden sm:inline">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
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
  isCollapsed: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onToggleRuler: () => void;
  onToggleCollapsed: () => void;
  onClose: () => void;
}

const eventInfoPanelTransition = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.65,
} as const;

export const EventInfoPanel: React.FC<EventInfoPanelProps> = ({
  event,
  isRulerActive,
  isCollapsed,
  onFocus,
  onEdit,
  onToggleRuler,
  onToggleCollapsed,
  onClose,
}) => (
  <AnimatePresence mode="wait" initial={false}>
    {isCollapsed ? (
      <motion.div
        key="collapsed"
        className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.94 }}
        transition={eventInfoPanelTransition}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <motion.button
          onClick={onToggleCollapsed}
          className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/95 px-4 py-2 text-sm font-medium text-zinc-100 shadow-lg shadow-black/30 transition-colors hover:bg-zinc-800"
          aria-expanded={false}
          aria-label="Expand event info"
          title="Expand panel"
          whileTap={{ scale: 0.97 }}
        >
          <ChevronUp width={16} height={16} />
          <span className="flex items-center gap-2">
            <span className="text-lg">{event.emoji}</span> {event.title}
          </span>
        </motion.button>
      </motion.div>
    ) : (
      <motion.div
        key="expanded"
        className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2"
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.95 }}
        transition={eventInfoPanelTransition}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <motion.button
          onClick={onToggleCollapsed}
          className="absolute -top-5 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/95 p-2 text-zinc-300 shadow-lg shadow-black/30 transition-colors hover:bg-zinc-800 hover:text-white"
          aria-expanded
          aria-label="Collapse event info"
          title="Collapse panel"
          whileTap={{ scale: 0.95 }}
        >
          <ChevronDown width={16} height={16} />
        </motion.button>

        <motion.div
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 text-lg flex items-center justify-center">
                {event.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {event.title}
                    </h3>
                    <p className="mt-0.5 truncate font-mono text-xs text-emerald-500">
                      {getEventDisplayLabel(event)}
                    </p>
                  </div>

                  <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:max-w-[50%]">
                    <button
                      onClick={onFocus}
                      className="flex items-center gap-1 rounded-md border border-emerald-500 bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                      title="Center camera on this event"
                    >
                      <Locate width={14} height={14} />
                    </button>
                    <button
                      onClick={onEdit}
                      className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                    >
                      <Pencil width={12} height={12} />
                    </button>
                    <button
                      onClick={onToggleRuler}
                      className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isRulerActive
                          ? "border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                          : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      }`}
                      title="Measure time from this event to the cursor"
                    >
                      <Ruler width={12} height={12} />
                    </button>
                    <button
                      onClick={onClose}
                      className="rounded-md border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                      aria-label="Close"
                    >
                      <X width={16} height={16} />
                    </button>
                  </div>
                </div>

                <p className="mt-1.5 line-clamp-2 text-xs text-zinc-300">
                  {event.description}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
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
