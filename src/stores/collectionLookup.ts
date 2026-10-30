/** Lookups over a `collectionId -> events` map. */

import type { Event, StoredTimelineCollection } from "../constants/types";

export const getCollectionEventsById = (
  collectionLibrary: Record<string, StoredTimelineCollection>,
) =>
  Object.fromEntries(
    Object.entries(collectionLibrary).map(([collectionId, collection]) => [
      collectionId,
      collection.events,
    ]),
  ) as Record<string, Event[]>;

export const findEventCollectionIdInCollections = (
  collectionEventsById: Record<string, Event[]>,
  eventId: string,
) => {
  for (const collectionId of Object.keys(collectionEventsById)) {
    const collectionEvents = collectionEventsById[collectionId] ?? [];
    if (collectionEvents.some((event) => event.id === eventId)) {
      return collectionId;
    }
  }

  return null;
};

export const findEventByIdInCollections = (
  collectionEventsById: Record<string, Event[]>,
  eventId: string,
) => {
  for (const collectionEvents of Object.values(collectionEventsById)) {
    const matchedEvent = collectionEvents.find((event) => event.id === eventId);
    if (matchedEvent) {
      return matchedEvent;
    }
  }

  return null;
};
