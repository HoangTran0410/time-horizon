export const BIG_BANG_YEAR = -13.8e9;

/**
 * Catalog collection auto-loaded on a user's very first visit so the timeline
 * is never empty on arrival. Spans the full 13.8By range, which is the point.
 */
export const DEFAULT_SEED_COLLECTION_ID = "cosmic";

export const GOOGLE_CLIENT_ID =
  "18522689439-iqf64i30ho7o8u439pdslegvvhceiip9.apps.googleusercontent.com";

export const AUTOSYNC_DELAY_SECONDS = 30;

export const TICK_OVERSCAN_INTERVALS = 2;
export const COLLECTION_CACHE_KEY = "time-horizon:collection-cache:v2";
export const COLLECTION_COLOR_PREFERENCES_KEY =
  "time-horizon:collection-color-preferences:v1";
export const ZOOM_UI_THROTTLE_MS = 80;
/**
 * How often event layout is recomputed during a continuous zoom. Must stay
 * comfortably above the 0.2s opacity tween in updateLayout — relayouting faster
 * than the tween restarts it every pass, so events never finish fading in.
 */
export const ZOOM_LAYOUT_THROTTLE_MS = 250;
export const ZOOM_SETTLE_DELAY_MS = 140;
export const ZOOM_WARP_HIDE_MS = 520;
export const ZOOM_WARP_SPEED_THRESHOLD = 0.0024;
export const FPS_SAMPLE_WINDOW_MS = 250;

export const MIN_ZOOM = 100 / 13.8e9;
export const MAX_ZOOM = 1000 / (1 / 365.25);

export const CAMERA_FIT_PADDING = 0.12;
/**
 * Narrowest range a camera fit will frame. One day is the timeline's finest
 * unit (see MAX_ZOOM), so a span shorter than that gets padded out to it
 * rather than driving the zoom to infinity.
 */
export const MIN_FIT_RANGE_YEARS = 1 / 365.25;
export const CAMERA_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};
export const FOCUS_SPRING = {
  type: "spring" as const,
  stiffness: 400,
  damping: 40,
};
export const EVENT_LAYOUT_SPRING = {
  type: "spring" as const,
  stiffness: 160,
  damping: 42,
};

export const LAYOUT_LEVELS = [1, 2, 3] as const;
export const LAYOUT_ROW_OFFSET = 80;
export const LAYOUT_MARGIN_RATIO = 0.3;
/**
 * How far the viewport may drift, as a fraction of its visible span, before a
 * pan triggers a fresh layout pass. Panning does not change zoom, so row
 * assignments stay valid — only newly entering events need placing, and layout
 * already covers LAYOUT_MARGIN_RATIO beyond each edge. Must stay well below
 * that margin so nothing can scroll into view unplaced.
 */
export const LAYOUT_REFRESH_SHIFT_RATIO = 0.15;
export const LAYOUT_MIN_DISTANCE_PX = 90;
export const LAYOUT_EDGE_PADDING = 96;
export const LAYOUT_MAX_LEVELS_PER_SIDE = 4;
export const LONG_TRAVEL_VIEWPORT_MULTIPLIER = 2.5;

/**
 * Pixel width at which a span stops behaving like a point. Below this the bar
 * would be shorter than the event marker itself, so it is drawn and laid out
 * as a plain point event.
 */
export const SPAN_MIN_RENDER_PX = 28;
