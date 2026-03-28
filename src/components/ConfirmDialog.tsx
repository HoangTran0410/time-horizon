import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  isOpen: boolean;
  onCancel: () => void;
}

const dialogTransition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.85,
} as const;

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}) => {
  const shouldCloseOnPointerUpRef = useRef(false);
  const isDangerTone = tone === "danger";

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  const handleBackdropPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    shouldCloseOnPointerUpRef.current = event.target === event.currentTarget;
  };

  const handleBackdropPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (
      shouldCloseOnPointerUpRef.current &&
      event.target === event.currentTarget
    ) {
      onCancel();
    }

    shouldCloseOnPointerUpRef.current = false;
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-110 flex items-center justify-center bg-black/80 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={handleBackdropPointerDown}
          onPointerUp={handleBackdropPointerUp}
          onPointerCancel={() => {
            shouldCloseOnPointerUpRef.current = false;
          }}
          onWheel={(event) => event.stopPropagation()}
        >
          <motion.div
            className="ui-modal-surface ui-panel w-full max-w-md overflow-hidden rounded-[2rem]"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={dialogTransition}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_50%)] px-6 pb-4 pt-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                    isDangerTone
                      ? "border-red-500/25 bg-red-500/10 text-red-300"
                      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="ui-kicker">Confirm Action</div>
                  <h2 className="ui-display-title mt-2 text-[1.6rem] leading-tight text-white">
                    {title}
                  </h2>
                  <p className="mt-2 text-[0.92rem] leading-7 text-zinc-400">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="ui-button ui-button-secondary"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`ui-button ${
                  isDangerTone ? "ui-button-danger" : "ui-button-primary"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
