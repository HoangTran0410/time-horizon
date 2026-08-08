import { BIG_BANG_YEAR, MAX_ZOOM, MIN_ZOOM } from "../../constants";

/** One stop on the landing page's scripted camera path. */
export type LandingCameraWaypoint = {
  /** Absolute year at the centre of the viewport. Negative is BCE. */
  year: number;
  /** Natural log of pixels-per-year. See MIN_ZOOM/MAX_ZOOM for the range. */
  logZoom: number;
};

/**
 * Below this the segment is treated as holding zoom steady and the eased
 * parameter collapses to linear, avoiding a 0/0 in the closed form.
 */
export const LANDING_ZOOM_EPSILON = 1e-6;

const MIN_LOG_ZOOM = Math.log(MIN_ZOOM);
const MAX_LOG_ZOOM = Math.log(MAX_ZOOM);

export const isLandingLogZoomInBounds = (logZoom: number): boolean =>
  Number.isFinite(logZoom) &&
  logZoom >= MIN_LOG_ZOOM &&
  logZoom <= MAX_LOG_ZOOM;

/**
 * Eased progress through one segment.
 *
 * Pixel distance between two years is |dyear| * zoom, so constant on-screen
 * travel needs dyear/dt proportional to 1/zoom = e^(-logZoom(t)). With logZoom
 * linear across the segment (k = lzB - lzA), integrating and normalising gives
 * the expression below: the closed-form solution for constant screen-space pan
 * velocity under exponential zoom. It degenerates to `t` as k approaches 0.
 *
 * Not van Wijk & Nuij's smooth zoom-and-pan — that optimises a hyperbolic path
 * through (pan, zoom) space and its pan profile does not converge to this one
 * at any rho. This is the simpler constant-velocity solution.
 */
const easeSegment = (t: number, k: number): number => {
  if (Math.abs(k) <= LANDING_ZOOM_EPSILON) return t;
  return (1 - Math.exp(-k * t)) / (1 - Math.exp(-k));
};

const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;

/**
 * Map scroll progress (0..1 across the whole scrollytelling block) onto the
 * camera. Segments are equal-length in scroll: N waypoints means N-1 segments,
 * each occupying 1/(N-1) of the range.
 */
export const resolveLandingCamera = (
  waypoints: readonly LandingCameraWaypoint[],
  progress: number,
): { focusYear: number; logZoom: number } => {
  if (waypoints.length === 0) {
    return { focusYear: BIG_BANG_YEAR, logZoom: MIN_LOG_ZOOM };
  }
  if (waypoints.length === 1) {
    return { focusYear: waypoints[0].year, logZoom: waypoints[0].logZoom };
  }

  const clamped = clamp01(Number.isFinite(progress) ? progress : 0);
  const segmentCount = waypoints.length - 1;
  const scaled = clamped * segmentCount;
  // At progress exactly 1, floor() would index one past the last segment.
  const index = Math.min(Math.floor(scaled), segmentCount - 1);
  const t = scaled - index;

  const from = waypoints[index];
  const to = waypoints[index + 1];
  const k = to.logZoom - from.logZoom;

  return {
    focusYear: from.year + (to.year - from.year) * easeSegment(t, k),
    logZoom: from.logZoom + k * t,
  };
};
