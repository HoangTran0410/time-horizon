import React, { useEffect, useState } from "react";
import {
  Maximize2,
  Minimize2,
  MoonStar,
  SunMedium,
  Share2,
} from "lucide-react";
import { ThemeMode } from "../constants/theme";

interface ToolbarProps {
  logicFps: number;
  renderFps: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onShare: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  logicFps,
  renderFps,
  theme,
  onToggleTheme,
  onShare,
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
        {logicFps}|{renderFps}
      </div>
      {supportsFullscreen ? (
        <button
          type="button"
          onClick={() => {
            void handleToggleFullscreen();
          }}
          className="ui-icon-button h-10 w-10 shrink-0"
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
        </button>
      ) : null}
      <button
        type="button"
        onClick={onShare}
        className="ui-icon-button h-10 w-10 shrink-0"
        aria-label="Share timeline"
        title="Share timeline"
      >
        <Share2 width={15} height={15} />
      </button>
      <button
        type="button"
        onClick={onToggleTheme}
        className="ui-icon-button h-10 w-10 shrink-0"
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
      </button>
    </div>
  );
};
