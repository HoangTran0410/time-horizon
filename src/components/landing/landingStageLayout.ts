import { LANDING_WAYPOINTS } from "./landingWaypoints";

/** Scroll length per segment. One constant so the pacing is tunable in one place. */
const SEGMENT_VH = 55;

/**
 * Scroll spent holding the opening frame before the camera starts moving.
 *
 * Paced against the two reveals in index.css: the hero dissolves over 0→22vh
 * and the canvas rises over 14vh→78vh. Mapping the camera straight onto scroll
 * meant it was already half way to the second waypoint by the time the hero
 * cleared, so the establishing shot — all 13.8 billion years in one frame — was
 * never seen standing still. Ending the hold just past the reveal gives it a
 * beat of its own before the journey starts.
 */
const INTRO_HOLD_VH = 65;

export const TRACK_VH = INTRO_HOLD_VH + LANDING_WAYPOINTS.length * SEGMENT_VH;

/**
 * `useScroll` runs 0→1 over the track minus one viewport ("start start" to
 * "end end"), and the sticky stage is exactly one viewport tall — so the hold
 * is its share of that, not of the raw track height.
 */
export const INTRO_HOLD_FRACTION = INTRO_HOLD_VH / (TRACK_VH - 100);

/**
 * Height of the scroll track, as a style value.
 *
 * The live stage and the skeleton shown while its chunk downloads both set it,
 * so the page is its final height from the first paint and nothing shifts when
 * the canvas arrives.
 */
export const LANDING_TRACK_HEIGHT = `${TRACK_VH}vh`;
