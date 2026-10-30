/**
 * Persistence boundary of the timeline store. Persisted payloads arrive from
 * localStorage, Google Drive and user JSON/CSV imports, so every field is
 * re-validated here before it reaches state (see CLAUDE.md). Also holds the
 * collection-record constructors the sanitizers and store actions share.
 */

import type { ThemeMode } from "../constants/theme";
import {
  type CollectionSyncState,
  type CollectionOrigin,
  type DeletedCollectionSyncTombstone,
  type Event,
  type EventCollectionMeta,
  type ImportedEvent,
  type MediaFilter,
  type SpatialMappingConfig,
  type StoredTimelineCollection,
  type SupportedLanguage,
  type SyncConnectionStatus,
  type SyncPreferences,
  type TimelineOrientation,
  type VerticalWheelBehavior,
  type VerticalTimeDirection,
  MEDIA_FILTERS,
} from "../constants/types";
import {
  assignRuntimeEventIds,
  createLocalDateStamp,
  normalizeEventTimeParts,
  sanitizeSpatialMapping,
} from "../helpers";
import { normalizeLocalizedText } from "../helpers/localization";
import {
  getCollectionEventsById,
  findEventByIdInCollections,
} from "./collectionLookup";
import { type SearchSortMode, SEARCH_SORT_MODES } from "./search";
import type {
  TimelineAppView,
  NavigationPanelTab,
  TimelinePersistedState,
} from "./types";

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "dark" || value === "light";

const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  value === "vi" || value === "en";

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const sanitizeCollectionEventsById = (collections: unknown) => {
  if (
    !collections ||
    typeof collections !== "object" ||
    Array.isArray(collections)
  ) {
    return {};
  }

  return collections as Record<string, Event[]>;
};

const sanitizeLastOpenedView = (value: unknown): TimelineAppView | undefined =>
  value === "landing" || value === "timeline" ? value : undefined;

const sanitizeNavigationPanelTab = (
  value: unknown,
): NavigationPanelTab | undefined => {
  if (value === "goto" || value === "display") return value;
  // Migrate the four legacy tabs: jump/fit merged into one destination form,
  // view/zoom merged into display settings.
  if (value === "jump" || value === "fit") return "goto";
  if (value === "view" || value === "zoom") return "display";
  return undefined;
};

const sanitizeTimelineOrientation = (
  value: unknown,
): TimelineOrientation | undefined =>
  value === "horizontal" || value === "vertical" ? value : undefined;

const sanitizeVerticalWheelBehavior = (
  value: unknown,
): VerticalWheelBehavior | undefined =>
  value === "pan" || value === "zoom" ? value : undefined;

const sanitizeVerticalTimeDirection = (
  value: unknown,
): VerticalTimeDirection | undefined =>
  value === "up" || value === "down" ? value : undefined;

const isSyncConnectionStatus = (
  value: unknown,
): value is SyncConnectionStatus =>
  value === "disconnected" ||
  value === "connecting" ||
  value === "connected" ||
  value === "error";

export const createInitialSyncPreferences = (): SyncPreferences => ({
  onboardingCompleted: false,
  lastSuccessfulSyncAt: null,
});

const sanitizeSyncConnectionStatus = (
  value: unknown,
): SyncConnectionStatus => {
  if (
    value === "connected" ||
    value === "connecting" ||
    value === "disconnected" ||
    value === "error"
  ) {
    return value;
  }
  return "disconnected";
};

const sanitizeSyncPreferences = (value: unknown): SyncPreferences => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createInitialSyncPreferences();
  }

  const candidate = value as Partial<SyncPreferences>;
  return {
    onboardingCompleted: candidate.onboardingCompleted === true,
    lastSuccessfulSyncAt:
      typeof candidate.lastSuccessfulSyncAt === "string" &&
      candidate.lastSuccessfulSyncAt.trim().length > 0
        ? candidate.lastSuccessfulSyncAt.trim()
        : null,
  };
};

const isCollectionOrigin = (value: unknown): value is CollectionOrigin =>
  value === "custom" || value === "catalog" || value === "catalog-fork";

const isLocalCollectionOrigin = (origin: CollectionOrigin): boolean =>
  origin !== "catalog";

