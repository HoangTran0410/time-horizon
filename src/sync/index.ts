import type {
  CollectionOrigin,
  DeletedCollectionSyncTombstone,
  StoredTimelineCollection,
  SyncPreferences,
  SyncScope,
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

export interface SyncConflict {
  id: string;
  reason:
    | "local-dirty-vs-remote-change"
    | "local-change-vs-remote-delete"
    | "local-delete-vs-remote-present";
}

const hasScope = (
  syncPreferences: SyncPreferences,
  scope: SyncScope,
): boolean => syncPreferences.enabledScopes.includes(scope);

const includesCollectionPayload = (
  collection: StoredTimelineCollection,
  syncPreferences: SyncPreferences,
): boolean =>
  hasScope(syncPreferences, "custom-collections") &&
  (collection.origin === "custom" || collection.origin === "catalog-fork");

const includesCatalogMetadata = (
  collection: StoredTimelineCollection,
  syncPreferences: SyncPreferences,
): boolean =>
  collection.origin === "catalog" && hasScope(syncPreferences, "catalog-metadata");

const includesCollectionColor = (
  collectionId: string,
  collection: StoredTimelineCollection,
  syncPreferences: SyncPreferences,
  collectionColorPreferences: Record<string, string>,
): boolean =>
  hasScope(syncPreferences, "collection-colors") &&
  collectionColorPreferences[collectionId] !== undefined &&
  (collection.origin === "catalog" ||
    collection.origin === "custom" ||
    collection.origin === "catalog-fork");

export const isCollectionSyncable = (
  collectionId: string,
  collection: StoredTimelineCollection,
  syncPreferences: SyncPreferences,
  collectionColorPreferences: Record<string, string> = {},
): boolean =>
  includesCollectionPayload(collection, syncPreferences) ||
  includesCatalogMetadata(collection, syncPreferences) ||
  includesCollectionColor(
    collectionId,
    collection,
    syncPreferences,
    collectionColorPreferences,
  );

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
        options.syncPreferences,
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
        options.syncPreferences,
        options.collectionColorPreferences,
      ),
    )
    .map(([collectionId, collection]) => ({
      id: collectionId,
      origin: collection.origin ?? "catalog",
      ...(collection.sourceCatalogId
        ? { sourceCatalogId: collection.sourceCatalogId }
        : {}),
      ...(includesCollectionPayload(collection, options.syncPreferences)
        ? {
            meta: collection.meta ?? null,
            events: collection.events,
          }
        : {
            meta: collection.meta ?? null,
          }),
      ...(includesCollectionColor(
        collectionId,
        collection,
        options.syncPreferences,
        options.collectionColorPreferences,
      )
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

export const detectSyncConflicts = (options: {
  collectionLibrary: Record<string, StoredTimelineCollection>;
  deletedCollectionSyncTombstones: Record<string, DeletedCollectionSyncTombstone>;
  syncPreferences: SyncPreferences;
  collectionColorPreferences: Record<string, string>;
  remoteState: SyncProjectionRemoteState;
}): SyncConflict[] => {
  const conflicts: SyncConflict[] = [];
  const remoteCollections = new Map(
    options.remoteState.collections.map((collection) => [collection.id, collection]),
  );
  const remoteDeletedIds = new Set(
    options.remoteState.deletedCollections.map((collection) => collection.id),
  );

  Object.entries(options.collectionLibrary).forEach(([collectionId, collection]) => {
    if (
      !collection.sync?.dirty ||
      !isCollectionSyncable(
        collectionId,
        collection,
        options.syncPreferences,
        options.collectionColorPreferences,
      )
    ) {
      return;
    }

    if (remoteDeletedIds.has(collectionId)) {
      conflicts.push({
        id: collectionId,
        reason: "local-change-vs-remote-delete",
      });
      return;
    }

    const remoteCollection = remoteCollections.get(collectionId);
    const localBaselineHash = collection.cloud?.contentHash;
    if (
      remoteCollection &&
      localBaselineHash &&
      remoteCollection.contentHash &&
      remoteCollection.contentHash !== localBaselineHash
    ) {
      conflicts.push({
        id: collectionId,
        reason: "local-dirty-vs-remote-change",
      });
    }
  });

  Object.keys(options.deletedCollectionSyncTombstones).forEach((collectionId) => {
    if (remoteCollections.has(collectionId)) {
      conflicts.push({
        id: collectionId,
        reason: "local-delete-vs-remote-present",
      });
    }
  });

  return conflicts;
};
