import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText } from "lucide-react";
import { ThemeMode } from "../constants/theme";
import { Event, EventCollectionMeta } from "../constants/types";
import { CollectionEditor } from "./CollectionEditor";
import { EventEditor } from "./EventEditor";
import { Sidebar } from "./Sidebar";
import { Controller } from "./Controller";
import { ConfirmDialog, type ConfirmDialogOptions } from "./ConfirmDialog";
import { ShareModal } from "./ShareModal";
import { ImportEventsDialog } from "./ImportEventsDialog";
import { EventInfoPanel } from "./EventInfoPanel";
import { Toolbar } from "./Toolbar";
import { TimelineGuidanceOverlay } from "./TimelineGuidanceOverlay";
import { TimelineCanvasViewport } from "./TimelineCanvasViewport";
import { WarpOverlay } from "./TimelineMarkers";
import { createLocalDateStamp, createNewTimelineEvent } from "../helpers";
import { useTimelineCollections } from "../hooks/useTimelineCollections";
import { useTimelineShareUrl } from "../hooks/useTimelineShareUrl";
import { useTimelineViewport } from "../hooks/useTimelineViewport";
import {
  filterTimelineSearchEvents,
  findEventByIdInCollections,
  sanitizeImportedEvents,
  useStore,
} from "../stores";

interface TimelineProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onBackToLanding: () => void;
}

type CollectionTransferPayload = {
  version: number;
  source: "time-horizon";
  exportedAt: string;
  collections: Array<{
    meta: EventCollectionMeta;
    events: Event[];
    color?: string | null;
    visible?: boolean;
  }>;
};

