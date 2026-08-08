import { useEffect, useRef, useState } from "react";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import { ZOOM_WARP_MIN_LOG_DELTA } from "../../constants";
import type { WarpOverlayMode } from "../../constants/types";

type LandingWarpState = {
  isWarping: boolean;
  mode: Exclude<WarpOverlayMode, "travel">;
  /** Pixels-per-year for the overlay. See the note on render-phase writes. */
  zoom: MotionValue<number>;
};

/**
 * Below this a frame counts as holding zoom steady. Shared with the app so both
 * surfaces raise the rings on the same input; see the constant for why it is a
 * magnitude rather than a speed.
 */
const ZOOM_ACTIVITY_EPSILON = ZOOM_WARP_MIN_LOG_DELTA;

/** How long the rings linger after the last zoom change. */
const ZOOM_IDLE_MS = 220;

/**
 * Drive the app's zoom reference rings from the scripted camera.
 *
 * In the app the rings are raised by the wheel and pinch handlers, which never
 * fire here — the landing camera is written straight onto motion values by
 * scroll. This watches that value instead and reports the same warp state the
 * gesture handlers would, so the overlay works unchanged.
 *
 * It also hands back its own `zoom` value rather than passing the viewport
 * hook's through. That one is a `useTransform` of `logZoom`, and motion
 * recomputes those during render — which would have the overlay call setState
 * while the stage is rendering, every time the caption or the axis changes.
 * This mirror is only ever written from a `logZoom` change, i.e. never during
 * render.
 *
 * Warp state flips only when the rings appear, change direction, or time out,
 * never per frame.
 */
export const useLandingZoomWarp = (
  logZoom: MotionValue<number>,
): LandingWarpState => {
  const zoom = useMotionValue(Math.exp(logZoom.get()));

  const [warp, setWarp] = useState<Omit<LandingWarpState, "zoom">>({
    isWarping: false,
    mode: "zoom-in",
  });

  const previousRef = useRef(logZoom.get());
  const lastChangeRef = useRef(0);

  useMotionValueEvent(logZoom, "change", (current) => {
    zoom.set(Math.exp(current));

    const delta = current - previousRef.current;
    previousRef.current = current;
    if (Math.abs(delta) < ZOOM_ACTIVITY_EPSILON) return;

    lastChangeRef.current = performance.now();

    const mode: LandingWarpState["mode"] = delta > 0 ? "zoom-in" : "zoom-out";
    setWarp((previous) =>
      previous.isWarping && previous.mode === mode
        ? previous
        : { isWarping: true, mode },
    );
  });

  // The timer lives in an effect keyed on the flag, not alongside the setState
  // above: a timeout owned by the motion callback is cleared by any unmount —
  // including the simulated one StrictMode performs — and nothing re-arms it,
  // leaving the rings on screen forever. Re-arming against a timestamp also
  // keeps them up through a long scroll without restarting on every frame.
  useEffect(() => {
    if (!warp.isWarping) return;

    let timeoutId = 0;
    const check = () => {
      const idleFor = performance.now() - lastChangeRef.current;
      if (idleFor >= ZOOM_IDLE_MS) {
        setWarp((previous) => ({ ...previous, isWarping: false }));
        return;
      }
      timeoutId = window.setTimeout(check, ZOOM_IDLE_MS - idleFor);
    };

    timeoutId = window.setTimeout(check, ZOOM_IDLE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [warp.isWarping]);

  return { ...warp, zoom };
};
