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
  priority: number;
};

/**
 * logZoom values are hand-tuned so each stop frames its moment: roughly
 * -18 shows all of cosmic time, and -2 is close enough to read single years.
 * They must stay inside [ln(MIN_ZOOM), ln(MAX_ZOOM)] — landingWaypoints.test.ts
 * enforces that.
 *
 * Priority descends strictly from 100 (Big Bang) to 55 (Now) so that when
 * waypoints collide at maximum zoom-out (all events pile into a few pixels),
 * the widest-scope event (Big Bang) survives clustering, letting viewers
 * understand the scroll starts at the broadest perspective. Values stay within
 * [55, 100] to match the app's existing convention range for real catalog data.
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
    priority: 100,
  },
  {
    eventUid: "landing-first-stars",
    year: -13.4e9,
    logZoom: -17.6,
    titleKey: "landingWpFirstStarsTitle",
    captionKey: "landingWpFirstStarsCaption",
    timeLabelKey: "landingTimeFirstStars",
    emoji: "★",
    priority: 95,
  },
  {
    eventUid: "landing-earth",
    year: -4.54e9,
    logZoom: -16.4,
    titleKey: "landingWpEarthTitle",
    captionKey: "landingWpEarthCaption",
    timeLabelKey: "landingTimeEarth",
    emoji: "🜨",
    priority: 90,
  },
  {
    eventUid: "landing-first-life",
    year: -3.7e9,
    logZoom: -15.6,
    titleKey: "landingWpLifeTitle",
    captionKey: "landingWpLifeCaption",
    timeLabelKey: "landingTimeLife",
    emoji: "◍",
    priority: 85,
  },
  {
    eventUid: "landing-cambrian",
    year: -541e6,
    logZoom: -13.4,
    titleKey: "landingWpCambrianTitle",
    captionKey: "landingWpCambrianCaption",
    timeLabelKey: "landingTimeCambrian",
    emoji: "🜛",
    priority: 80,
  },
  {
    eventUid: "landing-asteroid",
    year: -66e6,
    logZoom: -11.4,
    titleKey: "landingWpAsteroidTitle",
    captionKey: "landingWpAsteroidCaption",
    timeLabelKey: "landingTimeAsteroid",
    emoji: "☄",
    priority: 75,
  },
  {
    eventUid: "landing-sapiens",
    year: -300000,
    logZoom: -7.2,
    titleKey: "landingWpSapiensTitle",
    captionKey: "landingWpSapiensCaption",
    timeLabelKey: "landingTimeSapiens",
    emoji: "◈",
    priority: 70,
  },
  {
    eventUid: "landing-writing",
    year: -3200,
    logZoom: -4.6,
    titleKey: "landingWpWritingTitle",
    captionKey: "landingWpWritingCaption",
    timeLabelKey: "landingTimeWriting",
    emoji: "𓂀",
    priority: 65,
  },
  {
    eventUid: "landing-moon",
    year: 1969,
    logZoom: -2.6,
    titleKey: "landingWpMoonTitle",
    captionKey: "landingWpMoonCaption",
    timeLabelKey: "landingTimeMoon",
    emoji: "☾",
    priority: 60,
  },
  {
    eventUid: "landing-now",
    year: new Date().getUTCFullYear(),
    logZoom: -1.8,
    titleKey: "landingWpNowTitle",
    captionKey: "landingWpNowCaption",
    timeLabelKey: "landingTimeNow",
    emoji: "✚",
    priority: 55,
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
      priority: waypoint.priority,
    })),
    { collectionId: "landing" },
  );
