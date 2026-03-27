import { Event, getEventTimelineYear } from "./types";

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

  const [year, month, day, hour, minute, seconds] = event.time;

  let label: string;

  if (month === null) {
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
    } else if (day === null) {
      label = d.toLocaleDateString(undefined, MONTH_YEAR_FORMAT);
    } else {
      const hasTime = hour !== null || minute !== null || seconds !== null;
      if (!hasTime) {
        label = d.toLocaleDateString(undefined, FULL_DATE_FORMAT);
      } else {
        label = d.toLocaleString(undefined, {
          ...DATE_TIME_FORMAT,
          second: seconds !== null ? "2-digit" : undefined,
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
      day === 1 &&
      normalized.getHours() === 0 &&
      normalized.getMinutes() === 0
    );
  }

  if (!isNearlyInteger(absoluteYear)) return false;

  const roundedYear = Math.round(absoluteYear);
  if (roundedYear === 0) return true;
  return roundedYear % highlightStep === 0;
};
