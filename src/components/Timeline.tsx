import { useDeferredValue, useMemo, useRef, useState } from "react";
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
import { EventInfoPanel } from "./EventInfoPanel";
import { FpsBadge } from "./FpsBadge";
import { TimelineCanvasViewport } from "./TimelineCanvasViewport";
import { WarpOverlay } from "./TimelineMarkers";
import { createNewTimelineEvent } from "../helpers";
import { useTimelineCollections } from "../hooks/useTimelineCollections";
import { useTimelineViewport } from "../hooks/useTimelineViewport";
import {
  filterTimelineSearchEvents,
  useTimelineSearchStore,
} from "../stores/timelineSearchStore";

interface TimelineProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Timeline = ({ theme, onToggleTheme }: TimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedEventInfo, setSelectedEventInfo] = useState<Event | null>(
    null,
  );
  const [isRulerActive, setIsRulerActive] = useState(false);
  const [isEventInfoCollapsed, setIsEventInfoCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [addingCollectionId, setAddingCollectionId] = useState<string | null>(
    null,
  );
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const {
    collections,
    collectionEventsById,
    visibleCollectionIds,
    downloadingCollectionIds,
    collectionColorPreferences,
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
    handleDeleteCollection,
    handleSaveEvent,
    handleAddEvent,
    handleCreateCollection,
    handleSetCollectionColor,
    handleResetCollectionColor,
  } = useTimelineCollections();

  const searchQuery = useTimelineSearchStore((state) => state.searchQuery);
  const activeMediaFilters = useTimelineSearchStore(
    (state) => state.activeMediaFilters,
  );
  const showOnlyResultsOnTimeline = useTimelineSearchStore(
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
          )
        : timelineEvents,
    [
      activeMediaFilters,
      deferredTimelineSearchQuery,
      showOnlyResultsOnTimeline,
      timelineEvents,
    ],
  );

  const {
    focusPixel,
    focusYear,
    zoom,
    ticks,
    collapsedGroups,
    visibleBounds,
    eventLayouts,
    logicFps,
    renderFps,
    zoomRangeLabel,
    zoomTrackRef,
    zoomThumbY,
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
    clearFocusedEvent,
  } = useTimelineViewport({
    containerRef,
    renderedTimelineEvents,
    selectedEventId: selectedEventInfo?.id ?? null,
    setSelectedEventInfo,
    setIsRulerActive,
  });

  const handleSidebarDeleteCollection = (collection: EventCollectionMeta) => {
    const selectedInCollection =
      selectedEventInfo &&
      findEventCollectionId(selectedEventInfo.id) === collection.id;
    const editingInCollection =
      editingEvent && findEventCollectionId(editingEvent.id) === collection.id;

    handleDeleteCollection(collection.id);

    if (selectedInCollection) {
      clearFocusedEvent();
    }
    if (editingInCollection) {
      setEditingEvent(null);
    }
    if (addingCollectionId === collection.id) {
      setAddingCollectionId(null);
      setAddingEvent(false);
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
        : PLAYGROUND_COLLECTION.id);

    if (resolvedTargetCollectionId === PLAYGROUND_COLLECTION.id) {
      ensurePlaygroundCollection();
      addVisibleCollection(PLAYGROUND_COLLECTION.id);
    }

    setAddingCollectionId(resolvedTargetCollectionId);
    setAddingEvent(true);
  };

  const handleCreateEvent = (
    newEvent: Event,
    targetCollectionId?: string | null,
  ) => {
    const resolvedTargetCollectionId =
      targetCollectionId ?? addingCollectionId ?? singleVisibleCollectionId;
    if (!resolvedTargetCollectionId) return;

    handleAddEvent(newEvent, resolvedTargetCollectionId);
    setAddingCollectionId(null);
    setAddingEvent(false);
  };

  const handleUpdateEvent = (updatedEvent: Event) => {
    handleSaveEvent(updatedEvent);
    setEditingEvent(null);
    setAddingEvent(false);
  };

  const handleCreateNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    const nextCollection = handleCreateCollection(collection);
    setAddingCollectionId(nextCollection.id);
    setAddingEvent(true);
    setIsCreatingCollection(false);
  };

  const handleCloseAddEvent = () => {
    setAddingCollectionId(null);
    setAddingEvent(false);
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
        collectionColorPreferences={collectionColorPreferences}
        onSetCollectionColor={handleSetCollectionColor}
        onResetCollectionColor={handleResetCollectionColor}
        onDeleteCollection={handleSidebarDeleteCollection}
        onFocusEvent={handleFocusEvent}
        onEditEvent={setEditingEvent}
        onAddEvent={handleStartAddEvent}
        onAddCollection={() => setIsCreatingCollection(true)}
      />

      <TimelineCanvasViewport
        theme={theme}
        containerRef={containerRef}
        focusPixel={focusPixel}
        focusYear={focusYear}
        zoom={zoom}
        ticks={ticks}
        timelineEvents={renderedTimelineEvents}
        collapsedGroups={collapsedGroups}
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
        onQuickZoom={handleQuickZoom}
        onJumpToDate={handleJumpToDate}
        onSearchSelect={handleFocusEvent}
        onAutoFitAll={() => handleAutoFit()}
        onAutoFitRange={handleAutoFitRange}
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
          onFocus={() => {
            handleFocusEvent(selectedEventInfo);
          }}
          onEdit={() => {
            setEditingEvent(selectedEventInfo);
            clearFocusedEvent();
          }}
          onToggleRuler={() => {
            setIsRulerActive((prev) => !prev);
          }}
          onToggleCollapsed={() => {
            setIsEventInfoCollapsed((prev) => !prev);
          }}
          onClose={clearFocusedEvent}
        />
      )}

      {editingEvent && (
        <EventEditor
          mode="edit"
          event={editingEvent}
          onSave={handleUpdateEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {addingEvent && (
        <EventEditor
          mode="create"
          event={createNewTimelineEvent()}
          availableCollections={writableCollections}
          initialCollectionId={addingCollectionId}
          onAddCollection={() => setIsCreatingCollection(true)}
          onSave={handleCreateEvent}
          onClose={handleCloseAddEvent}
        />
      )}

      {isCreatingCollection && (
        <CollectionEditor
          onCreate={handleCreateNewCollection}
          onClose={() => setIsCreatingCollection(false)}
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
