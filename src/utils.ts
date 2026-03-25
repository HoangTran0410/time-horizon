import { Event, getEventTimelineYear } from "./types";

/** Strip trailing zeros from toFixed output, e.g. "100.0B" → "100B" */
const stripTrailingZeros = (s: string): string =>
  s.replace(/\.0+(?=\s|[A-Z]|$)/, "");

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
  1 / (365.25 * 24), // 1 hour
  1 / (365.25 * 24 * 60), // 1 minute
  1 / (365.25 * 24 * 3600), // 1 second
] as const;

const MONTH_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  year: "numeric",
};

const MONTH_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
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

const formatAbsoluteYear = (year: number): string => {
  const rounded = Math.round(year);
  if (rounded > 0) return `${rounded}`;
  if (rounded === 0) return "1 BC";
  return `${Math.abs(rounded)} BC`;
};

const parseAbsoluteYearToDate = (absoluteYear: number): Date => {
  const y = Math.floor(absoluteYear);
  const frac = absoluteYear - y;
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  return new Date(start + frac * (end - start));
};

export const formatYear = (absoluteYear: number): string => {
  const absYear = Math.abs(absoluteYear);

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
  const [year, month, day, hour, minute, seconds] = event.time;

  if (month === null) return formatYear(year);

  // JavaScript Date formatting around BC years is unreliable for locale output.
  // For BCE dates, fall back to decimal year formatting.
  if (year <= 0) return formatYear(getEventTimelineYear(event));

  const d = new Date(
    year,
    month - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    seconds ?? 0,
  );

  if (isNaN(d.getTime())) return formatYear(getEventTimelineYear(event));

  if (day === null) {
    return d.toLocaleDateString(undefined, MONTH_YEAR_FORMAT);
  }

  const hasTime = hour !== null || minute !== null || seconds !== null;
  if (!hasTime) {
    return d.toLocaleDateString(undefined, FULL_DATE_FORMAT);
  }

  return d.toLocaleString(undefined, {
    ...DATE_TIME_FORMAT,
    second: seconds !== null ? "2-digit" : undefined,
  });
};

export const getEventDisplayLabel = (event: Event): string =>
  formatEventTime(event);

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
    return d.toLocaleDateString(undefined, MONTH_YEAR_FORMAT);
  }

  if (interval >= 1 / 365.25) {
    return d.toLocaleDateString(undefined, MONTH_DAY_FORMAT);
  }

  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTimelineTick = (
  absoluteYear: number,
  interval: number,
): string => formatTick(absoluteYear, interval);
