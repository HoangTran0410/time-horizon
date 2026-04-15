import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, RefreshCw } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Link2Off,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { GOOGLE_CLIENT_ID } from "../constants";
import { useI18n } from "../i18n";
import { useStore } from "../stores";
import { hasPendingSyncableChanges as hasPendingSyncableChangesForSync } from "../sync";

interface SyncPanelProps {
  isOpen: boolean;
  isBusy: boolean;
  progressStep: string | null;
  onConnect: (options: {
    autosyncEnabled: boolean;
  }) => Promise<void> | void;
  onDisconnect: () => Promise<void> | void;
  onManualSync: () => Promise<void> | void;
  onRestoreFromDrive: () => Promise<void> | void;
  onClose: () => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({
  isOpen,
  isBusy,
  progressStep,
  onConnect,
  onDisconnect,
  onManualSync,
  onRestoreFromDrive,
  onClose,
}) => {
  const { language, t } = useI18n();
  const syncPreferences = useStore((s) => s.syncPreferences);
  const syncConnectionStatus = useStore((s) => s.syncConnectionStatus);
  const syncStatusMessage = useStore((s) => s.syncStatusMessage);
  const collectionLibrary = useStore((s) => s.collectionLibrary);
  const collectionColorPreferences = useStore(
    (s) => s.collectionColorPreferences,
  );
  const deletedCollectionSyncTombstones = useStore(
    (s) => s.deletedCollectionSyncTombstones,
  );
  const nextAutosyncAt = useStore((s) => s.nextAutosyncAt);
  const setAutosyncEnabled = useStore((s) => s.setAutosyncEnabled);
  const [draftAutosyncEnabled, setDraftAutosyncEnabled] = useState(
    syncPreferences.autosyncEnabled,
  );
  const [autosyncCountdown, setAutosyncCountdown] = useState<number | null>(null);

  // Update countdown every second when autosync is scheduled
  useEffect(() => {
    if (!nextAutosyncAt) {
      setAutosyncCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((nextAutosyncAt - Date.now()) / 1000));
      setAutosyncCountdown(remaining);
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [nextAutosyncAt]);

  const hasGoogleClientId = GOOGLE_CLIENT_ID.trim().length > 0;
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

  useEffect(() => {
    if (!isOpen) return;
    setDraftAutosyncEnabled(syncPreferences.autosyncEnabled);
  }, [isOpen, syncPreferences.autosyncEnabled]);

  const statusTone = useMemo(() => {
    if (syncConnectionStatus === "error") {
      return "border-rose-500/30 bg-rose-500/10 text-rose-100";
    }

    if (syncConnectionStatus === "connected") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    }

    if (syncConnectionStatus === "connecting") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    }

    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }, [syncConnectionStatus]);

  const statusLabel =
    syncConnectionStatus === "connected"
      ? t("syncConnected")
      : syncConnectionStatus === "connecting"
        ? t("syncConnecting")
        : syncConnectionStatus === "error"
          ? t("syncError")
          : t("syncDisconnected");

  const lastSyncedLabel = syncPreferences.lastSuccessfulSyncAt
    ? new Date(syncPreferences.lastSuccessfulSyncAt).toLocaleString(
        language === "vi" ? "vi-VN" : "en-US",
      )
    : t("neverSynced");

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="ui-modal-surface ui-panel my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.9rem] p-6 sm:p-8"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.22, ease: [0.21, 0.9, 0.32, 1.02] }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="ui-kicker">{t("syncSettings")}</div>
                <div className="ui-display-title mt-1 text-[1.35rem] leading-none text-white">
                  {t("googleDriveSync")}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ui-icon-button h-10 w-10"
                aria-label={t("closeSyncPanel")}
                title={t("closeSyncPanel")}
              >
                <X width={15} height={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div className={`rounded-[1.1rem] border px-4 py-3 ${statusTone}`}>
                <div className="flex items-center gap-3">
                  {syncConnectionStatus === "error" ? (
                    <AlertCircle width={16} height={16} />
                  ) : syncConnectionStatus === "connected" ? (
                    <CheckCircle2 width={16} height={16} />
                  ) : (
                    <Cloud width={16} height={16} />
                  )}
                  <div>
                    <div className="text-sm font-semibold">{statusLabel}</div>
                    <div className="text-[0.78rem] text-zinc-300/80">
                      {syncStatusMessage ??
                        (hasPendingSyncableChanges
                          ? t("pendingSyncChanges")
                          : t("noPendingSyncChanges"))}
                    </div>
                    {autosyncCountdown !== null ? (
                      <div className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-emerald-400/80">
                        <Clock width={12} height={12} className="shrink-0" />
                        <span>
                          {t("autosyncCountdown", { seconds: autosyncCountdown })}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {!hasGoogleClientId ? (
                <div className="rounded-[1.1rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <div className="font-semibold">{t("syncNotConfigured")}</div>
                  <div className="mt-1 text-[0.82rem] text-amber-100/80">
                    {t("syncNotConfiguredHelp")}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[1.1rem] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={
                      syncPreferences.onboardingCompleted
                        ? syncPreferences.autosyncEnabled
                        : draftAutosyncEnabled
                    }
                    onChange={(event) => {
                      if (syncPreferences.onboardingCompleted) {
                        setAutosyncEnabled(event.target.checked);
                        return;
                      }
                      setDraftAutosyncEnabled(event.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 accent-emerald-400"
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      {t("autosyncEnabledLabel")}
                    </div>
                    <div className="mt-1 text-[0.78rem] leading-5 text-zinc-400">
                      {t("autosyncEnabledHelp")}
                    </div>
                  </div>
                </label>
              </div>

              <div className="rounded-[1.1rem] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("lastSyncedAt")}
                </div>
                <div className="mt-2 text-sm text-zinc-100">{lastSyncedLabel}</div>
              </div>

              {progressStep ? (
                <div className="flex items-center gap-2 rounded-[1.1rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
                  <RefreshCw width={14} height={14} className="animate-spin text-emerald-400" />
                  <span className="text-sm text-emerald-200">{progressStep}</span>
                </div>
              ) : null}

              <div className="grid gap-2">
                {!syncPreferences.onboardingCompleted ? (
                  <button
                    type="button"
                    onClick={() =>
                      void onConnect({
                        autosyncEnabled: draftAutosyncEnabled,
                      })
                    }
                    disabled={isBusy || !hasGoogleClientId}
                    className="ui-button ui-button w-full justify-center rounded-[1rem] px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Cloud width={15} height={15} />
                    <span>{t("connectGoogleDrive")}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void onManualSync()}
                      disabled={isBusy || !hasGoogleClientId}
                      className="ui-button ui-button ui-button-secondary w-full justify-center rounded-[1rem] px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw
                        width={14}
                        height={14}
                        className={isBusy ? "animate-spin" : undefined}
                      />
                      <span>{t("manualSync")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRestoreFromDrive()}
                      disabled={isBusy || !hasGoogleClientId}
                      className="ui-button ui-button ui-button-secondary w-full justify-center rounded-[1rem] px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Cloud width={15} height={15} />
                      <span>{t("restoreFromDrive")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDisconnect()}
                      disabled={isBusy}
                      className="ui-button ui-button ui-button-danger w-full justify-center rounded-[1rem] px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Link2Off width={15} height={15} />
                      <span>{t("disconnectGoogleDrive")}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("clearLocalStorageConfirm"))) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  disabled={isBusy}
                  className="ui-button ui-button ui-button-danger w-full justify-center rounded-[1rem] px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 width={15} height={15} />
                  <span>{t("clearLocalStorage")}</span>
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
