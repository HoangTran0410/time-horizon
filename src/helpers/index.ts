import {
  BIG_BANG_YEAR,
  LAYOUT_EDGE_PADDING,
  LAYOUT_MAX_LEVELS_PER_SIDE,
  LAYOUT_ROW_OFFSET,
} from "../constants";
import {
  CollapsedEventGroup,
  DateJumpTarget,
  Event,
  EventCollectionMeta,
  EventTime,
} from "../constants/types";

export const normalizeEventTimeParts = (time: EventTime): Required<EventTime> =>
  [
    time[0],
    time[1] ?? null,
    time[2] ?? null,
    time[3] ?? null,
    time[4] ?? null,
    time[5] ?? null,
  ] as Required<EventTime>;

const SHARED_COLLECTIONS_QUERY_PARAM = "c";
const LEGACY_SHARED_COLLECTIONS_QUERY_PARAM = "collections";
const SHARED_EVENT_QUERY_PARAM = "e";
const TIMELINE_VIEW_QUERY_PARAM = "t";
const TIMELINE_VIEWPORT_YEAR_PARAM = "y";
const TIMELINE_VIEWPORT_ZOOM_PARAM = "z";

const uniqueCollectionIds = (collectionIds: string[]): string[] =>
  collectionIds.filter(
    (collectionId, index, allCollectionIds) =>
      collectionId.length > 0 && allCollectionIds.indexOf(collectionId) === index,
  );

export const getSharedCollectionIdsFromSearch = (search: string): string[] => {
  const params = new URLSearchParams(search);
  const rawValue =
    params.get(SHARED_COLLECTIONS_QUERY_PARAM) ??
    params.get(LEGACY_SHARED_COLLECTIONS_QUERY_PARAM);
  if (!rawValue) return [];

  return uniqueCollectionIds(
    rawValue
      .split(",")
      .map((collectionId) => collectionId.trim())
      .filter(Boolean),
  );
};

export const hasSharedCollectionIdsInSearch = (search: string): boolean =>
  getSharedCollectionIdsFromSearch(search).length > 0;

export const getSharedEventIdFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const rawValue = params.get(SHARED_EVENT_QUERY_PARAM);
  if (!rawValue) return null;

  const eventId = rawValue.trim();
  return eventId.length > 0 ? eventId : null;
};

export const hasSharedEventIdInSearch = (search: string): boolean =>
  getSharedEventIdFromSearch(search) !== null;

export const hasTimelineViewInSearch = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return params.get(TIMELINE_VIEW_QUERY_PARAM) === "1";
};

export const setTimelineViewInUrl = (url: URL, enabled: boolean): void => {
  if (enabled) {
    url.searchParams.set(TIMELINE_VIEW_QUERY_PARAM, "1");
  } else {
    url.searchParams.delete(TIMELINE_VIEW_QUERY_PARAM);
  }
};

export const setSharedCollectionIdsInUrl = (
  url: URL,
  collectionIds: string[],
): void => {
  const serializedIds = uniqueCollectionIds(collectionIds).join(",");
  if (serializedIds) {
    url.searchParams.set(SHARED_COLLECTIONS_QUERY_PARAM, serializedIds);
  } else {
    url.searchParams.delete(SHARED_COLLECTIONS_QUERY_PARAM);
  }

  url.searchParams.delete(LEGACY_SHARED_COLLECTIONS_QUERY_PARAM);
};

export const setSharedEventIdInUrl = (
  url: URL,
  eventId: string | null,
): void => {
  const nextEventId = eventId?.trim() ?? "";

  if (nextEventId) {
    url.searchParams.set(SHARED_EVENT_QUERY_PARAM, nextEventId);
  } else {
    url.searchParams.delete(SHARED_EVENT_QUERY_PARAM);
  }
};

const trimOptionalText = (value?: string | null): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const withHttpsForProtocolRelative = (value: string): string =>
  value.startsWith("//") ? `https:${value}` : value;

const withHttpsForKnownHosts = (value: string): string => {
  if (/^[a-z][a-z\d+.-]*:/iu.test(value)) return value;

  if (
    /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\b/iu.test(value) ||
    /^(?:[a-z-]+\.)?wikipedia\.org\b/iu.test(value)
  ) {
    return `https://${value}`;
  }

  return value;
};

