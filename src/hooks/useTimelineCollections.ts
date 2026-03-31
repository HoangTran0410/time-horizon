import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { EVENT_COLLECTIONS, PLAYGROUND_COLLECTION } from "../data/collections";
import { useTimelineStore } from "../stores";
import { findEventCollectionIdInCollections } from "../stores";

export const useTimelineCollections = () => {
  const {
    collectionLibrary,
    visibleCollectionIds,
    downloadingCollectionIds,
    collectionColorPreferences,
  } = useTimelineStore(
    useShallow((state) => ({
      collectionLibrary: state.collectionLibrary,
      visibleCollectionIds: state.visibleCollectionIds,
      downloadingCollectionIds: state.downloadingCollectionIds,
      collectionColorPreferences: state.collectionColorPreferences,
    })),
  );

  const {
    showCollections,
    addVisibleCollection,
    ensurePlaygroundCollection,
    downloadCollection,
    syncCollection,
    setCollectionVisibility,
    importCollections,
    deleteCollection,
    saveEvent,
    addEvent,
    addEvents,
    deleteEvent,
    createCollection,
    updateCollection,
    setCollectionColor,
    resetCollectionColor,
  } = useTimelineStore(
    useShallow((state) => ({
      showCollections: state.showCollections,
      addVisibleCollection: state.addVisibleCollection,
      ensurePlaygroundCollection: state.ensurePlaygroundCollection,
      downloadCollection: state.downloadCollection,
      syncCollection: state.syncCollection,
      setCollectionVisibility: state.setCollectionVisibility,
      importCollections: state.importCollections,
      deleteCollection: state.deleteCollection,
      saveEvent: state.saveEvent,
      addEvent: state.addEvent,
      addEvents: state.addEvents,
      deleteEvent: state.deleteEvent,
      createCollection: state.createCollection,
      updateCollection: state.updateCollection,
      setCollectionColor: state.setCollectionColor,
      resetCollectionColor: state.resetCollectionColor,
    })),
  );

  const collectionEventsById = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(collectionLibrary).map(([collectionId, collection]) => [
          collectionId,
          collection.events,
        ]),
      ) as Record<string, (typeof collectionLibrary)[string]["events"]>,
    [collectionLibrary],
  );

  const collectionMetaById = useMemo(
    () =>
      new Map(
        Object.entries(collectionLibrary).flatMap(([collectionId, collection]) =>
          collection.meta ? [[collectionId, collection.meta] as const] : [],
        ),
      ),
    [collectionLibrary],
  );

  const builtInCollectionIds = useMemo(
    () =>
      new Set([
        ...EVENT_COLLECTIONS.map((collection) => collection.id),
        PLAYGROUND_COLLECTION.id,
      ]),
    [],
  );

  const editableCollectionIds = useMemo(
    () => Object.keys(collectionLibrary),
    [collectionLibrary],
  );

  const localCollectionIds = useMemo(
    () =>
      Object.entries(collectionLibrary).flatMap(([collectionId, collection]) =>
        collection.isLocal ? [collectionId] : [],
      ),
    [collectionLibrary],
  );

  const collections = useMemo(
    () => {
      const builtInCollections = EVENT_COLLECTIONS.map(
        (collection) => collectionMetaById.get(collection.id) ?? collection,
      );
      const customCollections = Array.from(collectionMetaById.entries()).flatMap(
        ([collectionId, collection]) =>
          builtInCollectionIds.has(collectionId) ? [] : [collection],
      );
      const playgroundCollection = Object.prototype.hasOwnProperty.call(
        collectionLibrary,
        PLAYGROUND_COLLECTION.id,
      )
        ? [collectionMetaById.get(PLAYGROUND_COLLECTION.id) ?? PLAYGROUND_COLLECTION]
        : [];

      return [...builtInCollections, ...customCollections, ...playgroundCollection];
    },
    [builtInCollectionIds, collectionLibrary, collectionMetaById],
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
    localCollectionIds,
    editableCollectionIds,
    writableCollections,
    collectionColors,
    timelineEvents,
    eventAccentColors,
    singleVisibleCollectionId,
    showCollections,
    addVisibleCollection,
    ensurePlaygroundCollection,
    findEventCollectionId,
    handleDownloadCollection: downloadCollection,
    handleSyncCollection: syncCollection,
    handleSetCollectionVisibility: setCollectionVisibility,
    handleImportCollections: importCollections,
    handleDeleteCollection: deleteCollection,
    handleSaveEvent: saveEvent,
    handleAddEvent: addEvent,
    handleAddEvents: addEvents,
    handleDeleteEvent: deleteEvent,
    handleCreateCollection: createCollection,
    handleUpdateCollection: updateCollection,
    handleSetCollectionColor: setCollectionColor,
    handleResetCollectionColor: resetCollectionColor,
  };
};
