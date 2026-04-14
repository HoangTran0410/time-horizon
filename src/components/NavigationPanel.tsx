import React from "react";
import { AnimatePresence, motion, MotionValue } from "motion/react";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUp,
  ChevronDown,
  Crosshair,
  Eye,
  Scan,
  ZoomIn,
} from "lucide-react";
import {
  AutoFitRangeTarget,
  DateJumpTarget,
  TimelineOrientation,
  VerticalTimeDirection,
  VerticalWheelBehavior,
} from "../constants/types";
import { useI18n } from "../i18n";
import { NavigationPanelTab, useStore } from "../stores";

interface NavigationPanelProps {
  isOpen: boolean;
  zoomRangeLabel: string;
  onQuickZoom: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onJumpToDate: (target: DateJumpTarget) => void;
  onAutoFitRange: (target: AutoFitRangeTarget) => void;
  onAutoFitAll: () => void;
  zoomTrackRef: React.RefObject<HTMLDivElement | null>;
  zoomThumbY: MotionValue<number>;
  onZoomDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  timelineOrientation: TimelineOrientation;
  onTimelineOrientationChange: (orientation: TimelineOrientation) => void;
  verticalWheelBehavior: VerticalWheelBehavior;
  onVerticalWheelBehaviorChange: (behavior: VerticalWheelBehavior) => void;
  verticalTimeDirection: VerticalTimeDirection;
  onVerticalTimeDirectionChange: (direction: VerticalTimeDirection) => void;
  onComplete?: () => void;
}