const getYoutubeVideoIdFromUrl = (url: URL): string | null => {
  const hostname = url.hostname.replace(/^www\./iu, "").replace(/^m\./iu, "");

  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!hostname.endsWith("youtube.com")) return null;

  const pathParts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  if (pathParts[0] && ["embed", "shorts", "live", "v"].includes(pathParts[0])) {
    return pathParts[1] ?? null;
  }

  return url.searchParams.get("v");
};

export const normalizeImageUrl = (image?: string): string | null => {
  const trimmed = trimOptionalText(image);
  if (!trimmed) return null;

  return withHttpsForProtocolRelative(trimmed);
};

export const normalizeEmbedVideoUrl = (video?: string): string | null => {
  const trimmed = trimOptionalText(video);
  if (!trimmed) return null;

  const normalizedInput = withHttpsForKnownHosts(
    withHttpsForProtocolRelative(trimmed),
  );

  if (/^https?:\/\//iu.test(normalizedInput)) {
    try {
      const url = new URL(normalizedInput);
      const videoId = getYoutubeVideoIdFromUrl(url);
      return videoId
        ? `https://www.youtube.com/embed/${videoId}`
        : normalizedInput;
    } catch {
      return normalizedInput;
    }
  }

  return `https://www.youtube.com/embed/${trimmed}`;
};

export const normalizeExternalLinkUrl = (link?: string): string | null => {
  const trimmed = trimOptionalText(link);
  if (!trimmed) return null;

  const normalizedInput = withHttpsForKnownHosts(
    withHttpsForProtocolRelative(trimmed),
  );

  if (/^https?:\/\//iu.test(normalizedInput)) {
    return normalizedInput;
  }

  const articleName = trimmed
    .replace(/^wiki\//iu, "")
    .trim()
    .replace(/\s+/gu, "_");

  return `https://en.wikipedia.org/wiki/${encodeURIComponent(articleName)}`;
};

// Cache: event time is immutable, so the timeline year is deterministic.
// WeakMap avoids memory leaks — entries disappear when Event is GC'd.
const _timelineYearCache = new WeakMap<Event, number>();

export const getEventTimelineYear = (event: Event): number => {
  const cached = _timelineYearCache.get(event);
  if (cached !== undefined) return cached;

  const [year, month, day, hour, minute, seconds] = normalizeEventTimeParts(
    event.time,
  );

  if (
    month == null &&
    day == null &&
    hour == null &&
    minute == null &&
    seconds == null
  ) {
    _timelineYearCache.set(event, year);
    return year;
  }

  const d = new Date(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    seconds ?? 0,
  );

  if (isNaN(d.getTime())) {
    _timelineYearCache.set(event, year);
    return year;
  }

  const y = d.getFullYear();
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  const frac = (d.getTime() - start) / (end - start);
  const result = y + frac;

  _timelineYearCache.set(event, result);
  return result;
};

// Cache: event time is immutable — label never changes.
// WeakMap avoids memory leaks.
const _displayLabelCache = new WeakMap<Event, string>();

/** Strip trailing zeros from toFixed output, e.g. "100.0B" → "100B" */
const stripTrailingZeros = (s: string): string =>
  s.replace(/\.0+(?=\s|[A-Z]|$)/, "");

const formatCount = (value: number, maximumFractionDigits = 0): string =>
  value.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });

const formatDurationUnit = (
  value: number,
  singular: string,
  plural: string,
  maximumFractionDigits = 0,
): string => {
  const roundedValue =
    maximumFractionDigits > 0
      ? Number(value.toFixed(maximumFractionDigits))
      : Math.round(value);
  const label = Math.abs(roundedValue) === 1 ? singular : plural;
  return `${formatCount(roundedValue, maximumFractionDigits)} ${label}`;
};

