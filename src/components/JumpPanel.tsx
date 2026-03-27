import React from "react";
import { DateJumpTarget } from "../../constants/types";

interface JumpPanelProps {
  isOpen: boolean;
  onJumpToDate: (target: DateJumpTarget) => void;
  onJumpComplete: () => void;
}

const getMaxDay = (year: number, month: number): number => {
  const date = new Date(Date.UTC(0, month, 0));
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
};

export const JumpPanel: React.FC<JumpPanelProps> = ({
  isOpen,
  onJumpToDate,
  onJumpComplete,
}) => {
  const [yearInput, setYearInput] = React.useState("");
  const [monthInput, setMonthInput] = React.useState("");
  const [dayInput, setDayInput] = React.useState("");
  const [jumpError, setJumpError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) return;
    setJumpError(null);
  }, [isOpen]);

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
    onJumpComplete();
  };

  return (
    <div className="ui-popover" data-open={isOpen}>
      <form
        onSubmit={handleJumpSubmit}
        className="mt-0.5 w-56 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2.5 shadow-lg"
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
  );
};
