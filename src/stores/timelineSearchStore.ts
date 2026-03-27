import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Event } from "../constants/types";
import { MediaFilter } from "../constants/types";
import { normalizeEventTimeParts } from "../helpers";

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

type PartialDateInput = {
  year: number;
  month: number | null;
  day: number | null;
};

type AbsoluteYearRange = {
  start: number;
  end: number;
};

interface TimelineSearchState {
  searchQuery: string;
  activeMediaFilters: MediaFilter[];
  searchSortMode: SearchSortMode;
  timeRangeStartInput: string;
  timeRangeEndInput: string;
  showOnlyResultsOnTimeline: boolean;
  setSearchQuery: (value: string) => void;
  toggleMediaFilter: (filter: MediaFilter) => void;
  setSearchSortMode: (value: SearchSortMode) => void;
  setTimeRangeStartInput: (value: string) => void;
  setTimeRangeEndInput: (value: string) => void;
  setShowOnlyResultsOnTimeline: (value: boolean) => void;
}

const STORE_KEY = "time-horizon:timeline-search:v2";
const PARTIAL_DATE_INPUT_PATTERN = /^(-?\d+)(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EVENT_TIME_RANGE_CACHE = new WeakMap<Event, AbsoluteYearRange>();

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
    end: endDayOffset >= daysInYear ? year + 1 : year + endDayOffset / daysInYear,
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
      const start = year + (dayOffset + secondsAtStartOfHour / 86400) / daysInYear;

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
  const endRange = endResult.parsed ? toAbsoluteYearRange(endResult.parsed) : null;

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
      getEventAbsoluteYearRange(left).start - getEventAbsoluteYearRange(right).start;
    if (timeDiff !== 0) {
      return sortMode === "time-asc" ? timeDiff : -timeDiff;
    }

    return compareTitles(left, right);
  });
};

export const useTimelineSearchStore = create<TimelineSearchState>()(
  persist(
    (set) => ({
      searchQuery: "",
      activeMediaFilters: [],
      searchSortMode: "best-match",
      timeRangeStartInput: "",
      timeRangeEndInput: "",
      showOnlyResultsOnTimeline: false,
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
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        activeMediaFilters: state.activeMediaFilters,
        searchSortMode: state.searchSortMode,
        timeRangeStartInput: state.timeRangeStartInput,
        timeRangeEndInput: state.timeRangeEndInput,
        showOnlyResultsOnTimeline: state.showOnlyResultsOnTimeline,
      }),
    },
  ),
);