export const withAlpha = (color: string, alpha: number): string => {
  const normalized = color.trim();
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  if (/^#([0-9a-f]{3}){1,2}$/i.test(normalized)) {
    const hex = normalized.slice(1);
    const fullHex =
      hex.length === 3
        ? hex
            .split("")
            .map((char) => char + char)
            .join("")
        : hex;
    const int = Number.parseInt(fullHex, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  return normalized;
};

const NICE_INTERVALS: number[] = [
  1e10,
  5e9,
  1e9,
  5e8,
  1e8,
  5e7,
  1e7,
  5e6,
  1e6,
  5e5,
  1e5,
  5e4,
  1e4,
  5000,
  1000,
  500,
  100,
  50,
  10,
  5,
  1,
  1 / 12, // 1 month
  1 / 52, // 1 week
  1 / 365.25, // 1 day
] as const;

const MONTH_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  year: "numeric",
};

const MONTH_YEAR_NUMERIC_FORMAT: Intl.DateTimeFormatOptions = {
  month: "numeric",
  year: "numeric",
};

const MONTH_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

const DAY_MONTH_YEAR_NUMERIC_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "numeric",
  year: "numeric",
};

const FULL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const YEAR_ZERO_TOLERANCE = 1e-9;

const isYearZero = (year: number): boolean =>
  Math.abs(year) < YEAR_ZERO_TOLERANCE;

const formatAbsoluteYear = (year: number): string => {
  if (isYearZero(year)) return "0";

  const rounded = Math.round(year);
  if (rounded > 0) return `${rounded}`;
  if (rounded === 0) return year < 0 ? "1 BC" : "0";
  return `${Math.abs(rounded)} BC`;
};

const parseAbsoluteYearToDate = (absoluteYear: number): Date => {
  const y = Math.floor(absoluteYear);
  const frac = absoluteYear - y;
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  return new Date(start + frac * (end - start));
};

const dateToAbsoluteYear = (date: Date): number => {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return year + (date.getTime() - start) / (end - start);
};

export const formatYear = (absoluteYear: number): string => {
  const absYear = Math.abs(absoluteYear);

  if (absoluteYear >= 1e9) {
    return `${stripTrailingZeros((absYear / 1e9).toFixed(2))} Billion AD`;
  }

  if (absoluteYear >= 1e6) {
    return `${stripTrailingZeros((absYear / 1e6).toFixed(2))} Million AD`;
  }

  if (absoluteYear <= -1e9) {
    return `${stripTrailingZeros((absYear / 1e9).toFixed(2))} Billion BC`;
  }

  if (absoluteYear <= -1e6) {
    return `${stripTrailingZeros((absYear / 1e6).toFixed(2))} Million BC`;
  }

  if (absoluteYear <= -10000) {
    return `${Math.abs(Math.round(absoluteYear)).toLocaleString()} BC`;
  }

  if (absoluteYear <= 0) return formatAbsoluteYear(absoluteYear);

  if (Math.abs(absoluteYear - Math.round(absoluteYear)) < 1e-9) {
    return `${Math.round(absoluteYear)}`;
  }

  const d = parseAbsoluteYearToDate(absoluteYear);
  if (isNaN(d.getTime())) {
    return `${stripTrailingZeros(absoluteYear.toFixed(6))}`;
  }

  return d.toLocaleString(undefined, DATE_TIME_FORMAT);
};

const formatEventTime = (event: Event): string => {
  const cached = _displayLabelCache.get(event);
  if (cached !== undefined) return cached;

  const [year, month, day, hour, minute, seconds] = normalizeEventTimeParts(
    event.time,
  );

  let label: string;

  if (month == null) {
    label = formatYear(year);
  } else if (year <= 0) {
    // JavaScript Date formatting around BC years is unreliable for locale output.
    // For BCE dates, fall back to decimal year formatting.
    label = formatYear(getEventTimelineYear(event));
  } else {
    const d = new Date(
      year,
      month - 1,
      day ?? 1,
      hour ?? 0,
      minute ?? 0,
      seconds ?? 0,
    );

    if (isNaN(d.getTime())) {
      label = formatYear(getEventTimelineYear(event));
    } else if (day == null) {
      label = d.toLocaleDateString(undefined, MONTH_YEAR_FORMAT);
    } else {
      const hasTime = hour != null || minute != null || seconds != null;
      if (!hasTime) {
        label = d.toLocaleDateString(undefined, FULL_DATE_FORMAT);
      } else {
        label = d.toLocaleString(undefined, {
          ...DATE_TIME_FORMAT,
          second: seconds != null ? "2-digit" : undefined,
        });
      }
    }
  }

  _displayLabelCache.set(event, label);
  return label;
};

export const getEventDisplayLabel = (event: Event): string =>
  formatEventTime(event);

