import React from "react";
import { AutoFitRangeTarget } from "../constants/types";

interface AutoFitPanelProps {
  isOpen: boolean;
  onAutoFitRange: (target: AutoFitRangeTarget) => void;
  onAutoFitAll: () => void;
  onComplete: () => void;
}

export const AutoFitPanel: React.FC<AutoFitPanelProps> = ({
  isOpen,
  onAutoFitRange,
  onAutoFitAll,
  onComplete,
}) => {
  const [startYearInput, setStartYearInput] = React.useState("");
  const [endYearInput, setEndYearInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) return;
    setError(null);
  }, [isOpen]);

  const handleRangeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedStart = startYearInput.trim();
    const trimmedEnd = endYearInput.trim();

    if (!trimmedStart || !trimmedEnd) {
      setError("Start year and end year are required.");
      return;
    }

    const startYear = Number(trimmedStart);
    const endYear = Number(trimmedEnd);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
      setError("Years must be valid numbers.");
      return;
    }

    setError(null);
    onAutoFitRange({
      startYear: Math.min(startYear, endYear),
      endYear: Math.max(startYear, endYear),
    });
    onComplete();
  };

  return (
    <div className="ui-popover" data-open={isOpen}>
      <form
        onSubmit={handleRangeSubmit}
        className="mt-0.5 w-64 rounded-2xl border border-zinc-700 bg-zinc-950 p-2.5"
      >
        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
          Auto Fit
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={startYearInput}
            onChange={(e) => setStartYearInput(e.target.value)}
            placeholder="Start year"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <input
            type="number"
            inputMode="numeric"
            value={endYearInput}
            onChange={(e) => setEndYearInput(e.target.value)}
            placeholder="End year"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {error && (
          <div className="mb-2 text-[11px] leading-4 text-red-400">{error}</div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15"
          >
            Fit Range
          </button>
          <button
            type="button"
            onClick={() => {
              onAutoFitAll();
              onComplete();
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Auto Fit All
          </button>
        </div>
      </form>
    </div>
  );
};
