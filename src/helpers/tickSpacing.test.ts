import { describe, expect, it } from "vitest";
import {
  getStableTickLabelWidthEstimate,
  getTickIntervalThatFitsLabels,
} from "./index";
import { MAX_ZOOM, MIN_ZOOM } from "../constants/index";

/**
 * Exhaustive sweep of zoom level x viewport width x era. This is the test that
 * exposed the original tick-collision bug (3523/8264 zoom levels overlapped
 * under the old nearest-nice-value selection) — spot checks at a handful of
 * zooms missed it entirely, so keep it a sweep.
 */
describe("tick interval fit", () => {
  it("no zoom level spaces ticks tighter than its own labels", () => {
    const collisions: string[] = [];
    let worstRatio = Infinity;

    for (const primarySize of [390, 768, 1440, 2560]) {
      for (const refYear of [-13.8e9, -1e6, -753, 1942, 2026, 1e6]) {
        for (
          let logZoom = Math.log(MIN_ZOOM);
          logZoom <= Math.log(MAX_ZOOM);
          logZoom += 0.02
        ) {
          const visibleYears = primarySize / Math.exp(logZoom);
          const interval = getTickIntervalThatFitsLabels(
            visibleYears,
            primarySize,
            refYear,
          );
          const spacingPx = interval * Math.exp(logZoom);
          const neededPx = getStableTickLabelWidthEstimate(interval, refYear);
          worstRatio = Math.min(worstRatio, spacingPx / neededPx);
          if (spacingPx < neededPx) {
            collisions.push(
              `size=${primarySize} refYear=${refYear} visible=${visibleYears.toExponential(2)}yr ` +
                `spacing=${spacingPx.toFixed(0)}px needs=${neededPx}px`,
            );
          }
        }
      }
    }

    expect(collisions.slice(0, 4)).toEqual([]);
    expect(worstRatio).toBeGreaterThanOrEqual(1);
  });
});

const TICK_FIT_ADOPT_SLACK = 1.25;

/** Replays the Schmitt trigger exactly as updateTicks applies it. */
const applyHysteresis = (
  previous: number | null,
  visibleYears: number,
  primarySize: number,
  refYear: number,
): number => {
  const zoom = primarySize / visibleYears;
  const fits = (interval: number, slack: number) =>
    interval * zoom >= getStableTickLabelWidthEstimate(interval, refYear) * slack;
  let interval = getTickIntervalThatFitsLabels(visibleYears, primarySize, refYear);
  if (
    previous !== null &&
    previous !== interval &&
    fits(previous, 1) &&
    !fits(interval, TICK_FIT_ADOPT_SLACK)
  ) {
    interval = previous;
  }
  return interval;
};

describe("tick interval hysteresis", () => {
  it("the kept interval never collides and never flips coarser mid zoom-in", () => {
    let collisions = 0;
    let flips = 0;

    for (const primarySize of [390, 1440]) {
      for (const refYear of [-13.8e9, 1942, 2026]) {
        let previous: number | null = null;
        for (
          let logZoom = Math.log(MIN_ZOOM);
          logZoom <= Math.log(MAX_ZOOM);
          logZoom += 0.005
        ) {
          const visibleYears = primarySize / Math.exp(logZoom);
          const interval = applyHysteresis(previous, visibleYears, primarySize, refYear);
          const spacing = interval * Math.exp(logZoom);
          if (spacing < getStableTickLabelWidthEstimate(interval, refYear)) {
            collisions += 1;
          }
          // Zooming in monotonically, the rung must only ever get finer.
          if (previous !== null && interval > previous) flips += 1;
          previous = interval;
        }
      }
    }

    expect(collisions).toBe(0);
    expect(flips).toBe(0);
  });
});
