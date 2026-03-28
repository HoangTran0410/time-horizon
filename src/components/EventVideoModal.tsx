import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

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
              aria-label="Close video"
            >
              <X width={16} height={16} />
            </button>
            <iframe
              src={videoUrl}
              title={`${title} video`}
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
