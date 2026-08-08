import { describe, expect, it } from "vitest";
import { formatTick, generateCalendarTimelineTickYears } from "./index";

/** Month (1-12) of each tick, converted the same way the renderer does. */
const monthsOf = (ticks: number[]): number[] =>
  ticks.map((y) => {
    const yy = Math.floor(y);
    const s = new Date(yy, 0, 1).getTime();
    const e = new Date(yy + 1, 0, 1).getTime();
    return new Date(Math.round(s + (y - yy) * (e - s))).getMonth() + 1;
  });

describe("generateCalendarTimelineTickYears", () => {
  it.each([
    ["1 month", 1 / 12, 1],
    ["2 months", 1 / 6, 2],
    ["3 months", 1 / 4, 3],
    ["6 months", 1 / 2, 6],
  ])("%s rung steps by its own interval, aligned to January", (_name, interval, expectStep) => {
    const ticks = generateCalendarTimelineTickYears(1942, 1946, interval);
    expect(ticks).not.toBeNull();
    expect(ticks!.length).toBeGreaterThan(1);

    const months = monthsOf(ticks!);
    const steps = months.slice(1).map((m, i) => ((m - months[i] + 12) % 12) || 12);
    expect(steps.every((step) => step === expectStep)).toBe(true);
    expect(months.every((m) => (m - 1) % expectStep === 0)).toBe(true);
    expect(formatTick(ticks![0], interval, "vi")).toMatch(/^\d+\/\d{4}$/);
  });

  it("years 1-99 are not shifted into the 1900s", () => {
    const ticks = generateCalendarTimelineTickYears(50, 52, 1 / 2);
    expect(ticks).not.toBeNull();
    expect(Math.floor(ticks![0])).toBeLessThan(100);
  });
});
