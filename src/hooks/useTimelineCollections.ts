import { useMemo } from "react";
import type { EventCollectionMeta } from "../constants/types";
import { findEventCollectionIdInCollections, useStore } from "../stores";

/**
 * Core derived collections logic — only computes values that depend on
 * multiple store slices. Store state/actions are consumed directly by
 * components via useStore.
 */
export const useTimelineCollections = () => {
  const catalogMeta = useStore((state) => state.catalogMeta);
  const syncableIds = useStore((state) => state.syncableIds);
  const collectionLibrary = useStore((state) => state.collectionLibrary);
  const visibleCollectionIds = useStore((state) => state.visibleCollectionIds);
  const collectionColorPreferences = useStore(
    (state) => state.collectionColorPreferences,
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

  /**
   * All collections that appear in the UI.
   * Built from catalog metadata + any persisted (downloaded/imported) collection meta.
   */
  const collections = useMemo(() => {
    // Start with catalog metadata
    const result = new Map<string, EventCollectionMeta>(
      Object.entries(catalogMeta) as [string, EventCollectionMeta][],
    );

    // Override with persisted meta from collectionLibrary (downloads/imports win)
    for (const [id, entry] of Object.entries(collectionLibrary)) {
      if (entry.meta) {
        result.set(id, entry.meta);
      }
    }

    return Array.from(result.values());
  }, [catalogMeta, collectionLibrary]);

  /**
   * IDs of catalog/syncable collections (from metadata).
   */
  const catalogCollectionIds = useMemo(
    () =>
      new Set(
        syncableIds.filter(
          (collectionId) => collectionLibrary[collectionId]?.origin !== "catalog-fork",
        ),
      ),
    [collectionLibrary, syncableIds],
  );

  const localCollectionIds = useMemo(
    () =>
      Object.entries(collectionLibrary).flatMap(([collectionId, collection]) =>
        collection.origin !== "catalog" ? [collectionId] : [],
      ),
    [collectionLibrary],
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

  const editableCollectionIds = useMemo(
    () => Object.keys(collectionLibrary),
    [collectionLibrary],
  );

  const findEventCollectionId = (eventId: string) =>
    findEventCollectionIdInCollections(collectionEventsById, eventId);

  return {
    // Derived data
    collectionEventsById,
    collections,
    catalogCollectionIds,
    catalogMeta,
    localCollectionIds,
    editableCollectionIds,
    writableCollections,
    collectionColors,
    timelineEvents,
    eventAccentColors,
    singleVisibleCollectionId,
    visibleCollectionIds,
    collectionColorPreferences,
    // Helpers that depend on derived data
    findEventCollectionId,
  };
};
