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
  ImportedEvent,
  StoredEvent,
  EventTime,
  SupportedLanguage,
} from "../constants/types";
import { normalizeLocalizedText } from "./localization";

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  vi: "vi-VN",
  en: "en-US",
};

export const normalizeEventTimeParts = (time: EventTime): Required<EventTime> =>
  [
    time[0],
    time[1] ?? null,
    time[2] ?? null,
    time[3] ?? null,
    time[4] ?? null,
    time[5] ?? null,
  ] as Required<EventTime>;

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

export {
  clampSpatialLatitude,
  createSpatialAnchorFromViewport,
  DEFAULT_SPATIAL_MAPPING,
  DEFAULT_SPATIAL_MAP_THEME,
  DEFAULT_SPATIAL_MAP_OPACITY,
  DEFAULT_SPATIAL_METERS_PER_YEAR,
  formatCoordinate,
  getOpenFreeMapStyleUrl,
  getMetersPerYearForMapZoom,
  getSpatialCameraState,
  MAP_EQUATOR_METERS_PER_PIXEL_AT_Z0,
  OPEN_FREE_MAP_MAX_ZOOM,
  OPEN_FREE_MAP_MIN_ZOOM,
  sanitizeMetersPerYear,
  sanitizeSpatialMapTheme,
  sanitizeSpatialMapOpacity,
  sanitizeSpatialMapping,
  SPATIAL_MAX_SAFE_LATITUDE,
  SPATIAL_WORLD_CIRCUMFERENCE_METERS,
} from "./spatialMapping";

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

// Cache: event time is immutable — label only varies by locale.
// WeakMap avoids memory leaks. undefined = locale not yet computed.
const _displayLabelCache = new WeakMap<
  Event,
  Partial<Record<SupportedLanguage, string>>
>();

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

const formatWholeDurationUnit = (
  value: number,
  singular: string,
  plural: string,
): string => {
  const label = Math.abs(value) === 1 ? singular : plural;
  return `${formatCount(value)} ${label}`;
};

const YEAR_IN_DAYS = 365.25;
const MONTH_IN_DAYS = YEAR_IN_DAYS / 12;
const ELAPSED_TIME_LABELS: Record<
  SupportedLanguage,
  {
    billionYear: [string, string];
    millionYear: [string, string];
    year: [string, string];
    month: [string, string];
    day: [string, string];
    hour: [string, string];
    minute: [string, string];
    second: [string, string];
    underOneSecond: string;
  }
> = {
  en: {
    billionYear: ["billion year", "billion years"],
    millionYear: ["million year", "million years"],
    year: ["year", "years"],
    month: ["month", "months"],
    day: ["day", "days"],
    hour: ["hour", "hours"],
    minute: ["minute", "minutes"],
    second: ["second", "seconds"],
    underOneSecond: "under 1 second",
  },
  vi: {
    billionYear: ["tỷ năm", "tỷ năm"],
    millionYear: ["triệu năm", "triệu năm"],
    year: ["năm", "năm"],
    month: ["tháng", "tháng"],
    day: ["ngày", "ngày"],
    hour: ["giờ", "giờ"],
    minute: ["phút", "phút"],
    second: ["giây", "giây"],
    underOneSecond: "dưới 1 giây",
  },
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

const formatEventTime = (
  event: Event,
  locale: SupportedLanguage,
): string => {
  const cached = _displayLabelCache.get(event);
  if (cached !== undefined) {
    const hit = cached[locale];
    if (hit !== undefined) return hit;
  }

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

    const localeStr = LOCALE_MAP[locale];

    if (isNaN(d.getTime())) {
      label = formatYear(getEventTimelineYear(event));
    } else if (day == null) {
      label = d.toLocaleDateString(localeStr, MONTH_YEAR_FORMAT);
    } else {
      const hasTime = hour != null || minute != null || seconds != null;
      if (!hasTime) {
        label = d.toLocaleDateString(localeStr, FULL_DATE_FORMAT);
      } else {
        label = d.toLocaleString(localeStr, {
          ...DATE_TIME_FORMAT,
          second: seconds != null ? "2-digit" : undefined,
        });
      }
    }
  }

  // Persist per-locale so other locales can still hit cache.
  // Only write to cache after confirming label is non-empty (guards against
  // partial cache entry from a parallel caller).
  const existing = _displayLabelCache.get(event) ?? { vi: undefined, en: undefined };
  existing[locale] = label;
  _displayLabelCache.set(event, existing);
  return label;
};

