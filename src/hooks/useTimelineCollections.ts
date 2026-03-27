import { useEffect, useMemo, useRef, useState } from "react";
import {
  EVENT_COLLECTIONS,
  PLAYGROUND_COLLECTION,
  SYNCABLE_COLLECTION_IDS,
  loadEventCollection,
} from "../data/collections";
import { Event, EventCollectionMeta } from "../constants/types";
import { buildCustomCollectionMeta } from "../helpers";
import {
  persistCollectionCache,
  persistCollectionColorPreferences,
  readCollectionCache,
  readCollectionColorPreferences,
} from "../stores/collectionStorage";
import { CollectionCreationInput } from "../constants/types";

export const useTimelineCollections = () => {
  const initialCacheRef = useRef(readCollectionCache());

  const [customCollections, setCustomCollections] = useState<
    EventCollectionMeta[]
  >(initialCacheRef.current.customCollections);
  const [collectionEventsById, setCollectionEventsById] = useState<
    Record<string, Event[]>
  >(initialCacheRef.current.collections);
  const [visibleCollectionIds, setVisibleCollectionIds] = useState<string[]>(
    initialCacheRef.current.visibleCollectionIds,
  );
  const [downloadingCollectionIds, setDownloadingCollectionIds] = useState<
    string[]
  >([]);
  const [collectionColorPreferences, setCollectionColorPreferences] = useState<
    Record<string, string>
  >(readCollectionColorPreferences);

  useEffect(() => {
    persistCollectionCache({
      collectionEventsById,
      visibleCollectionIds,
      customCollections,
    });
  }, [collectionEventsById, customCollections, visibleCollectionIds]);

  useEffect(() => {
    persistCollectionColorPreferences(collectionColorPreferences);
  }, [collectionColorPreferences]);

  const addVisibleCollection = (collectionId: string) => {
    setVisibleCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );
  };

  const ensurePlaygroundCollection = () => {
    setCollectionEventsById((prev) =>
      Object.prototype.hasOwnProperty.call(prev, PLAYGROUND_COLLECTION.id)
        ? prev
        : { ...prev, [PLAYGROUND_COLLECTION.id]: [] },
    );
  };

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

  const findEventCollectionId = (eventId: string) => {
    for (const collectionId of Object.keys(collectionEventsById)) {
      const collectionEvents = collectionEventsById[collectionId] ?? [];
      if (collectionEvents.some((event) => event.id === eventId)) {
        return collectionId;
      }
    }

    return null;
  };

  const handleDownloadCollection = async (collectionId: string) => {
    if (collectionEventsById[collectionId]) {
      addVisibleCollection(collectionId);
      return;
    }

    setDownloadingCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );

    try {
      const loadedEvents = await loadEventCollection(collectionId);
      addVisibleCollection(collectionId);
      setCollectionEventsById((prev) => ({
        ...prev,
        [collectionId]: loadedEvents,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setDownloadingCollectionIds((prev) =>
        prev.filter((id) => id !== collectionId),
      );
    }
  };

  const handleSyncCollection = async (collectionId: string) => {
    if (
      downloadingCollectionIds.includes(collectionId) ||
      !SYNCABLE_COLLECTION_IDS.includes(collectionId)
    ) {
      return;
    }

    setDownloadingCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );

    try {
      const loadedEvents = await loadEventCollection(collectionId);
      setCollectionEventsById((prev) => ({
        ...prev,
        [collectionId]: loadedEvents,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setDownloadingCollectionIds((prev) =>
        prev.filter((id) => id !== collectionId),
      );
    }
  };

  const handleSetCollectionVisibility = (
    collectionId: string,
    visible: boolean,
  ) => {
    if (!visible) {
      setVisibleCollectionIds((prev) =>
        prev.filter((id) => id !== collectionId),
      );
      return;
    }

    addVisibleCollection(collectionId);
  };

  const handleDeleteCollection = (collectionId: string) => {
    setCustomCollections((prev) =>
      prev.filter((collection) => collection.id !== collectionId),
    );
    setCollectionEventsById((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, collectionId)) {
        return prev;
      }

      const next = { ...prev };
      delete next[collectionId];
      return next;
    });
    setVisibleCollectionIds((prev) => prev.filter((id) => id !== collectionId));
    setDownloadingCollectionIds((prev) =>
      prev.filter((id) => id !== collectionId),
    );
    setCollectionColorPreferences((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, collectionId)) {
        return prev;
      }

      const next = { ...prev };
      delete next[collectionId];
      return next;
    });
  };

  const handleSaveEvent = (updatedEvent: Event) => {
    const ownerCollectionId = findEventCollectionId(updatedEvent.id);
    if (!ownerCollectionId) return;

    setCollectionEventsById((prev) => ({
      ...prev,
      [ownerCollectionId]: prev[ownerCollectionId].map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    }));
  };

  const handleAddEvent = (newEvent: Event, targetCollectionId: string) => {
    setCollectionEventsById((prev) => {
      const existingEvents = prev[targetCollectionId] ?? [];

      return {
        ...prev,
        [targetCollectionId]: [...existingEvents, newEvent],
      };
    });
    addVisibleCollection(targetCollectionId);
  };

  const handleCreateCollection = (collection: CollectionCreationInput) => {
    const nextCollection = buildCustomCollectionMeta(collection, [
      ...EVENT_COLLECTIONS,
      ...customCollections,
      PLAYGROUND_COLLECTION,
    ]);

    setCustomCollections((prev) => [...prev, nextCollection]);
    setCollectionEventsById((prev) => ({
      ...prev,
      [nextCollection.id]: [],
    }));
    addVisibleCollection(nextCollection.id);

    return nextCollection;
  };

  const handleSetCollectionColor = (collectionId: string, color: string) => {
    setCollectionColorPreferences((prev) => ({
      ...prev,
      [collectionId]: color,
    }));
  };

  const handleResetCollectionColor = (collectionId: string) => {
    setCollectionColorPreferences((prev) => {
      const next = { ...prev };
      delete next[collectionId];
      return next;
    });
  };

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
    handleDownloadCollection,
    handleSyncCollection,
    handleSetCollectionVisibility,
    handleDeleteCollection,
    handleSaveEvent,
    handleAddEvent,
    handleCreateCollection,
    handleSetCollectionColor,
    handleResetCollectionColor,
  };
};
