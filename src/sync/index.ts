import type {
  CollectionOrigin,
  DeletedCollectionSyncTombstone,
  StoredTimelineCollection,
  SyncPreferences,
} from "../constants/types";

export interface SyncProjectionCollection {
  id: string;
  origin: CollectionOrigin;
  sourceCatalogId?: string;
  fileId?: string;
  revision?: string;
  contentHash?: string;
  meta?: StoredTimelineCollection["meta"];
  events?: StoredTimelineCollection["events"];
  colorPreference?: string | null;
  dirtyReason?: StoredTimelineCollection["sync"] extends infer T
    ? T extends { dirtyReason?: infer R }
      ? R
      : never
    : never;
}

export interface SyncProjectionSnapshot {
  generatedAt: string;
  preferences: SyncPreferences;
  collections: SyncProjectionCollection[];
  deletedCollections: Array<
    DeletedCollectionSyncTombstone & {
      id: string;
    }
  >;
}

export interface SyncProjectionRemoteState extends SyncProjectionSnapshot {
  rootFolderId?: string;
  collectionsFolderId?: string;
}

export const isCollectionSyncable = (
  collectionId: string,
  collection: StoredTimelineCollection,
  collectionColorPreferences: Record<string, string> = {},
): boolean =>
  collection.origin === "catalog" ||
  collection.origin === "custom" ||
  collection.origin === "catalog-fork" ||
  collectionColorPreferences[collectionId] !== undefined;

export const hasPendingSyncableChanges = (options: {
  collectionLibrary: Record<string, StoredTimelineCollection>;
  deletedCollectionSyncTombstones: Record<string, DeletedCollectionSyncTombstone>;
  syncPreferences: SyncPreferences;
  collectionColorPreferences?: Record<string, string>;
}): boolean => {
  if (!options.syncPreferences.onboardingCompleted) {
    return false;
  }

  if (Object.keys(options.deletedCollectionSyncTombstones).length > 0) {
    return true;
  }

  return Object.entries(options.collectionLibrary).some(
    ([collectionId, collection]) =>
      collection.sync?.dirty === true &&
      isCollectionSyncable(
        collectionId,
        collection,
        options.collectionColorPreferences ?? {},
      ),
  );
};

export const buildSyncProjectionSnapshot = (options: {
  collectionLibrary: Record<string, StoredTimelineCollection>;
  deletedCollectionSyncTombstones: Record<string, DeletedCollectionSyncTombstone>;
  syncPreferences: SyncPreferences;
  collectionColorPreferences: Record<string, string>;
  generatedAt?: string;
}): SyncProjectionSnapshot => {
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const collections = Object.entries(options.collectionLibrary)
    .filter(([collectionId, collection]) =>
      isCollectionSyncable(
        collectionId,
        collection,
        options.collectionColorPreferences,
      ),
    )
    .map(([collectionId, collection]) => ({
      id: collectionId,
      origin: collection.origin ?? "catalog",
      ...(collection.sourceCatalogId
        ? { sourceCatalogId: collection.sourceCatalogId }
        : {}),
      meta: collection.meta ?? null,
      events: collection.events,
      ...(options.collectionColorPreferences[collectionId] !== undefined
        ? {
            colorPreference:
              options.collectionColorPreferences[collectionId] ?? null,
          }
        : {}),
      ...(collection.sync?.dirtyReason
        ? { dirtyReason: collection.sync.dirtyReason }
        : {}),
    }));

  const deletedCollections = Object.entries(
    options.deletedCollectionSyncTombstones,
  ).map(([id, tombstone]) => ({
    id,
    ...tombstone,
  }));

  return {
    generatedAt,
    preferences: options.syncPreferences,
    collections,
    deletedCollections,
  };
};
