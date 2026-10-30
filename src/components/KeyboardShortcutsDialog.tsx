import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { useI18n } from "../i18n";
import { TIMELINE_SHORTCUTS } from "./timelineKeyboard";
import { useDialogA11y } from "./useDialogA11y";

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** "?" help sheet listing the timeline's keyboard controls. */
export const KeyboardShortcutsDialog: React.FC<
  KeyboardShortcutsDialogProps
> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const { containerRef, titleId } = useDialogA11y({ isOpen, onClose });

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-110 flex items-center justify-center bg-black/80 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="ui-modal-surface ui-panel max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[1.9rem] p-6 sm:p-7"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.21, 0.9, 0.32, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                  <Keyboard size={18} aria-hidden="true" />
                </span>
                <div>
                  <div className="ui-kicker">
                    {t("keyboardShortcutsKicker")}
                  </div>
                  <h2
                    id={titleId}
                    className="ui-display-title mt-1 text-[1.35rem] leading-tight text-white"
                  >
                    {t("keyboardShortcuts")}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="ui-icon-button h-10 w-10 shrink-0"
                aria-label={t("close")}
                title={t("close")}
              >
                <X width={15} height={15} aria-hidden="true" />
              </button>
            </div>

            <dl className="divide-y divide-zinc-800/80 rounded-[1.1rem] border border-zinc-800 bg-zinc-950/60">
              {TIMELINE_SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.labelKey}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <dt className="text-[0.88rem] text-zinc-200">
                    {t(shortcut.labelKey)}
                  </dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key) => (
                      <kbd key={key} className="ui-kbd">
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-[0.8rem] leading-6 text-zinc-400">
              {t("keyboardShortcutsHint")}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
