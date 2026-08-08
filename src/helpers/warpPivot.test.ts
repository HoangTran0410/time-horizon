import { describe, expect, it } from "vitest";
import { resolveZoomFixedPointPixel, type TimelineCameraSample } from "./index";
import {
  resolveLandingCamera,
  type LandingCameraWaypoint,
} from "../components/landing/landingCamera";

const AXIS_PX = 1440;
const CENTRE = AXIS_PX / 2;

/** The camera as the engine holds it, reduced to the map years → pixels. */
const sampleCamera = (
  focusPixel: number,
  focusYear: number,
  logZoom: number,
  axisDirection: 1 | -1 = 1,
): TimelineCameraSample => {
  const zoom = Math.exp(logZoom);
  return { panPixel: focusPixel - focusYear * zoom * axisDirection, zoom };
};

const yearAtPixel = (
  camera: TimelineCameraSample,
  pixel: number,
  axisDirection: 1 | -1 = 1,
) => (pixel - camera.panPixel) / (camera.zoom * axisDirection);

describe("resolveZoomFixedPointPixel", () => {
  it("returns the anchor pixel when the camera zooms about one year", () => {
    // What a wheel gesture does: focusPixel/focusYear pinned to the pointer,
    // only logZoom moves.
    const previous = sampleCamera(900, 1000, -2);
    const next = sampleCamera(900, 1000, -1.9);

    expect(resolveZoomFixedPointPixel(previous, next, 1)).toBeCloseTo(900, 9);
  });

  it("ignores a re-anchor that does not move the image", () => {
    // The wheel handler rewrites focusPixel and focusYear on every event, which
    // leaves the picture untouched. Only the zoom that follows may move it.
    const previous = sampleCamera(900, 1000, -2);
    const zoom = Math.exp(-2);
    const reanchoredYear = 1000 + 120 / zoom;
    const next = sampleCamera(1020, reanchoredYear, -1.9);

    expect(resolveZoomFixedPointPixel(previous, next, 1)).toBeCloseTo(1020, 6);
  });

  it("finds the off-centre point a pan-while-zooming expands from", () => {
    // Camera scaled about year 2060 sitting at pixel 729, nowhere near centre.
    const previous = sampleCamera(729, 2060, -3);
    const next = sampleCamera(729, 2060, -2.5);

    expect(resolveZoomFixedPointPixel(previous, next, 1)).toBeCloseTo(729, 6);
  });

  it("handles an upward vertical axis", () => {
    const previous = sampleCamera(400, 1000, -2, -1);
    const next = sampleCamera(400, 1000, -1.6, -1);

    expect(resolveZoomFixedPointPixel(previous, next, -1)).toBeCloseTo(400, 9);
  });

  it("returns null for a pure pan, which has no fixed point", () => {
    const previous = sampleCamera(CENTRE, 1000, -2);
    const next = sampleCamera(CENTRE, 1400, -2);

    expect(resolveZoomFixedPointPixel(previous, next, 1)).toBeNull();
  });

  it("returns null rather than a non-finite pixel", () => {
    const previous = sampleCamera(CENTRE, 1000, -2);
    expect(
      resolveZoomFixedPointPixel(
        previous,
        { panPixel: Number.NaN, zoom: 1 },
        1,
      ),
    ).toBeNull();
  });
});

describe("reference rings under the landing camera", () => {
  // The tail of the scripted tour: writing → the moon landing. It pans ~5000
  // years while zooming in ~57x, which is where the drift was reported.
  const waypoints: LandingCameraWaypoint[] = [
    { year: -3200, logZoom: -6.386 },
    { year: 1969, logZoom: -2.336 },
  ];

  /** A ring 1000 years across, as the warp overlay draws it. */
  const RING_YEARS = 1000;

  const walkSegment = (
    pivotFor: (
      previous: TimelineCameraSample,
      next: TimelineCameraSample,
    ) => number,
  ) => {
    const edgeYears: number[] = [];
    let previous: TimelineCameraSample | null = null;

    for (let step = 50; step <= 100; step += 1) {
      const { focusYear, logZoom } = resolveLandingCamera(waypoints, step / 100);
      const next = sampleCamera(CENTRE, focusYear, logZoom);

      if (previous) {
        const pivot = pivotFor(previous, next);
        const edgePixel = pivot + (RING_YEARS * next.zoom) / 2;
        edgeYears.push(yearAtPixel(next, edgePixel));
      }
      previous = next;
    }

    return Math.max(...edgeYears) - Math.min(...edgeYears);
  };

  it("keeps a ring's edge on the same year while the camera zooms and pans", () => {
    const spread = walkSegment((previous, next) => {
      const pivot = resolveZoomFixedPointPixel(previous, next, 1);
      expect(pivot).not.toBeNull();
      return pivot as number;
    });

    expect(spread).toBeLessThan(1e-3);
  });

  it("documents the drift when the rings are centred on the viewport instead", () => {
    // Centring on focusPixel assumes the camera zooms about the year in the
    // middle of the screen. The tour pans while it zooms, so it does not, and
    // the ring's edge slides across ~600 years of timeline.
    expect(walkSegment(() => CENTRE)).toBeGreaterThan(400);
  });
});
