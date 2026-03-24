/** Strip trailing zeros from toFixed output, e.g. "100.0B" → "100B" */
const stripTrailingZeros = (s: string): string => s.replace(/\.0+(?=\s|[A-Z]|$)/, "");

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

const MS_PER_YEAR = 31557600000;

const formatAbsoluteYear = (year: number) => {
  const rounded = Math.round(year);
  if (rounded > 0) return `${rounded}`;
  if (rounded === 0) return `1 BC`;
  return `${Math.abs(rounded)} BC`;
};

export const formatYear = (absoluteYear: number): string => {
  if (absoluteYear <= -1e9)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e9).toFixed(2))} Billion ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (absoluteYear <= -1e6)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e6).toFixed(2))} Million ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (absoluteYear <= -10000)
    return `${Math.abs(Math.round(absoluteYear)).toLocaleString()} ${absoluteYear <= 0 ? "BC" : "AD"}`;

  if (absoluteYear <= 0) {
    return formatAbsoluteYear(absoluteYear);
  }

  try {
    const d = new Date(absoluteYear, 0, 1);
    if (isNaN(d.getTime())) return formatAbsoluteYear(absoluteYear);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return formatAbsoluteYear(absoluteYear);
  }
};

export const formatTick = (absoluteYear: number, interval: number): string => {

  if (interval >= 1e9)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e9).toFixed(1))}B ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (interval >= 1e6)
    return `${stripTrailingZeros(Math.abs(absoluteYear / 1e6).toFixed(1))}M ${absoluteYear <= 0 ? "BC" : "AD"}`;
  if (interval >= 1000) return formatAbsoluteYear(absoluteYear);
  if (interval >= 1 || absoluteYear <= 0)
    return formatAbsoluteYear(absoluteYear);

  try {
    // For sub-yearly ticks, use Jan 1 of the absolute year as the date anchor.
    // Sub-hourly tick labels (hour/minute) don't apply to year-scale events.
    const d = new Date(Math.round(absoluteYear), 0, 1);
    if (isNaN(d.getTime())) return formatAbsoluteYear(absoluteYear);

    if (interval >= 1 / 12)
      return d.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    if (interval >= 1 / 365.25)
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    return formatAbsoluteYear(absoluteYear);
  }
};
