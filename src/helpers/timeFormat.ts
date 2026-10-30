/** Human-readable labels for years, event times, durations and zoom ranges. */

import type { Event, EventTime, SupportedLanguage } from "../constants/types";
import {
  normalizeEventTimeParts,
  eventTimeToTimelineYear,
  isSpanEvent,
  DAY_IN_YEARS,
  HOUR_IN_YEARS,
  MINUTE_IN_YEARS,
  SECOND_IN_YEARS,
  isYearZero,
  parseAbsoluteYearToDate,
} from "./time";

export const LOCALE_MAP: Record<SupportedLanguage, string> = {
  vi: "vi-VN",
  en: "en-US",
};

// Cache: event time is immutable — label only varies by locale.
// WeakMap avoids memory leaks. undefined = locale not yet computed.
const _displayLabelCache = new WeakMap<
  Event,
  Partial<Record<SupportedLanguage, string>>
>();

/**
 * Strip trailing zeros from toFixed output: "100.0B" → "100B",
 * "13.80" → "13.8", "2.50 Million" → "2.5 Million". Only the fractional part
 * is touched, so "100" and "1000.00" keep their integer zeros.
 */
export const stripTrailingZeros = (s: string): string =>
  s.replace(/(\.\d*?)0+(?=\s|[A-Z]|$)/, "$1").replace(/\.(?=\s|[A-Z]|$)/, "");

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

/**
 * `Date#toLocaleDateString(locale, options)` builds a fresh Intl.DateTimeFormat
 * on every call, which is by far the slowest part of labelling ticks. The
 * option objects below are module constants, so formatters are cached per
 * (options object, locale) and reused. Output is identical: every cached
 * option set names its date fields explicitly.
 */
const DATE_TIME_FORMATTERS = new WeakMap<
  Intl.DateTimeFormatOptions,
  Map<string | undefined, Intl.DateTimeFormat>
>();

export const formatDateWithOptions = (
  date: Date,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string => {
  let byLocale = DATE_TIME_FORMATTERS.get(options);
  if (!byLocale) {
    byLocale = new Map();
    DATE_TIME_FORMATTERS.set(options, byLocale);
  }
  let formatter = byLocale.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    byLocale.set(locale, formatter);
  }
  return formatter.format(date);
};

const MONTH_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  year: "numeric",
};

export const MONTH_YEAR_NUMERIC_FORMAT: Intl.DateTimeFormatOptions = {
  month: "numeric",
  year: "numeric",
};

const MONTH_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

export const DAY_MONTH_YEAR_NUMERIC_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "numeric",
  year: "numeric",
};

export const pad2 = (value: number): string => String(value).padStart(2, "0");

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

export const formatAbsoluteYear = (year: number): string => {
  if (isYearZero(year)) return "0";

  const rounded = Math.round(year);
  if (rounded > 0) return `${rounded}`;
  if (rounded === 0) return year < 0 ? "1 BC" : "0";
  return `${Math.abs(rounded)} BC`;
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

  return formatDateWithOptions(d, undefined, DATE_TIME_FORMAT);
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
      label = formatDateWithOptions(d, localeStr, MONTH_YEAR_FORMAT);
    } else {
      const hasTime = hour != null || minute != null || seconds != null;
      if (!hasTime) {
        label = formatDateWithOptions(d, localeStr, FULL_DATE_FORMAT);
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

/** End-of-span label for an ongoing event ("1986 → nay"). */
export const ONGOING_END_LABELS: Record<SupportedLanguage, string> = {
  en: "present",
  vi: "nay",
};

/** Label for the end of a span, or null when the event is a point. */
export const getEventEndDisplayLabel = (
  event: Event,
  locale: SupportedLanguage,
): string | null => {
  if (!isSpanEvent(event)) return null;
  if (event.ongoing) return ONGOING_END_LABELS[locale];
  return event.endTime == null
    ? null
    : formatTimelineTimeLabel(event.endTime, locale);
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
