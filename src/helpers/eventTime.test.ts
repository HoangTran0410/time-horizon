import { describe, expect, it } from "vitest";
import {
  eventTimeToTimelineYear,
  formatElapsedTimelineTime,
  formatYear,
  getAbsoluteYearFromDateJump,
  getCurrentTimelineYear,
  getEventEndDisplayLabel,
  getEventSpanLengthYears,
  getEventTimelineEndYear,
  getEventTimelineRange,
  getEventTimelineYear,
  isSpanEvent,
  normalizeEventTimeParts,
} from "../helpers";
import { BIG_BANG_YEAR } from "../constants";
import type { Event, EventTime } from "../constants/types";

// eventTimeToTimelineYear works in local time, so a DST transition can move a
// fraction by up to an hour (~1.1e-4 of a year). Every fractional assertion
// below allows for that; anything coarser is a real regression.
const DST_TOLERANCE_DIGITS = 3;

const makeEvent = (time: EventTime, overrides: Partial<Event> = {}): Event => ({
  id: "e",
  title: "t",
  description: "",
  emoji: "📌",
  priority: 50,
  time,
  ...overrides,
});

describe("normalizeEventTimeParts", () => {
  it("pads a year-only time to six slots with null", () => {
    expect(normalizeEventTimeParts([1969])).toEqual([
      1969,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("turns undefined holes into null but keeps 0 (a valid hour/minute)", () => {
    expect(
      normalizeEventTimeParts([2000, 1, 1, 0, undefined, 0] as EventTime),
    ).toEqual([2000, 1, 1, 0, null, 0]);
  });

  it("drops anything past the sixth slot", () => {
    const long = [2000, 1, 2, 3, 4, 5, 6, 7] as unknown as EventTime;
    expect(normalizeEventTimeParts(long)).toHaveLength(6);
  });

  it("returns a fresh array, never the input", () => {
    const time: EventTime = [1, 2, 3, 4, 5, 6];
    expect(normalizeEventTimeParts(time)).not.toBe(time);
  });
});

describe("eventTimeToTimelineYear", () => {
  it("returns a year-only time verbatim, including BCE and the Big Bang floor", () => {
    expect(eventTimeToTimelineYear([1969])).toBe(1969);
    expect(eventTimeToTimelineYear([-500])).toBe(-500);
    expect(eventTimeToTimelineYear([0])).toBe(0);
    expect(eventTimeToTimelineYear([BIG_BANG_YEAR])).toBe(BIG_BANG_YEAR);
  });

  it("keeps a fractional year-only value (no Date round trip)", () => {
    expect(eventTimeToTimelineYear([1969.5])).toBe(1969.5);
  });

  it("puts Jan 1 exactly on the integer year", () => {
    expect(eventTimeToTimelineYear([2024, 1, 1])).toBe(2024);
    expect(eventTimeToTimelineYear([2024, 1])).toBe(2024);
  });

  it("respects leap years: Mar 1 is day 60 of 366 in 2024 and day 59 of 365 in 2023", () => {
    expect(eventTimeToTimelineYear([2024, 3, 1])).toBeCloseTo(
      2024 + 60 / 366,
      DST_TOLERANCE_DIGITS,
    );
    expect(eventTimeToTimelineYear([2023, 3, 1])).toBeCloseTo(
      2023 + 59 / 365,
      DST_TOLERANCE_DIGITS,
    );
  });

  it("applies Gregorian century rules: 2000 is leap, 1900 is not", () => {
    const feb29In2000 = eventTimeToTimelineYear([2000, 2, 29]);
    expect(Math.floor(feb29In2000)).toBe(2000);
    expect(feb29In2000).toBeCloseTo(2000 + 59 / 366, DST_TOLERANCE_DIGITS);

    // 1900-02-29 does not exist; Date rolls it over to Mar 1.
    expect(eventTimeToTimelineYear([1900, 2, 29])).toBeCloseTo(
      eventTimeToTimelineYear([1900, 3, 1]),
      9,
    );
  });

  it("does not map two-digit years into the 1900s", () => {
    // `new Date(50, 0)` is 1950; the helper must avoid that trap.
    expect(Math.floor(eventTimeToTimelineYear([50, 6, 15]))).toBe(50);
    expect(Math.floor(eventTimeToTimelineYear([5, 1, 2]))).toBe(5);
  });

  it("handles BCE dates with a month: stays inside the right year", () => {
    const value = eventTimeToTimelineYear([-44, 3, 15]);
    expect(Math.floor(value)).toBe(-44);
    expect(value - -44).toBeGreaterThan(0.19);
    expect(value - -44).toBeLessThan(0.21);
  });

  it("is monotonic across months, days and clock time", () => {
    const samples: EventTime[] = [
      [1999, 12, 31, 23, 59, 59],
      [2000],
      [2000, 1, 1, 0, 0, 1],
      [2000, 1, 1, 12],
      [2000, 1, 2],
      [2000, 2],
      [2000, 12, 31, 23, 59, 59],
      [2001],
    ];
    const values = samples.map(eventTimeToTimelineYear);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThan(values[index - 1]);
    }
  });

  it("places noon on Jan 1 half a day into the year", () => {
    expect(eventTimeToTimelineYear([2023, 1, 1, 12])).toBeCloseTo(
      2023 + 0.5 / 365,
      6,
    );
  });

  it("falls back to the bare year when the date is outside Date's range", () => {
    // Date tops out near ±275,000 years; deep-time dates with a month must not NaN.
    expect(eventTimeToTimelineYear([-66_000_000, 6, 1])).toBe(-66_000_000);
    expect(eventTimeToTimelineYear([BIG_BANG_YEAR, 1, 1])).toBe(BIG_BANG_YEAR);
  });

  it("rolls out-of-range month/day values over instead of throwing (current behaviour)", () => {
    // Month 13 is January of the next year; day 0 is the last day of the previous month.
    expect(eventTimeToTimelineYear([2000, 13])).toBe(2001);
    expect(eventTimeToTimelineYear([2000, 3, 0])).toBeCloseTo(
      eventTimeToTimelineYear([2000, 2, 29]),
      9,
    );
  });
});

describe("getEventTimelineYear", () => {
  it("matches eventTimeToTimelineYear and is stable across calls (cached)", () => {
    const event = makeEvent([1945, 9, 2]);
    const first = getEventTimelineYear(event);
    expect(first).toBe(eventTimeToTimelineYear(event.time));
    expect(getEventTimelineYear(event)).toBe(first);
  });
});

describe("getEventTimelineEndYear / getEventTimelineRange / isSpanEvent", () => {
  it("treats an event without endTime as a point", () => {
    const event = makeEvent([1969, 7, 20]);
    expect(getEventTimelineEndYear(event)).toBeNull();
    expect(isSpanEvent(event)).toBe(false);
    const range = getEventTimelineRange(event);
    expect(range.endYear).toBe(range.startYear);
    expect(getEventSpanLengthYears(event)).toBeNull();
  });

  it("treats endTime === time as a point, not a zero-length span", () => {
    const event = makeEvent([1969], { endTime: [1969] });
    expect(getEventTimelineEndYear(event)).toBeNull();
    expect(isSpanEvent(event)).toBe(false);
  });

  it("returns the authored end year, which may precede the start", () => {
    const event = makeEvent([476], { endTime: [-27] });
    expect(getEventTimelineEndYear(event)).toBe(-27);
    expect(getEventTimelineRange(event)).toEqual({
      startYear: -27,
      endYear: 476,
    });
    expect(getEventSpanLengthYears(event)).toBe(503);
  });

  it("spans BCE to CE with a positive length", () => {
    const event = makeEvent([-27], { endTime: [476] });
    expect(isSpanEvent(event)).toBe(true);
    expect(getEventSpanLengthYears(event)).toBe(503);
  });

  it("runs an ongoing event to now and ignores a stale endTime", () => {
    const now = getCurrentTimelineYear();
    const event = makeEvent([1986], { ongoing: true, endTime: [1990] });
    expect(getEventTimelineEndYear(event)).toBe(now);
    expect(getEventTimelineRange(event)).toEqual({
      startYear: 1986,
      endYear: now,
    });
  });

  it("degrades an ongoing event that starts in the future to a point", () => {
    const event = makeEvent([Math.floor(getCurrentTimelineYear()) + 10], {
      ongoing: true,
    });
    expect(getEventTimelineEndYear(event)).toBeNull();
    expect(isSpanEvent(event)).toBe(false);
  });

  it("labels the end of an ongoing span per language and nulls a point's end", () => {
    const ongoing = makeEvent([1986], { ongoing: true });
    expect(getEventEndDisplayLabel(ongoing, "en")).toBe("present");
    expect(getEventEndDisplayLabel(ongoing, "vi")).toBe("nay");
    expect(getEventEndDisplayLabel(makeEvent([1986]), "en")).toBeNull();
  });
});

describe("getAbsoluteYearFromDateJump", () => {
  it("returns the bare year when no month is given", () => {
    expect(getAbsoluteYearFromDateJump({ year: -500, month: null, day: null }))
      .toBe(-500);
  });

  it("is UTC-based, so it lands at noon of the target day independent of local TZ", () => {
    // Day 0 noon in a 365-day year.
    expect(
      getAbsoluteYearFromDateJump({ year: 2023, month: 1, day: 1 }),
    ).toBeCloseTo(2023 + 0.5 / 365, 9);
    // Mar 1 2024 is day index 60 of 366.
    expect(
      getAbsoluteYearFromDateJump({ year: 2024, month: 3, day: 1 }),
    ).toBeCloseTo(2024 + 60.5 / 366, 9);
  });

  it("defaults a missing day to the 1st and handles two-digit years", () => {
    expect(
      Math.floor(getAbsoluteYearFromDateJump({ year: 50, month: 6, day: null })),
    ).toBe(50);
  });
});

describe("formatYear", () => {
  it("formats deep time in billions / millions with BC/AD suffixes", () => {
    expect(formatYear(-66_000_000)).toBe("66 Million BC");
    expect(formatYear(-2_000_000_000)).toBe("2 Billion BC");
    expect(formatYear(-2_250_000)).toBe("2.25 Million BC");
    expect(formatYear(1e9)).toBe("1 Billion AD");
  });

  it("formats BCE years with a BC suffix and no sign", () => {
    expect(formatYear(-500)).toBe("500 BC");
    expect(formatYear(-1)).toBe("1 BC");
    expect(formatYear(0)).toBe("0");
  });

  it("formats whole CE years plainly", () => {
    expect(formatYear(1969)).toBe("1969");
    expect(formatYear(1)).toBe("1");
  });
});

describe("formatElapsedTimelineTime", () => {
  it("uses billions / millions for deep spans", () => {
    expect(formatElapsedTimelineTime(13.8e9, "en")).toBe("14 billion years");
    expect(formatElapsedTimelineTime(1.5e9, "en")).toBe("1.5 billion years");
    expect(formatElapsedTimelineTime(66e6, "en")).toBe("66 million years");
  });

  it("is sign-agnostic", () => {
    expect(formatElapsedTimelineTime(-503, "en")).toBe(
      formatElapsedTimelineTime(503, "en"),
    );
  });

  it("singularizes a unit of one and composes years + months", () => {
    expect(formatElapsedTimelineTime(1, "en")).toBe("1 year");
    expect(formatElapsedTimelineTime(1.5, "en")).toBe("1 year 6 months");
  });

  it("drops to hours/minutes/seconds for sub-day spans", () => {
    const hourInYears = 1 / 365.25 / 24;
    expect(formatElapsedTimelineTime(2 * hourInYears, "en")).toBe("2 hours");
    expect(formatElapsedTimelineTime((5 * hourInYears) / 60, "en")).toBe(
      "5 minutes",
    );
    expect(formatElapsedTimelineTime(0, "en")).toBe("under 1 second");
  });

  it("localizes to Vietnamese", () => {
    expect(formatElapsedTimelineTime(2, "vi")).toBe("2 năm");
    expect(formatElapsedTimelineTime(0, "vi")).toBe("dưới 1 giây");
  });
});