export const formatElapsedTimelineTime = (years: number): string => {
  const absoluteYears = Math.abs(years);

  if (absoluteYears >= 1e9) {
    return formatDurationUnit(
      absoluteYears / 1e9,
      "billion year",
      "billion years",
      absoluteYears >= 1e10 ? 0 : 1,
    );
  }

  if (absoluteYears >= 1e6) {
    return formatDurationUnit(
      absoluteYears / 1e6,
      "million year",
      "million years",
      absoluteYears >= 1e7 ? 0 : 1,
    );
  }

  if (absoluteYears >= 1) {
    return formatDurationUnit(absoluteYears, "year", "years");
  }

  const months = absoluteYears * 12;
  if (months >= 1) {
    return formatDurationUnit(months, "month", "months");
  }

  const days = absoluteYears * 365.25;
  if (days >= 1) {
    return formatDurationUnit(days, "day", "days");
  }

  const hours = days * 24;
  if (hours >= 1) {
    return formatDurationUnit(hours, "hour", "hours");
  }

  const minutes = hours * 60;
  if (minutes >= 1) {
    return formatDurationUnit(minutes, "minute", "minutes");
  }

  const seconds = Math.max(minutes * 60, 0);
  if (seconds < 1) {
    return "under 1 second";
  }

  return formatDurationUnit(seconds, "second", "seconds");
};

export const getNiceInterval = (ideal: number): number => {
  const logIdeal = Math.log10(ideal);
  let best = NICE_INTERVALS[0];
  let minDiff = Math.abs(logIdeal - Math.log10(best));

  for (let i = 1; i < NICE_INTERVALS.length; i += 1) {
    const interval = NICE_INTERVALS[i];
    const diff = Math.abs(logIdeal - Math.log10(interval));
    if (diff < minDiff) {
      minDiff = diff;
      best = interval;
    }
  }

  return best;
};

export const formatTick = (absoluteYear: number, interval: number): string => {
  if (isYearZero(absoluteYear)) return "0";

  const absYear = Math.abs(absoluteYear);
  const era = absoluteYear <= 0 ? "BC" : "AD";

  if (interval >= 1e9) {
    return `${stripTrailingZeros((absYear / 1e9).toFixed(1))}B ${era}`;
  }

  if (interval >= 1e6) {
    return `${stripTrailingZeros((absYear / 1e6).toFixed(1))}M ${era}`;
  }

  if (interval >= 1000 || absoluteYear <= 0) {
    return formatAbsoluteYear(absoluteYear);
  }

  if (interval >= 1) {
    return formatAbsoluteYear(absoluteYear);
  }

  const d = parseAbsoluteYearToDate(absoluteYear);
  if (isNaN(d.getTime())) return formatAbsoluteYear(absoluteYear);

  if (interval >= 1 / 12) {
    return d.toLocaleDateString(undefined, MONTH_YEAR_NUMERIC_FORMAT);
  }

  if (interval >= 1 / 365.25) {
    return d.toLocaleDateString(undefined, DAY_MONTH_YEAR_NUMERIC_FORMAT);
  }

  return d.toLocaleDateString(undefined, DAY_MONTH_YEAR_NUMERIC_FORMAT);
};

export const formatTimelineTick = (
  absoluteYear: number,
  interval: number,
): string => formatTick(absoluteYear, interval);

