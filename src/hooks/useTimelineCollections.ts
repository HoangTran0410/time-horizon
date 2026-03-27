import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { EVENT_COLLECTIONS, PLAYGROUND_COLLECTION } from "../data/collections";
import { useTimelineStore } from "../stores";
import { findEventCollectionIdInCollections } from "../stores";

export const useTimelineCollections = () => {
  const {
    customCollections,
    collectionEventsById,
    visibleCollectionIds,
    downloadingCollectionIds,
    collectionColorPreferences,
  } = useTimelineStore(
    useShallow((state) => ({
      customCollections: state.customCollections,
      collectionEventsById: state.collectionEventsById,
      visibleCollectionIds: state.visibleCollectionIds,
      downloadingCollectionIds: state.downloadingCollectionIds,
      collectionColorPreferences: state.collectionColorPreferences,
    })),
  );

  const {
    addVisibleCollection,
    ensurePlaygroundCollection,
    downloadCollection,
    syncCollection,
    setCollectionVisibility,
    deleteCollection,
    saveEvent,
    addEvent,
    deleteEvent,
    createCollection,
    setCollectionColor,
    resetCollectionColor,
  } = useTimelineStore(
    useShallow((state) => ({
      addVisibleCollection: state.addVisibleCollection,
      ensurePlaygroundCollection: state.ensurePlaygroundCollection,
      downloadCollection: state.downloadCollection,
      syncCollection: state.syncCollection,
      setCollectionVisibility: state.setCollectionVisibility,
      deleteCollection: state.deleteCollection,
      saveEvent: state.saveEvent,
      addEvent: state.addEvent,
      deleteEvent: state.deleteEvent,
      createCollection: state.createCollection,
      setCollectionColor: state.setCollectionColor,
      resetCollectionColor: state.resetCollectionColor,
    })),
  );

  const collections = useMemo(
    () =>
      Object.prototype.hasOwnProperty.call(
        collectionEventsById,
        PLAYGROUND_COLLECTION.id,
      )
        ? [...EVENT_COLLECTIONS, ...customCollections, PLAYGROUND_COLLECTION]
        : [...EVENT_COLLECTIONS, ...customCollections],
    [collectionEventsById, customCollections],
  );

  const writableCollections = useMemo(
    () =>
      collections.filter((collection) =>
        Object.prototype.hasOwnProperty.call(
          collectionEventsById,
          collection.id,
        ),
      ),
    [collectionEventsById, collections],
  );

  const collectionColors = useMemo(
    () =>
      Object.fromEntries(
        collections.map((collection) => [
          collection.id,
          collectionColorPreferences[collection.id] ?? collection.color ?? null,
        ]),
      ) as Record<string, string | null>,
    [collectionColorPreferences, collections],
  );

  const timelineEvents = useMemo(
    () =>
      collections
        .filter((collection) => visibleCollectionIds.includes(collection.id))
        .flatMap((collection) => collectionEventsById[collection.id] ?? []),
    [collectionEventsById, collections, visibleCollectionIds],
  );

  const eventAccentColors = useMemo(() => {
    const colors: Record<string, string | null> = {};
    for (const collectionId of visibleCollectionIds) {
      const events = collectionEventsById[collectionId] ?? [];
      const collectionColor = collectionColors[collectionId];
      for (const event of events) {
        colors[event.id] = collectionColor ?? event.color ?? null;
      }
    }

    return colors;
  }, [collectionColors, collectionEventsById, visibleCollectionIds]);

  const singleVisibleCollectionId =
    visibleCollectionIds.length === 1 ? visibleCollectionIds[0] : null;

  const findEventCollectionId = (eventId: string) =>
    findEventCollectionIdInCollections(collectionEventsById, eventId);

  return {
    collectionEventsById,
    visibleCollectionIds,
    downloadingCollectionIds,
    collectionColorPreferences,
    collections,
    writableCollections,
    collectionColors,
    timelineEvents,
    eventAccentColors,
    singleVisibleCollectionId,
    addVisibleCollection,
    ensurePlaygroundCollection,
    findEventCollectionId,
    handleDownloadCollection: downloadCollection,
    handleSyncCollection: syncCollection,
    handleSetCollectionVisibility: setCollectionVisibility,
    handleDeleteCollection: deleteCollection,
    handleSaveEvent: saveEvent,
    handleAddEvent: addEvent,
    handleDeleteEvent: deleteEvent,
    handleCreateCollection: createCollection,
    handleSetCollectionColor: setCollectionColor,
    handleResetCollectionColor: resetCollectionColor,
  };
};
