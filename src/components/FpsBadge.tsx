import React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { ThemeMode } from "../../constants/theme";

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
      title={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
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
