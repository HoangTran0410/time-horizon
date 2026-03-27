import { EVENT_COLLECTIONS, PLAYGROUND_COLLECTION } from "../data/collections";
import { Event, EventCollectionMeta } from "../constants/types";
import {
  COLLECTION_CACHE_KEY,
  COLLECTION_COLOR_PREFERENCES_KEY,
} from "../constants";
import { CollectionCache } from "../constants/types";

const BUILT_IN_COLLECTION_IDS = new Set(
  [...EVENT_COLLECTIONS, PLAYGROUND_COLLECTION].map(
    (collection) => collection.id,
  ),
);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const sanitizeCustomCollections = (
  customCollections: unknown,
): EventCollectionMeta[] => {
  if (!Array.isArray(customCollections)) return [];

  const seen = new Set<string>();

  return customCollections.flatMap((collection) => {
    if (!collection || typeof collection !== "object") return [];

    const candidate = collection as Partial<EventCollectionMeta>;
    if (
      !isNonEmptyString(candidate.id) ||
      !isNonEmptyString(candidate.name) ||
      !isNonEmptyString(candidate.emoji) ||
      !isNonEmptyString(candidate.description) ||
      !isNonEmptyString(candidate.author) ||
      !isNonEmptyString(candidate.createdAt)
    ) {
      return [];
    }

    const id = candidate.id.trim();
    if (BUILT_IN_COLLECTION_IDS.has(id) || seen.has(id)) {
      return [];
    }

    seen.add(id);

    return [
      {
        id,
        name: candidate.name.trim(),
        emoji: candidate.emoji.trim(),
        description: candidate.description.trim(),
        author: candidate.author.trim(),
        createdAt: candidate.createdAt.trim(),
        color: typeof candidate.color === "string" ? candidate.color : null,
      },
    ];
  });
};

export const readCollectionCache = (): {
  collections: Record<string, Event[]>;
  visibleCollectionIds: string[];
  customCollections: EventCollectionMeta[];
} => {
  if (typeof window === "undefined") {
    return { collections: {}, visibleCollectionIds: [], customCollections: [] };
  }

  try {
    const raw = window.localStorage.getItem(COLLECTION_CACHE_KEY);
    if (!raw) {
      return {
        collections: {},
        visibleCollectionIds: [],
        customCollections: [],
      };
    }

    const parsed = JSON.parse(raw) as CollectionCache;
    if (!parsed || !parsed.collections) {
      return {
        collections: {},
        visibleCollectionIds: [],
        customCollections: [],
      };
    }

    const fallbackVisibleCollectionIds = Object.keys(parsed.collections);
    const nextVisibleCollectionIds = Array.isArray(parsed.visibleCollectionIds)
      ? parsed.visibleCollectionIds
      : fallbackVisibleCollectionIds;
    const customCollections = sanitizeCustomCollections(
      parsed.customCollections,
    );

    return {
      collections: parsed.collections,
      visibleCollectionIds: nextVisibleCollectionIds.filter(
        (collectionId, index, allIds) =>
          allIds.indexOf(collectionId) === index &&
          Object.prototype.hasOwnProperty.call(
            parsed.collections,
            collectionId,
          ),
      ),
      customCollections,
    };
  } catch (error) {
    console.error("Failed to restore cached collections", error);
    return { collections: {}, visibleCollectionIds: [], customCollections: [] };
  }
};

export const persistCollectionCache = ({
  collectionEventsById,
  visibleCollectionIds,
  customCollections,
}: {
  collectionEventsById: Record<string, Event[]>;
  visibleCollectionIds: string[];
  customCollections: EventCollectionMeta[];
}) => {
  if (typeof window === "undefined") return;

  try {
    const persistedVisibleCollectionIds = visibleCollectionIds.filter(
      (collectionId, index, allIds) =>
        allIds.indexOf(collectionId) === index &&
        Object.prototype.hasOwnProperty.call(
          collectionEventsById,
          collectionId,
        ),
    );

    window.localStorage.setItem(
      COLLECTION_CACHE_KEY,
      JSON.stringify({
        version: 3,
        collections: collectionEventsById,
        visibleCollectionIds: persistedVisibleCollectionIds,
        customCollections,
      }),
    );
  } catch (error) {
    console.error("Failed to persist collection cache", error);
  }
};

export const readCollectionColorPreferences = (): Record<string, string> => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(COLLECTION_COLOR_PREFERENCES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};

    const entries = Object.entries(parsed).flatMap(([key, value]) =>
      typeof value === "string" && value.trim().length > 0
        ? ([[key, value]] as const)
        : [],
    );

    return Object.fromEntries(entries) as Record<string, string>;
  } catch (error) {
    console.error("Failed to restore collection color preferences", error);
    return {};
  }
};

export const persistCollectionColorPreferences = (
  collectionColorPreferences: Record<string, string>,
) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      COLLECTION_COLOR_PREFERENCES_KEY,
      JSON.stringify(collectionColorPreferences),
    );
  } catch (error) {
    console.error("Failed to persist collection color preferences", error);
  }
};
