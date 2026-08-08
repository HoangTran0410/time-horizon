import { describe, expect, it } from "vitest";
import {
  DRAG_INERTIA_MAX_IDLE_MS,
  PINCH_TAIL_INERTIA_MIN_MS,
  PINCH_TAIL_INERTIA_MIN_PX,
  shouldStartDragInertia,
  type DragInertiaRelease,
} from "./index";

const release = (
  overrides: Partial<DragInertiaRelease> = {},
): DragInertiaRelease => ({
  velocity: 1.2,
  msSinceLastMove: 8,
  isPinchTail: false,
  dragDurationMs: 400,
  dragDistancePx: 180,
  ...overrides,
});

describe("shouldStartDragInertia", () => {
  it("flings a normal flick", () => {
    expect(shouldStartDragInertia(release())).toBe(true);
  });

  it("ignores a barely-moving release", () => {
    expect(shouldStartDragInertia(release({ velocity: 0.04 }))).toBe(false);
  });

  it("ignores a finger that came to rest before lifting", () => {
    expect(
      shouldStartDragInertia(
        release({ msSinceLastMove: DRAG_INERTIA_MAX_IDLE_MS + 1 }),
      ),
    ).toBe(false);
  });

  it("ignores a non-finite velocity from a zero-length sample", () => {
    expect(shouldStartDragInertia(release({ velocity: Infinity }))).toBe(false);
    expect(shouldStartDragInertia(release({ velocity: NaN }))).toBe(false);
  });

  describe("pinch tail", () => {
    it("does not fling the few milliseconds of slide left by lifting the second finger", () => {
      expect(
        shouldStartDragInertia(
          release({
            isPinchTail: true,
            // The exact shape that used to throw the camera: a 3px slide over
            // 2ms reads as 1.5px/ms, ~30px per frame of inertia.
            velocity: 1.5,
            dragDurationMs: 18,
            dragDistancePx: 3,
          }),
        ),
      ).toBe(false);
    });

    it("does not fling a long-but-stationary hold after a pinch", () => {
      expect(
        shouldStartDragInertia(
          release({
            isPinchTail: true,
            dragDurationMs: PINCH_TAIL_INERTIA_MIN_MS + 500,
            dragDistancePx: PINCH_TAIL_INERTIA_MIN_PX - 1,
          }),
        ),
      ).toBe(false);
    });

    it("does not fling a fast-but-brief drag after a pinch", () => {
      expect(
        shouldStartDragInertia(
          release({
            isPinchTail: true,
            dragDurationMs: PINCH_TAIL_INERTIA_MIN_MS - 1,
            dragDistancePx: PINCH_TAIL_INERTIA_MIN_PX + 100,
          }),
        ),
      ).toBe(false);
    });

    it("flings once the leftover finger has run a deliberate pan", () => {
      expect(
        shouldStartDragInertia(
          release({
            isPinchTail: true,
            dragDurationMs: PINCH_TAIL_INERTIA_MIN_MS + 1,
            dragDistancePx: PINCH_TAIL_INERTIA_MIN_PX + 1,
          }),
        ),
      ).toBe(true);
    });
  });
});
