import { Event, getEventTimelineYear } from "./types";

/** Strip trailing zeros from toFixed output, e.g. "100.0B" → "100B" */
const stripTrailingZeros = (s: string): string =>
  s.replace(/\.0+(?=\s|[A-Z]|$)/, "");

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
  if (absoluteYear <= -1e9)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e9).toFixed(2))} Billion ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (absoluteYear <= -1e6)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e6).toFixed(2))} Million ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (absoluteYear <= -10000)
    return `${Math.abs(Math.round(absoluteYear)).toLocaleString()} ${absoluteYear <= 0 ? "BC" : "AD"}`;

  if (absoluteYear <= 0) return formatAbsoluteYear(absoluteYear);

  if (Math.abs(absoluteYear - Math.round(absoluteYear)) < 1e-9) {
    return `${Math.round(absoluteYear)}`;
  }

  const d = parseAbsoluteYearToDate(absoluteYear);
  if (isNaN(d.getTime()))
    return `${stripTrailingZeros(absoluteYear.toFixed(6))}`;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  const hasTime = hour !== null || minute !== null || seconds !== null;
  if (!hasTime) {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: seconds !== null ? "2-digit" : undefined,
  });
};

export const getEventDisplayLabel = (event: Event): string =>
  formatEventTime(event);

export const getNiceInterval = (ideal: number): number => {
  const intervals = [
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
  ];

  let best = intervals[0];
  let minDiff = Math.abs(Math.log10(ideal) - Math.log10(best));

  for (const interval of intervals) {
    const diff = Math.abs(Math.log10(ideal) - Math.log10(interval));
    if (diff < minDiff) {
      minDiff = diff;
      best = interval;
    }
  }
  return best;
};

export const formatTick = (absoluteYear: number, interval: number): string => {
  if (interval >= 1e9)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e9).toFixed(1))}B ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (interval >= 1e6)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e6).toFixed(1))}M ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (interval >= 1000) return formatAbsoluteYear(absoluteYear);
  if (interval >= 1 || absoluteYear <= 0)
    return formatAbsoluteYear(absoluteYear);

  const d = parseAbsoluteYearToDate(absoluteYear);
  if (isNaN(d.getTime())) return formatAbsoluteYear(absoluteYear);

  if (interval >= 1 / 12)
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  if (interval >= 1 / 365.25)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTimelineTick = (
  absoluteYear: number,
  interval: number,
): string => formatTick(absoluteYear, interval);
