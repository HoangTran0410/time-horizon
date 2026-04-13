import React, { useEffect, useState } from "react";
import {
  Globe2,
  Maximize2,
  Minimize2,
  MoonStar,
  SunMedium,
  Share2,
} from "lucide-react";
import { ThemeMode } from "../constants/theme";
import { LanguagePickerButton } from "./LanguagePickerButton";
import { SpatialSettingsPanel } from "./SpatialSettingsPanel";
import type { SpatialMapTheme, SpatialMappingConfig } from "../constants/types";
import { useI18n } from "../i18n";

interface ToolbarProps {
  logicFps: number;
  renderFps: number;
  theme: ThemeMode;
  spatialMapping: SpatialMappingConfig;
  currentFocusYear: number;
  isSpatialAnchorPickMode: boolean;
  onToggleTheme: () => void;
  onShare: () => void;
  onToggleSpatialMappingEnabled: () => void;
  onSetSpatialMetersPerYear: (value: number) => void;
  onSetSpatialMapTheme: (value: SpatialMapTheme) => void;
  onSetSpatialMapOpacity: (value: number) => void;
  onStartSpatialAnchorPickMode: () => void;
  onStopSpatialAnchorPickMode: () => void;
  onResetSpatialMapping: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  logicFps,
  renderFps,
  theme,
  spatialMapping,
  currentFocusYear,
  isSpatialAnchorPickMode,
  onToggleTheme,
  onShare,
  onToggleSpatialMappingEnabled,
  onSetSpatialMetersPerYear,
  onSetSpatialMapTheme,
  onSetSpatialMapOpacity,
  onStartSpatialAnchorPickMode,
  onStopSpatialAnchorPickMode,
  onResetSpatialMapping,
}) => {
  const { t } = useI18n();
  const [isSpatialPanelOpen, setIsSpatialPanelOpen] = useState(false);
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
      className="fixed right-4 top-4 z-60 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-1 sm:max-w-none"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="ui-badge font-mono text-[0.72rem]">
        {logicFps}|{renderFps}
      </div>
      <button
        type="button"
        onClick={() => setIsSpatialPanelOpen(true)}
        className="ui-icon-button h-10 w-10 shrink-0"
        aria-label={t("spaceTimeMapping")}
        title={t("spaceTimeMapping")}
      >
        <Globe2
          width={15}
          height={15}
          className={spatialMapping.enabled ? "text-emerald-300" : undefined}
        />
      </button>
      <SpatialSettingsPanel
        isOpen={isSpatialPanelOpen}
        mapping={spatialMapping}
        isAnchorPickMode={isSpatialAnchorPickMode}
        currentFocusYear={currentFocusYear}
        onToggleEnabled={onToggleSpatialMappingEnabled}
        onSetMetersPerYear={onSetSpatialMetersPerYear}
        onSetMapTheme={onSetSpatialMapTheme}
        onSetMapOpacity={onSetSpatialMapOpacity}
        onStartPickMode={onStartSpatialAnchorPickMode}
        onStopPickMode={onStopSpatialAnchorPickMode}
        onReset={onResetSpatialMapping}
        onClose={() => setIsSpatialPanelOpen(false)}
      />
      {supportsFullscreen ? (
        <button
          type="button"
          onClick={() => {
            void handleToggleFullscreen();
          }}
          className="ui-icon-button h-10 w-10 shrink-0"
          aria-label={isFullscreen ? t("exitFullscreen") : t("enterFullscreen")}
          title={isFullscreen ? t("exitFullscreen") : t("enterFullscreen")}
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
        aria-label={t("shareTimeline")}
        title={t("shareTimeline")}
      >
        <Share2 width={15} height={15} />
      </button>
      <LanguagePickerButton
        buttonClassName="ui-icon-button h-10 w-10 shrink-0 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-200"
        textClassName="leading-none"
      />
      <button
        type="button"
        onClick={onToggleTheme}
        className="ui-icon-button h-10 w-10 shrink-0"
        aria-label={
          theme === "dark" ? t("switchToLightTheme") : t("switchToDarkTheme")
        }
        title={
          theme === "dark" ? t("switchToLightTheme") : t("switchToDarkTheme")
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
