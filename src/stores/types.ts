/** Shape of the single timeline store and the subset of it that is persisted. */

import type { ThemeMode } from "../constants/theme";
import type {
  DeletedCollectionSyncTombstone,
  Event,
  CollectionGroupDefinition,
  EventCollectionMeta,
  MediaFilter,
  SpatialMappingConfig,
  StoredTimelineCollection,
  CollectionCreationInput,
  SupportedLanguage,
  SyncConnectionStatus,
  SyncPreferences,
  TimelineOrientation,
  VerticalWheelBehavior,
  VerticalTimeDirection,
} from "../constants/types";
import type { SyncProjectionRemoteState } from "../sync";
import type { SearchSortMode } from "./search";

export type TimelineAppView = "landing" | "timeline";
export type NavigationPanelTab = "goto" | "display";

export type TimelineStoreState = {
  theme: ThemeMode;
  currentLanguage: SupportedLanguage;
  searchQuery: string;
  activeMediaFilters: MediaFilter[];
  searchSortMode: SearchSortMode;
  timeRangeStartInput: string;
  timeRangeEndInput: string;
  showOnlyResultsOnTimeline: boolean;
  /** Cached syncable collection IDs from catalog metadata */
  syncableIds: string[];
  /** Cached catalog collection metadata (id → meta) for quick lookup */
  catalogMeta: Record<string, EventCollectionMeta>;
  /** Topical folder definitions for the catalog (from data/collection-groups.json) */
  catalogGroups: CollectionGroupDefinition[];
  /** Downloaded collection data */
  collectionLibrary: Record<string, StoredTimelineCollection>;
  deletedCollectionSyncTombstones: Record<string, DeletedCollectionSyncTombstone>;
  syncPreferences: SyncPreferences;
  syncConnectionStatus: SyncConnectionStatus;
  syncStatusMessage: string | null;
  syncAccessToken: string | null;
  syncAccessTokenExpiry: number | null;
  visibleCollectionIds: string[];
  /**
   * Bumped only when a person turns a layer on or off — the sidebar toggle, the
   * explore modal, opening a collection from the landing page, finishing an
   * import. Restoring `visibleCollectionIds` from a share URL or from
   * localStorage leaves it alone, which is how the timeline tells "the user
   * asked for a different set of layers" apart from "this session is still
   * being reassembled". Session-only: never persisted.
   */
  collectionVisibilityNonce: number;
  downloadingCollectionIds: string[];
  collectionColorPreferences: Record<string, string>;
  selectedEventId: string | null;
  /** Incremented by the viewport click handler when user re-clicks the selected event */
  mobileInfoPanelReopenFlag: number;
  navigationPanelTab: NavigationPanelTab;
  timelineOrientation: TimelineOrientation;
  /**
   * When true the effective orientation follows viewport width instead of
   * `timelineOrientation` — narrow screens get vertical, where a whole run of
   * events is readable, rather than horizontal where only a couple fit.
   * Picking an orientation by hand latches this off.
   */
  timelineOrientationAuto: boolean;
  verticalWheelBehavior: VerticalWheelBehavior;
  verticalTimeDirection: VerticalTimeDirection;
  savedFocusYear: number | null;
  savedLogZoom: number | null;
  spatialMapping: SpatialMappingConfig;
  lastOpenedView: TimelineAppView;
  /**
   * True once the first-run default collection has been seeded (or the user
   * has downloaded/created anything themselves). Guards against re-seeding for
   * a user who deliberately emptied their library.
   */
  hasSeededDefaultCollection: boolean;
  /**
   * Events the user has muted so they stop dominating the view — a long era
   * spanning the whole viewport crowds out everything inside it. Keyed by the
   * durable eventUid, so a mute survives re-download and sync.
   */
  dimmedEventUids: string[];
  hasHydrated: boolean;
  isRulerActive: boolean;
  isEventInfoCollapsed: boolean;
  isToolbarExpanded: boolean;
  editingEventId: string | null;
  addingEvent: boolean;
  addingCollectionId: string | null;
  isCreatingCollection: boolean;
  isSpatialAnchorPickMode: boolean;
  // Ephemeral sidebar UI state (not persisted)
  isSidebarOpen: boolean;
  isSidebarExploreOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  setCurrentLanguage: (language: SupportedLanguage) => void;
  toggleTheme: () => void;
  setSearchQuery: (value: string) => void;
  toggleMediaFilter: (filter: MediaFilter) => void;
  setSearchSortMode: (value: SearchSortMode) => void;
  setTimeRangeStartInput: (value: string) => void;
  setTimeRangeEndInput: (value: string) => void;
  setShowOnlyResultsOnTimeline: (value: boolean) => void;
  showCollections: (collectionIds: string[]) => void;
  addVisibleCollection: (collectionId: string) => void;
  /** Replace cached catalog metadata (called by UI after fetching data/collections-metadata.json) */
  setCatalogMeta: (
    catalogMeta: Record<string, EventCollectionMeta>,
    syncableIds: string[],
  ) => void;
  setCatalogGroups: (catalogGroups: CollectionGroupDefinition[]) => void;
  setSyncConnectionStatus: (
    status: SyncConnectionStatus,
    message?: string | null,
  ) => void;
  setSyncAccessToken: (token: string | null) => void;
  completeSyncOnboarding: () => void;
  setLastSuccessfulSyncAt: (value: string | null) => void;
  markSyncSuccess: (payload: {
    syncedAt: string;
    syncedCollections?: Array<{
      id: string;
      fileId?: string;
      revision?: string;
      contentHash?: string;
    }>;
    clearedDeletedCollectionIds?: string[];
  }) => void;
  restoreSyncSnapshot: (payload: SyncProjectionRemoteState) => void;
  /** Download a catalog collection by ID */
  downloadCollection: (collectionId: string) => Promise<boolean>;
  /** Re-sync / re-download a catalog collection by ID */
  syncCollection: (collectionId: string) => Promise<void>;
  setCollectionVisibility: (collectionId: string, visible: boolean) => void;
  importCollections: (collections: ImportedCollectionInput[]) => {
    importedCollectionIds: string[];
  };
  deleteCollection: (collectionId: string) => void;
  saveEvent: (updatedEvent: Event) => void;
  addEvent: (newEvent: Event, targetCollectionId: string) => void;
  addEvents: (newEvents: Event[], targetCollectionId: string) => void;
  replaceCollectionEvents: (
    targetCollectionId: string,
    events: Event[],
  ) => void;
  deleteEvent: (eventId: string) => void;
  createCollection: (
    collection: CollectionCreationInput,
  ) => EventCollectionMeta;
  updateCollection: (
    collectionId: string,
    collection: CollectionCreationInput,
  ) => void;
  setCollectionColor: (collectionId: string, color: string) => void;
  resetCollectionColor: (collectionId: string) => void;
  focusEvent: (eventId: string) => void;
  previewEvent: (eventId: string) => void;
  clearFocusedEvent: () => void;
  /** Increment the flag to signal the mobile info panel should re-open */
  reopenMobileInfoPanel: () => void;
  setNavigationPanelTab: (tab: NavigationPanelTab) => void;
  setTimelineOrientation: (orientation: TimelineOrientation) => void;
  setTimelineOrientationAuto: (auto: boolean) => void;
  setVerticalWheelBehavior: (behavior: VerticalWheelBehavior) => void;
  setVerticalTimeDirection: (direction: VerticalTimeDirection) => void;
  setSavedViewport: (focusYear: number, logZoom: number) => void;
  setSpatialMapping: (mapping: Partial<SpatialMappingConfig>) => void;
  resetSpatialMapping: () => void;
  toggleSpatialMappingEnabled: () => void;
  startSpatialAnchorPickMode: () => void;
  stopSpatialAnchorPickMode: () => void;
  setLastOpenedView: (view: TimelineAppView) => void;
  markDefaultCollectionSeeded: () => void;
  /** Mute or unmute a single event by its durable eventUid. */
  toggleEventDimmed: (eventUid: string) => void;
  clearDimmedEvents: () => void;
  setHasHydrated: (value: boolean) => void;
  setIsRulerActive: (value: boolean) => void;
  toggleEventInfoCollapsed: () => void;
  setToolbarCollapsed: (value: boolean) => void;
  toggleToolbarCollapsed: () => void;
  openEventEditor: (eventId: string) => void;
  closeEventEditor: () => void;
  openEventCreator: (collectionId?: string | null) => void;
  closeEventCreator: () => void;
  openCollectionCreator: () => void;
  closeCollectionCreator: () => void;
  // Sidebar UI actions
  openSidebar: () => void;
  closeSidebar: () => void;
  openSidebarExplore: () => void;
  closeSidebarExplore: () => void;
};

export type ImportedCollectionInput = {
  meta?: Partial<EventCollectionMeta> | null;
  events?: unknown;
  color?: string | null;
  visible?: boolean;
};

export type TimelinePersistedState = Pick<
  TimelineStoreState,
  | "theme"
  | "currentLanguage"
  | "searchQuery"
  | "activeMediaFilters"
  | "searchSortMode"
  | "timeRangeStartInput"
  | "timeRangeEndInput"
  | "showOnlyResultsOnTimeline"
  | "collectionLibrary"
  | "deletedCollectionSyncTombstones"
  | "syncPreferences"
  | "syncConnectionStatus"
  | "syncAccessToken"
  | "syncAccessTokenExpiry"
  | "visibleCollectionIds"
  | "collectionColorPreferences"
  | "selectedEventId"
  | "navigationPanelTab"
  | "timelineOrientation"
  | "timelineOrientationAuto"
  | "verticalWheelBehavior"
  | "verticalTimeDirection"
  | "savedFocusYear"
  | "savedLogZoom"
  | "spatialMapping"
  | "lastOpenedView"
  | "isToolbarExpanded"
  | "hasSeededDefaultCollection"
  | "dimmedEventUids"
>;
