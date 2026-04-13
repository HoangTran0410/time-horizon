import React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  ImageOff,
  Locate,
  Pencil,
  Play,
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
import {
  getLocalizedEventDescription,
  getLocalizedEventTitle,
} from "../helpers/localization";
import { useI18n } from "../i18n";
import { EventVideoModal } from "./EventVideoModal";

interface EventInfoPanelProps {
  event: Event | null;
  previousEvent: Event | null;
  nextEvent: Event | null;
  isRulerActive: boolean;
  isCollapsed?: boolean;
  isOpen?: boolean;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectPreviousEvent: () => void;
  onSelectNextEvent: () => void;
  onToggleRuler: () => void;
  onToggleCollapsed?: () => void;
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
        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
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

interface EventNavigationButtonsProps {
  previousEvent: Event | null;
  nextEvent: Event | null;
  previousEventLabel: string;
  nextEventLabel: string;
  onSelectPreviousEvent: () => void;
  onSelectNextEvent: () => void;
  mobile?: boolean;
}

const EventNavigationButtons: React.FC<EventNavigationButtonsProps> = ({
  previousEvent,
  nextEvent,
  previousEventLabel,
  nextEventLabel,
  onSelectPreviousEvent,
  onSelectNextEvent,
  mobile = false,
}) =>
  mobile ? (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onSelectPreviousEvent}
        disabled={!previousEvent}
        className="ui-button ui-button-secondary w-full px-3 py-2 text-[0.74rem] disabled:cursor-not-allowed disabled:opacity-45"
        title={previousEventLabel}
      >
        <ChevronLeft width={14} height={14} />
        <span className="min-w-0 flex-1 truncate text-left text-xs">
          {previousEventLabel}
        </span>
      </button>
      <button
        type="button"
        onClick={onSelectNextEvent}
        disabled={!nextEvent}
        className="ui-button ui-button-secondary w-full px-3 py-2 text-[0.74rem] disabled:cursor-not-allowed disabled:opacity-45"
        title={nextEventLabel}
      >
        <span className="min-w-0 flex-1 truncate text-left text-xs">
          {nextEventLabel}
        </span>
        <ChevronRight width={14} height={14} />
      </button>
    </div>
  ) : (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onSelectPreviousEvent}
        disabled={!previousEvent}
        className="ui-button ui-button-secondary min-w-0 flex-1 rounded-[1rem] px-3 py-2 text-[0.76rem] disabled:cursor-not-allowed disabled:opacity-45"
        title={previousEventLabel}
      >
        <ChevronLeft width={13} height={13} className="shrink-0" />
        <span className="min-w-0 truncate text-xs">{previousEventLabel}</span>
      </button>
      <button
        type="button"
        onClick={onSelectNextEvent}
        disabled={!nextEvent}
        className="ui-button ui-button-secondary min-w-0 flex-1 rounded-[1rem] px-3 py-2 text-[0.76rem] disabled:cursor-not-allowed disabled:opacity-45"
        title={nextEventLabel}
      >
        <span className="min-w-0 truncate text-xs">{nextEventLabel}</span>
        <ChevronRight width={13} height={13} className="shrink-0" />
      </button>
    </div>
  );

interface EventActionButtonsProps {
  isRulerActive: boolean;
  focusLabel: string;
  editLabel: string;
  deleteLabel: string;
  rulerLabel: string;
  onFocus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRuler: () => void;
  mobile?: boolean;
}

