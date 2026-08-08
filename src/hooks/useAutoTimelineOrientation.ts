import { useEffect, useState } from "react";
import { TIMELINE_VERTICAL_MAX_WIDTH_PX } from "../constants";
import type { TimelineOrientation } from "../constants/types";

const QUERY = `(max-width: ${TIMELINE_VERTICAL_MAX_WIDTH_PX}px)`;

const readAutoOrientation = (): TimelineOrientation => {
  if (typeof window === "undefined") return "horizontal";
  return window.matchMedia(QUERY).matches ? "vertical" : "horizontal";
};

/**
 * The orientation the viewport asks for: vertical on narrow screens, horizontal
 * otherwise.
 *
 * Backed by `matchMedia` rather than a resize listener, so it fires only when
 * the breakpoint is actually crossed instead of on every resize frame. The
 * initialiser is lazy so the first render already has the right answer — read
 * it in an effect instead and a phone would paint one horizontal frame before
 * flipping, re-running the whole tick and layout pass for nothing.
 */
export const useAutoTimelineOrientation = (): TimelineOrientation => {
  const [orientation, setOrientation] =
    useState<TimelineOrientation>(readAutoOrientation);

  useEffect(() => {
    const query = window.matchMedia(QUERY);
    const sync = () => setOrientation(query.matches ? "vertical" : "horizontal");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return orientation;
};
