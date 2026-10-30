/**
 * EventTime <-> fractional-year conversion and the per-event caches behind it.
 * Negative years are BCE; every year<->Date conversion goes through
 * makeLocalDate so years 0-99 are not read as 1900-1999.
 */

import type { DateJumpTarget, Event, EventTime } from "../constants/types";

export const normalizeEventTimeParts = (time: EventTime): Required<EventTime> =>
  [
    time[0],
    time[1] ?? null,
    time[2] ?? null,
    time[3] ?? null,
    time[4] ?? null,
    time[5] ?? null,
  ] as Required<EventTime>;

/**
 * `new Date(y, ...)` treats 0-99 as 1900+y, so year 50 silently became 1950.
 * Every year<->Date conversion here goes through this instead.
 */
export const makeLocalDate = (
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

// Computed once per session: an ongoing span's end only needs day precision,
// and a stable value keeps the WeakMap caches below coherent.
let _nowTimelineYear: number | null = null;

/** Fractional year for "today", the end an ongoing event runs to. */
export const getCurrentTimelineYear = (): number => {
  if (_nowTimelineYear === null) {
    const now = new Date();
    _nowTimelineYear = eventTimeToTimelineYear([
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    ]);
  }
  return _nowTimelineYear;
};

/**
 * Fractional end year for a span event, or null for a point event.
 * Always >= the start year: a reversed pair is treated as a span, not an error,
 * since imported data routinely gets the two columns the wrong way round.
 */
export const getEventTimelineEndYear = (event: Event): number | null => {
  const cached = _timelineEndYearCache.get(event);
  if (cached !== undefined) return cached;

  if (event.ongoing) {
    // Runs to "now"; a start in the future degrades to a point.
    const nowYear = getCurrentTimelineYear();
    const result = nowYear > getEventTimelineYear(event) ? nowYear : null;
    _timelineEndYearCache.set(event, result);
    return result;
  }

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

export const DAY_IN_YEARS = 1 / 365.25;
export const HOUR_IN_YEARS = DAY_IN_YEARS / 24;
export const MINUTE_IN_YEARS = HOUR_IN_YEARS / 60;
export const SECOND_IN_YEARS = MINUTE_IN_YEARS / 60;
export const DAY_IN_MS = 24 * 60 * 60 * 1000;

const YEAR_ZERO_TOLERANCE = 1e-9;

export const isYearZero = (year: number): boolean =>
  Math.abs(year) < YEAR_ZERO_TOLERANCE;

export const parseAbsoluteYearToDate = (absoluteYear: number): Date => {
  const y = Math.floor(absoluteYear);
  const frac = absoluteYear - y;
  const start = makeLocalDate(y).getTime();
  const end = makeLocalDate(y + 1).getTime();
  // Rounded, not truncated: the year<->ms round trip lands a fraction of a
  // millisecond short, and `new Date` truncating that turned a tick sitting
  // exactly on 14:00 into a label reading 13:59.
  return new Date(Math.round(start + frac * (end - start)));
};

export const dateToAbsoluteYear = (date: Date): number => {
  const year = date.getFullYear();
  const start = makeLocalDate(year).getTime();
  const end = makeLocalDate(year + 1).getTime();
  return year + (date.getTime() - start) / (end - start);
};

/** How long a span lasts, in fractional years, or null for a point event. */
export const getEventSpanLengthYears = (event: Event): number | null => {
  const { startYear, endYear } = getEventTimelineRange(event);
  return endYear > startYear ? endYear - startYear : null;
};

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
