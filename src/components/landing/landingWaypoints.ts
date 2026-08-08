import type { Event } from "../../constants/types";
import { assignRuntimeEventIds } from "../../helpers";
import {
  LANDING_REFERENCE_AXIS_PX,
  type LandingCameraWaypoint,
} from "./landingCamera";

/**
 * One scripted stop: where the camera sits, plus the copy shown beside it.
 *
 * Text is stored as i18n keys rather than strings — the component resolves
 * them through `t()` so the page follows the language picker.
 */
export type LandingWaypoint = LandingCameraWaypoint & {
  /** Durable identity. Runtime `id` is assigned by assignRuntimeEventIds. */
  eventUid: string;
  titleKey: string;
  captionKey: string;
  timeLabelKey: string;
  emoji: string;
  priority: number;
};

/** A stop before its zoom is derived — years and copy only. */
type LandingWaypointSeed = Omit<LandingWaypoint, "logZoom">;

const HALF_AXIS_PX = LANDING_REFERENCE_AXIS_PX / 2;

/**
 * Pixels kept between the outermost visible waypoint and the edge of the axis,
 * so its card and label have somewhere to sit instead of being cut in half.
 */
export const LANDING_EDGE_PAD_PX = 220;

/**
 * How much wider than the neighbour distance a frame has to be for that
 * neighbour to land inside the padded area. 1440/2 ÷ (1440/2 − 220) ≈ 1.44.
 */
const NEIGHBOUR_MARGIN = HALF_AXIS_PX / (HALF_AXIS_PX - LANDING_EDGE_PAD_PX);

/**
 * Derive each stop's zoom from how far its neighbours are, rather than from a
 * span picked by eye.
 *
 * Hand-picked spans framed each moment on its own, which is what made the page
 * feel empty: at the asteroid stop the frame was 100M years wide while the next
 * waypoint sat 66M years away and the previous one 475M — so most of the scroll
 * was a bare ruler sliding past with nothing on it.
 *
 * The rule here is one line: a stop frames at least `NEIGHBOUR_MARGIN ×` the
 * distance to its farther neighbour. Because a segment's two endpoints share
 * the gap between them, both stay on screen for the *whole* transition, never
 * closer than `EDGE_PAD_PX` to the edge — the camera can no longer travel
 * through empty space. `landingWaypoints.test.ts` asserts exactly that.
 *
 * Two adjustments on top:
 *  - The first stop instead frames the entire story, so the page opens on all
 *    13.8 billion years rather than on the Big Bang alone.
 *  - Spans are swept back from the end so they never grow: the journey only
 *    ever zooms in. Where a stop would have needed a wider frame than the one
 *    before it, the two share a zoom and that segment becomes a pure pan.
 */
const deriveLogZooms = (years: readonly number[]): number[] => {
  const gaps = years.slice(1).map((year, index) => year - years[index]);

  const halfSpans = years.map((_, index) => {
    const back = index > 0 ? gaps[index - 1] : 0;
    const forward = index < gaps.length ? gaps[index] : 0;
    return NEIGHBOUR_MARGIN * Math.max(back, forward);
  });

  // Establishing shot: the whole timeline, measured out from the first year.
  halfSpans[0] = NEIGHBOUR_MARGIN * (years[years.length - 1] - years[0]);

  // Suffix maximum — makes the sequence non-increasing, i.e. never zooms out.
  for (let index = halfSpans.length - 2; index >= 0; index -= 1) {
    halfSpans[index] = Math.max(halfSpans[index], halfSpans[index + 1]);
  }

  return halfSpans.map((halfSpan) => Math.log(HALF_AXIS_PX / halfSpan));
};

/**
 * Priority descends strictly from 100 (Big Bang) to 55 (Now) so that when
 * waypoints collide at maximum zoom-out (all events pile into a few pixels),
 * the widest-scope event (Big Bang) survives clustering, letting viewers
 * understand the scroll starts at the broadest perspective. Values stay within
 * [55, 100] to match the app's existing convention range for real catalog data.
 */
