import { useState, type RefObject } from "react";
import { useMotionValueEvent, useScroll, type MotionValue } from "motion/react";
import {
  resolveLandingCamera,
  type LandingCameraWaypoint,
} from "./landingCamera";

type UseLandingCameraParams = {
  /** The tall scroll container that the sticky stage lives inside. */
  scrollRef: RefObject<HTMLElement | null>;
  waypoints: readonly LandingCameraWaypoint[];
  focusYear: MotionValue<number>;
  /** The viewport hook exposes this as `currentLogZoom`. */
  logZoom: MotionValue<number>;
  /** False under prefers-reduced-motion, where no canvas is mounted. */
  enabled: boolean;
};

/**
 * Drive the timeline camera from page scroll.
 *
 * Camera values are written straight onto the MotionValues, so no React render
 * happens per frame. Only the active waypoint index is lifted into state, to
 * swap the caption a few times per scroll pass.
 */
export const useLandingCamera = ({
  scrollRef,
  waypoints,
  focusYear,
  logZoom,
  enabled,
}: UseLandingCameraParams) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!enabled || waypoints.length === 0) return;

    const camera = resolveLandingCamera(waypoints, progress);
    focusYear.set(camera.focusYear);
    logZoom.set(camera.logZoom);

    const segmentCount = Math.max(1, waypoints.length - 1);
    const nearest = Math.min(
      waypoints.length - 1,
      Math.max(0, Math.round(progress * segmentCount)),
    );
    setActiveIndex((current) => (current === nearest ? current : nearest));
  });

  return { activeIndex };
};
