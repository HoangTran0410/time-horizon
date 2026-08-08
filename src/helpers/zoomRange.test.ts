import { describe, expect, it } from "vitest";
import { formatZoomRangeLabel, getZoomRangeParts } from "./index";

/** Zoom that makes a 1000px viewport span exactly `years`. */
const logZoomForSpan = (years: number) => Math.log(1000 / years);

const partsForSpan = (years: number) =>
  getZoomRangeParts(logZoomForSpan(years), 1000);

const YEAR_IN_DAYS = 365.25;

describe("getZoomRangeParts", () => {
  it("picks the largest unit the span fills", () => {
    expect(partsForSpan(13.8e9)).toEqual({ value: 14, unit: "billionYears" });
    expect(partsForSpan(541e6)).toEqual({ value: 541, unit: "millionYears" });
    expect(partsForSpan(20_000)).toEqual({ value: 20, unit: "thousandYears" });
    expect(partsForSpan(120)).toEqual({ value: 120, unit: "years" });
    expect(partsForSpan(0.5)).toEqual({ value: 6, unit: "months" });
    expect(partsForSpan(10 / YEAR_IN_DAYS)).toEqual({
      value: 10,
      unit: "days",
    });
    expect(partsForSpan(6 / (YEAR_IN_DAYS * 24))).toEqual({
      value: 6,
      unit: "hours",
    });
    expect(partsForSpan(30 / (YEAR_IN_DAYS * 24 * 60))).toEqual({
      value: 30,
      unit: "minutes",
    });
  });

  it("switches unit exactly at each boundary", () => {
    // Spans set directly rather than via a zoom round trip, which lands a
    // fraction below the boundary and would test floating point, not buckets.
    const at = (span: number) => getZoomRangeParts(0, span).unit;

    expect(at(1e9)).toBe("billionYears");
    expect(at(1e9 - 1)).toBe("millionYears");
    expect(at(1000)).toBe("thousandYears");
    expect(at(999)).toBe("years");
    expect(at(1)).toBe("years");
    expect(at(0.99)).toBe("months");
  });

  it("never reports zero seconds at the deepest zoom", () => {
    const parts = getZoomRangeParts(Math.log(1e12), 1000);
    expect(parts.unit).toBe("seconds");
    expect(parts.value).toBeGreaterThanOrEqual(1);
  });
});

describe("formatZoomRangeLabel", () => {
  it("keeps the compact in-app strings", () => {
    expect(formatZoomRangeLabel(logZoomForSpan(13.8e9), 1000)).toBe("14B Yrs");
    expect(formatZoomRangeLabel(logZoomForSpan(541e6), 1000)).toBe("541M Yrs");
    expect(formatZoomRangeLabel(logZoomForSpan(20_000), 1000)).toBe("20K Yrs");
    // Unscaled units keep the space the scaled ones drop.
    expect(formatZoomRangeLabel(logZoomForSpan(120), 1000)).toBe("120 Yrs");
    expect(formatZoomRangeLabel(logZoomForSpan(0.5), 1000)).toBe("6 Mos");
  });
});