export const getEventDisplayLabel = (
  event: Event,
  locale: SupportedLanguage,
): string => formatEventTime(event, locale);

export const formatElapsedTimelineTime = (
  years: number,
  locale: SupportedLanguage = "en",
): string => {
  const absoluteYears = Math.abs(years);
  const labels = ELAPSED_TIME_LABELS[locale];

  if (absoluteYears >= 1e9) {
    return formatDurationUnit(
      absoluteYears / 1e9,
      labels.billionYear[0],
      labels.billionYear[1],
      absoluteYears >= 1e10 ? 0 : 1,
    );
  }

  if (absoluteYears >= 1e6) {
    return formatDurationUnit(
      absoluteYears / 1e6,
      labels.millionYear[0],
      labels.millionYear[1],
      absoluteYears >= 1e7 ? 0 : 1,
    );
  }

  const days = absoluteYears * 365.25;
  const roundedDays = Math.round(days);

  if (roundedDays >= 1) {
    const totalMonths = absoluteYears * 12;
    let normalizedYears = Math.floor(totalMonths / 12);
    let normalizedMonths = Math.floor(totalMonths - normalizedYears * 12);
    let normalizedDays = Math.round(
      (totalMonths - normalizedYears * 12 - normalizedMonths) * MONTH_IN_DAYS,
    );

    if (normalizedDays >= Math.round(MONTH_IN_DAYS)) {
      normalizedMonths += 1;
      normalizedDays = 0;
    }

    if (normalizedMonths >= 12) {
      normalizedYears += Math.floor(normalizedMonths / 12);
      normalizedMonths %= 12;
    }

    const parts: string[] = [];
    if (normalizedYears > 0) {
      parts.push(
        formatWholeDurationUnit(
          normalizedYears,
          labels.year[0],
          labels.year[1],
        ),
      );
    }
    if (normalizedMonths > 0) {
      parts.push(
        formatWholeDurationUnit(
          normalizedMonths,
          labels.month[0],
          labels.month[1],
        ),
      );
    }
    if (normalizedDays > 0) {
      parts.push(
        formatWholeDurationUnit(normalizedDays, labels.day[0], labels.day[1]),
      );
    }

    if (parts.length > 0) {
      return parts.slice(0, 3).join(" ");
    }
  }

  const months = absoluteYears * 12;
  if (months >= 1) {
    return formatDurationUnit(months, labels.month[0], labels.month[1]);
  }

  if (days >= 1) {
    return formatDurationUnit(days, labels.day[0], labels.day[1]);
  }

  const hours = days * 24;
  if (hours >= 1) {
    return formatDurationUnit(hours, labels.hour[0], labels.hour[1]);
  }

  const minutes = hours * 60;
  if (minutes >= 1) {
    return formatDurationUnit(minutes, labels.minute[0], labels.minute[1]);
  }

  const seconds = Math.max(minutes * 60, 0);
  if (seconds < 1) {
    return labels.underOneSecond;
  }

  return formatDurationUnit(seconds, labels.second[0], labels.second[1]);
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

export const formatTick = (
  absoluteYear: number,
  interval: number,
  locale: SupportedLanguage,
): string => {
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

  const localeStr = LOCALE_MAP[locale];

  if (interval >= 1 / 12) {
    return d.toLocaleDateString(localeStr, MONTH_YEAR_NUMERIC_FORMAT);
  }

  if (interval >= 1 / 365.25) {
    return d.toLocaleDateString(localeStr, DAY_MONTH_YEAR_NUMERIC_FORMAT);
  }

  return d.toLocaleDateString(localeStr, DAY_MONTH_YEAR_NUMERIC_FORMAT);
};

export const formatTimelineTick = (
  absoluteYear: number,
  interval: number,
  locale: SupportedLanguage,
): string => formatTick(absoluteYear, interval, locale);

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

const hashString = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const normalizeEventUidCandidate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const createPersistentEventUid = (
  signature: string,
  occurrence: number,
  collectionId?: string,
): string => {
  const namespace = collectionId ? slugifyCollectionId(collectionId) : "event";
  const suffix = hashString(`eventUid:${namespace}:${signature}`);
  return occurrence > 1
    ? `${namespace}-eu-${suffix}-${occurrence}`
    : `${namespace}-eu-${suffix}`;
};

const normalizeStoredEventPayload = (
  event: StoredEvent | Event | ImportedEvent,
): StoredEvent => ({
  ...(normalizeEventUidCandidate(event.eventUid)
    ? { eventUid: normalizeEventUidCandidate(event.eventUid) ?? undefined }
    : {}),
  title: normalizeLocalizedText(event.title) ?? "",
  description: normalizeLocalizedText(event.description) ?? "",
  time: normalizeEventTimeParts(event.time),
  emoji: event.emoji,
  priority: event.priority,
  duration: event.duration,
  color: event.color ?? null,
  image: event.image,
  video: event.video,
  link: event.link,
});

const getStoredEventSignature = (
  event: StoredEvent | Event | ImportedEvent,
): string => {
  const normalized = normalizeStoredEventPayload(event);

  return JSON.stringify([
    normalizeLocalizedText(normalized.title) ?? "",
    normalizeLocalizedText(normalized.description) ?? "",
    normalized.emoji.trim(),
    normalizeEventTimeParts(normalized.time),
    normalized.priority,
    normalized.duration ?? null,
    normalized.color ?? null,
    normalized.image ?? null,
    normalized.video ?? null,
    normalized.link ?? null,
  ]);
};

const createDeterministicEventId = (
  signature: string,
  occurrence: number,
  collectionId?: string,
): string => {
  const namespace = collectionId ? slugifyCollectionId(collectionId) : "event";
  const suffix = hashString(`${namespace}:${signature}`);
  return occurrence > 1
    ? `${namespace}-${suffix}-${occurrence}`
    : `${namespace}-${suffix}`;
};

export const assignRuntimeEventIds = (
  events: Array<StoredEvent | Event>,
  options?: {
    collectionId?: string;
    previousEvents?: Event[];
  },
): Event[] => {
  const previousIdsBySignature = new Map<string, string[]>();
  const previousEventUidsBySignature = new Map<string, string[]>();

  options?.previousEvents?.forEach((event) => {
    const signature = getStoredEventSignature(event);
    const queue = previousIdsBySignature.get(signature) ?? [];
    queue.push(event.id);
    previousIdsBySignature.set(signature, queue);

    const eventUid = normalizeEventUidCandidate(event.eventUid);
    if (eventUid) {
      const uidQueue = previousEventUidsBySignature.get(signature) ?? [];
      uidQueue.push(eventUid);
      previousEventUidsBySignature.set(signature, uidQueue);
    }
  });

  const occurrenceCounts = new Map<string, number>();
  const seenEventUids = new Set<string>();

  return events.map((event) => {
    const normalized = normalizeStoredEventPayload(event);
    const signature = getStoredEventSignature(normalized);
    const nextOccurrence = (occurrenceCounts.get(signature) ?? 0) + 1;
    occurrenceCounts.set(signature, nextOccurrence);

    const preservedId = previousIdsBySignature.get(signature)?.shift();
    const explicitEventUid = normalizeEventUidCandidate(event.eventUid);
    const preservedEventUid =
      explicitEventUid ??
      previousEventUidsBySignature.get(signature)?.shift() ??
      createPersistentEventUid(
        signature,
        nextOccurrence,
        options?.collectionId,
      );

    let nextEventUid = preservedEventUid;
    if (seenEventUids.has(nextEventUid)) {
      nextEventUid = createPersistentEventUid(
        `${signature}:${nextOccurrence}:${seenEventUids.size}`,
        1,
        options?.collectionId,
      );
    }
    seenEventUids.add(nextEventUid);

    return {
      id:
        preservedId ??
        createDeterministicEventId(
          signature,
          nextOccurrence,
          options?.collectionId,
        ),
      ...normalized,
      eventUid: nextEventUid,
    };
  });
};

export const stripRuntimeEventId = (event: Event): StoredEvent => ({
  ...(normalizeEventUidCandidate(event.eventUid)
    ? { eventUid: normalizeEventUidCandidate(event.eventUid) ?? undefined }
    : {}),
  title: event.title,
  description: event.description,
  time: [...normalizeEventTimeParts(event.time)] as Event["time"],
  emoji: event.emoji,
  priority: event.priority,
  duration: event.duration,
  color: event.color ?? null,
  image: event.image,
  video: event.video,
  link: event.link,
});

export const stripRuntimeEventIds = (events: Event[]): StoredEvent[] =>
  events.map(stripRuntimeEventId);

export const createNewTimelineEvent = (): Event => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  eventUid:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: {
    vi: "",
    en: "",
  },
  description: {
    vi: "",
    en: "",
  },
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
      (year) => formatTimelineTick(year, interval, "en").length * 8 + 40,
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
