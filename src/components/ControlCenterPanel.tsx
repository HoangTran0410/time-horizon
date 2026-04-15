import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Cloud,
  Code,
  Globe2,
  Maximize2,
  Minimize2,
  MoonStar,
  Share2,
  SunMedium,
  X,
} from "lucide-react";
import type { ThemeMode } from "../constants/theme";
import { LANGUAGE_OPTIONS } from "../helpers/localization";
import { LanguagePickerButton } from "./LanguagePickerButton";
import { useI18n } from "../i18n";
import { useStore } from "../stores";
import { hasPendingSyncableChanges as hasPendingSyncableChangesForSync } from "../sync";
import { getSyncStatusLabelKey, getSyncStatusPresentation } from "./syncStatus";

interface ControlCenterPanelProps {
  isOpen: boolean;
  theme: ThemeMode;
  onOpenSpatialPanel: () => void;
  onOpenSyncPanel: () => void;
  onShare: () => void;
  onToggleTheme: () => void;
  onClose: () => void;
}

export const ControlCenterPanel: React.FC<ControlCenterPanelProps> = ({
  isOpen,
  theme,
  onOpenSpatialPanel,
  onOpenSyncPanel,
  onShare,
  onToggleTheme,
  onClose,
}) => {
  const { t } = useI18n();
  const syncPreferences = useStore((s) => s.syncPreferences);
  const syncConnectionStatus = useStore((s) => s.syncConnectionStatus);
  const collectionLibrary = useStore((s) => s.collectionLibrary);
  const collectionColorPreferences = useStore(
    (s) => s.collectionColorPreferences,
  );
  const deletedCollectionSyncTombstones = useStore(
    (s) => s.deletedCollectionSyncTombstones,
  );
  const spatialMappingEnabled = useStore((s) => s.spatialMapping.enabled);
  // const timelineOrientation = useStore((s) => s.timelineOrientation);
  // const setTimelineOrientation = useStore((s) => s.setTimelineOrientation);
  const { language } = useI18n();
  const currentOption = useMemo(
    () =>
      LANGUAGE_OPTIONS.find((option) => option.value === language) ??
      LANGUAGE_OPTIONS[0],
    [language],
  );
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.fullscreenElement !== null;
  });

  const supportsFullscreen =
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function";
  const hasPendingSyncableChanges = useMemo(
    () =>
      hasPendingSyncableChangesForSync({
        collectionLibrary,
        collectionColorPreferences,
        deletedCollectionSyncTombstones,
        syncPreferences,
      }),
    [
      collectionColorPreferences,
      collectionLibrary,
      deletedCollectionSyncTombstones,
      syncPreferences,
    ],
  );
  const syncStatusPresentation = getSyncStatusPresentation({
    hasPendingSyncableChanges,
    syncConnectionStatus,
  });
  const syncStatusLabel = t(getSyncStatusLabelKey(syncConnectionStatus));
  const spatialStatusLabel = spatialMappingEnabled
    ? t("enabled")
    : t("disabled");

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
    if (!supportsFullscreen || typeof document === "undefined") return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-[90] flex items-start justify-end bg-black/80 p-4 sm:items-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="ui-panel mt-2 w-full max-w-[24rem] overflow-hidden rounded-[1.9rem] border border-zinc-800/90 bg-zinc-950/96 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.21, 0.9, 0.32, 1] }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-zinc-800/90 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_45%),radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_35%)] px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="ui-kicker text-emerald-300">
                    {t("controlCenter")}
                  </div>
                  <div className="mt-1 text-[1.3rem] font-semibold tracking-[-0.03em] text-white">
                    {t("toolbarSettingsTitle")}
                  </div>
                  {/* <p className="mt-1 text-[0.82rem] leading-6 text-zinc-400">
                    {t("toolbarSettingsDescription")}
                  </p> */}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-icon-button h-10 w-10"
                  aria-label={t("close")}
                  title={t("close")}
                >
                  <X width={15} height={15} />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      // onClose();
                      onOpenSyncPanel();
                    }}
                    className="ui-button ui-button-secondary relative w-full items-start justify-start rounded-[1rem] px-4 py-3 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Cloud width={15} height={15} />
                      <span>{t("openSyncPanel")}</span>
                    </span>
                  </button>
                  <span
                    className={`pointer-events-none absolute -right-2 -top-2 z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] shadow-sm ${syncStatusPresentation.badgeClassName}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${syncStatusPresentation.indicatorClassName}`}
                    />
                    <span>{syncStatusLabel}</span>
                  </span>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      // onClose();
                      onOpenSpatialPanel();
                    }}
                    className="ui-button ui-button-secondary relative w-full items-start justify-start rounded-[1rem] px-4 py-3 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Globe2 width={15} height={15} />
                      <span>{t("openSpatialPanel")}</span>
                    </span>
                  </button>
                  <span
                    className={`pointer-events-none absolute -right-2 -top-2 z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] shadow-sm ${
                      spatialMappingEnabled
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                        : "border-zinc-700/80 bg-zinc-900/80 text-zinc-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        spatialMappingEnabled ? "bg-emerald-300" : "bg-zinc-500"
                      }`}
                    />
                    <span>{spatialStatusLabel}</span>
                  </span>
                </div>
                {/* <button
                  type="button"
                  onClick={() =>
                    setTimelineOrientation(
                      timelineOrientation === "horizontal"
                        ? "vertical"
                        : "horizontal",
                    )
                  }
                  className="ui-button ui-button-secondary justify-center rounded-[1rem] px-4 py-3"
                >
                  <span>{t("timelineOrientation")}</span>
                </button> */}
                <button
                  type="button"
                  onClick={onShare}
                  className="ui-button ui-button-secondary justify-center rounded-[1rem] px-4 py-3"
                >
                  <Share2 width={15} height={15} />
                  <span>{t("shareShort")}</span>
                </button>
                {supportsFullscreen ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleFullscreen();
                    }}
                    className="ui-button ui-button-secondary justify-center rounded-[1rem] px-4 py-3"
                  >
                    {isFullscreen ? (
                      <Minimize2 width={15} height={15} />
                    ) : (
                      <Maximize2 width={15} height={15} />
                    )}
                    <span>
                      {isFullscreen
                        ? t("fullscreenOffShort")
                        : t("fullscreenOnShort")}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="ui-button ui-button-secondary justify-center rounded-[1rem] px-4 py-3"
                >
                  {theme === "dark" ? (
                    <SunMedium width={15} height={15} />
                  ) : (
                    <MoonStar width={15} height={15} />
                  )}
                  <span>
                    {theme === "dark"
                      ? t("lightThemeShort")
                      : t("darkThemeShort")}
                  </span>
                </button>
                <div className="relative">
                  <LanguagePickerButton
                    buttonClassName="ui-button ui-button-secondary w-full justify-center gap-2 rounded-[1rem] px-4 py-3 text-[0.82rem] font-semibold"
                    textClassName="leading-none"
                    showLabel
                  />
                  <span className="pointer-events-none absolute -right-2 -top-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-zinc-200 shadow-sm">
                    {currentOption.flag}
                    <span>{currentOption.shortLabel}</span>
                  </span>
                </div>

                <a
                  href="https://github.com/hoangTran0410/time-horizon"
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button ui-button-secondary justify-center rounded-[1rem] px-4 py-3"
                >
                  <Code width={15} height={15} />
                  <span>{t("viewOnGithub")}</span>
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
