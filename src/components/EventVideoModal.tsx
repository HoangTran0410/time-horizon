import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useI18n } from "../i18n";
import { useDialogA11y } from "./useDialogA11y";

interface EventVideoModalProps {
  isOpen: boolean;
  videoUrl: string | null;
  title: string;
  onClose: () => void;
}

export const EventVideoModal: React.FC<EventVideoModalProps> = ({
  isOpen,
  videoUrl,
  title,
  onClose,
}) => {
  const { t } = useI18n();
  const isVisible = isOpen && Boolean(videoUrl);
  const { containerRef, titleId } = useDialogA11y({
    isOpen: isVisible,
    onClose,
  });

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && videoUrl ? (
        <motion.div
          className="ui-modal-overlay fixed inset-0 z-[140] bg-black md:flex md:items-center md:justify-center md:bg-black/80 md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative h-dvh w-screen overflow-hidden bg-black md:h-auto md:w-full md:max-w-4xl md:rounded-[1.8rem] md:border md:border-zinc-800/80"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="ui-icon-button absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 h-10 w-10 md:top-3"
              aria-label={t("closeVideo")}
              title={t("closeVideo")}
            >
              <X width={16} height={16} aria-hidden="true" />
            </button>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <iframe
              src={videoUrl}
              title={t("videoFrameTitle", { title })}
              className="h-full w-full md:aspect-video md:h-auto"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
