import { UNIVERSE_AGE_YEARS, YEAR_ZERO_FROM_BANG } from "../constants";

// Format functions - pure functions, no component state dependency
export const formatYearLabel = (year: number, visibleRange: number): string => {
  const abs = Math.abs(year);
  if (visibleRange < 200) return Math.floor(abs).toLocaleString();
  if (abs >= 1_000_000_000) return `${(year / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(year / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(year / 1_000).toFixed(1)}k`;
  return Math.floor(year).toString();
};

export const formatJesusYear = (years: number) => {
  if (years === 0) return "Big Bang";
  if (years === UNIVERSE_AGE_YEARS) return "Present Day";

  const jesusYear = years - YEAR_ZERO_FROM_BANG;
  const suffix = jesusYear < 0 ? " BC" : "";

  return `${formatYearLabel(Math.abs(jesusYear), 1)}${suffix}`;
};

export const dateToYearsFromBang = (dateString: string): number | null => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(year, 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const fractionalYear = year + dayOfYear / 365.25;
  return YEAR_ZERO_FROM_BANG + fractionalYear;
};

// Pre-defined constants to avoid recreating in render loops
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Cache for weekday calculations to avoid repeated Date object creation
const weekdayCache = new Map<string, number>();

const getWeekday = (
  year: number,
  monthIndex: number,
  dayOfMonth: number
): number => {
  const key = `${year}-${monthIndex}-${dayOfMonth}`;
  const cached = weekdayCache.get(key);
  if (cached !== undefined) return cached;

  const date = new Date(year, monthIndex, dayOfMonth);
  const weekday = date.getDay();

  // Limit cache size to prevent memory issues
  if (weekdayCache.size > 1000) weekdayCache.clear();
  weekdayCache.set(key, weekday);
  return weekday;
};

export const formatGranularTimeLines = (
  totalYears: number,
  zoom: number,
  width: number
): string[] => {
  const visibleRange = width / zoom;
  const jesusYear = totalYears - YEAR_ZERO_FROM_BANG;
  const lines: string[] = [];

  if (totalYears < YEAR_ZERO_FROM_BANG * 0.9999) {
    if (totalYears === 0) return ["Big Bang"];
    lines.push(`${formatYearLabel(totalYears, visibleRange)} PB`);
    return lines;
  }

  const absYear = Math.abs(jesusYear);
  const suffix = jesusYear < 0 ? " BC" : jesusYear === 0 ? "" : "";
  const displayYear =
    jesusYear === 0
      ? "Year 0"
      : `${formatYearLabel(absYear, visibleRange)}${suffix}`;
  lines.push(displayYear);

  if (visibleRange < 5) {
    lines.push(MONTHS[Math.floor((absYear * 12) % 12)]);
  }
  if (visibleRange < 0.2) {
    // Only calculate weekday for years after Year 0 (jesusYear > 0)
    if (jesusYear > 0) {
      const year = Math.floor(jesusYear);
      const fractionalYear = jesusYear - year;
      const dayOfYear = Math.floor(fractionalYear * 365.25);
      const dayOfMonth = (dayOfYear % 30) + 1;
      const monthIndex = Math.floor(dayOfYear / 30.44);
      const weekday = getWeekday(year, monthIndex, dayOfMonth);
      lines.push(`${WEEKDAYS[weekday]} ${dayOfMonth}`);
    } else {
      // For BC years, just show day number without weekday
      const dayOfMonth = (Math.floor(absYear * 365.25) % 30) + 1;
      lines.push(`Day ${dayOfMonth}`);
    }
  }
  //   else if (visibleRange < 0.2) {
  //     lines.push(`Day ${Math.floor((absYear * 365.25) % 30.44) + 1}`);
  //   }
  if (visibleRange < 0.005) {
    const hours = absYear * 365.25 * 24;
    lines.push(
      `${Math.floor(hours % 24)
        .toString()
        .padStart(2, "0")}:${Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, "0")}`
    );
  }

  return lines;
};