const LANDING_WAYPOINT_SEEDS: readonly LandingWaypointSeed[] = [
  {
    eventUid: "landing-big-bang",
    year: -13.8e9,
    titleKey: "landingWpBigBangTitle",
    captionKey: "landingWpBigBangCaption",
    timeLabelKey: "landingTimeBigBang",
    emoji: "✦",
    priority: 100,
  },
  {
    eventUid: "landing-first-stars",
    year: -13.4e9,
    titleKey: "landingWpFirstStarsTitle",
    captionKey: "landingWpFirstStarsCaption",
    timeLabelKey: "landingTimeFirstStars",
    emoji: "★",
    priority: 95,
  },
  {
    eventUid: "landing-earth",
    year: -4.54e9,
    titleKey: "landingWpEarthTitle",
    captionKey: "landingWpEarthCaption",
    timeLabelKey: "landingTimeEarth",
    emoji: "🜨",
    priority: 90,
  },
  {
    eventUid: "landing-first-life",
    year: -3.7e9,
    titleKey: "landingWpLifeTitle",
    captionKey: "landingWpLifeCaption",
    timeLabelKey: "landingTimeLife",
    emoji: "◍",
    priority: 85,
  },
  {
    eventUid: "landing-cambrian",
    year: -541e6,
    titleKey: "landingWpCambrianTitle",
    captionKey: "landingWpCambrianCaption",
    timeLabelKey: "landingTimeCambrian",
    emoji: "🜛",
    priority: 80,
  },
  {
    eventUid: "landing-asteroid",
    year: -66e6,
    titleKey: "landingWpAsteroidTitle",
    captionKey: "landingWpAsteroidCaption",
    timeLabelKey: "landingTimeAsteroid",
    emoji: "☄",
    priority: 75,
  },
  {
    eventUid: "landing-sapiens",
    year: -300000,
    titleKey: "landingWpSapiensTitle",
    captionKey: "landingWpSapiensCaption",
    timeLabelKey: "landingTimeSapiens",
    emoji: "◈",
    priority: 70,
  },
  {
    eventUid: "landing-writing",
    year: -3200,
    titleKey: "landingWpWritingTitle",
    captionKey: "landingWpWritingCaption",
    timeLabelKey: "landingTimeWriting",
    emoji: "𓂀",
    priority: 65,
  },
  {
    eventUid: "landing-moon",
    year: 1969,
    titleKey: "landingWpMoonTitle",
    captionKey: "landingWpMoonCaption",
    timeLabelKey: "landingTimeMoon",
    emoji: "☾",
    priority: 60,
  },
  {
    eventUid: "landing-now",
    year: new Date().getUTCFullYear(),
    titleKey: "landingWpNowTitle",
    captionKey: "landingWpNowCaption",
    timeLabelKey: "landingTimeNow",
    emoji: "✚",
    priority: 55,
  },
];

export const LANDING_WAYPOINTS: readonly LandingWaypoint[] = (() => {
  const logZooms = deriveLogZooms(
    LANDING_WAYPOINT_SEEDS.map((seed) => seed.year),
  );
  return LANDING_WAYPOINT_SEEDS.map((seed, index) => ({
    ...seed,
    logZoom: logZooms[index],
  }));
})();


/** Camera-only projection, so landingCamera stays unaware of copy and emoji. */
export const LANDING_CAMERA_WAYPOINTS: readonly LandingCameraWaypoint[] =
  LANDING_WAYPOINTS.map(({ year, logZoom }) => ({ year, logZoom }));

/**
 * Build the events the canvas draws.
 *
 * `title` and `description` hold i18n *keys*; LandingScrollStage resolves them
 * through `t()` before handing the list to the viewport, so the canvas draws
 * real localized text.
 */
export const buildLandingEvents = (): Event[] =>
  assignRuntimeEventIds(
    LANDING_WAYPOINTS.map((waypoint) => ({
      id: "",
      eventUid: waypoint.eventUid,
      title: waypoint.titleKey,
      description: waypoint.captionKey,
      time: [waypoint.year] as Event["time"],
      emoji: waypoint.emoji,
      priority: waypoint.priority,
    })),
    { collectionId: "landing" },
  );
