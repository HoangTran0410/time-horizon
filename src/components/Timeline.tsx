import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  PLAYGROUND_COLLECTION,
  SYNCABLE_COLLECTION_IDS,
} from "../data/collections";
import { ThemeMode } from "../constants/theme";
import { Event, EventCollectionMeta } from "../constants/types";
import { CollectionEditor } from "./CollectionEditor";
import { EventEditor } from "./EventEditor";
import { Sidebar } from "./Sidebar";
import { Controller } from "./Controller";
import { ConfirmDialog, type ConfirmDialogOptions } from "./ConfirmDialog";
import { EventInfoPanel } from "./EventInfoPanel";
import { FpsBadge } from "./FpsBadge";
import { TimelineGuidanceOverlay } from "./TimelineGuidanceOverlay";
import { TimelineCanvasViewport } from "./TimelineCanvasViewport";
import { WarpOverlay } from "./TimelineMarkers";
import { createLocalDateStamp, createNewTimelineEvent } from "../helpers";
import { useTimelineCollections } from "../hooks/useTimelineCollections";
import { useTimelineViewport } from "../hooks/useTimelineViewport";
import {
  filterTimelineSearchEvents,
  findEventByIdInCollections,
  useTimelineStore,
} from "../stores";

interface TimelineProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
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

export const Timeline = ({ theme, onToggleTheme }: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpenRequestKey, setSidebarOpenRequestKey] = useState(0);
  const [exploreOpenRequestKey, setExploreOpenRequestKey] = useState(0);
  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogOptions | null>(null);
  const {
    selectedEventId,
    isRulerActive,
    isEventInfoCollapsed,
    editingEventId,
    addingEvent,
    addingCollectionId,
    isCreatingCollection,
    focusEvent,
    previewEvent,
    clearFocusedEvent,
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
      focusEvent: state.focusEvent,
      previewEvent: state.previewEvent,
      clearFocusedEvent: state.clearFocusedEvent,
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
    handleDeleteEvent,
    handleCreateCollection,
    handleSetCollectionColor,
  } = useTimelineCollections();
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
  } = useTimelineViewport({
    containerRef,
    renderedTimelineEvents,
    selectedEventId,
    onSelectEvent: (event) => {
      if (event) {
        focusEvent(event.id);
        return;
      }

      clearFocusedEvent();
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

    const rawCollections = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as CollectionTransferPayload).collections)
        ? (parsed as CollectionTransferPayload).collections
        : parsed && typeof parsed === "object" && "meta" in parsed
          ? [parsed]
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
        : PLAYGROUND_COLLECTION.id);

    if (resolvedTargetCollectionId === PLAYGROUND_COLLECTION.id) {
      ensurePlaygroundCollection();
      addVisibleCollection(PLAYGROUND_COLLECTION.id);
    }

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
    const nextCollection = handleCreateCollection(collection);
    openEventCreator(nextCollection.id);
    closeCollectionCreator();
  };

  const handleCloseAddEvent = () => {
    closeEventCreator();
  };

  const handlePreviewSidebarEvent = (event: Event) => {
    previewEvent(event.id);
  };

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
        onSetCollectionColor={handleSetCollectionColor}
        onDeleteCollection={handleSidebarDeleteCollection}
        onRequestConfirm={setConfirmDialog}
        onPreviewEvent={handlePreviewSidebarEvent}
        onDeleteEvent={handleDeleteTimelineEvent}
        onAddEvent={handleStartAddEvent}
        onAddCollection={openCollectionCreator}
        onImportCollections={handleImportCollectionFile}
        onExportCollection={handleExportCollection}
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
                : "Start by bringing in a collection."
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

      <FpsBadge
        logicFps={logicFps}
        renderFps={renderFps}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <Controller
        zoomRangeLabel={zoomRangeLabel}
        searchableEvents={timelineEvents}
        selectedEvent={selectedEventInfo}
        isRulerActive={isRulerActive}
        onQuickZoom={handleQuickZoom}
        onJumpToDate={handleJumpToDate}
        onSearchSelect={handleFocusEvent}
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
          onCreate={handleCreateNewCollection}
          onClose={closeCollectionCreator}
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
