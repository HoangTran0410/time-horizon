import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ExternalLink,
  FileImage,
  Locate,
  Pencil,
  Play,
  Ruler,
  Trash2,
  X,
} from "lucide-react";
import { Event } from "../constants/types";
import {
  getEventDisplayLabel,
  normalizeEmbedVideoUrl,
  normalizeExternalLinkUrl,
  normalizeImageUrl,
} from "../helpers";
import { EventVideoModal } from "./EventVideoModal";

interface MobileEventInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  isRulerActive: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRuler: () => void;
  onCloseSelection: () => void;
}

export const MobileEventInfoPanel: React.FC<MobileEventInfoPanelProps> = ({
  isOpen,
  onClose,
  event,
  isRulerActive,
  onFocus,
  onEdit,
  onDelete,
  onToggleRuler,
  onCloseSelection,
}) => {
  const panelMaxHeight = "min(58vh, 30rem)";
  const imageUrl = event ? normalizeImageUrl(event.image) : null;
  const videoUrl = event ? normalizeEmbedVideoUrl(event.video) : null;
  const linkUrl = event ? normalizeExternalLinkUrl(event.link) : null;
  const [isImagePreviewOpen, setIsImagePreviewOpen] = React.useState(false);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setIsImagePreviewOpen(false);
    setIsVideoPreviewOpen(false);
  }, [event?.id]);

  const imagePreviewModal =
    typeof document !== "undefined" && isImagePreviewOpen && imageUrl
      ? createPortal(
          <AnimatePresence>
            <motion.div
              className="ui-modal-overlay fixed inset-0 z-[140] bg-black md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImagePreviewOpen(false)}
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <motion.div
                className="relative h-dvh w-screen overflow-hidden bg-black"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setIsImagePreviewOpen(false)}
                  className="ui-icon-button absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 h-10 w-10"
                  aria-label="Close image preview"
                >
                  <X width={16} height={16} />
                </button>
                <div className="flex h-full w-full items-center justify-center overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[calc(max(0.75rem,env(safe-area-inset-top))+3rem)]">
                  <img
                    src={imageUrl}
                    alt={event?.title ?? "Event image"}
                    className="h-full w-full object-contain"
                  />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="ui-popover md:hidden"
        data-open={isOpen}
        style={isOpen ? { maxHeight: panelMaxHeight } : undefined}
      >
        <div
          className="ui-panel mt-0.5 flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[1.45rem] p-3.5"
          style={{ maxHeight: panelMaxHeight }}
        >
          {event ? (
            <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <div className="flex items-start gap-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-zinc-700 bg-zinc-900 text-2xl">
                  {event.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[1rem] font-semibold text-zinc-100">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-[0.72rem] font-mono uppercase tracking-[0.14em] text-emerald-400">
                    {getEventDisplayLabel(event)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ui-icon-button h-9 w-9 shrink-0"
                  aria-label="Close selection"
                  title="Close selection"
                >
                  <X width={16} height={16} />
                </button>
              </div>

              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setIsImagePreviewOpen(true)}
                  className="flex h-36 w-full items-center justify-center overflow-hidden"
                >
                  <img
                    src={imageUrl}
                    alt={event.title}
                    className="max-h-full max-w-full rounded-[1rem] object-contain object-center"
                    loading="lazy"
                  />
                </button>
              ) : null}

              <p className="text-[0.84rem] leading-6 text-zinc-300 text-center">
                {event.description || "This event has no description yet."}
              </p>

              {(videoUrl || linkUrl) && (
                <div className="flex flex-wrap gap-2 item-center justify-center">
                  {/* {imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setIsImagePreviewOpen(true)}
                      className="ui-button ui-button-secondary px-3 py-2 text-[0.74rem]"
                    >
                      <FileImage width={14} height={14} />
                      <span>Image</span>
                    </button>
                  ) : null} */}
                  {videoUrl ? (
                    <button
                      type="button"
                      onClick={() => setIsVideoPreviewOpen(true)}
                      className="ui-button ui-button-secondary px-3 py-2 text-[0.74rem]"
                    >
                      <Play width={14} height={14} />
                      <span>Video</span>
                    </button>
                  ) : null}
                  {linkUrl ? (
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-button ui-button-secondary px-3 py-2 text-[0.74rem]"
                    >
                      <ExternalLink width={14} height={14} />
                      <span>Link</span>
                    </a>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pb-2">
                <button
                  type="button"
                  onClick={onFocus}
                  className="ui-button ui-button-secondary w-full px-3 py-2.5 text-[0.76rem]"
                >
                  <Locate width={14} height={14} />
                  <span>Focus</span>
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="ui-button ui-button-secondary w-full px-3 py-2.5 text-[0.76rem]"
                >
                  <Pencil width={14} height={14} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleRuler}
                  className={`ui-button w-full px-3 py-2.5 text-[0.76rem] ${
                    isRulerActive
                      ? "border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                      : "ui-button-secondary"
                  }`}
                >
                  <Ruler width={14} height={14} />
                  <span>Measure</span>
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="ui-button ui-button-danger w-full px-3 py-2.5 text-[0.76rem]"
                >
                  <Trash2 width={14} height={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.15rem] border border-dashed border-zinc-800 px-3 py-5 text-center text-[0.82rem] leading-5 text-zinc-500">
              Select an event on the timeline to open its details here.
            </div>
          )}
        </div>
      </div>

      {imagePreviewModal}
      <EventVideoModal
        isOpen={isVideoPreviewOpen}
        videoUrl={videoUrl}
        title={event?.title ?? "Event"}
        onClose={() => setIsVideoPreviewOpen(false)}
      />
    </>
  );
};