const EventActionButtons: React.FC<EventActionButtonsProps> = ({
  isRulerActive,
  focusLabel,
  editLabel,
  deleteLabel,
  rulerLabel,
  onFocus,
  onEdit,
  onDelete,
  onToggleRuler,
  mobile = false,
}) =>
  mobile ? (
    <div className="grid grid-cols-4 gap-2">
      <button
        type="button"
        onClick={onFocus}
        aria-label={focusLabel}
        className="ui-icon-button h-10 flex-1 rounded-[0.95rem]"
      >
        <Locate width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        className="ui-icon-button h-10 flex-1 rounded-[0.95rem]"
      >
        <Pencil width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={onToggleRuler}
        aria-label={rulerLabel}
        className={`ui-icon-button h-10 flex-1 rounded-[0.95rem] ${
          isRulerActive
            ? "border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
            : "ui-button-secondary"
        }`}
      >
        <Ruler width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        className="ui-icon-button h-10 flex-1 rounded-[0.95rem] border-rose-500/35 bg-rose-500/12 text-rose-100 hover:bg-rose-500/18"
      >
        <Trash2 width={14} height={14} />
      </button>
    </div>
  ) : (
    <div className="flex w-full flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        onClick={onFocus}
        className="ui-icon-button rounded-full p-2"
        title={focusLabel}
      >
        <Locate width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="ui-icon-button rounded-full p-2"
        title={editLabel}
      >
        <Pencil width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={onToggleRuler}
        className={`ui-icon-button p-2 ${
          isRulerActive
            ? "border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
            : "ui-button-secondary"
        }`}
        title={rulerLabel}
      >
        <Ruler width={14} height={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="ui-icon-button rounded-full p-2"
        title={deleteLabel}
      >
        <Trash2 width={14} height={14} />
      </button>
    </div>
  );

interface EventMediaActionsProps {
  imageUrl: string | null;
  videoUrl: string | null;
  linkUrl: string | null;
  title: string;
  loadingLabel: string;
  videoLabel: string;
  linkLabel: string;
  onOpenImage: () => void;
  onOpenVideo: () => void;
  mobile?: boolean;
}

const EventMediaActions: React.FC<EventMediaActionsProps> = ({
  imageUrl,
  videoUrl,
  linkUrl,
  title,
  loadingLabel,
  videoLabel,
  linkLabel,
  onOpenImage,
  onOpenVideo,
  mobile = false,
}) => {
  if (!imageUrl && !videoUrl && !linkUrl) return null;

  if (mobile) {
    return (
      <>
        {imageUrl ? (
          <button
            type="button"
            onClick={onOpenImage}
            className="flex h-36 w-full items-center justify-center overflow-hidden"
          >
            <EventImagePreview
              src={imageUrl}
              alt={title}
              wrapperClassName="max-h-full max-w-full rounded-[1rem]"
              className="max-h-full max-w-full rounded-[1rem] object-contain object-center"
              loadingLabel={loadingLabel}
            />
          </button>
        ) : null}

        {(videoUrl || linkUrl) && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {videoUrl ? (
              <button
                type="button"
                onClick={onOpenVideo}
                className="ui-button ui-button-secondary px-3 py-2 text-[0.74rem]"
              >
                <Play width={14} height={14} />
                <span>{videoLabel}</span>
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
                <span>{linkLabel}</span>
              </a>
            ) : null}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      {imageUrl ? (
        <EventImagePreview
          src={imageUrl}
          alt={title}
          onClick={onOpenImage}
          wrapperClassName="h-[120px] w-[120px] rounded-xl border border-zinc-800"
          className="h-[120px] w-[120px] object-cover"
          loadingLabel={loadingLabel}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {videoUrl ? (
          <button
            type="button"
            onClick={onOpenVideo}
            className="ui-button ui-button-secondary rounded-[1rem] px-3 py-2 text-[0.76rem]"
          >
            <Play width={13} height={13} />
            <span>{videoLabel}</span>
          </button>
        ) : null}

        {linkUrl ? (
          <a
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            className="ui-button ui-button-secondary rounded-[1rem] px-3 py-2 text-[0.76rem]"
          >
            <ExternalLink width={13} height={13} />
            <span>{linkLabel}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
};

export const EventInfoPanel: React.FC<EventInfoPanelProps> = ({
  event,
  previousEvent,
  nextEvent,
  isRulerActive,
  isCollapsed = false,
  isOpen = false,
  hideOnMobile = false,
  hideOnDesktop = false,
  onFocus,
  onEdit,
  onDelete,
  onSelectPreviousEvent,
  onSelectNextEvent,
  onToggleRuler,
  onToggleCollapsed,
  onClose,
}) => {
  const { language, t } = useI18n();
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
  }, [event?.id]);

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

    const pointers = Array.from(activeImagePointersRef.current.values());
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

    const pointers = Array.from(activeImagePointersRef.current.values());
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
    );
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
      );
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

  if (!event) return null;

  const embeddedVideoUrl = normalizeEmbedVideoUrl(event.video);
  const externalLinkUrl = normalizeExternalLinkUrl(event.link);
  const imageUrl = normalizeImageUrl(event.image);
  const title = getLocalizedEventTitle(event, language);
  const description = getLocalizedEventDescription(
    event,
    language,
    t("noDescriptionYet"),
  );
  const previousEventLabel = previousEvent
    ? getLocalizedEventTitle(previousEvent, language)
    : t("previousEvent");
  const nextEventLabel = nextEvent
    ? getLocalizedEventTitle(nextEvent, language)
    : t("nextEvent");
  const panelMaxHeight = "min(58vh, 30rem)";
  const canCollapse = typeof onToggleCollapsed === "function";
  const showDesktopExpanded = !canCollapse || !isCollapsed;

  return (
    <>
      {!hideOnMobile ? (
        <div
          className="md:hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="ui-popover"
            data-open={isOpen}
            style={isOpen ? { maxHeight: panelMaxHeight } : undefined}
          >
            <div
              className="ui-panel mt-0.5 flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[1.45rem]"
              style={{ maxHeight: panelMaxHeight }}
            >
              <div className="min-h-0 space-y-4 overflow-y-auto p-4">
                <div className="flex items-start gap-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-zinc-700 bg-zinc-900 text-2xl">
                    {event.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[1rem] font-semibold text-zinc-100">
                      {title}
                    </h3>
                    <p className="mt-1 text-[0.72rem] font-mono uppercase tracking-[0.14em] text-emerald-400">
                      {getEventDisplayLabel(event, language)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="ui-icon-button h-9 w-9 shrink-0"
                    aria-label={t("closeSelection")}
                    title={t("closeSelection")}
                  >
                    <X width={16} height={16} />
                  </button>
                </div>

                <EventMediaActions
                  imageUrl={imageUrl}
                  videoUrl={embeddedVideoUrl}
                  linkUrl={externalLinkUrl}
                  title={title}
                  loadingLabel={t("loadingImage")}
                  videoLabel={t("video")}
                  linkLabel={t("link")}
                  onOpenImage={() => setMediaModal("image")}
                  onOpenVideo={() => setMediaModal("video")}
                  mobile
                />

                <p className="text-center text-[0.84rem] leading-6 text-zinc-300">
                  {description}
                </p>

                <EventNavigationButtons
                  previousEvent={previousEvent}
                  nextEvent={nextEvent}
                  previousEventLabel={previousEventLabel}
                  nextEventLabel={nextEventLabel}
                  onSelectPreviousEvent={onSelectPreviousEvent}
                  onSelectNextEvent={onSelectNextEvent}
                  mobile
                />

                <EventActionButtons
                  isRulerActive={isRulerActive}
                  focusLabel={t("focusEvent")}
                  editLabel={t("editEvent")}
                  deleteLabel={t("deleteEvent")}
                  rulerLabel={t("toggleRuler")}
                  onFocus={onFocus}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleRuler={onToggleRuler}
                  mobile
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!hideOnDesktop ? (
        <div className="hidden md:block">
          <AnimatePresence mode="wait" initial={false}>
            {showDesktopExpanded ? (
              <motion.div
                key="expanded"
                className="fixed bottom-5 left-1/2 z-30 w-[min(92vw,560px)] -translate-x-1/2"
                initial={{ opacity: 0, y: 22, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                transition={eventInfoPanelTransition}
                onPointerDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                {canCollapse ? (
                  <motion.button
                    type="button"
                    onClick={onToggleCollapsed}
                    className="ui-button ui-button-secondary absolute left-1/2 top-[-1.25rem] z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full text-zinc-300"
                    style={{ padding: 0 }}
                    aria-expanded
                    aria-label={t("closeSelectedEventInfo")}
                    title={t("closeSelectedEventInfo")}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ChevronDown width={16} height={16} />
                  </motion.button>
                ) : null}

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
                              {title}
                            </h3>
                            <p className="mt-1 font-mono text-[0.76rem] uppercase tracking-[0.12em] text-emerald-500">
                              {getEventDisplayLabel(event, language)}
                            </p>
                          </div>

                          <div className="flex items-start justify-end gap-1">
                            <EventActionButtons
                              isRulerActive={isRulerActive}
                              focusLabel={t("focusEvent")}
                              editLabel={t("editEvent")}
                              deleteLabel={t("deleteEvent")}
                              rulerLabel={t("toggleRuler")}
                              onFocus={onFocus}
                              onEdit={onEdit}
                              onDelete={onDelete}
                              onToggleRuler={onToggleRuler}
                            />
                            <button
                              type="button"
                              onClick={onClose}
                              className="ui-icon-button h-9 w-9 rounded-full"
                              aria-label={t("close")}
                              title={t("close")}
                            >
                              <X width={16} height={16} />
                            </button>
                          </div>
                        </div>

                        <p className="mt-2 text-[0.84rem] text-zinc-300">
                          {description}
                        </p>

                        <EventMediaActions
                          imageUrl={imageUrl}
                          videoUrl={embeddedVideoUrl}
                          linkUrl={externalLinkUrl}
                          title={title}
                          loadingLabel={t("loadingImage")}
                          videoLabel={t("video")}
                          linkLabel={t("link")}
                          onOpenImage={() => setMediaModal("image")}
                          onOpenVideo={() => setMediaModal("video")}
                        />

                        <EventNavigationButtons
                          previousEvent={previousEvent}
                          nextEvent={nextEvent}
                          previousEventLabel={previousEventLabel}
                          nextEventLabel={nextEventLabel}
                          onSelectPreviousEvent={onSelectPreviousEvent}
                          onSelectNextEvent={onSelectNextEvent}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
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
                  type="button"
                  onClick={onToggleCollapsed}
                  className="ui-panel flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-100"
                  aria-expanded={false}
                  aria-label={t("openSelectedEventInfo")}
                  title={t("openSelectedEventInfo")}
                  whileTap={{ scale: 0.97 }}
                >
                  <ChevronUp width={16} height={16} />
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{event.emoji}</span>
                    {title}
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}

      <AnimatePresence>
        {mediaModal === "image" && imageUrl ? (
          <motion.div
            key="event-image-modal"
            className="ui-modal-overlay fixed inset-0 z-[140] flex items-center justify-center bg-black p-0 md:bg-black/80 md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMediaModal(null)}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              className="ui-panel relative h-dvh w-screen overflow-hidden rounded-none bg-black md:h-auto md:w-auto md:rounded-[1.8rem]"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="absolute left-3 top-3 z-10 hidden items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 md:flex">
                <ZoomIn width={14} height={14} />
                <span>{Math.round(imageScale * 100)}%</span>
                <button
                  type="button"
                  onClick={resetImageViewport}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                  <RotateCcw width={11} height={11} />
                  <span>{t("reset")}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMediaModal(null)}
                className="ui-icon-button absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 h-10 w-10 md:top-3"
                aria-label={t("close")}
              >
                <X width={16} height={16} />
              </button>
              <div
                ref={imageWheelSurfaceRef}
                className="flex h-dvh w-screen items-center justify-center overflow-hidden bg-zinc-950 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[calc(max(0.75rem,env(safe-area-inset-top))+3rem)] md:h-[min(86vh,900px)] md:w-[min(92vw,1200px)] md:p-0"
              >
                <EventImagePreview
                  src={imageUrl}
                  alt={title}
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
          title={title}
          onClose={() => setMediaModal(null)}
        />
      </AnimatePresence>
    </>
  );
};
