import { useEffect } from "react";
import {
  advanceSmoothWheelQueue,
  createSmoothWheelQueueItem,
  getSmoothWheelAcceleration,
  isDiscreteWheelInput,
  normalizeDiscreteWheelDelta,
  type SmoothWheelQueueItem,
} from "./landingSmoothScroll";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Adds inertia only to discrete mouse-wheel notches. Trackpads retain the
 * browser's native high-resolution scrolling, including their own momentum.
 */
export const useLandingSmoothWheel = () => {
  useEffect(() => {
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let queue: SmoothWheelQueueItem[] = [];
    let frameId: number | null = null;
    let lastWheelTime = 0;
    let direction = 0;

    const cancelAnimation = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      queue = [];
      lastWheelTime = 0;
      direction = 0;
    };

    const animateScroll = (now: number) => {
      const frame = advanceSmoothWheelQueue(queue, now);
      queue = frame.queue;
      if (frame.scrollDelta !== 0) window.scrollBy(0, frame.scrollDelta);
      if (queue.length === 0) {
        frameId = null;
        return;
      }
      frameId = requestAnimationFrame(animateScroll);
    };

    const handleWheel = (event: WheelEvent) => {
      const wheelDeltaY = (
        event as WheelEvent & { readonly wheelDeltaY?: number }
      ).wheelDeltaY;
      const isDiscrete = isDiscreteWheelInput({
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        wheelDeltaY,
      });

      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        reducedMotion.matches ||
        !isDiscrete
      ) {
        if (!isDiscrete) cancelAnimation();
        return;
      }

      event.preventDefault();
      let rawDelta = wheelDeltaY ? -wheelDeltaY : event.deltaY;
      if (
        wheelDeltaY &&
        Math.abs(wheelDeltaY) >= 120 &&
        Math.abs(wheelDeltaY) % 120 === 0
      ) {
        rawDelta = -120 * Math.sign(wheelDeltaY);
      }
      let impulse = normalizeDiscreteWheelDelta(
        rawDelta,
        event.deltaMode,
        window.innerHeight,
      );
      const nextDirection = Math.sign(impulse);
      if (direction !== 0 && nextDirection !== direction) cancelAnimation();
      direction = nextDirection;

      const now = performance.now();
      impulse *= getSmoothWheelAcceleration(now - lastWheelTime);
      lastWheelTime = now;
      queue.push(createSmoothWheelQueueItem(impulse, now));
      if (frameId === null) frameId = requestAnimationFrame(animateScroll);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerdown", cancelAnimation, { passive: true });
    window.addEventListener("touchstart", cancelAnimation, { passive: true });
    window.addEventListener("keydown", cancelAnimation);
    return () => {
      cancelAnimation();
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerdown", cancelAnimation);
      window.removeEventListener("touchstart", cancelAnimation);
      window.removeEventListener("keydown", cancelAnimation);
    };
  }, []);
};
