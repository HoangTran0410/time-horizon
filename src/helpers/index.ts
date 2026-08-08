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

/**
 * `new Date(y, ...)` treats 0-99 as 1900+y, so year 50 silently became 1950.
 * Every year<->Date conversion here goes through this instead.
 */
const makeLocalDate = (
  year: number,
  monthIndex = 0,
  day = 1,
  hours = 0,
  minutes = 0,
  seconds = 0,
): Date => {
  const date = new Date(2000, monthIndex, day, hours, minutes, seconds);
  date.setFullYear(year, monthIndex, day);
  return date;
};

// Cache: event time is immutable, so the timeline year is deterministic.
// WeakMap avoids memory leaks — entries disappear when Event is GC'd.
const _timelineYearCache = new WeakMap<Event, number>();

/** Fractional-year position for any EventTime. Pure; callers add caching. */
export const eventTimeToTimelineYear = (time: EventTime): number => {
  const [year, month, day, hour, minute, seconds] =
    normalizeEventTimeParts(time);

  if (
    month == null &&
    day == null &&
    hour == null &&
    minute == null &&
    seconds == null
  ) {
    return year;
  }

  const d = makeLocalDate(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    seconds ?? 0,
  );

  if (isNaN(d.getTime())) {
    return year;
  }

  const y = d.getFullYear();
  const start = makeLocalDate(y).getTime();
  const end = makeLocalDate(y + 1).getTime();
  const frac = (d.getTime() - start) / (end - start);
  return y + frac;
};

export const getEventTimelineYear = (event: Event): number => {
  const cached = _timelineYearCache.get(event);
  if (cached !== undefined) return cached;

  const result = eventTimeToTimelineYear(event.time);
  _timelineYearCache.set(event, result);
  return result;
};

const _timelineEndYearCache = new WeakMap<Event, number | null>();

/**
 * Fractional end year for a span event, or null for a point event.
 * Always >= the start year: a reversed pair is treated as a span, not an error,
 * since imported data routinely gets the two columns the wrong way round.
 */
export const getEventTimelineEndYear = (event: Event): number | null => {
  const cached = _timelineEndYearCache.get(event);
  if (cached !== undefined) return cached;

  if (event.endTime == null) {
    _timelineEndYearCache.set(event, null);
    return null;
  }

  const startYear = getEventTimelineYear(event);
  const endYear = eventTimeToTimelineYear(event.endTime);
  // Returned as authored, which may be earlier than the start — callers that
  // need an ordered pair go through getEventTimelineRange.
  const result = endYear === startYear ? null : endYear;

  _timelineEndYearCache.set(event, result);
  return result;
};

/** Ordered inclusive [start, end]; end === start for point events. */
export const getEventTimelineRange = (
  event: Event,
): { startYear: number; endYear: number } => {
  const startYear = getEventTimelineYear(event);
  const endYear = getEventTimelineEndYear(event);
  return endYear === null
    ? { startYear, endYear: startYear }
    : {
        startYear: Math.min(startYear, endYear),
        endYear: Math.max(startYear, endYear),
      };
};

export const isSpanEvent = (event: Event): boolean =>
  getEventTimelineEndYear(event) !== null;

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