const sanitizeSourceCatalogId = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const sanitizeCollectionCloudMetadata = (
  value: unknown,
): StoredTimelineCollection["cloud"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as NonNullable<StoredTimelineCollection["cloud"]>;

  const normalized = {
    fileId:
      typeof candidate.fileId === "string" && candidate.fileId.trim().length > 0
        ? candidate.fileId.trim()
        : undefined,
    revision:
      typeof candidate.revision === "string" &&
      candidate.revision.trim().length > 0
        ? candidate.revision.trim()
        : undefined,
    contentHash:
      typeof candidate.contentHash === "string" &&
      candidate.contentHash.trim().length > 0
        ? candidate.contentHash.trim()
        : undefined,
    lastSyncedAt:
      typeof candidate.lastSyncedAt === "string" &&
      candidate.lastSyncedAt.trim().length > 0
        ? candidate.lastSyncedAt.trim()
        : undefined,
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
};

const collectionHasDurableEventUids = (
  collection: Pick<StoredTimelineCollection, "events">,
): boolean => collection.events.every((event) => isNonEmptyString(event.eventUid));

export const createCollectionSyncState = (
  collection: Pick<StoredTimelineCollection, "events">,
  previous?: CollectionSyncState | null,
  overrides: Partial<CollectionSyncState> = {},
): CollectionSyncState => ({
  dirty: previous?.dirty ?? false,
  dirtyReason: previous?.dirtyReason,
  lastLocalChangeAt: previous?.lastLocalChangeAt,
  eventUidMigrationComplete: collectionHasDurableEventUids(collection),
  ...overrides,
});

const sanitizeCollectionSyncState = (
  value: unknown,
  collection: Pick<StoredTimelineCollection, "events">,
): CollectionSyncState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createCollectionSyncState(collection);
  }

  const candidate = value as Partial<CollectionSyncState>;
  return createCollectionSyncState(collection, null, {
    dirty: candidate.dirty === true,
    dirtyReason:
      candidate.dirtyReason === "content" ||
      candidate.dirtyReason === "metadata" ||
      candidate.dirtyReason === "color" ||
      candidate.dirtyReason === "delete"
        ? candidate.dirtyReason
        : undefined,
    lastLocalChangeAt:
      typeof candidate.lastLocalChangeAt === "string" &&
      candidate.lastLocalChangeAt.trim().length > 0
        ? candidate.lastLocalChangeAt.trim()
        : undefined,
  });
};

const sanitizeDeletedCollectionSyncTombstones = (
  value: unknown,
): Record<string, DeletedCollectionSyncTombstone> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([collectionId, tombstoneValue]) => {
      if (
        !tombstoneValue ||
        typeof tombstoneValue !== "object" ||
        Array.isArray(tombstoneValue)
      ) {
        return [];
      }

      const candidate = tombstoneValue as Partial<DeletedCollectionSyncTombstone>;
      if (!isCollectionOrigin(candidate.origin)) {
        return [];
      }

      const deletedAt =
        typeof candidate.deletedAt === "string" && candidate.deletedAt.trim().length > 0
          ? candidate.deletedAt.trim()
          : null;

      if (!deletedAt) {
        return [];
      }

      return [
        [
          collectionId,
          {
            deletedAt,
            origin: candidate.origin,
            ...(sanitizeSourceCatalogId(candidate.sourceCatalogId)
              ? { sourceCatalogId: sanitizeSourceCatalogId(candidate.sourceCatalogId) }
              : {}),
          },
        ] as const,
      ];
    }),
  ) as Record<string, DeletedCollectionSyncTombstone>;
};

export const markCollectionSyncStateDirty = (
  collection: StoredTimelineCollection,
  reason: CollectionSyncState["dirtyReason"],
  changedAt: string,
): void => {
  collection.sync = createCollectionSyncState(collection, collection.sync, {
    dirty: true,
    dirtyReason: reason,
    lastLocalChangeAt: changedAt,
  });
};

const deriveCollectionOrigin = (
  candidate: Partial<StoredTimelineCollection>,
  collectionId: string,
  meta?: EventCollectionMeta | null,
): CollectionOrigin => {
  if (isCollectionOrigin(candidate.origin)) {
    return candidate.origin;
  }

  const sourceCatalogId = sanitizeSourceCatalogId(candidate.sourceCatalogId);
  if (sourceCatalogId && sourceCatalogId !== collectionId) {
    return "catalog-fork";
  }

  if (candidate.isLocal === true) {
    return "custom";
  }

  if (meta?.dataUrl) {
    return "catalog";
  }

  return "catalog";
};

