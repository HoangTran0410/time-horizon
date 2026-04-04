import React, { useState, useCallback } from "react";
import { Copy, Check, X, Layers, MapPin, Link, Locate } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "../i18n";

/** ─── Props ─────────────────────────────────────────────────────────── */

export type ShareOptionsState = {
  includeCollections: boolean;
  includeSelectedEvent: boolean;
  includeViewport: boolean;
};

interface ShareModalProps {
  focusYear: number;
  logZoom: number;
  selectedEventId: string | null;
  visibleCollectionIds: string[];
  collectionNames: Record<string, string>;
  onGenerateUrl: (options: ShareOptionsState) => string;
  onClose: () => void;
}

/** ─── Toggle row ─────────────────────────────────────────────────────── */

type ToggleMeta = {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

const ToggleRow: React.FC<ToggleMeta> = ({
  icon,
  label,
  description,
  value,
  onChange,
  disabled,
}) => (
  <label
    className={[
      "share-toggle-row",
      value ? "share-toggle-row--on" : "",
      disabled ? "share-toggle-row--disabled" : "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <div className="share-toggle-icon">{icon}</div>
    <div className="share-toggle-text">
      <span className="share-toggle-label">{label}</span>
      <span className="share-toggle-desc">{description}</span>
    </div>
    {/* Track */}
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className="share-toggle-track"
      style={{ "--active": value ? "1" : "0" } as React.CSSProperties}
    >
      <span className="share-toggle-thumb" />
    </button>
  </label>
);

/** ─── Main component ─────────────────────────────────────────────────── */

export const ShareModal: React.FC<ShareModalProps> = ({
  focusYear,
  selectedEventId,
  visibleCollectionIds,
  collectionNames,
  onGenerateUrl,
  onClose,
}) => {
  const { t } = useI18n();
  const [options, setOptions] = useState<ShareOptionsState>(() => ({
    includeCollections: visibleCollectionIds.length > 0,
    // Default: prefer event focus if one is selected, otherwise camera view
    includeSelectedEvent:
      visibleCollectionIds.length > 0 && selectedEventId !== null,
    includeViewport:
      visibleCollectionIds.length > 0 && selectedEventId === null,
  }));
  const [copied, setCopied] = useState(false);

  const update = useCallback(
    (key: keyof ShareOptionsState, value: boolean) =>
      setOptions((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "includeCollections" && !value) {
          next.includeSelectedEvent = false;
          next.includeViewport = false;
        }
        // Mutually exclusive: "Focus on event" ↔ "Share camera view"
        if (key === "includeSelectedEvent" && value) {
          next.includeViewport = false;
        } else if (key === "includeViewport" && value) {
          next.includeSelectedEvent = false;
        }
        return next;
      }),
    [],
  );

  const shareUrl = onGenerateUrl(options);

  const collectionLabel =
    visibleCollectionIds.length > 0
      ? t("shareableCollectionsCount", {
          count: visibleCollectionIds.length,
        })
      : t("noShareableCollections");

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const yearLabel =
    Math.abs(Math.round(focusYear)) < 1000
      ? Math.round(focusYear).toString()
      : Math.round(focusYear).toLocaleString();

  return (
    <AnimatePresence>
      <motion.div
        key="share-overlay"
        className="ui-modal-overlay bg-black/80 fixed inset-0 z-100 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      >
        <motion.div
          key="share-card"
          className="ui-modal-surface ui-panel w-full max-w-md rounded-[1.9rem] p-6 sm:p-8"
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ duration: 0.22, ease: [0.21, 0.9, 0.32, 1.02] }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="share-card-title-row">
              <Link width={16} height={16} className="share-card-icon" />
              <h2 className="share-card-title">{t("shareTimeline")}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ui-icon-button h-10 w-10"
              aria-label={t("close")}
            >
              <X width={16} height={16} />
            </button>
          </div>

          {/* Toggles */}
          <div className="share-toggles">
            <ToggleRow
              icon={<Layers width={14} height={14} />}
              label={collectionLabel}
              description={
                visibleCollectionIds.length > 0
                  ? visibleCollectionIds
                      .slice(0, 3)
                      .map((id) => collectionNames[id] ?? id)
                      .join(", ")
                  : t("noShareableCollections")
              }
              value={options.includeCollections}
              onChange={(v) => update("includeCollections", v)}
              disabled={visibleCollectionIds.length === 0}
            />

            {options.includeCollections && (
              <ToggleRow
                icon={<MapPin width={14} height={14} />}
                label={t("focusSelectedEvent")}
                description={
                  selectedEventId
                    ? t("autoScrollToEvent")
                    : t("noEventSelected")
                }
                value={options.includeSelectedEvent}
                onChange={(v) => update("includeSelectedEvent", v)}
                disabled={!selectedEventId}
              />
            )}

            {selectedEventId ? (
              <ToggleRow
                icon={<Locate width={14} height={14} />}
                label={t("cameraViewZoom")}
                description={t("shareCurrentViewport", { year: yearLabel })}
                value={options.includeViewport}
                onChange={(v) => update("includeViewport", v)}
                disabled={!options.includeCollections}
              />
            ) : (
              options.includeCollections && (
                <ToggleRow
                  icon={<Locate width={14} height={14} />}
                  label={t("cameraViewZoom")}
                  description={t("shareCurrentViewport", { year: yearLabel })}
                  value={options.includeViewport}
                  onChange={(v) => update("includeViewport", v)}
                  disabled={!options.includeCollections}
                />
              )
            )}
          </div>

          {/* URL output */}
          <div className="share-url-section">
            <div className="share-url-track">
              <div
                className="share-url-glow"
                style={{
                  width: `${Math.min(100, Math.max(20, shareUrl.length * 0.45))}%`,
                }}
              />
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="share-url-input"
                onFocus={(e) => (e.target as HTMLInputElement).select()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>

            <motion.button
              type="button"
              onClick={handleCopy}
              className={`ui-button w-full justify-center${copied ? " ui-button-primary" : " ui-button-secondary"}`}
              whileTap={{ scale: 0.97 }}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span
                    key="check"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                  >
                    <Check width={13} height={13} />
                    {t("copied")}
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                  >
                    <Copy width={13} height={13} />
                    {t("copyLink")}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