export const DAY_IN_YEARS = 1 / 365.25;
export const HOUR_IN_YEARS = DAY_IN_YEARS / 24;
export const MINUTE_IN_YEARS = HOUR_IN_YEARS / 60;
export const SECOND_IN_YEARS = MINUTE_IN_YEARS / 60;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const NICE_INTERVALS: number[] = [
  // The top rungs sit well past the age of the universe on purpose: the
  // viewport can zoom out beyond the Big Bang, and at MIN_ZOOM a wide screen
  // spans ~3.5e11 years. Without them the coarsest rung does not fit its own
  // label and the outermost ticks collide.
  5e11,
  1e11,
  5e10,
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
  1 / 2, // 6 months
  1 / 4, // 3 months
  1 / 6, // 2 months
  1 / 12, // 1 month
  1 / 52, // 1 week
  DAY_IN_YEARS,
  // Sub-day rungs. Every one divides evenly into a day, which is what lets
  // the tick generator land them on round clock times.
  12 * HOUR_IN_YEARS,
  6 * HOUR_IN_YEARS,
  3 * HOUR_IN_YEARS,
  HOUR_IN_YEARS,
  30 * MINUTE_IN_YEARS,
  15 * MINUTE_IN_YEARS,
  5 * MINUTE_IN_YEARS,
  MINUTE_IN_YEARS,
  30 * SECOND_IN_YEARS,
  15 * SECOND_IN_YEARS,
  5 * SECOND_IN_YEARS,
  SECOND_IN_YEARS,
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

const pad2 = (value: number): string => String(value).padStart(2, "0");

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
  const start = makeLocalDate(y).getTime();
  const end = makeLocalDate(y + 1).getTime();
  // Rounded, not truncated: the year<->ms round trip lands a fraction of a
  // millisecond short, and `new Date` truncating that turned a tick sitting
  // exactly on 14:00 into a label reading 13:59.
  return new Date(Math.round(start + frac * (end - start)));
};