export const createCollectionRecord = (
  collectionId: string,
  options: {
    events?: Event[];
    meta?: EventCollectionMeta | null;
    origin?: CollectionOrigin;
    sourceCatalogId?: string;
    cloud?: StoredTimelineCollection["cloud"];
    sync?: StoredTimelineCollection["sync"];
  } = {},
): StoredTimelineCollection => {
  const origin = options.origin ?? "custom";
  const sourceCatalogId =
    origin === "catalog-fork" ? options.sourceCatalogId ?? collectionId : undefined;

  return {
    events: options.events ?? [],
    ...(options.meta ? { meta: options.meta } : {}),
    origin,
    ...(sourceCatalogId ? { sourceCatalogId } : {}),
    ...(options.cloud ? { cloud: options.cloud } : {}),
    sync: createCollectionSyncState(
      { events: options.events ?? [] },
      options.sync ?? null,
    ),
    isLocal: isLocalCollectionOrigin(origin),
  };
};

export const promoteCollectionToFork = (
  collectionId: string,
  collection: StoredTimelineCollection,
): void => {
  if (collection.origin === "catalog") {
    collection.origin = "catalog-fork";
    collection.sourceCatalogId ??= collectionId;
  } else if (!isCollectionOrigin(collection.origin)) {
    collection.origin = collection.isLocal ? "custom" : "catalog-fork";
  }

  collection.isLocal = isLocalCollectionOrigin(collection.origin);
};

export const buildCollectionLibrary = (
  collectionEventsById: Record<string, Event[]>,
  customCollections: EventCollectionMeta[] = [],
) => {
  const nextCollectionLibrary: Record<string, StoredTimelineCollection> =
    Object.fromEntries(
      Object.entries(collectionEventsById).map(([collectionId, events]) => [
        collectionId,
        createCollectionRecord(collectionId, {
          events: sanitizeImportedEvents(events, { collectionId }),
          origin: "catalog",
        }),
      ]),
    );

  customCollections.forEach((collection) => {
    nextCollectionLibrary[collection.id] = createCollectionRecord(collection.id, {
      events: nextCollectionLibrary[collection.id]?.events ?? [],
      meta: collection,
      origin: "custom",
    });
  });

  return nextCollectionLibrary;
};

const mergeCollectionLibraries = (
  baseCollectionLibrary: Record<string, StoredTimelineCollection>,
  overrideCollectionLibrary: Record<string, StoredTimelineCollection>,
) => {
  const mergedCollectionIds = new Set([
    ...Object.keys(baseCollectionLibrary),
    ...Object.keys(overrideCollectionLibrary),
  ]);

  return Object.fromEntries(
    Array.from(mergedCollectionIds).map((collectionId) => {
      const baseCollection = baseCollectionLibrary[collectionId];
      const overrideCollection = overrideCollectionLibrary[collectionId];

      return [
        collectionId,
        createCollectionRecord(collectionId, {
          events: overrideCollection?.events ?? baseCollection?.events ?? [],
          meta: overrideCollection?.meta ?? baseCollection?.meta ?? null,
          origin:
            overrideCollection?.origin ??
            baseCollection?.origin ??
            deriveCollectionOrigin(
              overrideCollection ?? baseCollection ?? {},
              collectionId,
              overrideCollection?.meta ?? baseCollection?.meta ?? null,
            ),
          sourceCatalogId:
            overrideCollection?.sourceCatalogId ?? baseCollection?.sourceCatalogId,
          cloud: overrideCollection?.cloud ?? baseCollection?.cloud ?? null,
          sync: overrideCollection?.sync ?? baseCollection?.sync ?? null,
        }),
      ] as const;
    }),
  ) as Record<string, StoredTimelineCollection>;
};