export const generateCalendarTimelineTickYears = (
  startYear: number,
  endYear: number,
  interval: number,
): number[] | null => {
  if (interval < 1 / 12 || interval >= 1) return null;
  if (startYear <= 0 || endYear <= 0) return null;

  const startDate = parseAbsoluteYearToDate(startYear);
  const endDate = parseAbsoluteYearToDate(endYear);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  if (cursor.getTime() < startDate.getTime()) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const ticks: number[] = [];
  while (cursor.getTime() <= endDate.getTime()) {
    ticks.push(dateToAbsoluteYear(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return ticks;
};

const isNearlyInteger = (value: number, tolerance = 1e-6): boolean =>
  Math.abs(value - Math.round(value)) < tolerance;

export const getTimelineHighlightStep = (interval: number): number => {
  if (interval < 1) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(interval));
  const normalized = interval / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

export const isHighlightedTimelineTick = (
  absoluteYear: number,
  highlightStep: number,
  interval: number,
): boolean => {
  if (isYearZero(absoluteYear)) return true;

  if (interval < 1) {
    const d = parseAbsoluteYearToDate(absoluteYear);
    if (isNaN(d.getTime())) return false;

    const roundedMinutes = Math.round(d.getMinutes() / 15) * 15;
    const normalized = new Date(d);
    normalized.setMinutes(roundedMinutes, 0, 0);

    if (interval >= 1 / 12) {
      return normalized.getMonth() === 0;
    }

    const day = normalized.getDate();
    if (interval >= 1 / 365.25) {
      return day === 1;
    }

    return (
      day === 1 && normalized.getHours() === 0 && normalized.getMinutes() === 0
    );
  }

  if (!isNearlyInteger(absoluteYear)) return false;

  const roundedYear = Math.round(absoluteYear);
  if (roundedYear === 0) return true;
  return roundedYear % highlightStep === 0;
};

const tickLabelWidthEstimateCache = new Map<number, number>();

export const getAbsoluteYearFromDateJump = ({
  year,
  month,
  day,
}: DateJumpTarget): number => {
  if (month === null) return year;

  const normalizedDay = day ?? 1;
  const date = new Date(Date.UTC(0, month - 1, normalizedDay, 12));
  date.setUTCFullYear(year, month - 1, normalizedDay);

  const actualYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(0, 0, 1));
  yearStart.setUTCFullYear(actualYear, 0, 1);
  const nextYearStart = new Date(Date.UTC(0, 0, 1));
  nextYearStart.setUTCFullYear(actualYear + 1, 0, 1);

  return (
    actualYear +
    (date.getTime() - yearStart.getTime()) /
      (nextYearStart.getTime() - yearStart.getTime())
  );
};

export const slugifyCollectionId = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return slug || "collection";
};

export const createLocalDateStamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createNewTimelineEvent = (): Event => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: "",
  description: "",
  emoji: "📅",
  time: [new Date().getFullYear(), null, null, null, null, null],
  priority: 50,
});

export const buildCustomCollectionMeta = (
  collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  existingCollections: EventCollectionMeta[],
): EventCollectionMeta => {
  const existingIds = new Set(existingCollections.map((item) => item.id));
  const baseId = slugifyCollectionId(collection.name);
  let nextId = baseId;
  let suffix = 2;

  while (existingIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id: nextId,
    emoji: collection.emoji,
    name: collection.name,
    description: collection.description,
    author: "You",
    createdAt: createLocalDateStamp(),
  };
};

export const getStableTickLabelWidthEstimate = (interval: number) => {
  const cached = tickLabelWidthEstimateCache.get(interval);
  if (cached !== undefined) return cached;

  const sampleYears =
    interval >= 1 ? [BIG_BANG_YEAR, 0, 2000] : [2024, 2024.25, 2024.5];
  const estimate = Math.max(
    80,
    ...sampleYears.map(
      (year) => formatTimelineTick(year, interval).length * 8 + 40,
    ),
  );
  tickLabelWidthEstimateCache.set(interval, estimate);
  return estimate;
};

export const formatZoomRangeLabel = (
  currentLogZoom: number,
  viewportWidth: number,
): string => {
  const currentZoom = Math.exp(currentLogZoom);
  const rangeInYears = viewportWidth / currentZoom;
  if (rangeInYears >= 1e9) {
    return `${(rangeInYears / 1e9).toFixed(0)}B Yrs`;
  }
  if (rangeInYears >= 1e6) {
    return `${(rangeInYears / 1e6).toFixed(0)}M Yrs`;
  }
  if (rangeInYears >= 1000) {
    return `${(rangeInYears / 1000).toFixed(0)}K Yrs`;
  }
  if (rangeInYears >= 1) {
    return `${rangeInYears.toFixed(0)} Yrs`;
  }
  if (rangeInYears >= 1 / 12) {
    return `${(rangeInYears * 12).toFixed(0)} Mos`;
  }
  if (rangeInYears >= 1 / 365.25) {
    return `${(rangeInYears * 365.25).toFixed(0)} Days`;
  }
  return "1 Day";
};

export const getTimelineLayoutLevelCount = (viewportHeight: number): number => {
  const halfHeight = Math.max(0, viewportHeight / 2);
  const usableHalfHeight = Math.max(0, halfHeight - LAYOUT_EDGE_PADDING);
  const levelCount = Math.floor(usableHalfHeight / LAYOUT_ROW_OFFSET);

  return Math.max(1, Math.min(LAYOUT_MAX_LEVELS_PER_SIDE, levelCount));
};

