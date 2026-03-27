export const BIG_BANG_YEAR = -13.8e9;

export const TICK_OVERSCAN_INTERVALS = 2;
export const COLLECTION_CACHE_KEY = "time-horizon:collection-cache:v2";
export const COLLECTION_COLOR_PREFERENCES_KEY =
  "time-horizon:collection-color-preferences:v1";
export const ZOOM_UI_THROTTLE_MS = 80;
export const ZOOM_LAYOUT_THROTTLE_MS = 1000;
export const ZOOM_SETTLE_DELAY_MS = 140;
export const ZOOM_WARP_HIDE_MS = 520;
export const ZOOM_WARP_SPEED_THRESHOLD = 0.0024;
export const FPS_SAMPLE_WINDOW_MS = 250;

export const MIN_ZOOM = 100 / 13.8e9;
export const MAX_ZOOM = 1000 / (1 / 365.25);

export const CAMERA_FIT_PADDING = 0.12;
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

export const LAYOUT_LEVELS = [1, 2, 3] as const;
export const LAYOUT_ROW_OFFSET = 80;
export const LAYOUT_MARGIN_RATIO = 0.3;
export const LAYOUT_MIN_DISTANCE_PX = 90;
export const LAYOUT_EDGE_PADDING = 96;
export const LAYOUT_MAX_LEVELS_PER_SIDE = 4;
export const LONG_TRAVEL_VIEWPORT_MULTIPLIER = 2.5;
