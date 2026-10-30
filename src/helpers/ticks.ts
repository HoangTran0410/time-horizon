/** Timeline ruler: tick interval ladder, label fit, tick generation and highlighting. */

import { BIG_BANG_YEAR } from "../constants";
import type { SupportedLanguage } from "../constants/types";
import {
  makeLocalDate,
  DAY_IN_YEARS,
  HOUR_IN_YEARS,
  MINUTE_IN_YEARS,
  SECOND_IN_YEARS,
  DAY_IN_MS,
  isYearZero,
  parseAbsoluteYearToDate,
  dateToAbsoluteYear,
} from "./time";
import {
  LOCALE_MAP,
  stripTrailingZeros,
  MONTH_YEAR_NUMERIC_FORMAT,
  DAY_MONTH_YEAR_NUMERIC_FORMAT,
  formatDateWithOptions,
  pad2,
  formatAbsoluteYear,
} from "./timeFormat";

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
    return formatDateWithOptions(d, localeStr, MONTH_YEAR_NUMERIC_FORMAT);
  }

  if (interval >= DAY_IN_YEARS) {
    return formatDateWithOptions(d, localeStr, DAY_MONTH_YEAR_NUMERIC_FORMAT);
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
