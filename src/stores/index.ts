import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import {
  COLLECTION_CACHE_KEY,
  COLLECTION_COLOR_PREFERENCES_KEY,
} from "../constants";
import {
  ThemeMode,
  THEME_STORAGE_KEY,
  getInitialTheme,
} from "../constants/theme";
import {
  Event,
  EventCollectionMeta,
  MEDIA_FILTERS,
  MediaFilter,
  CollectionCreationInput,
  CollectionCache,
} from "../constants/types";
import {
  EVENT_COLLECTIONS,
  PLAYGROUND_COLLECTION,
  SYNCABLE_COLLECTION_IDS,
  loadEventCollection,
} from "../data/collections";
import { buildCustomCollectionMeta, normalizeEventTimeParts } from "../helpers";

export type SearchSortMode =
  | "best-match"
  | "time-asc"
  | "time-desc"
  | "name-asc"
  | "name-desc";

export const SEARCH_SORT_OPTIONS: Array<{
  label: string;
  value: SearchSortMode;
}> = [
  { label: "Best match", value: "best-match" },
  { label: "Time: oldest first", value: "time-asc" },
  { label: "Time: newest first", value: "time-desc" },
  { label: "Name: A to Z", value: "name-asc" },
  { label: "Name: Z to A", value: "name-desc" },
];

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

type TimelineStoreState = {
  theme: ThemeMode;
  searchQuery: string;
  activeMediaFilters: MediaFilter[];
  searchSortMode: SearchSortMode;
  timeRangeStartInput: string;
  timeRangeEndInput: string;
  showOnlyResultsOnTimeline: boolean;
  customCollections: EventCollectionMeta[];
  collectionEventsById: Record<string, Event[]>;
  visibleCollectionIds: string[];
  downloadingCollectionIds: string[];
  collectionColorPreferences: Record<string, string>;
  selectedEventId: string | null;
  isRulerActive: boolean;
  isEventInfoCollapsed: boolean;
  editingEventId: string | null;
  addingEvent: boolean;
  addingCollectionId: string | null;
  isCreatingCollection: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSearchQuery: (value: string) => void;
  toggleMediaFilter: (filter: MediaFilter) => void;
  setSearchSortMode: (value: SearchSortMode) => void;
  setTimeRangeStartInput: (value: string) => void;
  setTimeRangeEndInput: (value: string) => void;
  setShowOnlyResultsOnTimeline: (value: boolean) => void;
  addVisibleCollection: (collectionId: string) => void;
  ensurePlaygroundCollection: () => void;
  downloadCollection: (collectionId: string) => Promise<void>;
  syncCollection: (collectionId: string) => Promise<void>;
  setCollectionVisibility: (collectionId: string, visible: boolean) => void;
  deleteCollection: (collectionId: string) => void;
  saveEvent: (updatedEvent: Event) => void;
  addEvent: (newEvent: Event, targetCollectionId: string) => void;
  deleteEvent: (eventId: string) => void;
  createCollection: (
    collection: CollectionCreationInput,
  ) => EventCollectionMeta;
  setCollectionColor: (collectionId: string, color: string) => void;
  resetCollectionColor: (collectionId: string) => void;
  focusEvent: (eventId: string) => void;
  previewEvent: (eventId: string) => void;
  clearFocusedEvent: () => void;
  setIsRulerActive: (value: boolean) => void;
  toggleEventInfoCollapsed: () => void;
  openEventEditor: (eventId: string) => void;
  closeEventEditor: () => void;
  openEventCreator: (collectionId?: string | null) => void;
  closeEventCreator: () => void;
  openCollectionCreator: () => void;
  closeCollectionCreator: () => void;
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
  | "customCollections"
  | "collectionEventsById"
  | "visibleCollectionIds"
  | "collectionColorPreferences"
>;

const STORE_KEY = "time-horizon:timeline-store:v1";
const PARTIAL_DATE_INPUT_PATTERN = /^(-?\d+)(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EVENT_TIME_RANGE_CACHE = new WeakMap<Event, AbsoluteYearRange>();
const BUILT_IN_COLLECTION_IDS = new Set(
  [...EVENT_COLLECTIONS, PLAYGROUND_COLLECTION].map(
    (collection) => collection.id,
  ),
);
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

const sanitizeVisibleCollectionIds = (
  visibleCollectionIds: unknown,
  collectionEventsById: Record<string, Event[]>,
) => {
  const ids = Array.isArray(visibleCollectionIds)
    ? visibleCollectionIds
    : Object.keys(collectionEventsById);

  return ids.filter(
    (collectionId, index, allIds): collectionId is string =>
      typeof collectionId === "string" &&
      allIds.indexOf(collectionId) === index &&
      Object.prototype.hasOwnProperty.call(collectionEventsById, collectionId),
  );
};

const sanitizePersistedTimelineState = (
  value: unknown,
): Partial<TimelinePersistedState> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Partial<TimelinePersistedState>;
  const collectionEventsById = sanitizeCollectionEventsById(
    candidate.collectionEventsById,
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
    customCollections: sanitizeCustomCollections(candidate.customCollections),
    collectionEventsById,
    visibleCollectionIds: sanitizeVisibleCollectionIds(
      candidate.visibleCollectionIds,
      collectionEventsById,
    ),
    collectionColorPreferences: sanitizeCollectionColorPreferences(
      candidate.collectionColorPreferences,
    ),
  };
};

const readLegacyCollectionCache = () => {
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
        collectionEventsById,
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
    const raw = window.localStorage.getItem(COLLECTION_COLOR_PREFERENCES_KEY);
    if (!raw) return {};
    return sanitizeCollectionColorPreferences(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to restore collection color preferences", error);
    return {};
  }
};

const readLegacyTheme = () => {
  if (typeof window === "undefined") return undefined;

  const rawTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(rawTheme) ? rawTheme : undefined;
};

const cleanupLegacyCollectionStorage = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(COLLECTION_CACHE_KEY);
  window.localStorage.removeItem(COLLECTION_COLOR_PREFERENCES_KEY);
  window.localStorage.removeItem(THEME_STORAGE_KEY);
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
      customCollections: legacyCollectionCache.customCollections,
      collectionEventsById: legacyCollectionCache.collections,
      visibleCollectionIds: legacyCollectionCache.visibleCollectionIds,
      collectionColorPreferences: legacyCollectionColorPreferences,
    };

    return migratedState;
  };

const timelinePersistStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;

    const existingValue = window.localStorage.getItem(name);
    if (existingValue !== null) {
      return existingValue;
    }

    const legacyState = getLegacyPersistedTimelineState();
    if (!legacyState) {
      return null;
    }

    return JSON.stringify({
      state: legacyState,
      version: 0,
    });
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
};

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
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

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
  const startResult = parsePartialDateInput(startTimeInput);
  if (startResult.error) return `From date: ${startResult.error}`;

  const endResult = parsePartialDateInput(endTimeInput);
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
  activeMediaFilters.length > 0 ||
  timeRangeStartInput.trim().length > 0 ||
  timeRangeEndInput.trim().length > 0;

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
  searchQuery.trim().length > 0 ||
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
  const normalizedQuery = normalizeSearchText(searchQuery);
  const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  const effectiveTimeRange = getEffectiveTimeRange(
    options?.startTimeInput,
    options?.endTimeInput,
  );

  const matches = events.filter((event) => {
    const title = normalizeSearchText(event.title);
    const description = normalizeSearchText(event.description);
    const matchesQuery =
      searchTerms.length === 0 ||
      searchTerms.every(
        (term) => title.includes(term) || description.includes(term),
      );
    const matchesFilters = activeMediaFilters.every((filter) => {
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
  state: Pick<TimelineStoreState, "collectionEventsById">,
  eventId: string,
) => findEventCollectionIdInCollections(state.collectionEventsById, eventId);

export const useTimelineStore = create<TimelineStoreState>()(
  persist(
    (set, get) => {
      return {
        theme: getInitialTheme(),
        searchQuery: "",
        activeMediaFilters: [],
        searchSortMode: DEFAULT_SEARCH_SORT_MODE,
        timeRangeStartInput: "",
        timeRangeEndInput: "",
        showOnlyResultsOnTimeline: false,
        customCollections: [],
        collectionEventsById: {},
        visibleCollectionIds: [],
        downloadingCollectionIds: [],
        collectionColorPreferences: {},
        selectedEventId: null,
        isRulerActive: false,
        isEventInfoCollapsed: getInitialEventInfoCollapsed(),
        editingEventId: null,
        addingEvent: false,
        addingCollectionId: null,
        isCreatingCollection: false,
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
        addVisibleCollection: (collectionId) =>
          set((state) => ({
            visibleCollectionIds: state.visibleCollectionIds.includes(
              collectionId,
            )
              ? state.visibleCollectionIds
              : [...state.visibleCollectionIds, collectionId],
          })),
        ensurePlaygroundCollection: () =>
          set((state) => ({
            collectionEventsById: Object.prototype.hasOwnProperty.call(
              state.collectionEventsById,
              PLAYGROUND_COLLECTION.id,
            )
              ? state.collectionEventsById
              : {
                  ...state.collectionEventsById,
                  [PLAYGROUND_COLLECTION.id]: [],
                },
          })),
        downloadCollection: async (collectionId) => {
          const currentState = get();
          if (currentState.collectionEventsById[collectionId]) {
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
            const loadedEvents = await loadEventCollection(collectionId);
            set((state) => ({
              collectionEventsById: {
                ...state.collectionEventsById,
                [collectionId]: loadedEvents,
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
          const currentState = get();
          if (
            currentState.downloadingCollectionIds.includes(collectionId) ||
            !SYNCABLE_COLLECTION_IDS.includes(collectionId)
          ) {
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
            const loadedEvents = await loadEventCollection(collectionId);
            set((state) => ({
              collectionEventsById: {
                ...state.collectionEventsById,
                [collectionId]: loadedEvents,
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
            visibleCollectionIds: visible
              ? state.visibleCollectionIds.includes(collectionId)
                ? state.visibleCollectionIds
                : [...state.visibleCollectionIds, collectionId]
              : state.visibleCollectionIds.filter((id) => id !== collectionId),
          })),
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
            const nextCollectionEventsById = { ...state.collectionEventsById };
            delete nextCollectionEventsById[collectionId];

            const nextCollectionColorPreferences = {
              ...state.collectionColorPreferences,
            };
            delete nextCollectionColorPreferences[collectionId];

            return {
              customCollections: state.customCollections.filter(
                (collection) => collection.id !== collectionId,
              ),
              collectionEventsById: nextCollectionEventsById,
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

            return {
              collectionEventsById: {
                ...state.collectionEventsById,
                [ownerCollectionId]: state.collectionEventsById[
                  ownerCollectionId
                ].map((event) =>
                  event.id === updatedEvent.id ? updatedEvent : event,
                ),
              },
            };
          }),
        addEvent: (newEvent, targetCollectionId) =>
          set((state) => {
            const existingEvents =
              state.collectionEventsById[targetCollectionId] ?? [];

            return {
              collectionEventsById: {
                ...state.collectionEventsById,
                [targetCollectionId]: [...existingEvents, newEvent],
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

            return {
              collectionEventsById: {
                ...state.collectionEventsById,
                [ownerCollectionId]: state.collectionEventsById[
                  ownerCollectionId
                ].filter((event) => event.id !== eventId),
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
          const nextCollection = buildCustomCollectionMeta(collection, [
            ...EVENT_COLLECTIONS,
            ...get().customCollections,
            PLAYGROUND_COLLECTION,
          ]);

          set((state) => ({
            customCollections: [...state.customCollections, nextCollection],
            collectionEventsById: {
              ...state.collectionEventsById,
              [nextCollection.id]: [],
            },
            visibleCollectionIds: state.visibleCollectionIds.includes(
              nextCollection.id,
            )
              ? state.visibleCollectionIds
              : [...state.visibleCollectionIds, nextCollection.id],
          }));

          return nextCollection;
        },
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
      };
    },
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => timelinePersistStorage),
      migrate: (persistedState) =>
        sanitizePersistedTimelineState(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedTimelineState(persistedState),
      }),
      onRehydrateStorage: () => () => {
        cleanupLegacyCollectionStorage();
      },
      partialize: (state) => ({
        theme: state.theme,
        searchQuery: state.searchQuery,
        activeMediaFilters: state.activeMediaFilters,
        searchSortMode: state.searchSortMode,
        timeRangeStartInput: state.timeRangeStartInput,
        timeRangeEndInput: state.timeRangeEndInput,
        showOnlyResultsOnTimeline: state.showOnlyResultsOnTimeline,
        customCollections: state.customCollections,
        collectionEventsById: state.collectionEventsById,
        visibleCollectionIds: state.visibleCollectionIds,
        collectionColorPreferences: state.collectionColorPreferences,
      }),
    },
  ),
);
