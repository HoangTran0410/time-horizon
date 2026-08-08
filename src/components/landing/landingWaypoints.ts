import type { Event } from "../../constants/types";
import { assignRuntimeEventIds } from "../../helpers";
import type { LandingCameraWaypoint } from "./landingCamera";

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
};

/**
 * logZoom values are hand-tuned so each stop frames its moment: roughly
 * -18 shows all of cosmic time, and -2 is close enough to read single years.
 * They must stay inside [ln(MIN_ZOOM), ln(MAX_ZOOM)] — landingWaypoints.test.ts
 * enforces that.
 */
export const LANDING_WAYPOINTS: readonly LandingWaypoint[] = [
  {
    eventUid: "landing-big-bang",
    year: -13.8e9,
    logZoom: -18.3,
    titleKey: "landingWpBigBangTitle",
    captionKey: "landingWpBigBangCaption",
    timeLabelKey: "landingTimeBigBang",
    emoji: "✦",
  },
  {
    eventUid: "landing-first-stars",
    year: -13.4e9,
    logZoom: -17.6,
    titleKey: "landingWpFirstStarsTitle",
    captionKey: "landingWpFirstStarsCaption",
    timeLabelKey: "landingTimeFirstStars",
    emoji: "★",
  },
  {
    eventUid: "landing-earth",
    year: -4.54e9,
    logZoom: -16.4,
    titleKey: "landingWpEarthTitle",
    captionKey: "landingWpEarthCaption",
    timeLabelKey: "landingTimeEarth",
    emoji: "🜨",
  },
  {
    eventUid: "landing-first-life",
    year: -3.7e9,
    logZoom: -15.6,
    titleKey: "landingWpLifeTitle",
    captionKey: "landingWpLifeCaption",
    timeLabelKey: "landingTimeLife",
    emoji: "◍",
  },
  {
    eventUid: "landing-cambrian",
    year: -541e6,
    logZoom: -13.4,
    titleKey: "landingWpCambrianTitle",
    captionKey: "landingWpCambrianCaption",
    timeLabelKey: "landingTimeCambrian",
    emoji: "🜛",
  },
  {
    eventUid: "landing-asteroid",
    year: -66e6,
    logZoom: -11.4,
    titleKey: "landingWpAsteroidTitle",
    captionKey: "landingWpAsteroidCaption",
    timeLabelKey: "landingTimeAsteroid",
    emoji: "☄",
  },
  {
    eventUid: "landing-sapiens",
    year: -300000,
    logZoom: -7.2,
    titleKey: "landingWpSapiensTitle",
    captionKey: "landingWpSapiensCaption",
    timeLabelKey: "landingTimeSapiens",
    emoji: "◈",
  },
  {
    eventUid: "landing-writing",
    year: -3200,
    logZoom: -4.6,
    titleKey: "landingWpWritingTitle",
    captionKey: "landingWpWritingCaption",
    timeLabelKey: "landingTimeWriting",
    emoji: "𓂀",
  },
  {
    eventUid: "landing-moon",
    year: 1969,
    logZoom: -2.6,
    titleKey: "landingWpMoonTitle",
    captionKey: "landingWpMoonCaption",
    timeLabelKey: "landingTimeMoon",
    emoji: "☾",
  },
  {
    eventUid: "landing-now",
    year: new Date().getUTCFullYear(),
    logZoom: -1.8,
    titleKey: "landingWpNowTitle",
    captionKey: "landingWpNowCaption",
    timeLabelKey: "landingTimeNow",
    emoji: "✚",
  },
];

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
      priority: 0,
    })),
    { collectionId: "landing" },
  );
