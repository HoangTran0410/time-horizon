import { create } from "zustand";
import { produce } from "immer";
import { loadCatalogByUrl } from "../hooks/useCatalogCollections";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { getInitialTheme } from "../constants/theme";
import type {
  Event,
  EventCollectionMeta,
  StoredEvent,
} from "../constants/types";
import {
  assignRuntimeEventIds,
  buildCustomCollectionMeta,
  createLocalDateStamp,
  DEFAULT_SPATIAL_MAPPING,
  sanitizeSpatialMapping,
  slugifyCollectionId,
  stripRuntimeEventIds,
} from "../helpers";
import { DEFAULT_LANGUAGE } from "../helpers/localization";
import {
  getCollectionEventsById,
  findEventCollectionIdInCollections,
} from "./collectionLookup";
import {
  cleanupLegacyCollectionStorage,
  getLegacyPersistedTimelineState,
} from "./legacyStorage";
import {
  isNonEmptyString,
  createInitialSyncPreferences,
  createCollectionSyncState,
  markCollectionSyncStateDirty,
  createCollectionRecord,
  promoteCollectionToFork,
  getCustomCollectionsFromLibrary,
  sanitizeImportedEvents,
  sanitizePersistedTimelineState,
} from "./sanitizers";
import { DEFAULT_SEARCH_SORT_MODE } from "./search";
import type { TimelineStoreState } from "./types";

export type {
  ImportedCollectionInput,
  NavigationPanelTab,
  TimelineAppView,
  TimelinePersistedState,
  TimelineStoreState,
} from "./types";
export {
  DEFAULT_SEARCH_SORT_MODE,
  filterTimelineSearchEvents,
  getTimelineSearchDateInputError,
  hasActiveTimelineSearch,
  hasActiveTimelineSearchFilters,
  type SearchSortMode,
} from "./search";
export { sanitizeImportedEvents } from "./sanitizers";
export {
  findEventByIdInCollections,
  findEventCollectionIdInCollections,
} from "./collectionLookup";

export const createLocalCollectionId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createInitialTimelineSearchState = (): Pick<
  TimelineStoreState,
  | "searchQuery"
  | "activeMediaFilters"
  | "searchSortMode"
  | "timeRangeStartInput"
  | "timeRangeEndInput"
  | "showOnlyResultsOnTimeline"
> => ({
  searchQuery: "",
  activeMediaFilters: [],
  searchSortMode: DEFAULT_SEARCH_SORT_MODE,
  timeRangeStartInput: "",
  timeRangeEndInput: "",
  showOnlyResultsOnTimeline: false,
});

const createUniqueCollectionId = (
  baseValue: string,
  existingIds: Set<string>,
) => {
  const baseId = slugifyCollectionId(baseValue);
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  existingIds.add(nextId);
  return nextId;
};

const rematerializeCollectionEvents = (
  collectionId: string,
  events: Array<StoredEvent | Event>,
  previousEvents?: Event[],
) =>
  assignRuntimeEventIds(events, {
    collectionId,
    previousEvents,
  });

const STORE_KEY = "time-horizon:timeline-store:v1";

const timelinePersistStorage = createJSONStorage(() => localStorage);

const getInitialEventInfoCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 640px)").matches;
};

const getInitialToolbarCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
};

const findEventCollectionIdInState = (
  state: Pick<TimelineStoreState, "collectionLibrary">,
  eventId: string,
) =>
  findEventCollectionIdInCollections(
    getCollectionEventsById(state.collectionLibrary),
    eventId,
  );

/** Load events for a catalog collection by dataUrl */
const loadCatalogCollectionData = async (
  collectionId: string,
  dataUrl: string,
): Promise<Event[]> => {
  return sanitizeImportedEvents(await loadCatalogByUrl(dataUrl), {
    collectionId,
  });
};

