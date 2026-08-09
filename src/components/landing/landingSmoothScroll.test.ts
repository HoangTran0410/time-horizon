import { describe, expect, it } from "vitest";
import {
  advanceSmoothWheelQueue,
  createSmoothWheelQueueItem,
  getSmoothWheelAcceleration,
  isDiscreteWheelInput,
  normalizeDiscreteWheelDelta,
  pulseEase,
} from "./landingSmoothScroll";

describe("isDiscreteWheelInput", () => {
  it("leaves high-resolution touchpad deltas native", () => {
    expect(
      isDiscreteWheelInput({ deltaY: 7.35, deltaMode: 0, wheelDeltaY: -29 }),
    ).toBe(false);
  });

  it("recognizes a notched mouse wheel in pixel mode", () => {
    expect(
      isDiscreteWheelInput({ deltaY: 100, deltaMode: 0, wheelDeltaY: -120 }),
    ).toBe(true);
  });

  it("recognizes line-mode wheel input", () => {
    expect(
      isDiscreteWheelInput({ deltaY: 3, deltaMode: 1, wheelDeltaY: -120 }),
    ).toBe(true);
  });
});

describe("normalizeDiscreteWheelDelta", () => {
  it("matches the reference 100px step for a standard 120-unit notch", () => {
    expect(normalizeDiscreteWheelDelta(120, 0, 800)).toBe(100);
  });

  it("normalizes line-mode wheel input through the same step size", () => {
    expect(normalizeDiscreteWheelDelta(3, 1, 800)).toBe(100);
  });
});

describe("getSmoothWheelAcceleration", () => {
  it("accelerates notches arriving inside the 50ms window", () => {
    expect(getSmoothWheelAcceleration(25)).toBe(1.5);
  });

  it("does not accelerate separate wheel gestures", () => {
    expect(getSmoothWheelAcceleration(50)).toBe(1);
  });

  it("caps extremely fast bursts at three times the step", () => {
    expect(getSmoothWheelAcceleration(1)).toBe(3);
  });
});

describe("pulseEase", () => {
  it("uses the reference acceleration-and-tail curve", () => {
    expect(pulseEase(0)).toBe(0);
    expect(pulseEase(0.25)).toBeGreaterThan(0.25);
    expect(pulseEase(0.75)).toBeGreaterThan(pulseEase(0.25));
    expect(pulseEase(1)).toBe(1);
  });
});

describe("advanceSmoothWheelQueue", () => {
  it("delivers one wheel notch over 400ms instead of jumping", () => {
    let queue = [createSmoothWheelQueueItem(100, 0)];
    const first = advanceSmoothWheelQueue(queue, 100);
    queue = first.queue;
    const second = advanceSmoothWheelQueue(queue, 200);
    queue = second.queue;
    const finished = advanceSmoothWheelQueue(queue, 400);

    expect(first.scrollDelta).toBeGreaterThan(0);
    expect(first.scrollDelta).toBeLessThan(100);
    expect(second.scrollDelta).toBeGreaterThan(0);
    expect(first.scrollDelta + second.scrollDelta + finished.scrollDelta).toBe(100);
    expect(finished.queue).toEqual([]);
  });

  it("adds overlapping wheel commands into the same animation frame", () => {
    const result = advanceSmoothWheelQueue(
      [
        createSmoothWheelQueueItem(100, 0),
        createSmoothWheelQueueItem(150, 50),
      ],
      100,
    );

    expect(result.scrollDelta).toBeGreaterThan(
      advanceSmoothWheelQueue([createSmoothWheelQueueItem(100, 0)], 100)
        .scrollDelta,
    );
  });
});
