import { create } from "zustand";
import { loadCatalogByUrl } from "../hooks/useCatalogCollections";
import { createJSONStorage, persist } from "zustand/middleware";
import { ThemeMode, getInitialTheme } from "../constants/theme";
import type {
  Event,
  EventCollectionMeta,
  MediaFilter,
  StoredTimelineCollection,
  CollectionCreationInput,
} from "../constants/types";
import { MEDIA_FILTERS } from "../constants/types";
import {
  buildCustomCollectionMeta,
  createLocalDateStamp,
  normalizeEventTimeParts,
  slugifyCollectionId,
} from "../helpers";

export const createLocalCollectionId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type SearchSortMode =
  | "best-match"
  | "time-asc"
  | "time-desc"
  | "name-asc"
  | "name-desc";

export const DEFAULT_SEARCH_SORT_MODE: SearchSortMode = "best-match";

type PartialDateInput = {
  year: number;
  month: number | null;
  day: number | null;
};

type AbsoluteYearRange = {
  start: number;
  end: number;
};

export type TimelineAppView = "landing" | "timeline";

type TimelineStoreState = {
  theme: ThemeMode;
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
  /** Downloaded collection data */
  collectionLibrary: Record<string, StoredTimelineCollection>;
  visibleCollectionIds: string[];
  downloadingCollectionIds: string[];
  collectionColorPreferences: Record<string, string>;
  selectedEventId: string | null;
  savedFocusYear: number | null;
  savedLogZoom: number | null;
  lastOpenedView: TimelineAppView;
  hasHydrated: boolean;
  isRulerActive: boolean;
  isEventInfoCollapsed: boolean;
  editingEventId: string | null;
  addingEvent: boolean;
  addingCollectionId: string | null;
  isCreatingCollection: boolean;
  // Ephemeral sidebar UI state (not persisted)
  isSidebarOpen: boolean;
  isSidebarExploreOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
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
  /** Download a catalog collection by ID */
  downloadCollection: (collectionId: string) => Promise<void>;
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
  setSavedViewport: (focusYear: number, logZoom: number) => void;
  setLastOpenedView: (view: TimelineAppView) => void;
  setHasHydrated: (value: boolean) => void;
  setIsRulerActive: (value: boolean) => void;
  toggleEventInfoCollapsed: () => void;
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

type ImportedCollectionInput = {
  meta?: Partial<EventCollectionMeta> | null;
  events?: unknown;
  color?: string | null;
  visible?: boolean;
};

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

type TimelinePersistedState = Pick<
  TimelineStoreState,
  | "theme"
  | "searchQuery"
  | "activeMediaFilters"
  | "searchSortMode"
  | "timeRangeStartInput"
  | "timeRangeEndInput"
  | "showOnlyResultsOnTimeline"
  | "collectionLibrary"
  | "visibleCollectionIds"
  | "collectionColorPreferences"
  | "selectedEventId"
  | "savedFocusYear"
  | "savedLogZoom"
  | "lastOpenedView"
>;

const STORE_KEY = "time-horizon:timeline-store:v1";
const PARTIAL_DATE_INPUT_PATTERN = /^(-?\d+)(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EVENT_TIME_RANGE_CACHE = new WeakMap<Event, AbsoluteYearRange>();
const SEARCH_SORT_MODES: SearchSortMode[] = [
  "best-match",
  "time-asc",
  "time-desc",
  "name-asc",
  "name-desc",
];

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "dark" || value === "light";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeOptionalTextInput = (value: unknown): string =>
  typeof value === "string" ? value : "";

const normalizeFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeOptionalMediaFilters = (value: unknown): MediaFilter[] =>
  Array.isArray(value)
    ? value.filter(
        (filter): filter is MediaFilter =>
          typeof filter === "string" &&
          (MEDIA_FILTERS as readonly string[]).includes(filter),
      )
    : [];

const sanitizeCollectionEventsById = (collections: unknown) => {
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

const buildCollectionLibrary = (
  collectionEventsById: Record<string, Event[]>,
  customCollections: EventCollectionMeta[] = [],
) => {
  const nextCollectionLibrary: Record<string, StoredTimelineCollection> =
    Object.fromEntries(
      Object.entries(collectionEventsById).map(([collectionId, events]) => [
        collectionId,
        { events },
      ]),
    );

  customCollections.forEach((collection) => {
    nextCollectionLibrary[collection.id] = {
      events: nextCollectionLibrary[collection.id]?.events ?? [],
      meta: collection,
      isLocal: true,
    };
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
        {
          events: overrideCollection?.events ?? baseCollection?.events ?? [],
          ...(baseCollection?.meta || overrideCollection?.meta
            ? {
                meta: overrideCollection?.meta ?? baseCollection?.meta ?? null,
              }
            : {}),
          isLocal:
            overrideCollection?.isLocal ?? baseCollection?.isLocal ?? false,
        },
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
      const events = sanitizeImportedEvents(candidate.events);
      const meta =
        sanitizeCustomCollections(candidate.meta ? [candidate.meta] : [], {
          allowBuiltInIds: true,
        })[0] ?? null;

      return [
        [
          collectionId,
          {
            events,
            ...(meta ? { meta: { ...meta, id: collectionId } } : {}),
            isLocal: candidate.isLocal === true,
          },
        ] as const,
      ];
    }),
  ) as Record<string, StoredTimelineCollection>;
};

// We no longer have a hardcoded BUILT_IN_COLLECTION_IDS — all collections
// are discovered from catalog metadata. Legacy migrations may reference IDs
// so we keep an empty set here for the sanitizer to skip blocking them.
const BUILT_IN_COLLECTION_IDS = new Set<string>();

const getCollectionEventsById = (
  collectionLibrary: Record<string, StoredTimelineCollection>,
) =>
  Object.fromEntries(
    Object.entries(collectionLibrary).map(([collectionId, collection]) => [
      collectionId,
      collection.events,
    ]),
  ) as Record<string, Event[]>;

const getCustomCollectionsFromLibrary = (
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

const sanitizeCollectionColorPreferences = (value: unknown) => {
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

export const sanitizeImportedEvents = (value: unknown): Event[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((event) => {
    if (!event || typeof event !== "object") return [];

    const candidate = event as Partial<Event>;
    const time = sanitizeImportedEventTime(candidate.time);
    if (
      !isNonEmptyString(candidate.title) ||
      !isNonEmptyString(candidate.description) ||
      !isNonEmptyString(candidate.emoji) ||
      !time
    ) {
      return [];
    }

    const eventId =
      isNonEmptyString(candidate.id) && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : createLocalCollectionId();

    return [
      {
        id: eventId,
        title: candidate.title.trim(),
        description: candidate.description.trim(),
        emoji: candidate.emoji.trim(),
        time,
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
};

const sanitizeCustomCollections = (
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

const sanitizeVisibleCollectionIds = (
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

const sanitizePersistedTimelineState = (
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

  return {
    theme: isThemeMode(candidate.theme) ? candidate.theme : undefined,
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
    savedFocusYear: normalizeFiniteNumber(
      (candidate as { savedFocusYear?: unknown }).savedFocusYear,
    ),
    savedLogZoom: normalizeFiniteNumber(
      (candidate as { savedLogZoom?: unknown }).savedLogZoom,
    ),
    lastOpenedView: sanitizeLastOpenedView(
      (candidate as { lastOpenedView?: unknown }).lastOpenedView,
    ),
  };
};

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

const cleanupLegacyCollectionStorage = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem("time-horizon:collection-cache:v2");
  window.localStorage.removeItem(
    "time-horizon:collection-color-preferences:v1",
  );
  window.localStorage.removeItem("time-horizon:theme");
};

const getLegacyPersistedTimelineState =
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

const timelinePersistStorage = createJSONStorage(() => localStorage);

const getInitialEventInfoCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 640px)").matches;
};

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

const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase();
const compareTitles = (left: Event, right: Event) =>
  left.title.localeCompare(right.title, undefined, { sensitivity: "base" });

const isLeapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 !== 0);

const getDaysInYear = (year: number) => (isLeapYear(year) ? 366 : 365);

const getDaysInMonth = (year: number, month: number) => {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1] ?? 31;
};

const getDayOffsetInYear = (year: number, month: number, day: number) => {
  let offset = day - 1;

  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    offset += getDaysInMonth(year, currentMonth);
  }

  return offset;
};

const getMonthStartAbsoluteYear = (year: number, month: number) =>
  year + getDayOffsetInYear(year, month, 1) / getDaysInYear(year);

const parsePartialDateInput = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return { parsed: null, error: null as string | null };
  }

  const match = PARTIAL_DATE_INPUT_PATTERN.exec(normalized);
  if (!match) {
    return {
      parsed: null,
      error: "Use YYYY, YYYY-MM, or YYYY-MM-DD.",
    };
  }

  const year = Number.parseInt(match[1], 10);
  const month = match[2] ? Number.parseInt(match[2], 10) : null;
  const day = match[3] ? Number.parseInt(match[3], 10) : null;

  if (!Number.isFinite(year)) {
    return {
      parsed: null,
      error: "Year must be a valid number.",
    };
  }

  if (month !== null && (month < 1 || month > 12)) {
    return {
      parsed: null,
      error: "Month must be between 1 and 12.",
    };
  }

  if (day !== null && month === null) {
    return {
      parsed: null,
      error: "Include a month before entering a day.",
    };
  }

  if (day !== null && (day < 1 || day > getDaysInMonth(year, month ?? 1))) {
    return {
      parsed: null,
      error: "Day is out of range for that month.",
    };
  }

  return {
    parsed: {
      year,
      month,
      day,
    } satisfies PartialDateInput,
    error: null as string | null,
  };
};

const toAbsoluteYearRange = ({
  year,
  month,
  day,
}: PartialDateInput): AbsoluteYearRange => {
  if (month === null) {
    return { start: year, end: year + 1 };
  }

  const daysInYear = getDaysInYear(year);
  const startDayOffset = getDayOffsetInYear(year, month, day ?? 1);
  const start = year + startDayOffset / daysInYear;

  if (day === null) {
    return {
      start,
      end: month === 12 ? year + 1 : getMonthStartAbsoluteYear(year, month + 1),
    };
  }

  const endDayOffset = startDayOffset + 1;
  return {
    start,
    end:
      endDayOffset >= daysInYear ? year + 1 : year + endDayOffset / daysInYear,
  };
};

const getEventAbsoluteYearRange = (event: Event): AbsoluteYearRange => {
  const cached = EVENT_TIME_RANGE_CACHE.get(event);
  if (cached) return cached;

  const [year, month, day, hour, minute, seconds] = normalizeEventTimeParts(
    event.time,
  );

  let range: AbsoluteYearRange;

  if (month === null) {
    range = { start: year, end: year + 1 };
  } else if (day === null) {
    range = toAbsoluteYearRange({ year, month, day: null });
  } else {
    const daysInYear = getDaysInYear(year);
    const dayOffset = getDayOffsetInYear(year, month, day);
    const baseStart = year + dayOffset / daysInYear;

    if (hour === null) {
      range = {
        start: baseStart,
        end:
          dayOffset + 1 >= daysInYear
            ? year + 1
            : year + (dayOffset + 1) / daysInYear,
      };
    } else {
      const secondsAtStartOfHour =
        hour * 60 * 60 + (minute ?? 0) * 60 + (seconds ?? 0);
      const start =
        year + (dayOffset + secondsAtStartOfHour / 86400) / daysInYear;

      let nextPrecisionSeconds = (hour + 1) * 60 * 60;
      if (minute !== null) {
        nextPrecisionSeconds = hour * 60 * 60 + (minute + 1) * 60;
      }
      if (seconds !== null) {
        nextPrecisionSeconds = secondsAtStartOfHour + 1;
      }

      range = {
        start,
        end: year + (dayOffset + nextPrecisionSeconds / 86400) / daysInYear,
      };
    }
  }

  EVENT_TIME_RANGE_CACHE.set(event, range);
  return range;
};

const rangesOverlap = (
  candidate: AbsoluteYearRange,
  filter: AbsoluteYearRange,
) => candidate.start < filter.end && filter.start < candidate.end;

const getEffectiveTimeRange = (
  startTimeInput?: string,
  endTimeInput?: string,
): AbsoluteYearRange | null => {
  const startResult = parsePartialDateInput(startTimeInput ?? "");
  const endResult = parsePartialDateInput(endTimeInput ?? "");

  const startRange = startResult.parsed
    ? toAbsoluteYearRange(startResult.parsed)
    : null;
  const endRange = endResult.parsed
    ? toAbsoluteYearRange(endResult.parsed)
    : null;

  if (startRange && endRange && startRange.start >= endRange.end) {
    return null;
  }

  if (!startRange && !endRange) return null;

  return {
    start: startRange?.start ?? Number.NEGATIVE_INFINITY,
    end: endRange?.end ?? Number.POSITIVE_INFINITY,
  };
};

export const getTimelineSearchDateInputError = (
  startTimeInput: string,
  endTimeInput: string,
) => {
  const safeStartTimeInput = normalizeOptionalTextInput(startTimeInput);
  const safeEndTimeInput = normalizeOptionalTextInput(endTimeInput);
  const startResult = parsePartialDateInput(safeStartTimeInput);
  if (startResult.error) return `From date: ${startResult.error}`;

  const endResult = parsePartialDateInput(safeEndTimeInput);
  if (endResult.error) return `To date: ${endResult.error}`;

  if (startResult.parsed && endResult.parsed) {
    const startRange = toAbsoluteYearRange(startResult.parsed);
    const endRange = toAbsoluteYearRange(endResult.parsed);
    if (startRange.start >= endRange.end) {
      return "From date must be before the end of the To date.";
    }
  }

  return null;
};

export const hasActiveTimelineSearchFilters = ({
  activeMediaFilters,
  searchSortMode,
  timeRangeStartInput,
  timeRangeEndInput,
}: Pick<
  TimelineStoreState,
  | "activeMediaFilters"
  | "searchSortMode"
  | "timeRangeStartInput"
  | "timeRangeEndInput"
>) =>
  normalizeOptionalMediaFilters(activeMediaFilters).length > 0 ||
  normalizeOptionalTextInput(timeRangeStartInput).trim().length > 0 ||
  normalizeOptionalTextInput(timeRangeEndInput).trim().length > 0;

export const hasActiveTimelineSearch = ({
  searchQuery,
  activeMediaFilters,
  searchSortMode,
  timeRangeStartInput,
  timeRangeEndInput,
}: Pick<
  TimelineStoreState,
  | "searchQuery"
  | "activeMediaFilters"
  | "searchSortMode"
  | "timeRangeStartInput"
  | "timeRangeEndInput"
>) =>
  normalizeOptionalTextInput(searchQuery).trim().length > 0 ||
  hasActiveTimelineSearchFilters({
    activeMediaFilters,
    searchSortMode,
    timeRangeStartInput,
    timeRangeEndInput,
  });

const getSearchRank = (event: Event, terms: string[]) => {
  const title = normalizeSearchText(event.title);
  const description = normalizeSearchText(event.description);

  return terms.reduce((score, term) => {
    if (title.startsWith(term)) return score;
    if (title.includes(term)) return score + 1;
    if (description.includes(term)) return score + 2;
    return score + 10;
  }, 0);
};

export const filterTimelineSearchEvents = (
  events: Event[],
  searchQuery: string,
  activeMediaFilters: MediaFilter[],
  options?: {
    sortByRelevance?: boolean;
    sortMode?: SearchSortMode;
    startTimeInput?: string;
    endTimeInput?: string;
  },
) => {
  const normalizedQuery = normalizeSearchText(
    normalizeOptionalTextInput(searchQuery),
  );
  const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedMediaFilters =
    normalizeOptionalMediaFilters(activeMediaFilters);
  const effectiveTimeRange = getEffectiveTimeRange(
    normalizeOptionalTextInput(options?.startTimeInput),
    normalizeOptionalTextInput(options?.endTimeInput),
  );

  const matches = events.filter((event) => {
    const title = normalizeSearchText(event.title);
    const description = normalizeSearchText(event.description);
    const matchesQuery =
      searchTerms.length === 0 ||
      searchTerms.every(
        (term) => title.includes(term) || description.includes(term),
      );
    const matchesFilters = normalizedMediaFilters.every((filter) => {
      if (filter === "image") return Boolean(event.image);
      if (filter === "video") return Boolean(event.video);
      return Boolean(event.link);
    });
    const matchesTimeRange =
      effectiveTimeRange === null ||
      rangesOverlap(getEventAbsoluteYearRange(event), effectiveTimeRange);

    return matchesQuery && matchesFilters && matchesTimeRange;
  });

  const sortMode = options?.sortMode;
  if (!sortMode) {
    return matches;
  }

  if (
    (sortMode === "best-match" || options?.sortByRelevance) &&
    searchTerms.length === 0
  ) {
    return matches;
  }

  return [...matches].sort((left, right) => {
    if (
      sortMode === "best-match" ||
      (options?.sortByRelevance && searchTerms.length > 0)
    ) {
      const rankDiff =
        getSearchRank(left, searchTerms) - getSearchRank(right, searchTerms);
      if (rankDiff !== 0) return rankDiff;
      return compareTitles(left, right);
    }

    if (sortMode === "name-asc") {
      return compareTitles(left, right);
    }

    if (sortMode === "name-desc") {
      return compareTitles(right, left);
    }

    const timeDiff =
      getEventAbsoluteYearRange(left).start -
      getEventAbsoluteYearRange(right).start;
    if (timeDiff !== 0) {
      return sortMode === "time-asc" ? timeDiff : -timeDiff;
    }

    return compareTitles(left, right);
  });
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
const loadCatalogCollectionData = async (dataUrl: string): Promise<Event[]> => {
  return (await loadCatalogByUrl(dataUrl)) as Event[];
};

export const useStore = create<TimelineStoreState>()(
  persist(
    (set, get) => {
      return {
        theme: getInitialTheme(),
        ...createInitialTimelineSearchState(),
        syncableIds: [],
        catalogMeta: {},
        collectionLibrary: {},
        visibleCollectionIds: [],
        downloadingCollectionIds: [],
        collectionColorPreferences: {},
        selectedEventId: null,
        savedFocusYear: null,
        savedLogZoom: null,
        lastOpenedView: "landing",
        hasHydrated: false,
        isRulerActive: false,
        isEventInfoCollapsed: getInitialEventInfoCollapsed(),
        editingEventId: null,
        addingEvent: false,
        addingCollectionId: null,
        isCreatingCollection: false,
        isSidebarOpen: false,
        isSidebarExploreOpen: false,
        setTheme: (theme) => set({ theme }),
        toggleTheme: () =>
          set((state) => ({
            theme: state.theme === "dark" ? "light" : "dark",
          })),
        setSearchQuery: (value) => set({ searchQuery: value }),
        toggleMediaFilter: (filter) =>
          set((state) => ({
            activeMediaFilters: state.activeMediaFilters.includes(filter)
              ? state.activeMediaFilters.filter((item) => item !== filter)
              : [...state.activeMediaFilters, filter],
          })),
        setSearchSortMode: (value) => set({ searchSortMode: value }),
        setTimeRangeStartInput: (value) => set({ timeRangeStartInput: value }),
        setTimeRangeEndInput: (value) => set({ timeRangeEndInput: value }),
        setShowOnlyResultsOnTimeline: (value) =>
          set({ showOnlyResultsOnTimeline: value }),
        showCollections: (collectionIds) =>
          set((state) => {
            const nextVisibleCollectionIds = collectionIds.reduce<string[]>(
              (visibleIds, collectionId) => {
                if (
                  !Object.prototype.hasOwnProperty.call(
                    state.collectionLibrary,
                    collectionId,
                  ) ||
                  visibleIds.includes(collectionId)
                ) {
                  return visibleIds;
                }

                return [...visibleIds, collectionId];
              },
              state.visibleCollectionIds,
            );

            return {
              ...createInitialTimelineSearchState(),
              visibleCollectionIds: nextVisibleCollectionIds,
            };
          }),
        addVisibleCollection: (collectionId) =>
          set((state) => ({
            visibleCollectionIds: state.visibleCollectionIds.includes(
              collectionId,
            )
              ? state.visibleCollectionIds
              : [...state.visibleCollectionIds, collectionId],
          })),
        setCatalogMeta: (catalogMeta, syncableIds) =>
          set({ catalogMeta, syncableIds }),
        downloadCollection: async (collectionId) => {
          const catalogMeta = get().catalogMeta;
          const catalogEntry = catalogMeta[collectionId];
          if (!catalogEntry?.dataUrl) {
            // Not a catalog collection — nothing to download
            return;
          }

          const currentState = get();
          if (currentState.collectionLibrary[collectionId]) {
            currentState.addVisibleCollection(collectionId);
            return;
          }

          set((state) => ({
            downloadingCollectionIds: state.downloadingCollectionIds.includes(
              collectionId,
            )
              ? state.downloadingCollectionIds
              : [...state.downloadingCollectionIds, collectionId],
          }));

          try {
            const loadedEvents = await loadCatalogCollectionData(
              catalogEntry.dataUrl,
            );
            set((state) => ({
              collectionLibrary: {
                ...state.collectionLibrary,
                [collectionId]: {
                  ...state.collectionLibrary[collectionId],
                  events: loadedEvents,
                  meta: catalogEntry,
                },
              },
              visibleCollectionIds: state.visibleCollectionIds.includes(
                collectionId,
              )
                ? state.visibleCollectionIds
                : [...state.visibleCollectionIds, collectionId],
            }));
          } catch (error) {
            console.error(error);
          } finally {
            set((state) => ({
              downloadingCollectionIds: state.downloadingCollectionIds.filter(
                (id) => id !== collectionId,
              ),
            }));
          }
        },
        syncCollection: async (collectionId) => {
          const catalogMeta = get().catalogMeta;
          const catalogEntry = catalogMeta[collectionId];
          if (!catalogEntry?.dataUrl) return;

          if (get().downloadingCollectionIds.includes(collectionId)) {
            return;
          }

          set((state) => ({
            downloadingCollectionIds: state.downloadingCollectionIds.includes(
              collectionId,
            )
              ? state.downloadingCollectionIds
              : [...state.downloadingCollectionIds, collectionId],
          }));

          try {
            const loadedEvents = await loadCatalogCollectionData(
              catalogEntry.dataUrl,
            );
            set((state) => ({
              collectionLibrary: {
                ...state.collectionLibrary,
                [collectionId]: {
                  ...state.collectionLibrary[collectionId],
                  events: loadedEvents,
                },
              },
            }));
          } catch (error) {
            console.error(error);
          } finally {
            set((state) => ({
              downloadingCollectionIds: state.downloadingCollectionIds.filter(
                (id) => id !== collectionId,
              ),
            }));
          }
        },
        setCollectionVisibility: (collectionId, visible) =>
          set((state) => ({
            ...createInitialTimelineSearchState(),
            visibleCollectionIds: visible
              ? state.visibleCollectionIds.includes(collectionId)
                ? state.visibleCollectionIds
                : [...state.visibleCollectionIds, collectionId]
              : state.visibleCollectionIds.filter((id) => id !== collectionId),
          })),
        importCollections: (collections) => {
          const currentState = get();
          const existingCollections = [
            ...getCustomCollectionsFromLibrary(currentState.collectionLibrary),
          ];
          const existingIds = new Set(
            existingCollections.map((item) => item.id),
          );
          const nextCollectionLibrary = { ...currentState.collectionLibrary };
          const nextCollectionColorPreferences = {
            ...currentState.collectionColorPreferences,
          };
          const nextVisibleCollectionIds = [
            ...currentState.visibleCollectionIds,
          ];
          const importedCollectionIds: string[] = [];

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

            if (!name || !emoji) {
              return;
            }

            const importedEvents = sanitizeImportedEvents(collection.events);
            const preferredId =
              isNonEmptyString(candidateMeta.id) &&
              candidateMeta.id.trim().length > 0
                ? candidateMeta.id.trim()
                : name;
            const nextId = createUniqueCollectionId(preferredId, existingIds);
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

            nextCollectionLibrary[nextId] = {
              events: importedEvents,
              meta: nextCollection,
              isLocal: true,
            };
            importedCollectionIds.push(nextId);

            if (
              typeof collection.color === "string" &&
              collection.color.trim()
            ) {
              nextCollectionColorPreferences[nextId] = collection.color;
            } else if (nextCollection.color) {
              nextCollectionColorPreferences[nextId] = nextCollection.color;
            }

            if (
              collection.visible !== false &&
              !nextVisibleCollectionIds.includes(nextId)
            ) {
              nextVisibleCollectionIds.push(nextId);
            }
          });

          if (importedCollectionIds.length === 0) {
            return { importedCollectionIds };
          }

          set({
            ...createInitialTimelineSearchState(),
            collectionLibrary: nextCollectionLibrary,
            collectionColorPreferences: nextCollectionColorPreferences,
            visibleCollectionIds: nextVisibleCollectionIds,
          });

          return { importedCollectionIds };
        },
        deleteCollection: (collectionId) =>
          set((state) => {
            const selectedInCollection =
              state.selectedEventId !== null &&
              findEventCollectionIdInState(state, state.selectedEventId) ===
                collectionId;
            const editingInCollection =
              state.editingEventId !== null &&
              findEventCollectionIdInState(state, state.editingEventId) ===
                collectionId;
            const nextCollectionLibrary = { ...state.collectionLibrary };
            delete nextCollectionLibrary[collectionId];

            const nextCollectionColorPreferences = {
              ...state.collectionColorPreferences,
            };
            delete nextCollectionColorPreferences[collectionId];

            return {
              collectionLibrary: nextCollectionLibrary,
              visibleCollectionIds: state.visibleCollectionIds.filter(
                (id) => id !== collectionId,
              ),
              downloadingCollectionIds: state.downloadingCollectionIds.filter(
                (id) => id !== collectionId,
              ),
              collectionColorPreferences: nextCollectionColorPreferences,
              selectedEventId: selectedInCollection
                ? null
                : state.selectedEventId,
              isRulerActive: selectedInCollection ? false : state.isRulerActive,
              editingEventId: editingInCollection ? null : state.editingEventId,
              addingEvent:
                state.addingCollectionId === collectionId
                  ? false
                  : state.addingEvent,
              addingCollectionId:
                state.addingCollectionId === collectionId
                  ? null
                  : state.addingCollectionId,
            };
          }),
        saveEvent: (updatedEvent) =>
          set((state) => {
            const ownerCollectionId = findEventCollectionIdInState(
              state,
              updatedEvent.id,
            );
            if (!ownerCollectionId) return {};

            const ownerCollection = state.collectionLibrary[ownerCollectionId];
            if (!ownerCollection) return {};

            return {
              collectionLibrary: {
                ...state.collectionLibrary,
                [ownerCollectionId]: {
                  ...ownerCollection,
                  events: ownerCollection.events.map((event) =>
                    event.id === updatedEvent.id ? updatedEvent : event,
                  ),
                },
              },
            };
          }),
        addEvent: (newEvent, targetCollectionId) =>
          set((state) => {
            const existingEvents =
              state.collectionLibrary[targetCollectionId]?.events ?? [];

            return {
              collectionLibrary: {
                ...state.collectionLibrary,
                [targetCollectionId]: {
                  ...state.collectionLibrary[targetCollectionId],
                  events: [...existingEvents, newEvent],
                },
              },
              visibleCollectionIds: state.visibleCollectionIds.includes(
                targetCollectionId,
              )
                ? state.visibleCollectionIds
                : [...state.visibleCollectionIds, targetCollectionId],
            };
          }),
        addEvents: (newEvents, targetCollectionId) =>
          set((state) => {
            const existingEvents =
              state.collectionLibrary[targetCollectionId]?.events ?? [];

            return {
              collectionLibrary: {
                ...state.collectionLibrary,
                [targetCollectionId]: {
                  ...state.collectionLibrary[targetCollectionId],
                  events: [...existingEvents, ...newEvents],
                },
              },
              visibleCollectionIds: state.visibleCollectionIds.includes(
                targetCollectionId,
              )
                ? state.visibleCollectionIds
                : [...state.visibleCollectionIds, targetCollectionId],
            };
          }),
        deleteEvent: (eventId) =>
          set((state) => {
            const ownerCollectionId = findEventCollectionIdInState(
              state,
              eventId,
            );
            if (!ownerCollectionId) return {};

            const ownerCollection = state.collectionLibrary[ownerCollectionId];
            if (!ownerCollection) return {};

            return {
              collectionLibrary: {
                ...state.collectionLibrary,
                [ownerCollectionId]: {
                  ...ownerCollection,
                  events: ownerCollection.events.filter(
                    (event) => event.id !== eventId,
                  ),
                },
              },
              selectedEventId:
                state.selectedEventId === eventId
                  ? null
                  : state.selectedEventId,
              isRulerActive:
                state.selectedEventId === eventId ? false : state.isRulerActive,
              editingEventId:
                state.editingEventId === eventId ? null : state.editingEventId,
            };
          }),
        createCollection: (collection) => {
          const currentState = get();
          const existingCollections = [
            ...getCustomCollectionsFromLibrary(currentState.collectionLibrary),
          ];
          const nextCollection = buildCustomCollectionMeta(
            collection,
            existingCollections,
          );

          set((state) => ({
            collectionLibrary: {
              ...state.collectionLibrary,
              [nextCollection.id]: {
                events: [],
                meta: nextCollection,
                isLocal: true,
              },
            },
            visibleCollectionIds: state.visibleCollectionIds.includes(
              nextCollection.id,
            )
              ? state.visibleCollectionIds
              : [...state.visibleCollectionIds, nextCollection.id],
          }));

          return nextCollection;
        },
        updateCollection: (collectionId, collection) =>
          set((state) => {
            const existingCollection = state.collectionLibrary[collectionId];
            const baseCollection = existingCollection?.meta;
            if (!existingCollection || !baseCollection) {
              return {};
            }

            return {
              collectionLibrary: {
                ...state.collectionLibrary,
                [collectionId]: {
                  ...existingCollection,
                  isLocal: true,
                  meta: {
                    ...baseCollection,
                    emoji: collection.emoji.trim() || baseCollection.emoji,
                    name: collection.name.trim() || baseCollection.name,
                    description: collection.description.trim(),
                  },
                },
              },
            };
          }),
        setCollectionColor: (collectionId, color) =>
          set((state) => ({
            collectionColorPreferences: {
              ...state.collectionColorPreferences,
              [collectionId]: color,
            },
          })),
        resetCollectionColor: (collectionId) =>
          set((state) => {
            const nextCollectionColorPreferences = {
              ...state.collectionColorPreferences,
            };
            delete nextCollectionColorPreferences[collectionId];

            return {
              collectionColorPreferences: nextCollectionColorPreferences,
            };
          }),
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
        setSavedViewport: (focusYear, logZoom) =>
          set({
            savedFocusYear: focusYear,
            savedLogZoom: logZoom,
          }),
        setLastOpenedView: (view) =>
          set({
            lastOpenedView: view,
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
        openSidebarExplore: () => set({ isSidebarOpen: true, isSidebarExploreOpen: true }),
        closeSidebarExplore: () => set({ isSidebarExploreOpen: false }),
      };
    },
    {
      name: STORE_KEY,
      version: 4,
      storage: timelinePersistStorage,
      migrate: (persistedState) => {
        const raw = persistedState as Partial<
          TimelinePersistedState & { version?: number }
        >;
        if (!raw || raw.version === 0 || raw.version === undefined) {
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
      }),
      onRehydrateStorage: () => (state) => {
        cleanupLegacyCollectionStorage();
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        theme: state.theme,
        searchQuery: state.searchQuery,
        activeMediaFilters: state.activeMediaFilters,
        searchSortMode: state.searchSortMode,
        timeRangeStartInput: state.timeRangeStartInput,
        timeRangeEndInput: state.timeRangeEndInput,
        showOnlyResultsOnTimeline: state.showOnlyResultsOnTimeline,
        collectionLibrary: state.collectionLibrary,
        visibleCollectionIds: state.visibleCollectionIds,
        collectionColorPreferences: state.collectionColorPreferences,
        selectedEventId: state.selectedEventId,
        savedFocusYear: state.savedFocusYear,
        savedLogZoom: state.savedLogZoom,
        lastOpenedView: state.lastOpenedView,
      }),
    },
  ),
);
