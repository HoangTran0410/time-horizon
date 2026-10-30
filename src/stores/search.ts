/**
 * Timeline search: free-text matching, media filters, the partial-date
 * time-range filter and result sorting. Pure functions over events; the store
 * only holds the inputs.
 */

import {
  type Event,
  type MediaFilter,
  type SupportedLanguage,
  MEDIA_FILTERS,
} from "../constants/types";
import { getCurrentTimelineYear, normalizeEventTimeParts } from "../helpers";
import {
  DEFAULT_LANGUAGE,
  getLocalizedText,
  getSearchableLocalizedText,
} from "../helpers/localization";

export type SearchSortMode =
  | "best-match"
  | "time-asc"
  | "time-desc"
  | "name-asc"
  | "name-desc";

export const DEFAULT_SEARCH_SORT_MODE: SearchSortMode = "best-match";

/** The search inputs as the store holds them. */
export type TimelineSearchInputs = {
  searchQuery: string;
  activeMediaFilters: MediaFilter[];
  searchSortMode: SearchSortMode;
  timeRangeStartInput: string;
  timeRangeEndInput: string;
};

type PartialDateInput = {
  year: number;
  month: number | null;
  day: number | null;
};

type AbsoluteYearRange = {
  start: number;
  end: number;
};

const PARTIAL_DATE_INPUT_PATTERN = /^(-?\d+)(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EVENT_TIME_RANGE_CACHE = new WeakMap<Event, AbsoluteYearRange>();
export const SEARCH_SORT_MODES: SearchSortMode[] = [
  "best-match",
  "time-asc",
  "time-desc",
  "name-asc",
  "name-desc",
];

const normalizeOptionalTextInput = (value: unknown): string =>
  typeof value === "string" ? value : "";

const normalizeOptionalMediaFilters = (value: unknown): MediaFilter[] =>
  Array.isArray(value)
    ? value.filter(
        (filter): filter is MediaFilter =>
          typeof filter === "string" &&
          (MEDIA_FILTERS as readonly string[]).includes(filter),
      )
    : [];

const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase();
const compareTitles = (
  left: Event,
  right: Event,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
) =>
  getLocalizedText(left.title, language).localeCompare(
    getLocalizedText(right.title, language),
    undefined,
    { sensitivity: "base" },
  );

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

/** The interval one EventTime covers at its own precision ("1942" is all of 1942). */
const getTimeAbsoluteYearRange = (time: Event["time"]): AbsoluteYearRange => {
  const [year, month, day, hour, minute, seconds] =
    normalizeEventTimeParts(time);

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

  return range;
};

/**
 * The whole interval an event occupies: a span runs from its start to the end
 * of its end time, and an ongoing event runs to now. Using the start alone made
 * the time filter miss every span that began before the filtered range.
 */
const getEventAbsoluteYearRange = (event: Event): AbsoluteYearRange => {
  const cached = EVENT_TIME_RANGE_CACHE.get(event);
  if (cached) return cached;

  const startRange = getTimeAbsoluteYearRange(event.time);
  let range = startRange;

  if (event.ongoing) {
    const now = getCurrentTimelineYear();
    if (now > startRange.end) range = { start: startRange.start, end: now };
  } else if (event.endTime != null) {
    // Reversed pairs are common in imported data; treat them as a span too.
    const endRange = getTimeAbsoluteYearRange(event.endTime);
    range = {
      start: Math.min(startRange.start, endRange.start),
      end: Math.max(startRange.end, endRange.end),
    };
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
  TimelineSearchInputs,
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
  TimelineSearchInputs,
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

const getSearchRank = (
  event: Event,
  terms: string[],
  language: SupportedLanguage = DEFAULT_LANGUAGE,
) => {
  const title = normalizeSearchText(getLocalizedText(event.title, language));
  const description = normalizeSearchText(
    getSearchableLocalizedText(event.description),
  );

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
    language?: SupportedLanguage;
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
  const language = options?.language ?? DEFAULT_LANGUAGE;
  const normalizedMediaFilters =
    normalizeOptionalMediaFilters(activeMediaFilters);
  const effectiveTimeRange = getEffectiveTimeRange(
    normalizeOptionalTextInput(options?.startTimeInput),
    normalizeOptionalTextInput(options?.endTimeInput),
  );

  const matches = events.filter((event) => {
    const title = normalizeSearchText(getSearchableLocalizedText(event.title));
    const description = normalizeSearchText(
      getSearchableLocalizedText(event.description),
    );
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
        getSearchRank(left, searchTerms, language) -
        getSearchRank(right, searchTerms, language);
      if (rankDiff !== 0) return rankDiff;
      return compareTitles(left, right, language);
    }

    if (sortMode === "name-asc") {
      return compareTitles(left, right, language);
    }

    if (sortMode === "name-desc") {
      return compareTitles(right, left, language);
    }

    const timeDiff =
      getEventAbsoluteYearRange(left).start -
      getEventAbsoluteYearRange(right).start;
    if (timeDiff !== 0) {
      return sortMode === "time-asc" ? timeDiff : -timeDiff;
    }

    return compareTitles(left, right, language);
  });
};
