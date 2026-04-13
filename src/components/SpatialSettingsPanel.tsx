import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Crosshair,
  Globe2,
  MoonStar,
  RotateCcw,
  SunMedium,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type {
  SpatialMapTheme,
  SpatialMappingConfig,
} from "../constants/types";
import {
  DEFAULT_SPATIAL_METERS_PER_YEAR,
  DEFAULT_SPATIAL_MAP_OPACITY,
  formatCoordinate,
  sanitizeMetersPerYear,
  sanitizeSpatialMapOpacity,
} from "../helpers";
import { useI18n } from "../i18n";

interface SpatialSettingsPanelProps {
  isOpen: boolean;
  mapping: SpatialMappingConfig;
  isAnchorPickMode: boolean;
  currentFocusYear: number;
  onToggleEnabled: () => void;
  onSetMetersPerYear: (value: number) => void;
  onSetMapTheme: (value: SpatialMapTheme) => void;
  onSetMapOpacity: (value: number) => void;
  onStartPickMode: () => void;
  onStopPickMode: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const SpatialSettingsPanel: React.FC<SpatialSettingsPanelProps> = ({
  isOpen,
  mapping,
  isAnchorPickMode,
  currentFocusYear,
  onToggleEnabled,
  onSetMetersPerYear,
  onSetMapTheme,
  onSetMapOpacity,
  onStartPickMode,
  onStopPickMode,
  onReset,
  onClose,
}) => {
  const { t } = useI18n();
  const [metersInput, setMetersInput] = useState(
    String(mapping.metersPerYear ?? DEFAULT_SPATIAL_METERS_PER_YEAR),
  );
  const [opacityInput, setOpacityInput] = useState(
    String(Math.round((mapping.mapOpacity ?? DEFAULT_SPATIAL_MAP_OPACITY) * 100)),
  );

  useEffect(() => {
    setMetersInput(String(mapping.metersPerYear));
  }, [mapping.metersPerYear]);

  useEffect(() => {
    setOpacityInput(String(Math.round(mapping.mapOpacity * 100)));
  }, [mapping.mapOpacity]);

  const anchorYearLabel =
    mapping.anchorYear === null
      ? t("usingCurrentViewportAsAnchor")
      : t("anchorYearValue", {
          year: Math.round(mapping.anchorYear * 1000) / 1000,
        });

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="spatial-settings-overlay"
          className="ui-modal-overlay bg-black/80 fixed inset-0 z-100 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            key="spatial-settings-card"
            className="ui-modal-surface ui-panel w-full max-w-md rounded-[1.9rem] p-6 sm:p-8"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.22, ease: [0.21, 0.9, 0.32, 1.02] }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="ui-kicker">{t("spatialBackground")}</div>
                <div className="ui-display-title mt-1 text-[1.35rem] leading-none text-white">
                  {t("spaceTimeMapping")}
                </div>
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

            <div className="space-y-3">
              <button
                type="button"
                onClick={onToggleEnabled}
                className={`flex w-full items-center justify-between rounded-[1.1rem] border px-4 py-3 text-left transition ${
                  mapping.enabled
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-700/80 bg-zinc-900/70 text-zinc-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Globe2 width={16} height={16} />
                  <span>
                    <span className="block text-sm font-semibold">
                      {t("showSpatialBackground")}
                    </span>
                    <span className="block text-[0.72rem] uppercase tracking-[0.16em] text-zinc-400">
                      {mapping.enabled ? t("enabled") : t("disabled")}
                    </span>
                  </span>
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    mapping.enabled ? "bg-emerald-300" : "bg-zinc-500"
                  }`}
                />
              </button>

              <div className="ui-panel-soft rounded-[1.1rem] p-3">
                <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("mapTheme")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSetMapTheme("dark")}
                    className={`flex items-center justify-center gap-2 rounded-[0.95rem] border px-3 py-2.5 text-sm font-semibold transition ${
                      mapping.mapTheme === "dark"
                        ? "border-emerald-400/45 bg-emerald-500/12 text-emerald-100"
                        : "border-zinc-700/80 bg-zinc-950/70 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                    }`}
                  >
                    <MoonStar width={14} height={14} />
                    {t("darkMap")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetMapTheme("light")}
                    className={`flex items-center justify-center gap-2 rounded-[0.95rem] border px-3 py-2.5 text-sm font-semibold transition ${
                      mapping.mapTheme === "light"
                        ? "border-emerald-400/45 bg-emerald-500/12 text-emerald-100"
                        : "border-zinc-700/80 bg-zinc-950/70 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                    }`}
                  >
                    <SunMedium width={14} height={14} />
                    {t("lightMap")}
                  </button>
                </div>
              </div>

              <div className="ui-panel-soft rounded-[1.1rem] p-3">
                <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("mapOpacity")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={opacityInput}
                    onChange={(event) => {
                      const nextValue = String(
                        Math.round(
                          sanitizeSpatialMapOpacity(
                            Number(event.target.value) / 100,
                          ) * 100,
                        ),
                      );
                      setOpacityInput(nextValue);
                      onSetMapOpacity(Number(nextValue) / 100);
                    }}
                    className="h-2 w-full cursor-pointer accent-emerald-400"
                  />
                  <div className="min-w-[3.5rem] rounded-full border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                    {opacityInput}%
                  </div>
                </div>
              </div>

              <div className="ui-panel-soft rounded-[1.1rem] p-3">
                <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("metersPerYear")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={metersInput}
                    onChange={(event) => setMetersInput(event.target.value)}
                    onBlur={() => {
                      const nextValue = sanitizeMetersPerYear(Number(metersInput));
                      setMetersInput(String(nextValue));
                      onSetMetersPerYear(nextValue);
                    }}
                    className="ui-field"
                  />
                  <div className="rounded-full border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                    {t("meters")}
                  </div>
                </div>
                <div className="mt-2 text-[0.74rem] leading-5 text-zinc-400">
                  {t("spatialScaleSummary", {
                    meters: Math.round(mapping.metersPerYear * 1000) / 1000,
                  })}
                </div>
              </div>

              <div className="ui-panel-soft rounded-[1.1rem] p-3 text-[0.78rem] text-zinc-300">
                <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("currentAnchor")}
                </div>
                <div>{anchorYearLabel}</div>
                <div className="mt-1">
                  {t("anchorLatitudeValue", {
                    value: formatCoordinate(mapping.anchorLat, "N", "S"),
                  })}
                </div>
                <div>
                  {t("anchorLongitudeValue", {
                    value: formatCoordinate(mapping.anchorLng, "E", "W"),
                  })}
                </div>
                <div className="mt-2 text-[0.72rem] leading-5 text-zinc-500">
                  {t("pickCurrentViewportHelp", {
                    year: Math.round(currentFocusYear * 1000) / 1000,
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isAnchorPickMode) {
                      onStopPickMode();
                    } else {
                      onStartPickMode();
                    }
                    onClose();
                  }}
                  className={`ui-button justify-center ${
                    isAnchorPickMode
                      ? "ui-button-primary"
                      : "ui-button-secondary"
                  }`}
                >
                  <Crosshair width={14} height={14} />
                  {isAnchorPickMode
                    ? t("cancelPickMode")
                    : t("pickMapAnchor")}
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="ui-button ui-button-secondary justify-center"
                >
                  <RotateCcw width={14} height={14} />
                  {t("reset")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
