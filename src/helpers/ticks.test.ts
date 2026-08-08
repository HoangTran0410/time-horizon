import { describe, expect, it } from "vitest";
import {
  DAY_IN_YEARS,
  HOUR_IN_YEARS,
  MINUTE_IN_YEARS,
  SECOND_IN_YEARS,
  formatTick,
  generateSubDayTimelineTickYears,
  getNiceInterval,
  getStableTickLabelWidthEstimate,
} from "./index";
import { MAX_ZOOM, getMaxZoomForYear } from "../constants/index";

/** Fractional-year of a local Date, matching the timeline's own convention. */
const yearOfMs = (ms: number): number => {
  const d = new Date(ms);
  const y = d.getFullYear();
  const s = new Date(y, 0, 1).getTime();
  const e = new Date(y + 1, 0, 1).getTime();
  return y + (d.getTime() - s) / (e - s);
};

describe("sub-day tick ladder", () => {
  it.each([
    ["12h", 12 * HOUR_IN_YEARS],
    ["1h", HOUR_IN_YEARS],
    ["15m", 15 * MINUTE_IN_YEARS],
    ["1m", MINUTE_IN_YEARS],
    ["5s", 5 * SECOND_IN_YEARS],
    ["1s", SECOND_IN_YEARS],
  ])("getNiceInterval lands exactly on the %s rung", (_name, value) => {
    expect(Math.abs(getNiceInterval(value) / value - 1)).toBeLessThan(1e-9);
  });
});

describe("tick labels below one day", () => {
  it.each([
    ["hour", HOUR_IN_YEARS, /^\d{2}:00$/],
    ["minute", MINUTE_IN_YEARS, /^\d{2}:\d{2}$/],
    ["second", SECOND_IN_YEARS, /^\d{2}:\d{2}:\d{2}$/],
  ])("%s labels are clock-only", (_name, interval, pattern) => {
    expect(formatTick(2024.5, interval, "vi")).toMatch(pattern);
  });

  it("day labels still carry the date", () => {
    expect(formatTick(2024 + 11.5 / 12, DAY_IN_YEARS, "vi")).toMatch(
      /\d+\/\d+\/\d{4}/,
    );
  });

  it("width estimate covers the widest day label", () => {
    const wDay = getStableTickLabelWidthEstimate(DAY_IN_YEARS);
    const widest = formatTick(2024 + 11.9 / 12, DAY_IN_YEARS, "vi");
    expect(wDay).toBeGreaterThanOrEqual(widest.length * 8 + 40);
  });

  it("clock labels are estimated narrower than day labels", () => {
    expect(
      getStableTickLabelWidthEstimate(HOUR_IN_YEARS),
    ).toBeLessThan(getStableTickLabelWidthEstimate(DAY_IN_YEARS));
  });
});

describe("generateSubDayTimelineTickYears", () => {
  it("hourly ticks land exactly on :00 and label as HH:00", () => {
    const t0 = new Date(2024, 5, 10, 0, 0, 0).getTime();
    const ticks = generateSubDayTimelineTickYears(
      yearOfMs(t0 + 3.3 * 3600_000),
      yearOfMs(t0 + 9 * 3600_000),
      HOUR_IN_YEARS,
    );
    expect(ticks).not.toBeNull();
    expect(ticks!.length).toBeGreaterThan(0);
    for (const y of ticks!) {
      const yy = Math.floor(y);
      const s = new Date(yy, 0, 1).getTime();
      const e = new Date(yy + 1, 0, 1).getTime();
      // Round, same as parseAbsoluteYearToDate — truncating here would
      // reproduce the very off-by-1ms this test is checking is gone.
      const minutes = new Date(Math.round(s + (y - yy) * (e - s))).getMinutes();
      expect(minutes).toBe(0);
      expect(formatTick(y, HOUR_IN_YEARS, "vi")).toMatch(/^\d{2}:00$/);
    }
  });

  it("declines day-or-coarser intervals", () => {
    expect(generateSubDayTimelineTickYears(2024, 2024.1, DAY_IN_YEARS)).toBeNull();
  });

  it("declines BCE ranges", () => {
    expect(generateSubDayTimelineTickYears(-100, -99.9, HOUR_IN_YEARS)).toBeNull();
  });
});

describe("float-precision zoom ceiling", () => {
  it("seconds are reachable at modern dates", () => {
    expect(getMaxZoomForYear(2026)).toBe(MAX_ZOOM);
  });

  it("ceiling falls as |year| grows", () => {
    const ceilNow = getMaxZoomForYear(2026);
    const ceilMillion = getMaxZoomForYear(1e6);
    const ceilBigBang = getMaxZoomForYear(-13.8e9);
    expect(ceilBigBang).toBeLessThan(ceilMillion);
    expect(ceilMillion).toBeLessThan(ceilNow);
  });

  it.each([[2026], [1e5], [1e6], [1e9], [-13.8e9]])(
    "one float step stays sub-pixel at year %d",
    (year) => {
      const jitterPx = Math.abs(year) * Number.EPSILON * getMaxZoomForYear(year);
      expect(jitterPx).toBeLessThanOrEqual(0.26);
    },
  );
});