export const useStore = create<TimelineStoreState>()(
  immer(
    persist(
      (set, get) => {
        return {
          theme: getInitialTheme(),
          currentLanguage: DEFAULT_LANGUAGE,
          ...createInitialTimelineSearchState(),
          syncableIds: [],
          catalogMeta: {},
          catalogGroups: [],
          collectionLibrary: {},
          deletedCollectionSyncTombstones: {},
          syncPreferences: createInitialSyncPreferences(),
          syncConnectionStatus: "disconnected",
          syncStatusMessage: null,
          syncAccessToken: null,
          syncAccessTokenExpiry: null,
          visibleCollectionIds: [],
          collectionVisibilityNonce: 0,
          downloadingCollectionIds: [],
          collectionColorPreferences: {},
          selectedEventId: null,
          mobileInfoPanelReopenFlag: 0,
        navigationPanelTab: "goto",
        timelineOrientation: "horizontal",
        timelineOrientationAuto: true,
        verticalWheelBehavior: "pan",
        verticalTimeDirection: "down",
        savedFocusYear: null,
          savedLogZoom: null,
          spatialMapping: DEFAULT_SPATIAL_MAPPING,
          lastOpenedView: "landing",
          hasSeededDefaultCollection: false,
          dimmedEventUids: [],
          hasHydrated: false,
          isRulerActive: false,
          isEventInfoCollapsed: getInitialEventInfoCollapsed(),
          isToolbarExpanded: getInitialToolbarCollapsed(),
          editingEventId: null,
          addingEvent: false,
          addingCollectionId: null,
          isCreatingCollection: false,
          isSpatialAnchorPickMode: false,
          isSidebarOpen: false,
          isSidebarExploreOpen: false,
          setTheme: (theme) => set({ theme }),
          setCurrentLanguage: (currentLanguage) => set({ currentLanguage }),
          toggleTheme: () =>
            set((state) => ({
              theme: state.theme === "dark" ? "light" : "dark",
            })),
          setSearchQuery: (value) => set({ searchQuery: value }),
          toggleMediaFilter: (filter) =>
            set(
              produce((state) => {
                const idx = state.activeMediaFilters.indexOf(filter);
                if (idx >= 0) {
                  state.activeMediaFilters.splice(idx, 1);
                } else {
                  state.activeMediaFilters.push(filter);
                }
              }),
            ),
          setSearchSortMode: (value) => set({ searchSortMode: value }),
          setTimeRangeStartInput: (value) =>
            set({ timeRangeStartInput: value }),
          setTimeRangeEndInput: (value) => set({ timeRangeEndInput: value }),
          setShowOnlyResultsOnTimeline: (value) =>
            set({ showOnlyResultsOnTimeline: value }),
          showCollections: (collectionIds) =>
            set(
              produce((state) => {
                collectionIds.forEach((collectionId) => {
                  if (
                    Object.prototype.hasOwnProperty.call(
                      state.collectionLibrary,
                      collectionId,
                    ) &&
                    !state.visibleCollectionIds.includes(collectionId)
                  ) {
                    state.visibleCollectionIds.push(collectionId);
                  }
                });
                const init = createInitialTimelineSearchState();
                Object.assign(state, init);
              }),
            ),
          addVisibleCollection: (collectionId) =>
            set(
              produce((state) => {
                if (!state.visibleCollectionIds.includes(collectionId)) {
                  state.visibleCollectionIds.push(collectionId);
                }
                state.collectionVisibilityNonce += 1;
              }),
            ),
          setCatalogMeta: (catalogMeta, syncableIds) =>
            set(
              produce((state) => {
                state.catalogMeta = catalogMeta;
                state.syncableIds = syncableIds;
              }),
            ),
          setCatalogGroups: (catalogGroups) => set({ catalogGroups }),
          setSyncConnectionStatus: (syncConnectionStatus, syncStatusMessage = null) =>
            set({
              syncConnectionStatus,
              syncStatusMessage,
            }),
          setSyncAccessToken: (token) =>
            set({
              syncAccessToken: token,
              syncAccessTokenExpiry: token ? Date.now() : null,
            }),
          completeSyncOnboarding: () =>
            set(
              produce((state) => {
                state.syncPreferences.onboardingCompleted = true;
              }),
            ),
          setLastSuccessfulSyncAt: (value) =>
            set(
              produce((state) => {
                state.syncPreferences.lastSuccessfulSyncAt = value;
              }),
            ),
          markSyncSuccess: ({
            syncedAt,
            syncedCollections,
            clearedDeletedCollectionIds,
          }) =>
            set(
              produce((state) => {
                const collectionIds =
                  syncedCollections?.map((collection) => collection.id) ??
                  Object.keys(state.collectionLibrary);
                collectionIds.forEach((collectionId) => {
                  const collection = state.collectionLibrary[collectionId];
                  if (!collection) return;
                  const syncedCollection = syncedCollections?.find(
                    (item) => item.id === collectionId,
                  );
                  collection.sync = createCollectionSyncState(
                    collection,
                    collection.sync,
                    {
                      dirty: false,
                      dirtyReason: undefined,
                      lastLocalChangeAt: collection.sync?.lastLocalChangeAt,
                    },
                  );
                  collection.cloud = {
                    ...(collection.cloud ?? {}),
                    ...(syncedCollection?.fileId
                      ? { fileId: syncedCollection.fileId }
                      : {}),
                    ...(syncedCollection?.revision
                      ? { revision: syncedCollection.revision }
                      : {}),
                    ...(syncedCollection?.contentHash
                      ? { contentHash: syncedCollection.contentHash }
                      : {}),
                    lastSyncedAt: syncedAt,
                  };
                });

                const deletedIds =
                  clearedDeletedCollectionIds ??
                  Object.keys(state.deletedCollectionSyncTombstones);
                deletedIds.forEach((collectionId) => {
                  delete state.deletedCollectionSyncTombstones[collectionId];
                });

                state.syncPreferences.lastSuccessfulSyncAt = syncedAt;
                state.syncStatusMessage = null;
                if (state.syncConnectionStatus !== "error") {
                  state.syncConnectionStatus = "connected";
                }
              }),
            ),
          restoreSyncSnapshot: (payload) =>
            set(
              produce((state) => {
                const restoredVisibleCollectionIds = new Set(
                  state.visibleCollectionIds,
                );

                payload.deletedCollections.forEach((deletedCollection) => {
                  delete state.collectionLibrary[deletedCollection.id];
                  delete state.collectionColorPreferences[deletedCollection.id];
                  restoredVisibleCollectionIds.delete(deletedCollection.id);
                  state.deletedCollectionSyncTombstones[deletedCollection.id] = {
                    deletedAt: deletedCollection.deletedAt,
                    origin: deletedCollection.origin,
                    ...(deletedCollection.sourceCatalogId
                      ? { sourceCatalogId: deletedCollection.sourceCatalogId }
                      : {}),
                  };
                });

                payload.collections.forEach((remoteCollection) => {
                  const nextCollection = createCollectionRecord(
                    remoteCollection.id,
                    {
                      events: sanitizeImportedEvents(remoteCollection.events ?? [], {
                        collectionId: remoteCollection.id,
                        previousEvents:
                          state.collectionLibrary[remoteCollection.id]?.events,
                      }),
                      meta:
                        remoteCollection.meta && remoteCollection.meta.id
                          ? remoteCollection.meta
                          : remoteCollection.meta
                            ? {
                                ...remoteCollection.meta,
                                id: remoteCollection.id,
                              }
                            : null,
                      origin: remoteCollection.origin,
                      sourceCatalogId: remoteCollection.sourceCatalogId,
                      sync: {
                        dirty: false,
                        dirtyReason: undefined,
                        eventUidMigrationComplete: true,
                      },
                    },
                  );

                  nextCollection.cloud = {
                    ...(nextCollection.cloud ?? {}),
                    lastSyncedAt:
                      payload.preferences.lastSuccessfulSyncAt ??
                      payload.generatedAt,
                  };

                  state.collectionLibrary[remoteCollection.id] = nextCollection;
                  delete state.deletedCollectionSyncTombstones[remoteCollection.id];

                  if (remoteCollection.colorPreference) {
                    state.collectionColorPreferences[remoteCollection.id] =
                      remoteCollection.colorPreference;
                  }

                  restoredVisibleCollectionIds.add(remoteCollection.id);
                });

                state.visibleCollectionIds = Array.from(restoredVisibleCollectionIds);
                state.syncPreferences = {
                  ...state.syncPreferences,
                  ...payload.preferences,
                  onboardingCompleted: true,
                  lastSuccessfulSyncAt:
                    payload.preferences.lastSuccessfulSyncAt ??
                    payload.generatedAt,
                };
                state.syncStatusMessage = null;
                state.syncConnectionStatus = "connected";
              }),
            ),
          downloadCollection: async (collectionId) => {
            const catalogMeta = get().catalogMeta;
            const catalogEntry = catalogMeta[collectionId];
            if (!catalogEntry?.dataUrl) {
              // Not a catalog collection — nothing to download
              return false;
            }

            const currentState = get();
            if (currentState.collectionLibrary[collectionId]) {
              currentState.addVisibleCollection(collectionId);
              return true;
            }

            set(
              produce((state) => {
                if (!state.downloadingCollectionIds.includes(collectionId)) {
                  state.downloadingCollectionIds.push(collectionId);
                }
              }),
            );

            try {
              const loadedEvents = await loadCatalogCollectionData(
                collectionId,
                catalogEntry.dataUrl,
              );
              set(
                produce((state) => {
                  state.collectionLibrary[collectionId] = createCollectionRecord(
                    collectionId,
                    {
                      ...state.collectionLibrary[collectionId],
                      events: loadedEvents,
                      meta: catalogEntry,
                      origin: "catalog",
                    },
                  );
                  delete state.deletedCollectionSyncTombstones[collectionId];
                  if (!state.visibleCollectionIds.includes(collectionId)) {
                    state.visibleCollectionIds.push(collectionId);
                  }
                }),
              );
              return true;
            } catch (error) {
              console.error(error);
              return false;
            } finally {
              set(
                produce((state) => {
                  state.downloadingCollectionIds =
                    state.downloadingCollectionIds.filter(
                      (id) => id !== collectionId,
                    );
                }),
              );
            }
          },
          syncCollection: async (collectionId) => {
            const catalogMeta = get().catalogMeta;
            const catalogEntry = catalogMeta[collectionId];
            if (!catalogEntry?.dataUrl) return;
            if (get().collectionLibrary[collectionId]?.origin !== "catalog") {
              return;
            }

            if (get().downloadingCollectionIds.includes(collectionId)) {
              return;
            }

            set(
              produce((state) => {
                if (!state.downloadingCollectionIds.includes(collectionId)) {
                  state.downloadingCollectionIds.push(collectionId);
                }
              }),
            );

            try {
              const loadedEvents = await loadCatalogCollectionData(
                collectionId,
                catalogEntry.dataUrl,
              );
              set(
                produce((state) => {
                  state.collectionLibrary[collectionId] = createCollectionRecord(
                    collectionId,
                    {
                      ...state.collectionLibrary[collectionId],
                      events: loadedEvents,
                      meta: state.collectionLibrary[collectionId]?.meta ?? catalogEntry,
                      origin: "catalog",
                    },
                  );
                  delete state.deletedCollectionSyncTombstones[collectionId];
                }),
              );
            } catch (error) {
              console.error(error);
            } finally {
              set(
                produce((state) => {
                  state.downloadingCollectionIds =
                    state.downloadingCollectionIds.filter(
                      (id) => id !== collectionId,
                    );
                }),
              );
            }
          },
          setCollectionVisibility: (collectionId, visible) =>
            set(
              produce((state) => {
                if (visible) {
                  if (!state.visibleCollectionIds.includes(collectionId)) {
                    state.visibleCollectionIds.push(collectionId);
                  }
                } else {
                  state.visibleCollectionIds =
                    state.visibleCollectionIds.filter(
                      (id) => id !== collectionId,
                    );
                }
                const init = createInitialTimelineSearchState();
                Object.assign(state, init);
                state.collectionVisibilityNonce += 1;
              }),
            ),
          importCollections: (collections) => {
            const currentState = get();
            const existingCollections = [
              ...getCustomCollectionsFromLibrary(
                currentState.collectionLibrary,
              ),
            ];
            const existingIds = new Set(
              existingCollections.map((item) => item.id),
            );
            const importedCollectionIds: string[] = [];

            // Pre-compute what will be written so we can assign directly in produce
            const collectionWrites: Array<{
              id: string;
              events: Event[];
              meta: EventCollectionMeta;
              colorPref?: string;
              visible: boolean;
            }> = [];

            collections.forEach((collection) => {
              const candidateMeta = collection.meta;
              if (!candidateMeta) return;

              const name = isNonEmptyString(candidateMeta.name)
                ? candidateMeta.name.trim()
                : "";
              const emoji = isNonEmptyString(candidateMeta.emoji)
                ? candidateMeta.emoji.trim()
                : "";
              const description =
                typeof candidateMeta.description === "string"
                  ? candidateMeta.description.trim()
                  : "";

              if (!name || !emoji) return;

              const preferredId =
                isNonEmptyString(candidateMeta.id) &&
                candidateMeta.id.trim().length > 0
                  ? candidateMeta.id.trim()
                  : name;
              const nextId = createUniqueCollectionId(preferredId, existingIds);
              const importedEvents = sanitizeImportedEvents(collection.events, {
                collectionId: nextId,
              });
              const nextCollection: EventCollectionMeta = {
                id: nextId,
                name,
                emoji,
                description,
                author: isNonEmptyString(candidateMeta.author)
                  ? candidateMeta.author.trim()
                  : "Imported",
                createdAt: isNonEmptyString(candidateMeta.createdAt)
                  ? candidateMeta.createdAt.trim()
                  : createLocalDateStamp(),
                color:
                  typeof candidateMeta.color === "string"
                    ? candidateMeta.color
                    : null,
                dataUrl: undefined,
              };

              importedCollectionIds.push(nextId);

              const colorPref =
                typeof collection.color === "string" && collection.color.trim()
                  ? collection.color.trim()
                  : (nextCollection.color ?? undefined);

              collectionWrites.push({
                id: nextId,
                events: importedEvents,
                meta: nextCollection,
                colorPref,
                visible: collection.visible !== false,
              });
            });

            if (importedCollectionIds.length === 0) {
              return { importedCollectionIds };
            }

            set(
              produce((state) => {
                const changedAt = new Date().toISOString();
                const init = createInitialTimelineSearchState();
                Object.assign(state, init);
                collectionWrites.forEach(
                  ({ id, events, meta, colorPref, visible }) => {
                    state.collectionLibrary[id] = createCollectionRecord(id, {
                      events,
                      meta,
                      origin: "custom",
                    });
                    markCollectionSyncStateDirty(
                      state.collectionLibrary[id],
                      "content",
                      changedAt,
                    );
                    delete state.deletedCollectionSyncTombstones[id];
                    if (colorPref)
                      state.collectionColorPreferences[id] = colorPref;
                    if (visible && !state.visibleCollectionIds.includes(id)) {
                      state.visibleCollectionIds.push(id);
                    }
                  },
                );
              }),
            );

            return { importedCollectionIds };
          },
          deleteCollection: (collectionId) =>
            set(
              produce((state) => {
                const existingCollection = state.collectionLibrary[collectionId];
                if (existingCollection) {
                  state.deletedCollectionSyncTombstones[collectionId] = {
                    deletedAt: new Date().toISOString(),
                    origin: existingCollection.origin ?? "custom",
                    ...(existingCollection.sourceCatalogId
                      ? { sourceCatalogId: existingCollection.sourceCatalogId }
                      : {}),
                  };
                }
                const selectedInCollection =
                  state.selectedEventId !== null &&
                  findEventCollectionIdInState(state, state.selectedEventId) ===
                    collectionId;
                const editingInCollection =
                  state.editingEventId !== null &&
                  findEventCollectionIdInState(state, state.editingEventId) ===
                    collectionId;
                delete state.collectionLibrary[collectionId];
                delete state.collectionColorPreferences[collectionId];
                state.visibleCollectionIds = state.visibleCollectionIds.filter(
                  (id) => id !== collectionId,
                );
                state.downloadingCollectionIds =
                  state.downloadingCollectionIds.filter(
                    (id) => id !== collectionId,
                  );
                if (selectedInCollection) {
                  state.selectedEventId = null;
                  state.isRulerActive = false;
                }
                if (editingInCollection) {
                  state.editingEventId = null;
                }
                if (state.addingCollectionId === collectionId) {
                  state.addingEvent = false;
                  state.addingCollectionId = null;
                }
              }),
            ),
          saveEvent: (updatedEvent) =>
            set(
              produce((state) => {
                const ownerCollectionId = findEventCollectionIdInState(
                  state,
                  updatedEvent.id,
                );
                if (!ownerCollectionId) return;
                const ownerCollection =
                  state.collectionLibrary[ownerCollectionId];
                if (!ownerCollection) return;
                promoteCollectionToFork(ownerCollectionId, ownerCollection);
                const idx = ownerCollection.events.findIndex(
                  (event) => event.id === updatedEvent.id,
                );
                if (idx < 0) return;

                const nextEvents = [...ownerCollection.events];
                nextEvents[idx] = updatedEvent;
                ownerCollection.events = rematerializeCollectionEvents(
                  ownerCollectionId,
                  nextEvents,
                  ownerCollection.events,
                );
                markCollectionSyncStateDirty(
                  ownerCollection,
                  "content",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[ownerCollectionId];

                const nextEventId = ownerCollection.events[idx]?.id ?? null;
                if (state.selectedEventId === updatedEvent.id) {
                  state.selectedEventId = nextEventId;
                }
                if (state.editingEventId === updatedEvent.id) {
                  state.editingEventId = nextEventId;
                }
              }),
            ),
          addEvent: (newEvent, targetCollectionId) =>
            set(
              produce((state) => {
                if (!state.collectionLibrary[targetCollectionId]) {
                  state.collectionLibrary[targetCollectionId] =
                    createCollectionRecord(targetCollectionId, {
                      events: [],
                      origin: "custom",
                    });
                }
                const ownerCollection =
                  state.collectionLibrary[targetCollectionId];
                promoteCollectionToFork(targetCollectionId, ownerCollection);
                ownerCollection.events = rematerializeCollectionEvents(
                  targetCollectionId,
                  [...ownerCollection.events, newEvent],
                  ownerCollection.events,
                );
                markCollectionSyncStateDirty(
                  ownerCollection,
                  "content",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[targetCollectionId];
                if (!state.visibleCollectionIds.includes(targetCollectionId)) {
                  state.visibleCollectionIds.push(targetCollectionId);
                }
              }),
            ),
          addEvents: (newEvents, targetCollectionId) =>
            set(
              produce((state) => {
                if (!state.collectionLibrary[targetCollectionId]) {
                  state.collectionLibrary[targetCollectionId] =
                    createCollectionRecord(targetCollectionId, {
                      events: [],
                      origin: "custom",
                    });
                }
                const ownerCollection =
                  state.collectionLibrary[targetCollectionId];
                promoteCollectionToFork(targetCollectionId, ownerCollection);
                ownerCollection.events = rematerializeCollectionEvents(
                  targetCollectionId,
                  [...ownerCollection.events, ...newEvents],
                  ownerCollection.events,
                );
                markCollectionSyncStateDirty(
                  ownerCollection,
                  "content",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[targetCollectionId];
                if (!state.visibleCollectionIds.includes(targetCollectionId)) {
                  state.visibleCollectionIds.push(targetCollectionId);
                }
              }),
            ),
          replaceCollectionEvents: (targetCollectionId, events) =>
            set(
              produce((state) => {
                if (!state.collectionLibrary[targetCollectionId]) {
                  state.collectionLibrary[targetCollectionId] =
                    createCollectionRecord(targetCollectionId, {
                      events: [],
                      origin: "custom",
                    });
                }

                const ownerCollection =
                  state.collectionLibrary[targetCollectionId];
                promoteCollectionToFork(targetCollectionId, ownerCollection);
                ownerCollection.events = rematerializeCollectionEvents(
                  targetCollectionId,
                  events,
                  ownerCollection.events,
                );
                markCollectionSyncStateDirty(
                  ownerCollection,
                  "content",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[targetCollectionId];

                if (!state.visibleCollectionIds.includes(targetCollectionId)) {
                  state.visibleCollectionIds.push(targetCollectionId);
                }

                if (
                  state.selectedEventId &&
                  !ownerCollection.events.some(
                    (event) => event.id === state.selectedEventId,
                  ) &&
                  findEventCollectionIdInState(state, state.selectedEventId) ===
                    null
                ) {
                  state.selectedEventId = null;
                  state.isRulerActive = false;
                }

                if (
                  state.editingEventId &&
                  !ownerCollection.events.some(
                    (event) => event.id === state.editingEventId,
                  ) &&
                  findEventCollectionIdInState(state, state.editingEventId) ===
                    null
                ) {
                  state.editingEventId = null;
                }
              }),
            ),
          deleteEvent: (eventId) =>
            set(
              produce((state) => {
                const ownerCollectionId = findEventCollectionIdInState(
                  state,
                  eventId,
                );
                if (!ownerCollectionId) return;
                const ownerCollection =
                  state.collectionLibrary[ownerCollectionId];
                if (!ownerCollection) return;
                promoteCollectionToFork(ownerCollectionId, ownerCollection);
                const nextEvents = ownerCollection.events.filter(
                  (event) => event.id !== eventId,
                );
                ownerCollection.events = rematerializeCollectionEvents(
                  ownerCollectionId,
                  nextEvents,
                  ownerCollection.events,
                );
                markCollectionSyncStateDirty(
                  ownerCollection,
                  "content",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[ownerCollectionId];
                if (state.selectedEventId === eventId) {
                  state.selectedEventId = null;
                  state.isRulerActive = false;
                }
                if (state.editingEventId === eventId) {
                  state.editingEventId = null;
                }
              }),
            ),
          createCollection: (collection) => {
            const currentState = get();
            const existingCollections = [
              ...getCustomCollectionsFromLibrary(
                currentState.collectionLibrary,
              ),
            ];
            const nextCollection = buildCustomCollectionMeta(
              collection,
              existingCollections,
            );

            set(
              produce((state) => {
                state.collectionLibrary[nextCollection.id] =
                  createCollectionRecord(nextCollection.id, {
                    events: [],
                    meta: nextCollection,
                    origin: "custom",
                  });
                markCollectionSyncStateDirty(
                  state.collectionLibrary[nextCollection.id],
                  "content",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[nextCollection.id];
                if (!state.visibleCollectionIds.includes(nextCollection.id)) {
                  state.visibleCollectionIds.push(nextCollection.id);
                }
              }),
            );

            return nextCollection;
          },
          updateCollection: (collectionId, collection) =>
            set(
              produce((state) => {
                const existingCollection =
                  state.collectionLibrary[collectionId];
                const baseCollection = existingCollection?.meta;
                if (!existingCollection || !baseCollection) return;
                promoteCollectionToFork(collectionId, existingCollection);
                state.collectionLibrary[collectionId] =
                  createCollectionRecord(collectionId, {
                    ...existingCollection,
                    meta: {
                      ...baseCollection,
                      emoji: collection.emoji.trim() || baseCollection.emoji,
                      name: collection.name.trim() || baseCollection.name,
                      description: collection.description.trim(),
                    },
                  });
                markCollectionSyncStateDirty(
                  state.collectionLibrary[collectionId],
                  "metadata",
                  new Date().toISOString(),
                );
                delete state.deletedCollectionSyncTombstones[collectionId];
              }),
            ),
          setCollectionColor: (collectionId, color) =>
            set(
              produce((state) => {
                state.collectionColorPreferences[collectionId] = color;
                const collection = state.collectionLibrary[collectionId];
                if (collection) {
                  markCollectionSyncStateDirty(
                    collection,
                    "color",
                    new Date().toISOString(),
                  );
                  delete state.deletedCollectionSyncTombstones[collectionId];
                }
              }),
            ),
          resetCollectionColor: (collectionId) =>
            set(
              produce((state) => {
                delete state.collectionColorPreferences[collectionId];
                const collection = state.collectionLibrary[collectionId];
                if (collection) {
                  markCollectionSyncStateDirty(
                    collection,
                    "color",
                    new Date().toISOString(),
                  );
                  delete state.deletedCollectionSyncTombstones[collectionId];
                }
              }),
            ),
          focusEvent: (eventId) =>
            set({
              selectedEventId: eventId,
              isRulerActive: false,
            }),
          previewEvent: (eventId) =>
            set({
              selectedEventId: eventId,
              isRulerActive: false,
              isEventInfoCollapsed: false,
            }),
          clearFocusedEvent: () =>
            set({
              selectedEventId: null,
              isRulerActive: false,
            }),
          reopenMobileInfoPanel: () =>
            set((state) => ({
              mobileInfoPanelReopenFlag: state.mobileInfoPanelReopenFlag + 1,
            })),
          setNavigationPanelTab: (tab) =>
            set({
              navigationPanelTab: tab,
            }),
          // An explicit choice latches auto off — otherwise the next resize
          // would immediately overrule what the user just picked.
          setTimelineOrientation: (timelineOrientation) =>
            set({
              timelineOrientation,
              timelineOrientationAuto: false,
            }),
          setTimelineOrientationAuto: (timelineOrientationAuto) =>
            set({
              timelineOrientationAuto,
            }),
        setVerticalWheelBehavior: (verticalWheelBehavior) =>
          set({
            verticalWheelBehavior,
          }),
        setVerticalTimeDirection: (verticalTimeDirection) =>
          set({
            verticalTimeDirection,
          }),
        setSavedViewport: (focusYear, logZoom) =>
          set({
            savedFocusYear: focusYear,
              savedLogZoom: logZoom,
            }),
          setSpatialMapping: (mapping) =>
            set((state) => ({
              spatialMapping: sanitizeSpatialMapping({
                ...state.spatialMapping,
                ...mapping,
              }),
            })),
          resetSpatialMapping: () =>
            set({
              spatialMapping: DEFAULT_SPATIAL_MAPPING,
              isSpatialAnchorPickMode: false,
            }),
          toggleSpatialMappingEnabled: () =>
            set((state) => ({
              spatialMapping: {
                ...state.spatialMapping,
                enabled: !state.spatialMapping.enabled,
              },
            })),
          startSpatialAnchorPickMode: () =>
            set({
              isSpatialAnchorPickMode: true,
            }),
          stopSpatialAnchorPickMode: () =>
            set({
              isSpatialAnchorPickMode: false,
            }),
          setLastOpenedView: (view) =>
            set({
              lastOpenedView: view,
            }),
          markDefaultCollectionSeeded: () =>
            set({
              hasSeededDefaultCollection: true,
            }),
          toggleEventDimmed: (eventUid) =>
            set((state) => {
              if (!isNonEmptyString(eventUid)) return;
              const index = state.dimmedEventUids.indexOf(eventUid);
              if (index === -1) state.dimmedEventUids.push(eventUid);
              else state.dimmedEventUids.splice(index, 1);
            }),
          clearDimmedEvents: () =>
            set((state) => {
              if (state.dimmedEventUids.length === 0) return;
              state.dimmedEventUids = [];
            }),
          setHasHydrated: (value) =>
            set({
              hasHydrated: value,
            }),
          setIsRulerActive: (value) => set({ isRulerActive: value }),
          toggleEventInfoCollapsed: () =>
            set((state) => ({
              isEventInfoCollapsed: !state.isEventInfoCollapsed,
            })),
          setToolbarCollapsed: (value) => set({ isToolbarExpanded: value }),
          toggleToolbarCollapsed: () =>
            set((state) => ({
              isToolbarExpanded: !state.isToolbarExpanded,
            })),
          openEventEditor: (eventId) =>
            set({
              editingEventId: eventId,
            }),
          closeEventEditor: () =>
            set({
              editingEventId: null,
            }),
          openEventCreator: (collectionId = null) =>
            set({
              addingEvent: true,
              addingCollectionId: collectionId,
            }),
          closeEventCreator: () =>
            set({
              addingEvent: false,
              addingCollectionId: null,
            }),
          openCollectionCreator: () =>
            set({
              isCreatingCollection: true,
            }),
          closeCollectionCreator: () =>
            set({
              isCreatingCollection: false,
            }),
          openSidebar: () => set({ isSidebarOpen: true }),
          closeSidebar: () => set({ isSidebarOpen: false }),
          openSidebarExplore: () =>
            set({ isSidebarOpen: true, isSidebarExploreOpen: true }),
          closeSidebarExplore: () => set({ isSidebarExploreOpen: false }),
        };
      },
      {
        name: STORE_KEY,
        version: 5,
        storage: timelinePersistStorage,
        // The stored version arrives as the second argument — the state object
        // itself never carries a `version` key (partialize doesn't write one),
        // so reading it off the state sent every payload down the legacy branch.
        migrate: (persistedState, version) => {
          if (!persistedState || version === undefined || version === 0) {
            const legacy = getLegacyPersistedTimelineState();
            return sanitizePersistedTimelineState(
              Object.keys(legacy).length > 0 ? legacy : persistedState,
            );
          }
          return sanitizePersistedTimelineState(persistedState);
        },
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...sanitizePersistedTimelineState(persistedState),
          // Always reset connection status on reload — auth token may be stale.
          // Force onboarding to incomplete so the Connect button shows instead of
          // sync/restore buttons until user re-authenticates successfully.
          syncConnectionStatus: "disconnected",
          syncStatusMessage: null,
          syncPreferences: {
            ...currentState.syncPreferences,
            onboardingCompleted: false,
          },
        }),
        onRehydrateStorage: () => (state) => {
          cleanupLegacyCollectionStorage();
          state?.setHasHydrated(true);
        },
          partialize: (state) => ({
          theme: state.theme,
          currentLanguage: state.currentLanguage,
          searchQuery: state.searchQuery,
          activeMediaFilters: state.activeMediaFilters,
          searchSortMode: state.searchSortMode,
          timeRangeStartInput: state.timeRangeStartInput,
          timeRangeEndInput: state.timeRangeEndInput,
          showOnlyResultsOnTimeline: state.showOnlyResultsOnTimeline,
          collectionLibrary: Object.fromEntries(
            Object.entries(state.collectionLibrary).map(
              ([collectionId, collection]) => [
                collectionId,
                {
                  ...collection,
                  events: stripRuntimeEventIds(collection.events),
                },
              ],
            ),
          ),
          deletedCollectionSyncTombstones: state.deletedCollectionSyncTombstones,
          syncPreferences: state.syncPreferences,
          syncConnectionStatus: state.syncConnectionStatus,
          syncAccessToken: state.syncAccessToken,
          syncAccessTokenExpiry: state.syncAccessTokenExpiry,
          visibleCollectionIds: state.visibleCollectionIds,
          collectionColorPreferences: state.collectionColorPreferences,
          selectedEventId: state.selectedEventId,
        navigationPanelTab: state.navigationPanelTab,
        timelineOrientation: state.timelineOrientation,
        timelineOrientationAuto: state.timelineOrientationAuto,
        verticalWheelBehavior: state.verticalWheelBehavior,
        verticalTimeDirection: state.verticalTimeDirection,
        savedFocusYear: state.savedFocusYear,
          savedLogZoom: state.savedLogZoom,
          spatialMapping: state.spatialMapping,
          lastOpenedView: state.lastOpenedView,
          isToolbarExpanded: state.isToolbarExpanded,
          hasSeededDefaultCollection: state.hasSeededDefaultCollection,
          dimmedEventUids: state.dimmedEventUids,
        }),
      },
    ),
  ),
);