const getMaxDay = (year: number, month: number): number => {
  const date = new Date(Date.UTC(0, month, 0));
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
};

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  isOpen,
  zoomRangeLabel,
  onQuickZoom,
  onJumpToDate,
  onAutoFitRange,
  onAutoFitAll,
  zoomTrackRef,
  zoomThumbY,
  onZoomDragStart,
  onZoomDragMove,
  onZoomDragEnd,
  timelineOrientation,
  onTimelineOrientationChange,
  verticalWheelBehavior,
  onVerticalWheelBehaviorChange,
  verticalTimeDirection,
  onVerticalTimeDirectionChange,
  onComplete,
}) => {
  const { t } = useI18n();
  const activeTab = useStore((state) => state.navigationPanelTab);
  const setActiveTab = useStore((state) => state.setNavigationPanelTab);
  const [yearInput, setYearInput] = React.useState("");
  const [monthInput, setMonthInput] = React.useState("");
  const [dayInput, setDayInput] = React.useState("");
  const [jumpError, setJumpError] = React.useState<string | null>(null);
  const [startYearInput, setStartYearInput] = React.useState("");
  const [endYearInput, setEndYearInput] = React.useState("");
  const [fitError, setFitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) return;
    setJumpError(null);
    setFitError(null);
  }, [isOpen]);

  const verticalSettingsTransition = {
    initial: { opacity: 0, height: 0, y: -6 },
    animate: { opacity: 1, height: "auto", y: 0 },
    exit: { opacity: 0, height: 0, y: -6 },
    transition: { duration: 0.18, ease: "easeOut" as const },
  };

  const handleJumpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedYear = yearInput.trim();
    if (!trimmedYear) {
      setJumpError(t("yearRequired"));
      return;
    }

    const year = Number(trimmedYear);
    if (!Number.isFinite(year) || !Number.isInteger(year)) {
      setJumpError(t("yearMustBeInteger"));
      return;
    }

    const month = monthInput.trim() === "" ? null : Number(monthInput);
    if (month !== null) {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        setJumpError(t("monthMustBeRange"));
        return;
      }
    }

    const day = dayInput.trim() === "" ? null : Number(dayInput);
    if (day !== null && month === null) {
      setJumpError(t("chooseMonthBeforeDay"));
      return;
    }

    if (day !== null && month !== null) {
      const maxDay = getMaxDay(year, month);
      if (!Number.isInteger(day) || day < 1 || day > maxDay) {
        setJumpError(t("dayRange", { max: maxDay }));
        return;
      }
    }

    setJumpError(null);
    onJumpToDate({ year, month, day });
    onComplete?.();
  };

  const handleFitSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedStart = startYearInput.trim();
    const trimmedEnd = endYearInput.trim();

    if (!trimmedStart || !trimmedEnd) {
      setFitError(t("startEndRequired"));
      return;
    }

    const startYear = Number(trimmedStart);
    const endYear = Number(trimmedEnd);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      setFitError(t("yearsMustBeValid"));
      return;
    }

    setFitError(null);
    onAutoFitRange({
      startYear: Math.min(startYear, endYear),
      endYear: Math.max(startYear, endYear),
    });
    onComplete?.();
  };

  return (
    <div
      className="ui-popover"
      data-open={isOpen}
      style={isOpen ? { maxHeight: "min(66vh, 32rem)" } : undefined}
    >
      <div className="ui-panel mt-0.5 max-h-[min(66vh,32rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[1.45rem] p-3.5 sm:w-[22.5rem]">
        <div className="ui-display-title text-[1.5rem] leading-none text-white mb-2">
          {t("navigate")}
        </div>
        <div className="ui-tablist mb-3">
          <button
            type="button"
            className="ui-tab whitespace-nowrap"
            data-active={activeTab === "view"}
            onClick={() => setActiveTab("view" as NavigationPanelTab)}
          >
            <Eye size={15} className="icon" />
            {t("viewTab")}
          </button>
          <button
            type="button"
            className="ui-tab whitespace-nowrap"
            data-active={activeTab === "zoom"}
            onClick={() => setActiveTab("zoom" as NavigationPanelTab)}
          >
            <ZoomIn size={15} className="icon" />
            {t("zoom")}
          </button>
          <button
            type="button"
            className="ui-tab whitespace-nowrap"
            data-active={activeTab === "jump"}
            onClick={() => setActiveTab("jump" as NavigationPanelTab)}
          >
            <Crosshair size={15} className="icon" />
            {t("jump")}
          </button>
          <button
            type="button"
            className="ui-tab whitespace-nowrap"
            data-active={activeTab === "fit"}
            onClick={() => setActiveTab("fit" as NavigationPanelTab)}
          >
            <Scan size={15} className="icon" />
            {t("fit")}
          </button>
        </div>
        {activeTab === "view" ? (
          <div className="ui-panel-soft rounded-[1.15rem] p-3">
            <div className="text-sm font-semibold text-zinc-100">
              {t("timelineOrientation")}
            </div>
            <p className="mt-1 text-[0.74rem] leading-5 text-zinc-400">
              {t("timelineOrientationHelp")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    ori: "horizontal",
                    icon: <ArrowLeftRight size={15} className="icon" />,
                  },
                  {
                    ori: "vertical",
                    icon: <ArrowDownUp size={15} className="icon" />,
                  },
                ] as const
              ).map(({ ori: orientation, icon }) => (
                <button
                  key={orientation}
                  type="button"
                  className="ui-tab"
                  data-active={timelineOrientation === orientation}
                  onClick={() => onTimelineOrientationChange(orientation)}
                >
                  {icon} {t(orientation)}
                </button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {timelineOrientation === "vertical" ? (
                <motion.div
                  key="vertical-settings"
                  className="mt-3 overflow-hidden border-t border-zinc-800/80 pt-3"
                  {...verticalSettingsTransition}
                >
                <div className="text-sm font-semibold text-zinc-100">
                  {t("verticalScrollBehavior")}
                </div>
                <p className="mt-1 text-[0.74rem] leading-5 text-zinc-400">
                  {t("verticalScrollBehaviorHelp")}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        label: "pan",
                        icon: <ArrowDownUp size={15} className="icon" />,
                      },
                      {
                        label: "zoom",
                        icon: <ZoomIn size={15} className="icon" />,
                      },
                    ] as const
                  ).map(({ label: behavior, icon }) => (
                    <button
                      key={behavior}
                      type="button"
                      className="ui-tab"
                      data-active={verticalWheelBehavior === behavior}
                      onClick={() => onVerticalWheelBehaviorChange(behavior)}
                    >
                      {icon}
                      {behavior === "pan"
                        ? t("scrollToPan")
                        : t("scrollToZoom")}
                    </button>
                  ))}
                </div>
                  <div className="mt-3 border-t border-zinc-800/80 pt-3">
                    <div className="text-sm font-semibold text-zinc-100">
                      {t("verticalTimeDirection")}
                    </div>
                    <p className="mt-1 text-[0.74rem] leading-5 text-zinc-400">
                      {t("verticalTimeDirectionHelp")}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(
                        [
                          {
                            direction: "up",
                            icon: <ArrowUp size={15} className="icon" />,
                            label: t("timeFlowsUp"),
                          },
                          {
                            direction: "down",
                            icon: <ArrowDown size={15} className="icon" />,
                            label: t("timeFlowsDown"),
                          },
                        ] as const
                      ).map(({ direction, icon, label }) => (
                        <button
                          key={direction}
                          type="button"
                          className="ui-tab"
                          data-active={verticalTimeDirection === direction}
                          onClick={() => onVerticalTimeDirectionChange(direction)}
                        >
                          {icon}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
        {activeTab === "zoom" ? (
          <div className="ui-panel-soft rounded-[1.15rem] p-3">
            <div className="flex flex-row">
              <div className="flex-1">
                <div className="mb-2.5">
                  <div className="text-sm font-semibold text-zinc-100">
                    {t("zoom")}
                  </div>
                  <p className="mt-1 text-[0.74rem] leading-5 text-zinc-400">
                    {t("pickScaleThenSlider")}
                  </p>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3">
                  <div className="relative">
                    <select
                      value="current"
                      onChange={onQuickZoom}
                      className="ui-field w-full cursor-pointer appearance-none py-2.5 pl-3.5 pr-10 text-center text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-zinc-300"
                    >
                      <option value="current">
                        {zoomRangeLabel || t("currentZoom")}
                      </option>
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
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      <ChevronDown width={12} height={12} />
                    </div>
                  </div>
                </div>
              </div>
              <div
                ref={zoomTrackRef}
                className="relative mx-auto flex h-24 w-9 touch-none cursor-ns-resize items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/70"
                onPointerDown={onZoomDragStart}
                onPointerMove={onZoomDragMove}
                onPointerUp={onZoomDragEnd}
                onPointerCancel={onZoomDragEnd}
              >
                <motion.div
                  className="absolute flex h-8 w-8 flex-col items-center justify-center gap-0.5 rounded-full border border-zinc-600 bg-zinc-700 shadow-lg hover:bg-zinc-600"
                  style={{ y: zoomThumbY }}
                >
                  <div className="h-px w-3 rounded-full bg-zinc-400" />
                  <div className="h-px w-3 rounded-full bg-zinc-400" />
                  <div className="h-px w-3 rounded-full bg-zinc-400" />
                </motion.div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "jump" ? (
          <form
            className="ui-panel-soft rounded-[1.15rem] p-3"
            onSubmit={handleJumpSubmit}
          >
            <div className="mb-2.5">
              <div className="text-sm font-semibold text-zinc-100">
                {t("jumpTo")}
              </div>
              <p className="mt-1 text-[0.74rem] leading-5 text-zinc-400">
                {t("jumpToHelp")}
              </p>
            </div>
            <div className="space-y-2">
              <input
                type="number"
                inputMode="numeric"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                placeholder={t("year")}
                className="ui-field"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={12}
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value)}
                  placeholder={t("month")}
                  className="ui-field"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  placeholder={t("day")}
                  className="ui-field"
                />
              </div>
              {jumpError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[0.8rem] leading-5 text-red-300">
                  {jumpError}
                </div>
              ) : null}
              <button
                type="submit"
                className="ui-button ui-button-primary w-full"
              >
                {t("goToDate")}
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === "fit" ? (
          <form
            className="ui-panel-soft rounded-[1.15rem] p-3"
            onSubmit={handleFitSubmit}
          >
            <div className="mb-2.5">
              <div className="text-sm font-semibold text-zinc-100">
                {t("fit")}
              </div>
              <p className="mt-1 text-[0.74rem] leading-5 text-zinc-400">
                {t("fitRangeHelp")}
              </p>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={startYearInput}
                  onChange={(e) => setStartYearInput(e.target.value)}
                  placeholder={`${t("year")} ${t("fromDate").toLowerCase()}`}
                  className="ui-field"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={endYearInput}
                  onChange={(e) => setEndYearInput(e.target.value)}
                  placeholder={`${t("year")} ${t("toDate").toLowerCase()}`}
                  className="ui-field"
                />
              </div>
              {fitError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[0.8rem] leading-5 text-red-300">
                  {fitError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  className="ui-button ui-button-primary w-full"
                >
                  {t("fitRange")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAutoFitAll();
                    onComplete?.();
                  }}
                  className="ui-button ui-button-secondary w-full"
                >
                  {t("fitAllVisible")}
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
};
