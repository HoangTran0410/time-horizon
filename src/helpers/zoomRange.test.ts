import { describe, expect, it } from "vitest";
import { formatZoomRangeLabel } from "./index";

/** Zoom that makes a 1000px viewport span exactly `years`. */
const logZoomForSpan = (years: number) => Math.log(1000 / years);

const labelForSpan = (years: number) =>
  formatZoomRangeLabel(logZoomForSpan(years), 1000);

const YEAR_IN_DAYS = 365.25;

describe("formatZoomRangeLabel", () => {
  it("picks the largest unit the span fills", () => {
    expect(labelForSpan(13.8e9)).toBe("14B Yrs");
    expect(labelForSpan(541e6)).toBe("541M Yrs");
    expect(labelForSpan(20_000)).toBe("20K Yrs");
    expect(labelForSpan(120)).toBe("120 Yrs");
    expect(labelForSpan(0.5)).toBe("6 Mos");
    expect(labelForSpan(10 / YEAR_IN_DAYS)).toBe("10 Days");
    expect(labelForSpan(6 / (YEAR_IN_DAYS * 24))).toBe("6 Hrs");
    expect(labelForSpan(30 / (YEAR_IN_DAYS * 24 * 60))).toBe("30 Min");
  });

  it("switches unit exactly at each boundary", () => {
    // Spans set directly rather than via a zoom round trip, which lands a
    // fraction below the boundary and would test floating point, not buckets.
    const unit = (span: number) =>
      formatZoomRangeLabel(0, span).replace(/^[\d.]+/, "");

    expect(unit(1e9)).toBe("B Yrs");
    expect(unit(1e9 - 1)).toBe("M Yrs");
    expect(unit(1000)).toBe("K Yrs");
    expect(unit(999)).toBe(" Yrs");
    expect(unit(1)).toBe(" Yrs");
    expect(unit(0.99)).toBe(" Mos");
  });

  it("never reports zero seconds at the deepest zoom", () => {
    expect(formatZoomRangeLabel(Math.log(1e12), 1000)).toBe("1 Sec");
  });
});
