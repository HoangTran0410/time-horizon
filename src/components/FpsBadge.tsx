import React, { useEffect, useState } from "react";
import { Maximize2, Minimize2, MoonStar, SunMedium } from "lucide-react";
import { ThemeMode } from "../constants/theme";

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
}) => {
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.fullscreenElement !== null;
  });

  const supportsFullscreen = (() => {
    if (typeof document === "undefined") return false;
    return typeof document.documentElement.requestFullscreen === "function";
  })();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    if (!supportsFullscreen) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  };

  return (
    <div
      className="fixed right-4 top-4 z-40 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-2 sm:max-w-none"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="ui-badge font-mono text-[0.72rem]">
        Logic {logicFps} | Canvas {renderFps}
      </div>
      {supportsFullscreen ? (
        <button
          type="button"
          onClick={() => {
            void handleToggleFullscreen();
          }}
          className="ui-button ui-button-secondary h-10 px-4 text-[0.82rem]"
          aria-label={
            isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"
          }
          title={
            isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"
          }
        >
          {isFullscreen ? (
            <Minimize2 width={15} height={15} />
          ) : (
            <Maximize2 width={15} height={15} />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? "Window" : "Fullscreen"}
          </span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggleTheme}
        className="ui-button ui-button-secondary h-10 px-4 text-[0.82rem]"
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
};