const sanitizeCollectionLibrary = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([collectionId, collectionValue]) => {
      if (
        !collectionValue ||
        typeof collectionValue !== "object" ||
        Array.isArray(collectionValue)
      ) {
        return [];
      }

      const candidate = collectionValue as Partial<StoredTimelineCollection>;
      const events = sanitizeImportedEvents(candidate.events, { collectionId });
      const meta =
        sanitizeCustomCollections(candidate.meta ? [candidate.meta] : [], {
          allowBuiltInIds: true,
        })[0] ?? null;
      const origin = deriveCollectionOrigin(candidate, collectionId, meta);
      const sourceCatalogId =
        origin === "catalog-fork"
          ? sanitizeSourceCatalogId(candidate.sourceCatalogId) ?? collectionId
          : undefined;
      const cloud = sanitizeCollectionCloudMetadata(candidate.cloud);
      const sync = sanitizeCollectionSyncState(candidate.sync, { events });

      return [
        [
          collectionId,
          createCollectionRecord(collectionId, {
            events,
            ...(meta ? { meta: { ...meta, id: collectionId } } : {}),
            origin,
            sourceCatalogId,
            cloud,
            sync,
          }),
        ] as const,
      ];
    }),
  ) as Record<string, StoredTimelineCollection>;
};

// We no longer have a hardcoded BUILT_IN_COLLECTION_IDS — all collections
// are discovered from catalog metadata. Legacy migrations may reference IDs
// so we keep an empty set here for the sanitizer to skip blocking them.
const BUILT_IN_COLLECTION_IDS = new Set<string>();

export const getCustomCollectionsFromLibrary = (
  collectionLibrary: Record<string, StoredTimelineCollection>,
) =>
  Object.values(collectionLibrary).flatMap((collection) =>
    collection.meta ? [collection.meta] : [],
  );

const sanitizeSelectedEventId = (
  selectedEventId: unknown,
  collectionLibrary: Record<string, StoredTimelineCollection>,
) => {
  if (!isNonEmptyString(selectedEventId)) return null;

  const collectionEventsById = getCollectionEventsById(collectionLibrary);
  return findEventByIdInCollections(collectionEventsById, selectedEventId)
    ? selectedEventId.trim()
    : null;
};

export const sanitizeCollectionColorPreferences = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).flatMap(([key, itemValue]) =>
    typeof itemValue === "string" && itemValue.trim().length > 0
      ? ([[key, itemValue]] as const)
      : [],
  );

  return Object.fromEntries(entries) as Record<string, string>;
};

const sanitizeImportedEventTime = (value: unknown): Event["time"] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const normalized = value.slice(0, 6).map((part) => {
    if (part === null || part === undefined) return null;
    if (typeof part !== "number" || !Number.isFinite(part)) return null;
    return part;
  });

  const year = normalized[0];
  if (typeof year !== "number") {
    return null;
  }

  return normalizeEventTimeParts([
    year,
    normalized[1],
    normalized[2],
    normalized[3],
    normalized[4],
    normalized[5],
  ]);
};

export const sanitizeImportedEvents = (
  value: unknown,
  options?: {
    collectionId?: string;
    previousEvents?: Event[];
  },
): Event[] => {
  if (!Array.isArray(value)) return [];

  const normalizedEvents = value.flatMap((event) => {
    if (!event || typeof event !== "object") return [];

    const candidate = event as Partial<ImportedEvent>;
    const time = sanitizeImportedEventTime(candidate.time);
    const ongoing = candidate.ongoing === true;
    // A malformed endTime degrades the event to a point rather than rejecting
    // it — the start time is the part that must be trustworthy. An ongoing
    // event's end is "now", so a stored end date would only go stale: drop it.
    const endTime =
      !ongoing && candidate.endTime != null
        ? sanitizeImportedEventTime(candidate.endTime)
        : null;
    const title = normalizeLocalizedText(candidate.title);
    const description = normalizeLocalizedText(candidate.description) ?? "";
    if (!title || !isNonEmptyString(candidate.emoji) || !time) {
      return [];
    }

    return [
      {
        // Without this passthrough the durable identity is silently re-derived
        // from content on every rehydrate, so a random uid (createNewTimelineEvent)
        // would not survive a reload and Drive conflict handling loses track.
        ...(isNonEmptyString(candidate.eventUid)
          ? { eventUid: candidate.eventUid.trim() }
          : {}),
        title,
        description,
        emoji: candidate.emoji.trim(),
        time,
        ...(endTime ? { endTime } : {}),
        ...(ongoing ? { ongoing: true } : {}),
        priority:
          typeof candidate.priority === "number" &&
          Number.isFinite(candidate.priority)
            ? candidate.priority
            : 50,
        duration:
          typeof candidate.duration === "number" &&
          Number.isFinite(candidate.duration)
            ? candidate.duration
            : undefined,
        color: typeof candidate.color === "string" ? candidate.color : null,
        image:
          typeof candidate.image === "string" ? candidate.image : undefined,
        video:
          typeof candidate.video === "string" ? candidate.video : undefined,
        link: typeof candidate.link === "string" ? candidate.link : undefined,
      },
    ];
  });

  return assignRuntimeEventIds(normalizedEvents, {
    collectionId: options?.collectionId,
    previousEvents: options?.previousEvents,
  });
};

