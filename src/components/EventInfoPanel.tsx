import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronUp,
  ChevronDown,
  ExternalLink,
  ImageOff,
  Play,
  Locate,
  Pencil,
  RotateCcw,
  Ruler,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { Event } from "../constants/types";
import {
  getEventDisplayLabel,
  normalizeEmbedVideoUrl,
  normalizeExternalLinkUrl,
  normalizeImageUrl,
} from "../helpers";
import { EventVideoModal } from "./EventVideoModal";

interface EventInfoPanelProps {
  event: Event;
  isRulerActive: boolean;
  isCollapsed: boolean;
  hideOnMobile?: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRuler: () => void;
  onToggleCollapsed: () => void;
  onClose: () => void;
}

const eventInfoPanelTransition = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.65,
} as const;

type PointerSnapshot = { clientX: number; clientY: number };

const getPointerDistance = (first: PointerSnapshot, second: PointerSnapshot) =>
  Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

const getPointerCenter = (first: PointerSnapshot, second: PointerSnapshot) => ({
  x: (first.clientX + second.clientX) / 2,
  y: (first.clientY + second.clientY) / 2,
});

interface EventImagePreviewProps {
  src: string;
  alt: string;
  className: string;
  wrapperClassName?: string;
  onClick?: () => void;
  loadingLabel?: string;
  imgStyle?: React.CSSProperties;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  onPointerUp?: React.PointerEventHandler<HTMLElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLElement>;
}

