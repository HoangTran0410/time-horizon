/** One-time migration of the pre-v1 localStorage keys into the persisted store. */

import {
  isThemeMode,
  sanitizeCollectionEventsById,
  buildCollectionLibrary,
  sanitizeCollectionColorPreferences,
  sanitizeCustomCollections,
  sanitizeVisibleCollectionIds,
} from "./sanitizers";
import type { TimelinePersistedState } from "./types";

const readLegacyCollectionCache = () => {
  if (typeof window === "undefined") {
    return { collections: {}, visibleCollectionIds: [], customCollections: [] };
  }

  try {
    const raw = window.localStorage.getItem("time-horizon:collection-cache:v2");
    if (!raw) {
      return {
        collections: {},
        visibleCollectionIds: [],
        customCollections: [],
      };
    }

    const parsed = JSON.parse(raw);
    const collectionEventsById = sanitizeCollectionEventsById(
      parsed?.collections,
    );
    if (Object.keys(collectionEventsById).length === 0) {
      return {
        collections: {},
        visibleCollectionIds: [],
        customCollections: [],
      };
    }

    return {
      collections: collectionEventsById,
      visibleCollectionIds: sanitizeVisibleCollectionIds(
        parsed.visibleCollectionIds,
        buildCollectionLibrary(
          collectionEventsById,
          sanitizeCustomCollections(parsed.customCollections),
        ),
      ),
      customCollections: sanitizeCustomCollections(parsed.customCollections),
    };
  } catch (error) {
    console.error("Failed to restore cached collections", error);
    return { collections: {}, visibleCollectionIds: [], customCollections: [] };
  }
};

const readLegacyCollectionColorPreferences = () => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(
      "time-horizon:collection-color-preferences:v1",
    );
    if (!raw) return {};
    return sanitizeCollectionColorPreferences(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to restore collection color preferences", error);
    return {};
  }
};

const readLegacyTheme = () => {
  if (typeof window === "undefined") return undefined;

  const rawTheme = window.localStorage.getItem("time-horizon:theme");
  return isThemeMode(rawTheme) ? rawTheme : undefined;
};

export const cleanupLegacyCollectionStorage = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem("time-horizon:collection-cache:v2");
  window.localStorage.removeItem(
    "time-horizon:collection-color-preferences:v1",
  );
  window.localStorage.removeItem("time-horizon:theme");
};

export const getLegacyPersistedTimelineState =
  (): Partial<TimelinePersistedState> | null => {
    const legacyCollectionCache = readLegacyCollectionCache();
    const legacyCollectionColorPreferences =
      readLegacyCollectionColorPreferences();
    const legacyTheme = readLegacyTheme();

    const hasLegacyData =
      legacyTheme !== undefined ||
      Object.keys(legacyCollectionCache.collections).length > 0 ||
      legacyCollectionCache.customCollections.length > 0 ||
      legacyCollectionCache.visibleCollectionIds.length > 0 ||
      Object.keys(legacyCollectionColorPreferences).length > 0;

    if (!hasLegacyData) {
      return {};
    }

    const migratedState: Partial<TimelinePersistedState> = {
      theme: legacyTheme,
      collectionLibrary: buildCollectionLibrary(
        legacyCollectionCache.collections,
        legacyCollectionCache.customCollections,
      ),
      visibleCollectionIds: sanitizeVisibleCollectionIds(
        legacyCollectionCache.visibleCollectionIds,
        buildCollectionLibrary(
          legacyCollectionCache.collections,
          legacyCollectionCache.customCollections,
        ),
      ),
      collectionColorPreferences: legacyCollectionColorPreferences,
    };

    return migratedState;
  };