export const sanitizeCustomCollections = (
  customCollections: unknown,
  options?: {
    allowBuiltInIds?: boolean;
  },
): EventCollectionMeta[] => {
  if (!Array.isArray(customCollections)) return [];

  const seen = new Set<string>();

  return customCollections.flatMap((collection) => {
    if (!collection || typeof collection !== "object") return [];

    const candidate = collection as Partial<EventCollectionMeta>;
    if (
      !isNonEmptyString(candidate.id) ||
      !isNonEmptyString(candidate.name) ||
      !isNonEmptyString(candidate.emoji)
    ) {
      return [];
    }

    const id = candidate.id.trim();
    if (
      (!options?.allowBuiltInIds && BUILT_IN_COLLECTION_IDS.has(id)) ||
      seen.has(id)
    ) {
      return [];
    }

    seen.add(id);

    return [
      {
        id,
        name: candidate.name.trim(),
        emoji: candidate.emoji.trim(),
        description:
          typeof candidate.description === "string"
            ? candidate.description.trim()
            : "",
        author: isNonEmptyString(candidate.author)
          ? candidate.author.trim()
          : "You",
        createdAt: isNonEmptyString(candidate.createdAt)
          ? candidate.createdAt.trim()
          : createLocalDateStamp(),
        color: typeof candidate.color === "string" ? candidate.color : null,
        dataUrl: undefined,
      },
    ];
  });
};

export const sanitizeVisibleCollectionIds = (
  visibleCollectionIds: unknown,
  collectionLibrary: Record<string, StoredTimelineCollection>,
) => {
  const knownIds = new Set(Object.keys(collectionLibrary));

  const ids = Array.isArray(visibleCollectionIds) ? visibleCollectionIds : [];

  return ids.filter(
    (collectionId, index, allIds): collectionId is string =>
      typeof collectionId === "string" &&
      allIds.indexOf(collectionId) === index &&
      knownIds.has(collectionId),
  );
};

/** Persisted mutes arrive from Drive and JSON imports, so re-validate them. */
const sanitizeDimmedEventUids = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  for (const entry of value) {
    if (isNonEmptyString(entry)) seen.add(entry);
  }
  return [...seen];
};

