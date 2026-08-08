import { useCallback, useEffect, useState, type RefObject } from "react";
import { useMotionValueEvent, useScroll, type MotionValue } from "motion/react";
import {
  resolveLandingAxisLogZoom,
  resolveLandingCamera,
  resolveLandingTourProgress,
  type LandingCameraWaypoint,
} from "./landingCamera";

type UseLandingCameraParams = {
  /** The tall scroll container that the sticky stage lives inside. */
  scrollRef: RefObject<HTMLElement | null>;
  waypoints: readonly LandingCameraWaypoint[];
  focusYear: MotionValue<number>;
  /** The viewport hook exposes this as `currentLogZoom`. */
  logZoom: MotionValue<number>;
  /**
   * Length of the axis the timeline is drawn along — width when horizontal,
   * height when vertical. Waypoint zooms are authored against a reference
   * length and rescaled onto this one, so a phone frames the same years.
   */
  axisPx: number;
  /**
   * Share of the scroll spent parked on the first waypoint before the camera
   * starts moving, so the hero has cleared and the opening frame has been seen
   * before the journey begins.
   */
  introHoldFraction: number;
  /** False while the stage is off-screen, so scrolling past costs nothing. */
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
  axisPx,
  introHoldFraction,
  enabled,
}: UseLandingCameraParams) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  const applyCamera = useCallback(
    (progress: number) => {
      if (!enabled || waypoints.length === 0) return;

      // Everything downstream reads the tour clock, not the scrollbar: the
      // caption has to stay on the opening waypoint through the hold too.
      const tourProgress = resolveLandingTourProgress(
        progress,
        introHoldFraction,
      );

      const camera = resolveLandingCamera(waypoints, tourProgress);
      focusYear.set(camera.focusYear);
      logZoom.set(resolveLandingAxisLogZoom(camera.logZoom, axisPx));

      const segmentCount = Math.max(1, waypoints.length - 1);
      const nearest = Math.min(
        waypoints.length - 1,
        Math.max(0, Math.round(tourProgress * segmentCount)),
      );
      setActiveIndex((current) => (current === nearest ? current : nearest));
    },
    [axisPx, enabled, focusYear, introHoldFraction, logZoom, waypoints],
  );

  useMotionValueEvent(scrollYProgress, "change", applyCamera);

  // Resizing or flipping orientation changes how many years the axis shows, and
  // neither produces a scroll event — without this the frame would keep the
  // zoom it was given for the old axis until the visitor scrolls again.
  useEffect(() => {
    applyCamera(scrollYProgress.get());
  }, [applyCamera, scrollYProgress]);

  return { activeIndex };
};
