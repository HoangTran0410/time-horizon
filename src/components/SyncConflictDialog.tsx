import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Copy, Download, Upload } from "lucide-react";
import { useI18n } from "../i18n";

export interface SyncConflictDialogConflict {
  id: string;
  name: string;
}

interface SyncConflictDialogProps {
  isOpen: boolean;
  mode: "sync" | "restore";
  conflicts: SyncConflictDialogConflict[];
  onKeepLocal: () => void;
  onKeepRemote: () => void;
  onDuplicateAndRestore: () => void;
  onCancel: () => void;
}

export const SyncConflictDialog: React.FC<SyncConflictDialogProps> = ({
  isOpen,
  mode,
  conflicts,
  onKeepLocal,
  onKeepRemote,
  onDuplicateAndRestore,
  onCancel,
}) => {
  const { t } = useI18n();

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-120 flex items-center justify-center bg-black/80 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="ui-modal-surface ui-panel w-full max-w-lg overflow-hidden rounded-[2rem]"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_50%)] px-6 pb-4 pt-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="ui-kicker">{t("syncConflictTitle")}</div>
                  <h2 className="ui-display-title mt-2 text-[1.5rem] leading-tight text-white">
                    {mode === "sync"
                      ? t("syncConflictSyncHeading")
                      : t("syncConflictRestoreHeading")}
                  </h2>
                  <p className="mt-2 text-[0.92rem] leading-7 text-zinc-400">
                    {t("syncConflictDescription", { count: conflicts.length })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-6 py-5">
              <div className="rounded-[1.1rem] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("conflictingCollections")}
                </div>
                <div className="mt-3 space-y-2">
                  {conflicts.slice(0, 5).map((conflict) => (
                    <div
                      key={conflict.id}
                      className="rounded-[0.9rem] border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200"
                    >
                      {conflict.name}
                    </div>
                  ))}
                  {conflicts.length > 5 ? (
                    <div className="text-[0.8rem] text-zinc-500">
                      {t("moreConflictingCollections", {
                        count: conflicts.length - 5,
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={onKeepLocal}
                  className="ui-button ui-button-primary justify-center"
                >
                  <Upload width={15} height={15} />
                  <span>
                    {mode === "sync"
                      ? t("keepLocalAndSync")
                      : t("keepLocalOnly")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onKeepRemote}
                  className="ui-button ui-button-secondary justify-center"
                >
                  <Download width={15} height={15} />
                  <span>{t("keepRemoteAndRestore")}</span>
                </button>
                <button
                  type="button"
                  onClick={onDuplicateAndRestore}
                  className="ui-button ui-button-secondary justify-center"
                >
                  <Copy width={15} height={15} />
                  <span>{t("duplicateLocalThenRestore")}</span>
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="ui-button ui-button-secondary"
                >
                  {t("cancel")}
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
