export type WheelInputSample = {
  deltaY: number;
  deltaMode: number;
  /** Chromium/WebKit legacy value: notched wheels normally report ±120. */
  wheelDeltaY?: number;
};

export type SmoothWheelQueueItem = {
  delta: number;
  last: number;
  start: number;
};

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const MOUSE_WHEEL_LEGACY_STEP = 120;
const LINE_HEIGHT_PX = 40;
const WHEEL_STEP_PX = 100;
export const SMOOTH_WHEEL_ANIMATION_MS = 400;
const PULSE_SCALE = 4;
const ACCELERATION_WINDOW_MS = 50;
const ACCELERATION_MAX = 3;

const isNearMultiple = (value: number, step: number) => {
  const remainder = Math.abs(value) % step;
  return remainder < 0.5 || step - remainder < 0.5;
};

/** Keep native touchpad momentum and only replace discrete wheel notches. */
export const isDiscreteWheelInput = ({
  deltaY,
  deltaMode,
  wheelDeltaY,
}: WheelInputSample): boolean => {
  if (!Number.isFinite(deltaY) || deltaY === 0) return false;
  if (deltaMode !== DOM_DELTA_PIXEL) return true;

  const legacyMagnitude = Math.abs(wheelDeltaY ?? 0);
  if (
    legacyMagnitude >= MOUSE_WHEEL_LEGACY_STEP &&
    isNearMultiple(legacyMagnitude, MOUSE_WHEEL_LEGACY_STEP)
  ) {
    return true;
  }

  const magnitude = Math.abs(deltaY);
  return magnitude >= 80 && isNearMultiple(magnitude, 100);
};

/** Match sscr.js: line conversion followed by a 100px/120-unit wheel step. */
export const normalizeDiscreteWheelDelta = (
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number => {
  let pixels =
    deltaMode === DOM_DELTA_LINE
      ? deltaY * LINE_HEIGHT_PX
      : deltaMode === 2
        ? deltaY * viewportHeight
        : deltaY;
  if (Math.abs(pixels) > 1.2) pixels *= WHEEL_STEP_PX / 120;
  return pixels;
};

/** Match sscr.js burst acceleration: quick notches increase up to 3×. */
export const getSmoothWheelAcceleration = (elapsedMs: number): number => {
  if (!Number.isFinite(elapsedMs) || elapsedMs >= ACCELERATION_WINDOW_MS) {
    return 1;
  }
  const safeElapsed = Math.max(1, elapsedMs);
  return Math.min((1 + 50 / safeElapsed) / 2, ACCELERATION_MAX);
};

const pulseRaw = (progress: number): number => {
  let x = progress * PULSE_SCALE;
  if (x < 1) return x - (1 - Math.exp(-x));
  const start = Math.exp(-1);
  x -= 1;
  return start + (1 - Math.exp(-x)) * (1 - start);
};

const PULSE_NORMALIZE = 1 / pulseRaw(1);

/** Michael Herf's viscous-fluid pulse curve used by the reference utility. */
export const pulseEase = (progress: number): number => {
  if (progress >= 1) return 1;
  if (progress <= 0) return 0;
  return pulseRaw(progress) * PULSE_NORMALIZE;
};

export const createSmoothWheelQueueItem = (
  delta: number,
  start: number,
): SmoothWheelQueueItem => ({
  delta,
  last: delta < 0 ? 0.99 : -0.99,
  start,
});

/**
 * Advance every overlapping wheel command and combine its incremental movement,
 * exactly like the queue in sscr.js. Integer deltas keep native scroll parity.
 */
export const advanceSmoothWheelQueue = (
  queue: readonly SmoothWheelQueueItem[],
  now: number,
): { scrollDelta: number; queue: SmoothWheelQueueItem[] } => {
  let scrollDelta = 0;
  const remaining: SmoothWheelQueueItem[] = [];

  for (const item of queue) {
    const elapsed = Math.max(0, now - item.start);
    const finished = elapsed >= SMOOTH_WHEEL_ANIMATION_MS;
    const position = finished
      ? 1
      : pulseEase(elapsed / SMOOTH_WHEEL_ANIMATION_MS);
    const delta = Math.trunc(item.delta * position - item.last);
    scrollDelta += delta;
    if (!finished) {
      remaining.push({ ...item, last: item.last + delta });
    }
  }

  return { scrollDelta, queue: remaining };
};