const EventImagePreview: React.FC<EventImagePreviewProps> = ({
  src,
  alt,
  className,
  wrapperClassName = "",
  onClick,
  loadingLabel = "Loading image",
  imgStyle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
}) => {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">(
    "loading",
  );

  React.useEffect(() => {
    let isActive = true;
    setStatus("loading");

    const preloadImage = new Image();
    const handleLoad = () => {
      if (isActive) setStatus("loaded");
    };
    const handleError = () => {
      if (isActive) setStatus("error");
    };

    preloadImage.onload = handleLoad;
    preloadImage.onerror = handleError;
    preloadImage.src = src;

    if (preloadImage.complete) {
      if (preloadImage.naturalWidth > 0) {
        handleLoad();
      } else {
        handleError();
      }
    }

    return () => {
      isActive = false;
      preloadImage.onload = null;
      preloadImage.onerror = null;
    };
  }, [src]);

  const content = (
    <>
      {status !== "error" && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          style={imgStyle}
          className={`${className} transition-opacity duration-200 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
          <div className="flex flex-col items-center gap-2 text-[10px] text-zinc-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
            <span>{loadingLabel}</span>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center  text-zinc-500">
          <div className="flex flex-col items-center gap-1 text-[10px]">
            <ImageOff width={16} height={16} />
            <span>Image unavailable</span>
          </div>
        </div>
      )}
    </>
  );

  const sharedClassName =
    `relative overflow-hidden bg-zinc-950/70 ${wrapperClassName}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
        className={`${sharedClassName} transition-transform hover:scale-[1.03]`}
        title="Open image"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={sharedClassName}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
    >
      {content}
    </div>
  );
};

export const EventInfoPanel: React.FC<EventInfoPanelProps> = ({
  event,
  isRulerActive,
  isCollapsed,
  hideOnMobile = false,
  onFocus,
  onEdit,
  onDelete,
  onToggleRuler,
  onToggleCollapsed,
  onClose,
}) => {
  const embeddedVideoUrl = normalizeEmbedVideoUrl(event.video);
  const externalLinkUrl = normalizeExternalLinkUrl(event.link);
  const imageUrl = normalizeImageUrl(event.image);
  const [mediaModal, setMediaModal] = React.useState<"image" | "video" | null>(
    null,
  );
  const [imageScale, setImageScale] = React.useState(1);
  const [imageOffset, setImageOffset] = React.useState({ x: 0, y: 0 });
  const [isImagePanning, setIsImagePanning] = React.useState(false);
  const activeImagePointersRef = React.useRef<Map<number, PointerSnapshot>>(
    new Map(),
  );
  const imagePanStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const imagePinchStateRef = React.useRef<{
    startDistance: number;
    startScale: number;
    startCenterX: number;
    startCenterY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const imageWheelSurfaceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMediaModal(null);
  }, [event.id]);

  React.useEffect(() => {
    if (mediaModal !== "image") {
      setImageScale(1);
      setImageOffset({ x: 0, y: 0 });
      setIsImagePanning(false);
      activeImagePointersRef.current.clear();
      imagePanStateRef.current = null;
      imagePinchStateRef.current = null;
    }
  }, [mediaModal]);

  const resetImageViewport = () => {
    setImageScale(1);
    setImageOffset({ x: 0, y: 0 });
    setIsImagePanning(false);
    activeImagePointersRef.current.clear();
    imagePanStateRef.current = null;
    imagePinchStateRef.current = null;
  };

  const clampImageScale = (nextScale: number) =>
    Math.min(5, Math.max(1, nextScale));

  React.useEffect(() => {
    if (mediaModal !== "image") return;

    const surface = imageWheelSurfaceRef.current;
    if (!surface) return;

    const handleImageWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setImageScale((prev) => {
        const nextScale = clampImageScale(
          prev + (event.deltaY < 0 ? 0.24 : -0.24),
        );

        if (nextScale === 1) {
          setImageOffset({ x: 0, y: 0 });
        }

        return nextScale;
      });
    };

    surface.addEventListener("wheel", handleImageWheel, { passive: false });

    return () => {
      surface.removeEventListener("wheel", handleImageWheel);
    };
  }, [mediaModal]);

  const handleImagePointerDown: React.PointerEventHandler<HTMLElement> = (
    e,
  ) => {
    activeImagePointersRef.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const pointers = Array.from(
      activeImagePointersRef.current.values(),
    ) as PointerSnapshot[];
    if (pointers.length >= 2) {
      const [first, second] = pointers;
      const center = getPointerCenter(first, second);
      imagePinchStateRef.current = {
        startDistance: getPointerDistance(first, second),
        startScale: imageScale,
        startCenterX: center.x,
        startCenterY: center.y,
        originX: imageOffset.x,
        originY: imageOffset.y,
      };
      imagePanStateRef.current = null;
      setIsImagePanning(false);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (imageScale <= 1) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    imagePanStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: imageOffset.x,
      originY: imageOffset.y,
    };
    setIsImagePanning(true);
  };

  const handleImagePointerMove: React.PointerEventHandler<HTMLElement> = (
    e,
  ) => {
    if (activeImagePointersRef.current.has(e.pointerId)) {
      activeImagePointersRef.current.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }

    const pointers = Array.from(
      activeImagePointersRef.current.values(),
    ) as PointerSnapshot[];
    const pinchState = imagePinchStateRef.current;
    if (pinchState && pointers.length >= 2) {
      const [first, second] = pointers;
      const distance = getPointerDistance(first, second);
      const center = getPointerCenter(first, second);
      const nextScale = clampImageScale(
        pinchState.startScale *
          (pinchState.startDistance > 0
            ? distance / pinchState.startDistance
            : 1),
      );

      e.preventDefault();
      e.stopPropagation();
      setImageScale(nextScale);
      setImageOffset({
        x: pinchState.originX + (center.x - pinchState.startCenterX),
        y: pinchState.originY + (center.y - pinchState.startCenterY),
      });
      return;
    }

    const panState = imagePanStateRef.current;
    if (!panState || panState.pointerId !== e.pointerId) return;

    e.preventDefault();
    e.stopPropagation();
    setImageOffset({
      x: panState.originX + (e.clientX - panState.startX),
      y: panState.originY + (e.clientY - panState.startY),
    });
  };

  const finishImagePointerInteraction: React.PointerEventHandler<
    HTMLElement
  > = (e) => {
    activeImagePointersRef.current.delete(e.pointerId);

    const remainingPointers = Array.from(
      activeImagePointersRef.current.values(),
    ) as PointerSnapshot[];
    if (remainingPointers.length < 2) {
      imagePinchStateRef.current = null;
    }

    const panState = imagePanStateRef.current;
    if (panState && panState.pointerId === e.pointerId) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      imagePanStateRef.current = null;
      setIsImagePanning(false);
    }

    if (
      remainingPointers.length === 1 &&
      imageScale > 1 &&
      imagePanStateRef.current === null
    ) {
      const [remainingPointer] = Array.from(
        activeImagePointersRef.current.entries(),
      ) as Array<[number, PointerSnapshot]>;
      if (remainingPointer) {
        const [pointerId, pointer] = remainingPointer;
        imagePanStateRef.current = {
          pointerId,
          startX: pointer.clientX,
          startY: pointer.clientY,
          originX: imageOffset.x,
          originY: imageOffset.y,
        };
        setIsImagePanning(true);
      }
    }
  };

  const handleImageDoubleClick: React.MouseEventHandler<HTMLElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetImageViewport();
  };

  return (
    <div className={hideOnMobile ? "hidden md:block" : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {isCollapsed ? (
          <motion.div
            key="collapsed"
            className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={eventInfoPanelTransition}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.button
              onClick={onToggleCollapsed}
              className="ui-panel flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-100"
              aria-expanded={false}
              aria-label="Expand event info"
              title="Expand panel"
              whileTap={{ scale: 0.97 }}
            >
              <ChevronUp width={16} height={16} />
              <span className="flex items-center gap-2">
                <span className="text-lg">{event.emoji}</span> {event.title}
              </span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={eventInfoPanelTransition}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.button
              onClick={onToggleCollapsed}
              className="ui-button ui-button-secondary absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full text-zinc-300 z-10"
              style={{ padding: 0 }}
              aria-expanded
              aria-label="Collapse event info"
              title="Collapse panel"
              whileTap={{ scale: 0.95 }}
            >
              <ChevronDown width={16} height={16} />
            </motion.button>

            <motion.div
              className="ui-panel rounded-[1.5rem] px-4 py-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-lg">
                    {event.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <div className="min-w-0 flex-1 basis-48">
                        <h3 className="text-[1rem] font-semibold text-white">
                          {event.title}
                        </h3>
                        <p className="mt-1 truncate font-mono text-[0.76rem] uppercase tracking-[0.12em] text-emerald-500">
                          {getEventDisplayLabel(event)}
                        </p>
                      </div>

                      <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:max-w-[50%]">
                        <button
                          onClick={onFocus}
                          className="ui-icon-button rounded-full p-2"
                          title="Center camera on this event"
                        >
                          <Locate width={14} height={14} />
                        </button>
                        <button
                          onClick={onEdit}
                          className="ui-icon-button rounded-full p-2"
                        >
                          <Pencil width={14} height={14} />
                        </button>
                        <button
                          onClick={onToggleRuler}
                          className={`ui-icon-button p-2 ${
                            isRulerActive
                              ? "border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                              : "ui-button-secondary"
                          }`}
                          title="Measure time from this event to the cursor"
                        >
                          <Ruler width={14} height={14} />
                        </button>
                        <button
                          onClick={onDelete}
                          className="ui-icon-button rounded-full p-2"
                          title={`Delete ${event.title}`}
                        >
                          <Trash2 width={14} height={14} />
                        </button>
                        <button
                          onClick={onClose}
                          className="ui-icon-button h-9 w-9 rounded-full"
                          aria-label="Close"
                        >
                          <X width={16} height={16} />
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[0.84rem] leading-6 text-zinc-300">
                      {event.description}
                    </p>
                    {(imageUrl || embeddedVideoUrl || externalLinkUrl) && (
                      <div className="mt-3 flex items-center gap-2">
                        {imageUrl && (
                          <EventImagePreview
                            src={imageUrl}
                            alt={event.title}
                            onClick={() => setMediaModal("image")}
                            wrapperClassName="h-[120px] w-[120px] rounded-xl border border-zinc-800"
                            className="h-[120px] w-[120px] object-cover"
                            loadingLabel="Loading"
                          />
                        )}

                        <div className="flex flex-wrap gap-2">
                          {embeddedVideoUrl && (
                            <button
                              type="button"
                              onClick={() => setMediaModal("video")}
                              className="ui-button ui-button-secondary rounded-[1rem] px-3 py-2 text-[0.76rem]"
                            >
                              <Play width={13} height={13} />
                              <span>Video</span>
                            </button>
                          )}

                          {externalLinkUrl && (
                            <a
                              href={externalLinkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-button ui-button-secondary rounded-[1rem] px-3 py-2 text-[0.76rem]"
                            >
                              <ExternalLink width={13} height={13} />
                              <span className="truncate">Link</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mediaModal === "image" && imageUrl ? (
          <motion.div
            key="event-image-modal"
            className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMediaModal(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              className="ui-panel relative overflow-hidden rounded-[1.8rem]"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full border border-zinc-700  px-3 py-1.5 text-xs text-zinc-300">
                <ZoomIn width={14} height={14} />
                <span>{Math.round(imageScale * 100)}%</span>
                <button
                  type="button"
                  onClick={resetImageViewport}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                  <RotateCcw width={11} height={11} />
                  <span>Reset</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMediaModal(null)}
                className="ui-icon-button absolute right-3 top-3 z-10 h-10 w-10"
                aria-label="Close image"
              >
                <X width={16} height={16} />
              </button>
              <div
                ref={imageWheelSurfaceRef}
                className="flex h-[min(86vh,900px)] w-[min(92vw,1200px)] items-center justify-center overflow-hidden bg-zinc-950"
              >
                <EventImagePreview
                  src={imageUrl}
                  alt={event.title}
                  wrapperClassName={`flex h-full w-full touch-none select-none items-center justify-center ${
                    imageScale > 1
                      ? isImagePanning
                        ? "cursor-grabbing"
                        : "cursor-grab"
                      : "cursor-zoom-in"
                  }`}
                  className="max-h-full max-w-full object-contain will-change-transform"
                  imgStyle={{
                    transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageScale})`,
                    transformOrigin: "center center",
                  }}
                  onPointerDown={handleImagePointerDown}
                  onPointerMove={handleImagePointerMove}
                  onPointerUp={finishImagePointerInteraction}
                  onPointerCancel={finishImagePointerInteraction}
                  onDoubleClick={handleImageDoubleClick}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        <EventVideoModal
          key="event-video-modal"
          isOpen={mediaModal === "video"}
          videoUrl={embeddedVideoUrl}
          title={event.title}
          onClose={() => setMediaModal(null)}
        />
      </AnimatePresence>
    </div>
  );
};