export const sanitizePersistedTimelineState = (
  value: unknown,
): Partial<TimelinePersistedState> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Partial<TimelinePersistedState>;
  const legacyCustomCollections = sanitizeCustomCollections(
    (candidate as { customCollections?: unknown }).customCollections,
  );
  const legacyCollectionLibrary = buildCollectionLibrary(
    sanitizeCollectionEventsById(
      (candidate as { collectionEventsById?: unknown }).collectionEventsById,
    ),
    legacyCustomCollections,
  );
  const persistedCollectionLibrary = sanitizeCollectionLibrary(
    (candidate as { collectionLibrary?: unknown }).collectionLibrary,
  );
  const collectionLibrary = mergeCollectionLibraries(
    legacyCollectionLibrary,
    persistedCollectionLibrary,
  );

  const sanitized: Partial<TimelinePersistedState> = {
    theme: isThemeMode(candidate.theme) ? candidate.theme : undefined,
    currentLanguage: isSupportedLanguage(
      (candidate as { currentLanguage?: unknown }).currentLanguage,
    )
      ? (candidate as { currentLanguage: SupportedLanguage }).currentLanguage
      : undefined,
    searchQuery:
      typeof candidate.searchQuery === "string"
        ? candidate.searchQuery
        : undefined,
    activeMediaFilters: Array.isArray(candidate.activeMediaFilters)
      ? candidate.activeMediaFilters.filter(
          (filter): filter is MediaFilter =>
            typeof filter === "string" &&
            (MEDIA_FILTERS as readonly string[]).includes(filter),
        )
      : undefined,
    searchSortMode:
      typeof candidate.searchSortMode === "string" &&
      SEARCH_SORT_MODES.includes(candidate.searchSortMode as SearchSortMode)
        ? candidate.searchSortMode
        : undefined,
    timeRangeStartInput:
      typeof candidate.timeRangeStartInput === "string"
        ? candidate.timeRangeStartInput
        : undefined,
    timeRangeEndInput:
      typeof candidate.timeRangeEndInput === "string"
        ? candidate.timeRangeEndInput
        : undefined,
    showOnlyResultsOnTimeline:
      typeof candidate.showOnlyResultsOnTimeline === "boolean"
        ? candidate.showOnlyResultsOnTimeline
        : undefined,
    collectionLibrary,
    deletedCollectionSyncTombstones: sanitizeDeletedCollectionSyncTombstones(
      (candidate as { deletedCollectionSyncTombstones?: unknown })
        .deletedCollectionSyncTombstones,
    ),
    syncPreferences: sanitizeSyncPreferences(
      (candidate as { syncPreferences?: unknown }).syncPreferences,
    ),
    syncConnectionStatus: sanitizeSyncConnectionStatus(
      (candidate as { syncConnectionStatus?: unknown }).syncConnectionStatus,
    ),
    syncAccessToken:
      typeof candidate.syncAccessToken === "string" &&
      candidate.syncAccessToken.trim().length > 0
        ? candidate.syncAccessToken.trim()
        : null,
    syncAccessTokenExpiry:
      typeof candidate.syncAccessTokenExpiry === "number" &&
      Number.isFinite(candidate.syncAccessTokenExpiry)
        ? candidate.syncAccessTokenExpiry
        : null,
    visibleCollectionIds: sanitizeVisibleCollectionIds(
      candidate.visibleCollectionIds,
      collectionLibrary,
    ),
    collectionColorPreferences: sanitizeCollectionColorPreferences(
      candidate.collectionColorPreferences,
    ),
    selectedEventId: sanitizeSelectedEventId(
      (candidate as { selectedEventId?: unknown }).selectedEventId,
      collectionLibrary,
    ),
    navigationPanelTab: sanitizeNavigationPanelTab(
      (candidate as { navigationPanelTab?: unknown }).navigationPanelTab,
    ),
    timelineOrientation: sanitizeTimelineOrientation(
      (candidate as { timelineOrientation?: unknown }).timelineOrientation,
    ),
    timelineOrientationAuto:
      typeof (candidate as { timelineOrientationAuto?: unknown })
        .timelineOrientationAuto === "boolean"
        ? (candidate as { timelineOrientationAuto: boolean })
            .timelineOrientationAuto
        : undefined,
    verticalWheelBehavior: sanitizeVerticalWheelBehavior(
      (candidate as { verticalWheelBehavior?: unknown }).verticalWheelBehavior,
    ),
    verticalTimeDirection: sanitizeVerticalTimeDirection(
      (candidate as { verticalTimeDirection?: unknown }).verticalTimeDirection,
    ),
    savedFocusYear: normalizeFiniteNumber(
      (candidate as { savedFocusYear?: unknown }).savedFocusYear,
    ),
    savedLogZoom: normalizeFiniteNumber(
      (candidate as { savedLogZoom?: unknown }).savedLogZoom,
    ),
    spatialMapping: sanitizeSpatialMapping(
      (candidate as { spatialMapping?: Partial<SpatialMappingConfig> | null })
        .spatialMapping,
    ),
    lastOpenedView: sanitizeLastOpenedView(
      (candidate as { lastOpenedView?: unknown }).lastOpenedView,
    ),
    isToolbarExpanded:
      typeof candidate.isToolbarExpanded === "boolean"
        ? candidate.isToolbarExpanded
        : undefined,
    hasSeededDefaultCollection:
      typeof (candidate as { hasSeededDefaultCollection?: unknown })
        .hasSeededDefaultCollection === "boolean"
        ? (candidate as { hasSeededDefaultCollection: boolean })
            .hasSeededDefaultCollection
        : undefined,
    dimmedEventUids: sanitizeDimmedEventUids(
      (candidate as { dimmedEventUids?: unknown }).dimmedEventUids,
    ),
  };

  // Invalid fields come back as explicit `undefined`; dropping those keys keeps
  // merge's spread over currentState from clobbering the in-memory defaults
  // (a hostile payload used to leave theme/currentLanguage === undefined).
  return Object.fromEntries(
    Object.entries(sanitized).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as Partial<TimelinePersistedState>;
};