export const Timeline = ({
  theme,
  onToggleTheme,
  onBackToLanding,
}: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogOptions | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [pendingImportEvents, setPendingImportEvents] = useState<
    Event[] | null
  >(null);
  const [pendingImportDialog, setPendingImportDialog] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<EventCollectionMeta | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // Store state — individual selectors avoid useShallow overhead
  const selectedEventId = useStore((s) => s.selectedEventId);
  const isRulerActive = useStore((s) => s.isRulerActive);
  const isEventInfoCollapsed = useStore((s) => s.isEventInfoCollapsed);
  const editingEventId = useStore((s) => s.editingEventId);
  const addingEvent = useStore((s) => s.addingEvent);
  const addingCollectionId = useStore((s) => s.addingCollectionId);
  const isCreatingCollection = useStore((s) => s.isCreatingCollection);
  const savedFocusYear = useStore((s) => s.savedFocusYear);
  const savedLogZoom = useStore((s) => s.savedLogZoom);
  const focusEvent = useStore((s) => s.focusEvent);
  const previewEvent = useStore((s) => s.previewEvent);
  const clearFocusedEvent = useStore((s) => s.clearFocusedEvent);
  const setSavedViewport = useStore((s) => s.setSavedViewport);
  const setIsRulerActive = useStore((s) => s.setIsRulerActive);
  const toggleEventInfoCollapsed = useStore((s) => s.toggleEventInfoCollapsed);
  const openEventEditor = useStore((s) => s.openEventEditor);
  const closeEventEditor = useStore((s) => s.closeEventEditor);
  const openEventCreator = useStore((s) => s.openEventCreator);
  const closeEventCreator = useStore((s) => s.closeEventCreator);
  const openCollectionCreator = useStore((s) => s.openCollectionCreator);
  const closeCollectionCreator = useStore((s) => s.closeCollectionCreator);
  const downloadingCollectionIds = useStore((s) => s.downloadingCollectionIds);
  const searchQuery = useStore((s) => s.searchQuery);
  const activeMediaFilters = useStore((s) => s.activeMediaFilters);
  const timeRangeStartInput = useStore((s) => s.timeRangeStartInput);
  const timeRangeEndInput = useStore((s) => s.timeRangeEndInput);
  const showOnlyResultsOnTimeline = useStore(
    (s) => s.showOnlyResultsOnTimeline,
  );

  const {
    collections,
    collectionEventsById,
    visibleCollectionIds,
    collectionColors,
    localCollectionIds,
    catalogCollectionIds,
    writableCollections,
    timelineEvents,
    eventAccentColors,
    singleVisibleCollectionId,
    findEventCollectionId,
    catalogMeta,
    editableCollectionIds,
  } = useTimelineCollections();

  const visibleCollections = collections.filter((c) =>
    visibleCollectionIds.includes(c.id),
  );

  // Store actions — call directly, no need to route through hook
  const addVisibleCollection = useStore((s) => s.addVisibleCollection);
  const downloadCollection = useStore((s) => s.downloadCollection);
  const syncCollection = useStore((s) => s.syncCollection);
  const setCollectionVisibility = useStore((s) => s.setCollectionVisibility);
  const importCollections = useStore((s) => s.importCollections);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const saveEvent = useStore((s) => s.saveEvent);
  const addEvent = useStore((s) => s.addEvent);
  const addEvents = useStore((s) => s.addEvents);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const createCollection = useStore((s) => s.createCollection);
  const updateCollection = useStore((s) => s.updateCollection);
  const setCollectionColor = useStore((s) => s.setCollectionColor);
  const openSidebar = useStore((s) => s.openSidebar);
  const openSidebarExplore = useStore((s) => s.openSidebarExplore);
  const {
    sharedCollectionIds: sharedCollectionIdsFromUrlRaw,
    sharedEventId: sharedEventIdFromUrl,
    sharedFocusYear,
    sharedLogZoom,
    generateShareUrl,
  } = useTimelineShareUrl();
  const selectedEventInfo = useMemo(
    () =>
      selectedEventId
        ? findEventByIdInCollections(collectionEventsById, selectedEventId)
        : null,
    [collectionEventsById, selectedEventId],
  );
  const editingEvent = useMemo(
    () =>
      editingEventId
        ? findEventByIdInCollections(collectionEventsById, editingEventId)
        : null,
    [collectionEventsById, editingEventId],
  );

  const deferredTimelineSearchQuery = useDeferredValue(searchQuery);
  const hasSharedTimelineState =
    sharedCollectionIdsFromUrlRaw.length > 0 ||
    sharedEventIdFromUrl !== null ||
    sharedFocusYear !== null ||
    sharedLogZoom !== null;

  const renderedTimelineEvents = useMemo(
    () =>
      showOnlyResultsOnTimeline
        ? filterTimelineSearchEvents(
            timelineEvents,
            deferredTimelineSearchQuery,
            activeMediaFilters,
            {
              startTimeInput: timeRangeStartInput,
              endTimeInput: timeRangeEndInput,
            },
          )
        : timelineEvents,
    [
      activeMediaFilters,
      deferredTimelineSearchQuery,
      showOnlyResultsOnTimeline,
      timeRangeEndInput,
      timeRangeStartInput,
      timelineEvents,
    ],
  );

  const {
    focusPixel,
    focusYear,
    zoom,
    ticks,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds,
    eventLayouts,
    logicFps,
    renderFps,
    zoomRangeLabel,
    zoomTrackRef,
    zoomThumbY,
    isViewportBeforeBigBang,
    isWarping,
    warpMode,
    warpDirection,
    recordRenderFrame,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeClickSuppression,
    handleFocusBigBang,
    handleFocusEvent,
    handleFocusCollapsedGroup,
    handleAutoFit,
    handleAutoFitRange,
    handleQuickZoom,
    handleJumpToDate,
    handleZoomDragStart,
    handleZoomDragMove,
    handleZoomDragEnd,
    clearFocusedEvent: clearFocusedEventFromViewport,
    currentLogZoom,
    hasBootstrappedRef,
  } = useTimelineViewport({
    containerRef,
    renderedTimelineEvents,
    selectedEventId,
    initialFocusYear: hasSharedTimelineState
      ? (sharedFocusYear ?? undefined)
      : (savedFocusYear ?? undefined),
    initialLogZoom: hasSharedTimelineState
      ? (sharedLogZoom ?? undefined)
      : (savedLogZoom ?? undefined),
    onSelectEvent: (event) => {
      if (event) {
        focusEvent(event.id);
        return;
      }

      clearFocusedEvent();
    },
    onViewportChange: ({ focusYear, logZoom }) => {
      setSavedViewport(focusYear, logZoom);
    },
    setIsRulerActive,
  });

  // Auto-fit when user toggles collection visibility in Sidebar
  useEffect(() => {
    if (!hasBootstrappedRef.current) return;
    // Defer to next frame so events have finished rendering first
    requestAnimationFrame(() => handleAutoFit(false));
  }, [visibleCollectionIds]);

  const downloadedCollectionIds = useMemo(
    () => Object.keys(collectionEventsById),
    [collectionEventsById],
  );
  const hiddenDownloadedCollectionIds = useMemo(
    () =>
      downloadedCollectionIds.filter(
        (collectionId) => !visibleCollectionIds.includes(collectionId),
      ),
    [downloadedCollectionIds, visibleCollectionIds],
  );
  const shouldShowEmptyTimelineGuidance =
    !isViewportBeforeBigBang && timelineEvents.length === 0;

  const handleExportCollection = (collectionId: string) => {
    const collectionMeta = collections.find(
      (collection) => collection.id === collectionId,
    );
    if (!collectionMeta) {
      throw new Error("That collection could not be found for export.");
    }

    if (
      !Object.prototype.hasOwnProperty.call(collectionEventsById, collectionId)
    ) {
      throw new Error("Only downloaded collections can be exported.");
    }

    const payload: CollectionTransferPayload = {
      version: 1,
      source: "time-horizon",
      exportedAt: new Date().toISOString(),
      collections: [
        {
          meta: collectionMeta,
          events: collectionEventsById[collectionId] ?? [],
          color: collectionColors[collectionId] ?? null,
          visible: visibleCollectionIds.includes(collectionId),
        },
      ],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${collectionMeta.id}-${createLocalDateStamp()}.json`;
    link.click();
    URL.revokeObjectURL(blobUrl);

    return `Exported "${collectionMeta.name}".`;
  };

  const handleImportCollectionFile = async (file: File) => {
    const rawText = await file.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("That file is not valid JSON.");
    }

    // Detect flat array of events (no "meta" field on items)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as Record<string, unknown>;
      const isFlatEventArray =
        first &&
        typeof first === "object" &&
        "time" in first &&
        "title" in first &&
        !("meta" in first);

      if (isFlatEventArray) {
        const events = sanitizeImportedEvents(parsed);
        if (events.length === 0) {
          throw new Error(
            "The file loaded, but none of its events matched the expected format.",
          );
        }
        setPendingImportEvents(events);
        setPendingImportDialog(true);
        return;
      }
    }

    const rawCollections = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? "collections" in parsed &&
          Array.isArray((parsed as CollectionTransferPayload).collections)
          ? (parsed as CollectionTransferPayload).collections
          : "meta" in parsed && "events" in parsed
            ? [parsed]
            : []
        : [];

    if (rawCollections.length === 0) {
      throw new Error(
        "No collections were found in that file. Export from Time Horizon and try again.",
      );
    }

    const { importedCollectionIds } = importCollections(rawCollections);
    if (importedCollectionIds.length === 0) {
      throw new Error(
        "The file loaded, but none of its collections matched the expected format.",
      );
    }

    openSidebar();
    return `Imported ${importedCollectionIds.length} collection${importedCollectionIds.length === 1 ? "" : "s"}.`;
  };

  // ── Full-page drag-and-drop ───────────────────────────────────────────────
  const handleFileDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDraggingFile(true);
  };

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files"))
      e.dataTransfer.dropEffect = "copy";
  };

  const handleFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setIsDraggingFile(false);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      await handleImportCollectionFile(file);
    } catch (error) {
      // silent — error is handled inside handleImportCollectionFile via store toast
      console.error(error);
    }
  };

  const handleStartAddEvent = (targetCollectionId?: string) => {
    const resolvedTargetCollectionId =
      targetCollectionId ??
      (visibleCollectionIds.length === 1 &&
      Object.prototype.hasOwnProperty.call(
        collectionEventsById,
        visibleCollectionIds[0],
      )
        ? visibleCollectionIds[0]
        : null);

    openEventCreator(resolvedTargetCollectionId);
  };

  const handleEditCollection = (collection: EventCollectionMeta) => {
    setEditingCollection(collection);
  };

  const handleCreateEvent = (
    newEvent: Event,
    targetCollectionId?: string | null,
  ) => {
    const resolvedTargetCollectionId =
      targetCollectionId ?? addingCollectionId ?? singleVisibleCollectionId;
    if (!resolvedTargetCollectionId) return;

    addEvent(newEvent, resolvedTargetCollectionId);
    closeEventCreator();
  };

  const handleDeleteTimelineEvent = (event: Event) => {
    const ownerCollectionId = findEventCollectionId(event.id);
    if (!ownerCollectionId) return;

    const ownerCollection = collections.find(
      (collection) => collection.id === ownerCollectionId,
    );
    const confirmationMessage = ownerCollection
      ? `This will remove "${event.title}" from "${ownerCollection.name}".`
      : `This will remove "${event.title}".`;

    setConfirmDialog({
      title: "Delete event?",
      description: confirmationMessage,
      confirmLabel: "Delete Event",
      tone: "danger",
      onConfirm: () => {
        deleteEvent(event.id);
      },
    });
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const handleConfirmDialog = () => {
    if (!confirmDialog) return;

    const { onConfirm } = confirmDialog;
    setConfirmDialog(null);
    onConfirm();
  };

  const handleUpdateEvent = (updatedEvent: Event) => {
    saveEvent(updatedEvent);
    closeEventEditor();
  };

  const handleCreateNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (pendingImportEvents) {
      handleImportEventsToNewCollection(collection);
    } else {
      const nextCollection = createCollection(collection);
      openEventCreator(nextCollection.id);
      closeCollectionCreator();
    }
  };

  const handleUpdateExistingCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (!editingCollection) return;

    updateCollection(editingCollection.id, collection);
    setEditingCollection(null);
  };

  const handleCloseAddEvent = () => {
    closeEventCreator();
  };

  const handleImportEventsToCollection = (targetCollectionId: string) => {
    if (!pendingImportEvents) return;
    addEvents(pendingImportEvents, targetCollectionId);
    addVisibleCollection(targetCollectionId);
    setPendingImportEvents(null);
    setPendingImportDialog(false);
    openSidebar();
  };

  const handleImportEventsToNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (!pendingImportEvents) return;
    const nextCollection = createCollection(collection);
    addEvents(pendingImportEvents, nextCollection.id);
    addVisibleCollection(nextCollection.id);
    closeCollectionCreator();
    setPendingImportEvents(null);
    setPendingImportDialog(false);
    openSidebar();
  };

  const handleCloseImportDialog = () => {
    closeCollectionCreator();
    setPendingImportEvents(null);
    setPendingImportDialog(false);
  };

  const sharedCollectionIdsFromUrl = useMemo(
    () =>
      sharedCollectionIdsFromUrlRaw.filter((id) =>
        catalogCollectionIds.has(id),
      ),
    [sharedCollectionIdsFromUrlRaw, catalogCollectionIds],
  );

  // Collections that are visible AND URL-shareable (i.e. can be restored from ?c= URL param).
  // Local collections are NOT shareable — they live in localStorage and are restored
  // on every load regardless of the URL. Only catalog collections go in ?c=.
  const shareableVisibleCollectionIds = useMemo(
    () =>
      visibleCollectionIds.filter(
        (id) =>
          (collectionEventsById[id]?.length ?? 0) > 0 &&
          catalogCollectionIds.has(id) &&
          !localCollectionIds.includes(id),
      ),
    [
      visibleCollectionIds,
      collectionEventsById,
      localCollectionIds,
      catalogCollectionIds,
    ],
  );
  const shareableSelectedEventId = useMemo(() => {
    if (!selectedEventInfo) return null;
    const selectedCollectionId = findEventCollectionId(selectedEventInfo.id);
    if (!selectedCollectionId) return null;
    if (!catalogCollectionIds.has(selectedCollectionId)) return null;
    if (!shareableVisibleCollectionIds.includes(selectedCollectionId))
      return null;
    return selectedEventInfo.id;
  }, [
    findEventCollectionId,
    selectedEventInfo,
    shareableVisibleCollectionIds,
    catalogCollectionIds,
  ]);

  const sharedUrlSignature = useMemo(
    () =>
      `${sharedCollectionIdsFromUrl.join(",")}::${sharedEventIdFromUrl ?? ""}`,
    [sharedCollectionIdsFromUrl, sharedEventIdFromUrl],
  );
  const lastAppliedSharedUrlSignatureRef = useRef<string | null>(null);
  const sharedUrlFocusFrameRef = useRef<number | null>(null);
  const sharedUrlFocusRequestedSignatureRef = useRef<string | null>(null);
  const [isApplyingSharedUrl, setIsApplyingSharedUrl] = useState(false);
  const [
    sharedUrlCollectionsReadySignature,
    setSharedUrlCollectionsReadySignature,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (lastAppliedSharedUrlSignatureRef.current === sharedUrlSignature) {
      return;
    }

    if (
      sharedCollectionIdsFromUrl.length === 0 &&
      sharedEventIdFromUrl === null
    ) {
      if (sharedUrlFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
        sharedUrlFocusFrameRef.current = null;
      }
      sharedUrlFocusRequestedSignatureRef.current = null;
      setSharedUrlCollectionsReadySignature(null);
      lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
      setIsApplyingSharedUrl(false);
      return;
    }

    let isCancelled = false;
    const requestedCollectionIds = new Set(sharedCollectionIdsFromUrl);
    setIsApplyingSharedUrl(true);
    setSharedUrlCollectionsReadySignature(null);
    sharedUrlFocusRequestedSignatureRef.current = null;

    if (sharedUrlFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
      sharedUrlFocusFrameRef.current = null;
    }

    for (const collectionId of visibleCollectionIds.filter((id) =>
      catalogCollectionIds.has(id),
    )) {
      if (!requestedCollectionIds.has(collectionId)) {
        setCollectionVisibility(collectionId, false);
      }
    }

    const applySharedUrl = async () => {
      await Promise.all(
        sharedCollectionIdsFromUrl.map((collectionId) =>
          downloadCollection(collectionId),
        ),
      );

      if (isCancelled) return;
      setSharedUrlCollectionsReadySignature(sharedUrlSignature);
    };

    void applySharedUrl();

    return () => {
      isCancelled = true;
    };
  }, [
    downloadCollection,
    setCollectionVisibility,
    sharedEventIdFromUrl,
    sharedCollectionIdsFromUrl,
    sharedUrlSignature,
    visibleCollectionIds,
  ]);

  useEffect(() => {
    if (!isApplyingSharedUrl) {
      return;
    }

    if (sharedUrlCollectionsReadySignature !== sharedUrlSignature) {
      return;
    }

    const hasRequestedCollectionsLoaded = sharedCollectionIdsFromUrl.every(
      (collectionId) =>
        Object.prototype.hasOwnProperty.call(
          collectionEventsById,
          collectionId,
        ),
    );
    const hasRequestedCollectionsVisible = sharedCollectionIdsFromUrl.every(
      (collectionId) => visibleCollectionIds.includes(collectionId),
    );

    if (!hasRequestedCollectionsLoaded || !hasRequestedCollectionsVisible) {
      return;
    }

    if (sharedEventIdFromUrl) {
      const sharedEvent = findEventByIdInCollections(
        collectionEventsById,
        sharedEventIdFromUrl,
      );

      if (!sharedEvent) {
        sharedUrlFocusRequestedSignatureRef.current = null;
        setSharedUrlCollectionsReadySignature(null);
        lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
        setIsApplyingSharedUrl(false);
        return;
      }

      if (sharedUrlFocusRequestedSignatureRef.current !== sharedUrlSignature) {
        sharedUrlFocusRequestedSignatureRef.current = sharedUrlSignature;
        previewEvent(sharedEvent.id);

        if (sharedUrlFocusFrameRef.current !== null) {
          window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
        }

        sharedUrlFocusFrameRef.current = window.requestAnimationFrame(() => {
          sharedUrlFocusFrameRef.current = null;
          handleFocusEvent(sharedEvent);
        });
      }

      if (selectedEventId !== sharedEvent.id) {
        return;
      }
    }

    sharedUrlFocusRequestedSignatureRef.current = null;
    setSharedUrlCollectionsReadySignature(null);
    lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
    setIsApplyingSharedUrl(false);
  }, [
    collectionEventsById,
    handleFocusEvent,
    isApplyingSharedUrl,
    previewEvent,
    selectedEventId,
    sharedCollectionIdsFromUrl,
    sharedEventIdFromUrl,
    sharedUrlCollectionsReadySignature,
    sharedUrlSignature,
    visibleCollectionIds,
  ]);

  useEffect(
    () => () => {
      if (sharedUrlFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
      }
    },
    [],
  );

  return (
    <>
      {isDraggingFile && (
        <div
          onDragEnter={handleFileDragEnter}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
          className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
        >
          <div className="pointer-events-auto flex h-full w-full items-center justify-center rounded-[2rem] border-2 border-dashed border-emerald-400/70 bg-emerald-950/85 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/15">
                <FileText size={36} className="text-emerald-300" />
              </div>
              <div>
                <div className="text-[1.15rem] font-semibold text-emerald-100">
                  Drop to import
                </div>
                <div className="mt-1 text-[0.85rem] text-emerald-300/70">
                  Time Horizon collection file (.json)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        onDragEnter={handleFileDragEnter}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
        className="contents"
      >
        <Sidebar
          collections={collections}
          syncableCollectionIds={Array.from(catalogCollectionIds)}
          editableCollectionIds={editableCollectionIds}
          onEditEvent={(event) => {
            openEventEditor(event.id);
          }}
          onDeleteEvent={handleDeleteTimelineEvent}
          onAddEvent={handleStartAddEvent}
          onAddCollection={openCollectionCreator}
          onImportCollections={handleImportCollectionFile}
          onExportCollection={handleExportCollection}
          onEditCollection={handleEditCollection}
          onUpdateCollectionEvents={(collectionId, events) => {
            const state = useStore.getState();
            const existingIds = (
              state.collectionLibrary[collectionId]?.events ?? []
            ).map((e) => e.id);
            existingIds.forEach((id) => useStore.getState().deleteEvent(id));
            if (events.length > 0) {
              useStore.getState().addEvents(events, collectionId);
            }
          }}
          onBackToLanding={onBackToLanding}
        />

        {shouldShowEmptyTimelineGuidance ? (
          <TimelineGuidanceOverlay
            eyebrow="Timeline Empty"
            title={
              hiddenDownloadedCollectionIds.length > 0
                ? "Nothing is visible right now."
                : downloadedCollectionIds.length > 0
                  ? "Your visible timeline is empty."
                  : "Welcome to Time Horizon."
            }
            description={
              hiddenDownloadedCollectionIds.length > 0
                ? `You already have ${hiddenDownloadedCollectionIds.length} collection${
                    hiddenDownloadedCollectionIds.length === 1 ? "" : "s"
                  } downloaded, but they are currently hidden from the timeline.`
                : downloadedCollectionIds.length > 0
                  ? "Open the collections panel to browse what is installed, toggle visibility, or pull in a different collection."
                  : "Browse the catalog or import a collection file to populate the timeline with events."
            }
            actions={[
              {
                label:
                  downloadedCollectionIds.length > 0
                    ? "Open Collections"
                    : "Browse Collections",
                onClick:
                  downloadedCollectionIds.length > 0 ||
                  hiddenDownloadedCollectionIds.length > 0
                    ? openSidebar
                    : openSidebarExplore,
              },
            ]}
          />
        ) : null}

        {isViewportBeforeBigBang ? (
          <TimelineGuidanceOverlay
            eyebrow="Beyond Big Bang"
            position="top"
            title="There is nothing earlier than this horizon."
            description="You have moved the camera before the beginning of this timeline, so ticks and events stop rendering here. Jump back to the Big Bang to continue exploring."
            actions={[
              {
                label: "Return To Big Bang",
                onClick: handleFocusBigBang,
              },
            ]}
          />
        ) : null}

        <TimelineCanvasViewport
          theme={theme}
          containerRef={containerRef}
          focusPixel={focusPixel}
          focusYear={focusYear}
          zoom={zoom}
          ticks={ticks}
          timelineEvents={renderedTimelineEvents}
          collapsedGroups={collapsedGroups}
          expandedCollapsedGroup={expandedCollapsedGroup}
          visibleBounds={visibleBounds}
          eventLayouts={eventLayouts}
          focusedEventId={selectedEventInfo?.id ?? null}
          rulerEvent={isRulerActive ? selectedEventInfo : null}
          eventAccentColors={eventAccentColors}
          onRenderFrame={recordRenderFrame}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          consumeClickSuppression={consumeClickSuppression}
          onFocusBigBang={handleFocusBigBang}
          onFocusEvent={handleFocusEvent}
          onFocusCollapsedGroup={handleFocusCollapsedGroup}
        />

        <Toolbar
          logicFps={logicFps}
          renderFps={renderFps}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onShare={() => setShareModalOpen(true)}
        />

        <Controller
          zoomRangeLabel={zoomRangeLabel}
          searchableEvents={timelineEvents}
          selectedEvent={selectedEventInfo}
          visibleCollections={visibleCollections}
          collectionEventsById={collectionEventsById}
          isRulerActive={isRulerActive}
          onQuickZoom={handleQuickZoom}
          onJumpToDate={handleJumpToDate}
          onSearchSelect={handleFocusEvent}
          onEditEvent={(event) => {
            openEventEditor(event.id);
          }}
          onDeleteEvent={handleDeleteTimelineEvent}
          onAutoFitAll={() => handleAutoFit()}
          onAutoFitRange={handleAutoFitRange}
          onFocusSelectedEvent={() => {
            if (selectedEventInfo) {
              handleFocusEvent(selectedEventInfo);
            }
          }}
          onEditSelectedEvent={() => {
            if (selectedEventInfo) {
              openEventEditor(selectedEventInfo.id);
            }
          }}
          onDeleteSelectedEvent={() => {
            if (selectedEventInfo) {
              handleDeleteTimelineEvent(selectedEventInfo);
            }
          }}
          onToggleSelectedEventRuler={() => {
            setIsRulerActive(!isRulerActive);
          }}
          onCloseSelectedEvent={clearFocusedEventFromViewport}
          zoomTrackRef={zoomTrackRef}
          zoomThumbY={zoomThumbY}
          onZoomDragStart={handleZoomDragStart}
          onZoomDragMove={handleZoomDragMove}
          onZoomDragEnd={handleZoomDragEnd}
        />

        {selectedEventInfo && (
          <EventInfoPanel
            event={selectedEventInfo}
            isRulerActive={isRulerActive}
            isCollapsed={isEventInfoCollapsed}
            hideOnMobile
            onFocus={() => {
              handleFocusEvent(selectedEventInfo);
            }}
            onEdit={() => {
              openEventEditor(selectedEventInfo.id);
            }}
            onDelete={() => handleDeleteTimelineEvent(selectedEventInfo)}
            onToggleRuler={() => {
              setIsRulerActive(!isRulerActive);
            }}
            onToggleCollapsed={() => {
              toggleEventInfoCollapsed();
            }}
            onClose={clearFocusedEventFromViewport}
          />
        )}

        {editingEvent && (
          <EventEditor
            mode="edit"
            event={editingEvent}
            onSave={handleUpdateEvent}
            onClose={closeEventEditor}
          />
        )}

        {addingEvent && (
          <EventEditor
            mode="create"
            event={createNewTimelineEvent()}
            availableCollections={writableCollections}
            initialCollectionId={addingCollectionId}
            onAddCollection={openCollectionCreator}
            onSave={handleCreateEvent}
            onClose={handleCloseAddEvent}
          />
        )}

        {isCreatingCollection && (
          <CollectionEditor
            mode="create"
            onSubmit={handleCreateNewCollection}
            onClose={handleCloseImportDialog}
            title={
              pendingImportEvents ? "New Collection for Import" : undefined
            }
          />
        )}

        {editingCollection && (
          <CollectionEditor
            mode="edit"
            initialValue={{
              emoji: editingCollection.emoji,
              name: editingCollection.name,
              description: editingCollection.description,
            }}
            onSubmit={handleUpdateExistingCollection}
            onClose={() => setEditingCollection(null)}
            title="Edit Collection"
          />
        )}

        {shareModalOpen && (
          <ShareModal
            focusYear={focusYear.get()}
            logZoom={currentLogZoom.get()}
            selectedEventId={shareableSelectedEventId}
            visibleCollectionIds={shareableVisibleCollectionIds}
            collectionNames={Object.fromEntries(
              shareableVisibleCollectionIds.map((id) => {
                const collection = collections.find((c) => c.id === id);
                return [id, collection?.name ?? id];
              }),
            )}
            onGenerateUrl={(opts) =>
              generateShareUrl({
                // Website is always included — share links always open timeline directly
                includeWebsite: true,
                includeCollections: opts.includeCollections,
                includeSelectedEvent: opts.includeSelectedEvent,
                includeViewport: opts.includeViewport,
                // Only syncable collections can be restored from ?c= URL param.
                // Local collections are persisted separately in localStorage.
                collectionIds: shareableVisibleCollectionIds,
                focusYear: focusYear.get(),
                logZoom: currentLogZoom.get(),
                overrideEventId: opts.includeSelectedEvent
                  ? shareableSelectedEventId
                  : null,
              })
            }
            onClose={() => setShareModalOpen(false)}
          />
        )}

        <ConfirmDialog
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog?.title ?? ""}
          description={confirmDialog?.description ?? ""}
          confirmLabel={confirmDialog?.confirmLabel}
          cancelLabel={confirmDialog?.cancelLabel}
          tone={confirmDialog?.tone}
          onConfirm={handleConfirmDialog}
          onCancel={handleCloseConfirmDialog}
        />

        {pendingImportDialog && (
          <ImportEventsDialog
            eventCount={pendingImportEvents?.length ?? 0}
            collections={writableCollections}
            onImportToCollection={handleImportEventsToCollection}
            onCreateNewCollection={() => {
              setPendingImportDialog(false);
              openCollectionCreator();
            }}
            onCancel={handleCloseImportDialog}
          />
        )}

        <WarpOverlay
          isWarping={isWarping}
          mode={warpMode}
          direction={warpDirection}
          theme={theme}
          zoom={zoom}
          zoomPivotX={focusPixel}
        />
      </div>
    </>
  );
};