export const getTimelineLayoutLevels = (viewportHeight: number): number[] =>
  Array.from(
    { length: getTimelineLayoutLevelCount(viewportHeight) },
    (_, index) => index + 1,
  );

export const getCollapsedGroupOffset = (viewportHeight: number): number =>
  (getTimelineLayoutLevelCount(viewportHeight) + 1) * LAYOUT_ROW_OFFSET;

export const areCollapsedGroupsEqual = (
  prevGroups: CollapsedEventGroup[],
  nextGroups: CollapsedEventGroup[],
) =>
  prevGroups.length === nextGroups.length &&
  prevGroups.every((group, index) => {
    const nextGroup = nextGroups[index];
    const nextEventIds = new Set(nextGroup.eventIds);
    return (
      group.id === nextGroup.id &&
      group.year === nextGroup.year &&
      group.side === nextGroup.side &&
      group.count === nextGroup.count &&
      group.eventIds.length === nextEventIds.size &&
      group.eventIds.every((eventId) => nextEventIds.has(eventId))
    );
  });

/**
 * Parse a viewport year from URL search params.
 * Accepts plain year number, or scientific notation (e.g. "-6.6e7" → -66000000).
 * Returns null if absent or invalid.
 */
export const getSharedViewportYearFromSearch = (
  search: string,
): number | null => {
  const params = new URLSearchParams(search);
  const raw = params.get(TIMELINE_VIEWPORT_YEAR_PARAM);
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Accept plain numbers or scientific notation (e.g. "-6.6e7", "1.5e9")
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) return parsed;

  // Fallback: try parsing scientific notation manually for precision
  const sciMatch = /^(-?\d*\.?\d+)[eE]([+-]?\d+)$/.exec(trimmed);
  if (sciMatch) {
    const base = Number.parseFloat(sciMatch[1]!);
    const exp = Number.parseInt(sciMatch[2]!, 10);
    const result = base * 10 ** exp;
    if (Number.isFinite(result)) return result;
  }

  return null;
};

/**
 * Parse a log-zoom value from URL search params.
 * logZoom = ln(zoom), so URL value is the log base e directly.
 * Accepts plain number or scientific notation.
 * Returns null if absent or invalid.
 */
export const getSharedLogZoomFromSearch = (
  search: string,
): number | null => {
  const params = new URLSearchParams(search);
  const raw = params.get(TIMELINE_VIEWPORT_ZOOM_PARAM);
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) return parsed;

  const sciMatch = /^(-?\d*\.?\d+)[eE]([+-]?\d+)$/.exec(trimmed);
  if (sciMatch) {
    const base = Number.parseFloat(sciMatch[1]!);
    const exp = Number.parseInt(sciMatch[2]!, 10);
    const result = base * 10 ** exp;
    if (Number.isFinite(result)) return result;
  }

  return null;
};

/** Returns true if the URL has a viewport year or zoom param. */
export const hasSharedViewportInSearch = (search: string): boolean =>
  getSharedViewportYearFromSearch(search) !== null ||
  getSharedLogZoomFromSearch(search) !== null;

/** Write focusYear + logZoom to URL params. Uses scientific notation for large values. */
export const setSharedViewportInUrl = (
  url: URL,
  focusYear: number,
  logZoom: number,
): void => {
  const roundedYear = Math.round(focusYear * 100) / 100;
  const roundedLogZoom = Math.round(logZoom * 1000) / 1000;

  // Use scientific notation for large numbers for readability in the URL
  const yearStr =
  Math.abs(roundedYear) >= 1e6
    ? roundedYear.toExponential(3)
    : String(roundedYear);

  url.searchParams.set(TIMELINE_VIEWPORT_YEAR_PARAM, yearStr);
  url.searchParams.set(
    TIMELINE_VIEWPORT_ZOOM_PARAM,
    String(roundedLogZoom),
  );
};

/** Remove all viewport params from the URL. */
export const clearSharedViewportInUrl = (url: URL): void => {
  url.searchParams.delete(TIMELINE_VIEWPORT_YEAR_PARAM);
  url.searchParams.delete(TIMELINE_VIEWPORT_ZOOM_PARAM);
};