const dateToAbsoluteYear = (date: Date): number => {
  const year = date.getFullYear();
  const start = makeLocalDate(year).getTime();
  const end = makeLocalDate(year + 1).getTime();
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

/**
 * Human label for one point in time. Split out from formatEventTime so a span
 * can format its end the same way its start is formatted.
 */
export const formatTimelineTimeLabel = (
  time: EventTime,
  locale: SupportedLanguage,
): string => {
  const [year, month, day, hour, minute, seconds] =
    normalizeEventTimeParts(time);

  let label: string;

  if (month == null) {
    label = formatYear(year);
  } else if (year <= 0) {
    // JavaScript Date formatting around BC years is unreliable for locale output.
    // For BCE dates, fall back to decimal year formatting.
    label = formatYear(eventTimeToTimelineYear(time));
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
      label = formatYear(eventTimeToTimelineYear(time));
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

  return label;
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

  const label = formatTimelineTimeLabel(event.time, locale);

  // Persist per-locale so other locales can still hit cache.
  const existing = _displayLabelCache.get(event) ?? { vi: undefined, en: undefined };
  existing[locale] = label;
  _displayLabelCache.set(event, existing);
  return label;
};

export const getEventDisplayLabel = (
  event: Event,
  locale: SupportedLanguage,
): string => formatEventTime(event, locale);

/** Label for the end of a span, or null when the event is a point. */
export const getEventEndDisplayLabel = (
  event: Event,
  locale: SupportedLanguage,
): string | null =>
  event.endTime == null || !isSpanEvent(event)
    ? null
    : formatTimelineTimeLabel(event.endTime, locale);

/** How long a span lasts, in fractional years, or null for a point event. */
export const getEventSpanLengthYears = (event: Event): number | null => {
  const { startYear, endYear } = getEventTimelineRange(event);
  return endYear > startYear ? endYear - startYear : null;
};

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

/**
 * Finest tick interval whose own label still fits the spacing that interval
 * would get. Picking the nearest nice value instead — which is what this
 * replaced — ignores label width entirely, and the rungs are far apart in
 * places: between 1 year and 1 month there is nothing, so a 2-year viewport
 * dropped straight to monthly ticks and printed "12/2024" every 52px.
 *
 * Expressed as a fit test rather than a spacing budget, collisions are
 * impossible by construction at any zoom, for any label format.
 */
export const getTickIntervalThatFitsLabels = (
  visibleYears: number,
  primarySize: number,
  referenceYear: number = BIG_BANG_YEAR,
): number => {
  if (!(visibleYears > 0) || !(primarySize > 0)) return NICE_INTERVALS[0];
  const zoom = primarySize / visibleYears;

  // NICE_INTERVALS runs coarse to fine, so the last one that fits is the
  // finest. Label width is not monotone across rungs (a clock label is
  // narrower than a date), so every rung is tested rather than breaking early.
  let best = NICE_INTERVALS[0];
  for (const interval of NICE_INTERVALS) {
    if (interval * zoom >= getStableTickLabelWidthEstimate(interval, referenceYear)) {
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

  if (interval >= DAY_IN_YEARS) {
    return d.toLocaleDateString(localeStr, DAY_MONTH_YEAR_NUMERIC_FORMAT);
  }

  // Below a day the date would repeat on every tick while tripling the label
  // width, which is exactly what makes them collide. The date lives on the
  // highlighted ticks; these carry the clock only.
  if (interval >= HOUR_IN_YEARS) {
    return `${pad2(d.getHours())}:00`;
  }

  if (interval >= MINUTE_IN_YEARS) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

export const formatTimelineTick = (
  absoluteYear: number,
  interval: number,
  locale: SupportedLanguage,
): string => formatTick(absoluteYear, interval, locale);

const makeMonthStart = (absoluteMonthIndex: number): Date => {
  const year = Math.floor(absoluteMonthIndex / 12);
  return makeLocalDate(year, absoluteMonthIndex - year * 12);
};

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

  // This used to step one month regardless of the interval it was handed, so
  // every rung between a year and a month emitted twelve ticks a year. With
  // coarser month rungs on the ladder that would space them for a six-month
  // label and print twelve.
  const monthStep = Math.max(1, Math.round(interval * 12));
  const startAbsMonth = startDate.getFullYear() * 12 + startDate.getMonth();
  let absMonth = Math.ceil(startAbsMonth / monthStep) * monthStep;
  if (makeMonthStart(absMonth).getTime() < startDate.getTime()) {
    absMonth += monthStep;
  }

  const ticks: number[] = [];
  const endMs = endDate.getTime();
  while (ticks.length < MAX_GENERATED_TICKS) {
    const cursor = makeMonthStart(absMonth);
    if (cursor.getTime() > endMs) break;
    ticks.push(dateToAbsoluteYear(cursor));
    absMonth += monthStep;
  }

  return ticks;
};

/** Hard cap so a pathological interval can never spin the generator forever. */
const MAX_GENERATED_TICKS = 4000;

/**
 * Sub-day ticks, stepped in milliseconds off local midnight so they land on
 * round clock times. Accumulating fractional years instead would drift the
 * labels off the minute they claim to mark, because a year is not a whole
 * number of any sub-day unit.
 */
export const generateSubDayTimelineTickYears = (
  startYear: number,
  endYear: number,
  interval: number,
): number[] | null => {
  if (interval >= DAY_IN_YEARS) return null;
  // Date-based stepping is only meaningful inside the range Date can express.
  if (startYear <= 0 || endYear <= 0) return null;

  const startDate = parseAbsoluteYearToDate(startYear);
  const endDate = parseAbsoluteYearToDate(endYear);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

  const stepMs = Math.round(interval * DAY_IN_MS / DAY_IN_YEARS);
  if (stepMs <= 0) return null;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const localMidnightMs = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  ).getTime();

  const stepsFromMidnight = Math.ceil((startMs - localMidnightMs) / stepMs);
  let cursorMs = localMidnightMs + stepsFromMidnight * stepMs;

  if ((endMs - cursorMs) / stepMs > MAX_GENERATED_TICKS) return null;

  const ticks: number[] = [];
  while (cursorMs <= endMs && ticks.length < MAX_GENERATED_TICKS) {
    ticks.push(dateToAbsoluteYear(new Date(cursorMs)));
    cursorMs += stepMs;
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

const tickLabelWidthEstimateCache = new Map<string, number>();

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
  ...(event.endTime != null
    ? { endTime: normalizeEventTimeParts(event.endTime) }
    : {}),
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
    normalized.endTime ? normalizeEventTimeParts(normalized.endTime) : null,
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
  ...(event.endTime != null
    ? {
        endTime: [
          ...normalizeEventTimeParts(event.endTime),
        ] as Event["time"],
      }
    : {}),
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

/**
 * Roughly how wide this rung's label will be, in pixels.
 *
 * `referenceYear` matters: at the year rung a label is "1942" near the present
 * and "13.8 Billion BC" in deep time, a 2x difference. Estimating with the
 * global worst case made modern views far sparser than they needed to be, so
 * the estimate is taken where the viewport actually is — bucketed by order of
 * magnitude so the cache stays small.
 */
export const getStableTickLabelWidthEstimate = (
  interval: number,
  referenceYear: number = BIG_BANG_YEAR,
) => {
  const magnitude = Math.floor(
    Math.log10(Math.max(Math.abs(referenceYear), 1)),
  );
  const cacheKey = `${interval}|${magnitude}|${referenceYear < 0 ? "b" : "a"}`;
  const cached = tickLabelWidthEstimateCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Widest realistic label for this rung. Below a year that means a two-digit
  // day in a two-digit month, which beats "1/4/2024" by four characters — the
  // estimate has to cover the worst case or the ticks it spaces will collide.
  const sampleYears =
    interval >= 1
      ? [referenceYear, referenceYear - interval * 4, referenceYear + interval * 4]
      : interval >= DAY_IN_YEARS
        ? [2024 + 11.5 / 12, 2024 + 0.5 / 12, 2024.5]
        : [2024 + 11.5 / 12 + 23 * HOUR_IN_YEARS + 59 * MINUTE_IN_YEARS];

  const estimate = Math.max(
    80,
    ...sampleYears.map(
      (year) => formatTimelineTick(year, interval, "en").length * 8 + 40,
    ),
  );
  tickLabelWidthEstimateCache.set(cacheKey, estimate);
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
  if (rangeInYears >= DAY_IN_YEARS) {
    return `${(rangeInYears * 365.25).toFixed(0)} Days`;
  }
  if (rangeInYears >= HOUR_IN_YEARS) {
    return `${(rangeInYears / HOUR_IN_YEARS).toFixed(0)} Hrs`;
  }
  if (rangeInYears >= MINUTE_IN_YEARS) {
    return `${(rangeInYears / MINUTE_IN_YEARS).toFixed(0)} Min`;
  }
  return `${Math.max(1, Math.round(rangeInYears / SECOND_IN_YEARS))} Sec`;
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

/**
 * One frame of the camera, reduced to the map it applies to years.
 *
 * `panPixel` is where year 0 lands — `focusPixel - focusYear * zoom *
 * axisDirection`, the quantity the viewport hook derives as `panX`. Sampling
 * that rather than the (focusPixel, focusYear) pair it is built from matters:
 * the wheel handler rewrites both on every event to re-anchor on the pointer,
 * which does not move the picture at all, and `panPixel` is what stays put.
 */
export type TimelineCameraSample = {
  panPixel: number;
  zoom: number;
};

/**
 * The pixel that does not move between two camera frames — the point the
 * timeline appears to expand from.
 *
 * Zooming and panning at once still reads as a pure zoom about *some* pixel,
 * and that pixel is generally not the middle of the viewport: the landing
 * tour's camera expands about a point up to ~90px off centre. Anything drawn
 * to measure the zoom — the warp overlay's reference rings — has to be centred
 * there, or its edges slide across the timeline at exactly the pan rate.
 *
 * Returns null when the two frames share a zoom, since a pure pan has no fixed
 * point. Callers should hold their last pivot in that case.
 */
export const resolveZoomFixedPointPixel = (
  previous: TimelineCameraSample,
  next: TimelineCameraSample,
  axisDirection: 1 | -1,
): number | null => {
  const zoomDelta = previous.zoom - next.zoom;
  if (!Number.isFinite(zoomDelta) || zoomDelta === 0) return null;

  const fixedYear =
    (next.panPixel - previous.panPixel) / (zoomDelta * axisDirection);
  const pixel = next.panPixel + fixedYear * next.zoom * axisDirection;

  return Number.isFinite(pixel) ? pixel : null;
};

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
