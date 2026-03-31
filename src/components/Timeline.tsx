import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  SYNCABLE_COLLECTION_IDS,
  isSyncableCollection,
} from "../data/collections";
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
  useTimelineStore,
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
  const [sidebarOpenRequestKey, setSidebarOpenRequestKey] = useState(0);
  const [exploreOpenRequestKey, setExploreOpenRequestKey] = useState(0);
  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogOptions | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [pendingImportEvents, setPendingImportEvents] = useState<
    Event[] | null
  >(null);
  const [pendingImportDialog, setPendingImportDialog] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<EventCollectionMeta | null>(null);
  const {
    selectedEventId,
    isRulerActive,
    isEventInfoCollapsed,
    editingEventId,
    addingEvent,
    addingCollectionId,
    isCreatingCollection,
    savedFocusYear,
    savedLogZoom,
    focusEvent,
    previewEvent,
    clearFocusedEvent,
    setSavedViewport,
    setIsRulerActive,
    toggleEventInfoCollapsed,
    openEventEditor,
    closeEventEditor,
    openEventCreator,
    closeEventCreator,
    openCollectionCreator,
    closeCollectionCreator,
  } = useTimelineStore(
    useShallow((state) => ({
      selectedEventId: state.selectedEventId,
      isRulerActive: state.isRulerActive,
      isEventInfoCollapsed: state.isEventInfoCollapsed,
      editingEventId: state.editingEventId,
      addingEvent: state.addingEvent,
      addingCollectionId: state.addingCollectionId,
      isCreatingCollection: state.isCreatingCollection,
      savedFocusYear: state.savedFocusYear,
      savedLogZoom: state.savedLogZoom,
      focusEvent: state.focusEvent,
      previewEvent: state.previewEvent,
      clearFocusedEvent: state.clearFocusedEvent,
      setSavedViewport: state.setSavedViewport,
      setIsRulerActive: state.setIsRulerActive,
      toggleEventInfoCollapsed: state.toggleEventInfoCollapsed,
      openEventEditor: state.openEventEditor,
      closeEventEditor: state.closeEventEditor,
      openEventCreator: state.openEventCreator,
      closeEventCreator: state.closeEventCreator,
      openCollectionCreator: state.openCollectionCreator,
      closeCollectionCreator: state.closeCollectionCreator,
    })),
  );

  const {
    collections,
    collectionEventsById,
    visibleCollectionIds,
    downloadingCollectionIds,
    collectionColors,
    localCollectionIds,
    editableCollectionIds,
    writableCollections,
    timelineEvents,
    eventAccentColors,
    singleVisibleCollectionId,
    ensurePlaygroundCollection,
    addVisibleCollection,
    findEventCollectionId,
    handleDownloadCollection,
    handleSyncCollection,
    handleSetCollectionVisibility,
    handleImportCollections,
    handleDeleteCollection,
    handleSaveEvent,
    handleAddEvent,
    handleAddEvents,
    handleDeleteEvent,
    handleCreateCollection,
    handleUpdateCollection,
    handleSetCollectionColor,
  } = useTimelineCollections();
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

  const searchQuery = useTimelineStore((state) => state.searchQuery);
  const activeMediaFilters = useTimelineStore(
    (state) => state.activeMediaFilters,
  );
  const timeRangeStartInput = useTimelineStore(
    (state) => state.timeRangeStartInput,
  );
  const timeRangeEndInput = useTimelineStore(
    (state) => state.timeRangeEndInput,
  );
  const showOnlyResultsOnTimeline = useTimelineStore(
    (state) => state.showOnlyResultsOnTimeline,
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

  const handleSidebarDeleteCollection = (collection: EventCollectionMeta) => {
    handleDeleteCollection(collection.id);
  };

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

  const requestOpenCollections = () => {
    setSidebarOpenRequestKey((current) => current + 1);
  };

  const requestOpenExploreCollections = () => {
    setExploreOpenRequestKey((current) => current + 1);
  };

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

    const { importedCollectionIds } = handleImportCollections(rawCollections);
    if (importedCollectionIds.length === 0) {
      throw new Error(
        "The file loaded, but none of its collections matched the expected format.",
      );
    }

    requestOpenCollections();
    return `Imported ${importedCollectionIds.length} collection${importedCollectionIds.length === 1 ? "" : "s"}.`;
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

  const handleCreateEvent = (
    newEvent: Event,
    targetCollectionId?: string | null,
  ) => {
    const resolvedTargetCollectionId =
      targetCollectionId ?? addingCollectionId ?? singleVisibleCollectionId;
    if (!resolvedTargetCollectionId) return;

    handleAddEvent(newEvent, resolvedTargetCollectionId);
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
        handleDeleteEvent(event.id);
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
    handleSaveEvent(updatedEvent);
    closeEventEditor();
  };

  const handleCreateNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (pendingImportEvents) {
      handleImportEventsToNewCollection(collection);
    } else {
      const nextCollection = handleCreateCollection(collection);
      openEventCreator(nextCollection.id);
      closeCollectionCreator();
    }
  };

  const handleUpdateExistingCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (!editingCollection) return;

    handleUpdateCollection(editingCollection.id, collection);
    setEditingCollection(null);
  };

  const handleCloseAddEvent = () => {
    closeEventCreator();
  };

  const handleImportEventsToCollection = (targetCollectionId: string) => {
    if (!pendingImportEvents) return;
    handleAddEvents(pendingImportEvents, targetCollectionId);
    addVisibleCollection(targetCollectionId);
    setPendingImportEvents(null);
    setPendingImportDialog(false);
    requestOpenCollections();
  };

  const handleImportEventsToNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (!pendingImportEvents) return;
    const nextCollection = handleCreateCollection(collection);
    handleAddEvents(pendingImportEvents, nextCollection.id);
    addVisibleCollection(nextCollection.id);
    closeCollectionCreator();
    setPendingImportEvents(null);
    setPendingImportDialog(false);
    requestOpenCollections();
  };

  const handleCloseImportDialog = () => {
    closeCollectionCreator();
    setPendingImportEvents(null);
    setPendingImportDialog(false);
  };

  const sharedCollectionIdsFromUrl = useMemo(
    () => sharedCollectionIdsFromUrlRaw.filter(isSyncableCollection),
    [sharedCollectionIdsFromUrlRaw],
  );

  // Collections that are visible AND URL-shareable (i.e. can be restored from ?c= URL param).
  // Local collections are NOT shareable — they live in localStorage and are restored
  // on every load regardless of the URL. Only syncable (built-in) collections go in ?c=.
  const shareableVisibleCollectionIds = useMemo(
    () =>
      visibleCollectionIds.filter(
        (id) =>
          (collectionEventsById[id]?.length ?? 0) > 0 &&
          isSyncableCollection(id) &&
          !localCollectionIds.includes(id),
      ),
    [visibleCollectionIds, collectionEventsById, localCollectionIds],
  );
  const shareableSelectedEventId = useMemo(() => {
    if (!selectedEventInfo) return null;
    const selectedCollectionId = findEventCollectionId(selectedEventInfo.id);
    if (!selectedCollectionId) return null;
    if (!isSyncableCollection(selectedCollectionId)) return null;
    if (!shareableVisibleCollectionIds.includes(selectedCollectionId)) return null;
    return selectedEventInfo.id;
  }, [findEventCollectionId, selectedEventInfo, shareableVisibleCollectionIds]);

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

    for (const collectionId of visibleCollectionIds.filter(
      isSyncableCollection,
    )) {
      if (!requestedCollectionIds.has(collectionId)) {
        handleSetCollectionVisibility(collectionId, false);
      }
    }

    const applySharedUrl = async () => {
      await Promise.all(
        sharedCollectionIdsFromUrl.map((collectionId) =>
          handleDownloadCollection(collectionId),
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
    handleDownloadCollection,
    handleSetCollectionVisibility,
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
      <Sidebar
        collections={collections}
        onDownloadCollection={handleDownloadCollection}
        onSyncCollection={handleSyncCollection}
        syncableCollectionIds={SYNCABLE_COLLECTION_IDS}
        visibleCollectionIds={visibleCollectionIds}
        onSetCollectionVisibility={handleSetCollectionVisibility}
        downloadingCollectionIds={downloadingCollectionIds}
        collectionEventsById={collectionEventsById}
        collectionColors={collectionColors}
        localCollectionIds={localCollectionIds}
        onSetCollectionColor={handleSetCollectionColor}
        onDeleteCollection={handleSidebarDeleteCollection}
        onRequestConfirm={setConfirmDialog}
        onEditEvent={(event) => {
          openEventEditor(event.id);
        }}
        onDeleteEvent={handleDeleteTimelineEvent}
        editableCollectionIds={editableCollectionIds}
        onEditCollection={(collection) => setEditingCollection(collection)}
        onAddEvent={handleStartAddEvent}
        onAddCollection={openCollectionCreator}
        onImportCollections={handleImportCollectionFile}
        onExportCollection={handleExportCollection}
        onUpdateCollectionEvents={(collectionId, events) => {
          useTimelineStore.getState().deleteEvent // remove all existing
          // Delete existing events in collection then add new ones
          const state = useTimelineStore.getState();
          const existingIds = (state.collectionLibrary[collectionId]?.events ?? []).map(e => e.id);
          existingIds.forEach(id => useTimelineStore.getState().deleteEvent(id));
          if (events.length > 0) {
            useTimelineStore.getState().addEvents(events, collectionId);
          }
        }}
        onBackToLanding={onBackToLanding}
        openRequestKey={sidebarOpenRequestKey}
        openExploreRequestKey={exploreOpenRequestKey}
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
                  ? requestOpenCollections
                  : requestOpenExploreCollections,
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
          title={pendingImportEvents ? "New Collection for Import" : undefined}
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
    </>
  );
};
