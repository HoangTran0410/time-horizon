import { describe, it, expect } from "vitest";
import { MAX_ZOOM, MIN_ZOOM } from "../../constants";
import {
  isLandingLogZoomInBounds,
  resolveLandingCamera,
  type LandingCameraWaypoint,
} from "./landingCamera";

const waypoints: LandingCameraWaypoint[] = [
  { year: -13.8e9, logZoom: -18 },
  { year: -4.54e9, logZoom: -15 },
  { year: 1969, logZoom: -2 },
];

describe("resolveLandingCamera", () => {
  it("returns the first waypoint at progress 0", () => {
    expect(resolveLandingCamera(waypoints, 0)).toEqual({
      focusYear: -13.8e9,
      logZoom: -18,
    });
  });

  it("returns the last waypoint at progress 1", () => {
    expect(resolveLandingCamera(waypoints, 1)).toEqual({
      focusYear: 1969,
      logZoom: -2,
    });
  });

  it("lands exactly on interior waypoints at their segment boundaries", () => {
    // Two segments, so the middle waypoint sits at progress 0.5.
    const mid = resolveLandingCamera(waypoints, 0.5);
    expect(mid.focusYear).toBeCloseTo(-4.54e9, 0);
    expect(mid.logZoom).toBeCloseTo(-15, 10);
  });

  it("clamps progress below 0 and above 1", () => {
    expect(resolveLandingCamera(waypoints, -3)).toEqual(
      resolveLandingCamera(waypoints, 0),
    );
    expect(resolveLandingCamera(waypoints, 4)).toEqual(
      resolveLandingCamera(waypoints, 1),
    );
  });

  it("interpolates logZoom linearly within a segment", () => {
    // Quarter of the way overall is halfway through the first segment.
    const quarter = resolveLandingCamera(waypoints, 0.25);
    expect(quarter.logZoom).toBeCloseTo(-16.5, 10);
  });

  it("degenerates to linear year interpolation when zoom is constant", () => {
    const flat: LandingCameraWaypoint[] = [
      { year: 0, logZoom: -5 },
      { year: 1000, logZoom: -5 },
    ];
    expect(resolveLandingCamera(flat, 0.5).focusYear).toBeCloseTo(500, 6);
    expect(resolveLandingCamera(flat, 0.25).focusYear).toBeCloseTo(250, 6);
  });

  it("front-loads the pan when zooming in", () => {
    // k = +5 over one segment: most of the distance is covered early, while
    // the view is still wide and the pan is visually cheap.
    const zoomIn: LandingCameraWaypoint[] = [
      { year: 0, logZoom: -5 },
      { year: 1000, logZoom: 0 },
    ];
    expect(resolveLandingCamera(zoomIn, 0.5).focusYear).toBeGreaterThan(900);
  });

  it("keeps focusYear monotonically increasing across a full sweep", () => {
    let previous = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const { focusYear } = resolveLandingCamera(waypoints, i / 200);
      expect(focusYear).toBeGreaterThanOrEqual(previous);
      previous = focusYear;
    }
  });

  it("keeps on-screen travel speed roughly constant through a deep zoom", () => {
    const deep: LandingCameraWaypoint[] = [
      { year: 0, logZoom: -10 },
      { year: 1e6, logZoom: 0 },
    ];
    const step = 0.02;
    const pixelDeltas: number[] = [];
    for (let t = 0; t < 1; t += step) {
      const a = resolveLandingCamera(deep, t);
      const b = resolveLandingCamera(deep, t + step);
      const midZoom = Math.exp((a.logZoom + b.logZoom) / 2);
      pixelDeltas.push(Math.abs(b.focusYear - a.focusYear) * midZoom);
    }
    const min = Math.min(...pixelDeltas);
    const max = Math.max(...pixelDeltas);
    // Linear-in-year interpolation would blow this ratio past 1000x.
    expect(max / min).toBeLessThan(3);
  });

  it("handles a single-waypoint list without dividing by zero", () => {
    const single: LandingCameraWaypoint[] = [{ year: 42, logZoom: -7 }];
    expect(resolveLandingCamera(single, 0.5)).toEqual({
      focusYear: 42,
      logZoom: -7,
    });
  });

  it("handles an empty list by returning a Big Bang default", () => {
    expect(resolveLandingCamera([], 0.5)).toEqual({
      focusYear: -13.8e9,
      logZoom: Math.log(MIN_ZOOM),
    });
  });
});

describe("isLandingLogZoomInBounds", () => {
  it("accepts values inside the engine's zoom range", () => {
    expect(isLandingLogZoomInBounds(Math.log(MIN_ZOOM))).toBe(true);
    expect(isLandingLogZoomInBounds(Math.log(MAX_ZOOM))).toBe(true);
    expect(isLandingLogZoomInBounds(-5)).toBe(true);
  });

  it("rejects values outside it", () => {
    expect(isLandingLogZoomInBounds(Math.log(MIN_ZOOM) - 0.5)).toBe(false);
    expect(isLandingLogZoomInBounds(Math.log(MAX_ZOOM) + 0.5)).toBe(false);
  });

  it("rejects non-finite values", () => {
    expect(isLandingLogZoomInBounds(Number.NaN)).toBe(false);
    expect(isLandingLogZoomInBounds(Infinity)).toBe(false);
  });
});
