import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Download, Trash2, Upload } from "lucide-react";
import { useI18n } from "../i18n";

interface BackupModeDialogProps {
  isOpen: boolean;
  collectionNames: string[];
  onMerge: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}

export const BackupModeDialog: React.FC<BackupModeDialogProps> = ({
  isOpen,
  collectionNames,
  onMerge,
  onOverwrite,
  onCancel,
}) => {
  const { t } = useI18n();

  if (typeof document === "undefined") {
    return null;
  }

  const previewNames = collectionNames.slice(0, 3);
  const remainingCount = Math.max(0, collectionNames.length - previewNames.length);

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-110 flex items-center justify-center bg-black/80 p-4"
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
                  <div className="ui-kicker">{t("backupChoiceKicker")}</div>
                  <h2 className="ui-display-title mt-2 text-[1.5rem] leading-tight text-white">
                    {t("backupChoiceTitle", { count: collectionNames.length })}
                  </h2>
                  <p className="mt-2 text-[0.92rem] leading-7 text-zinc-400">
                    {t("backupChoiceDescription")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-[1.1rem] border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  {t("backupChoiceListLabel")}
                </div>
                <div className="mt-3 space-y-2">
                  {previewNames.map((name) => (
                    <div
                      key={name}
                      className="rounded-[0.9rem] border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200"
                    >
                      {name}
                    </div>
                  ))}
                  {remainingCount > 0 ? (
                    <div className="text-[0.8rem] text-zinc-500">
                      {t("backupChoiceMore", { count: remainingCount })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onOverwrite}
                  className="ui-button ui-button-danger justify-center"
                >
                  <Trash2 width={15} height={15} />
                  <span>{t("backupOverwriteAction")}</span>
                </button>
                <button
                  type="button"
                  onClick={onMerge}
                  className="ui-button ui-button-secondary justify-center"
                >
                  <Download width={15} height={15} />
                  <span>{t("backupMergeAction")}</span>
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <Trash2 width={14} height={14} />
                    <span>{t("backupOverwriteAction")}</span>
                  </div>
                  <div className="mt-1 text-[0.8rem] text-red-100/80">
                    {t("backupOverwriteHelp")}
                  </div>
                </div>
                <div className="rounded-[1rem] border border-zinc-700 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <Upload width={14} height={14} />
                    <span>{t("backupMergeAction")}</span>
                  </div>
                  <div className="mt-1 text-[0.8rem] text-zinc-400">
                    {t("backupMergeHelp")}
                  </div>
                </div>
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
