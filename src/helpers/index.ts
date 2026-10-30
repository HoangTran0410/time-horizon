/**
 * Shared helpers, grouped by concern into the modules re-exported below.
 * Import from "../helpers" as before; the split is purely organisational.
 */

export {
  normalizeEventTimeParts,
  eventTimeToTimelineYear,
  getEventTimelineYear,
  getCurrentTimelineYear,
  getEventTimelineEndYear,
  getEventTimelineRange,
  isSpanEvent,
  DAY_IN_YEARS,
  HOUR_IN_YEARS,
  MINUTE_IN_YEARS,
  SECOND_IN_YEARS,
  getEventSpanLengthYears,
  getAbsoluteYearFromDateJump,
} from "./time";

export {
  formatYear,
  formatTimelineTimeLabel,
  getEventDisplayLabel,
  ONGOING_END_LABELS,
  getEventEndDisplayLabel,
  formatElapsedTimelineTime,
  formatZoomRangeLabel,
} from "./timeFormat";

export {
  getNiceInterval,
  getTickIntervalThatFitsLabels,
  formatTick,
  formatTimelineTick,
  generateCalendarTimelineTickYears,
  generateSubDayTimelineTickYears,
  getTimelineHighlightStep,
  isHighlightedTimelineTick,
  getStableTickLabelWidthEstimate,
} from "./ticks";

export {
  slugifyCollectionId,
  slugifyCollectionName,
  createLocalDateStamp,
  assignRuntimeEventIds,
  stripRuntimeEventId,
  stripRuntimeEventIds,
  createNewTimelineEvent,
  buildCustomCollectionMeta,
} from "./eventIds";

export {
  normalizeImageUrl,
  normalizeEmbedVideoUrl,
  normalizeExternalLinkUrl,
} from "./mediaUrls";

export { withAlpha } from "./color";

export {
  getTimelineLayoutLevelCount,
  getTimelineLayoutLevels,
  getCollapsedGroupOffset,
  resolveZoomFixedPointPixel,
  DRAG_INERTIA_MIN_VELOCITY,
  DRAG_INERTIA_MAX_IDLE_MS,
  PINCH_TAIL_INERTIA_MIN_MS,
  PINCH_TAIL_INERTIA_MIN_PX,
  shouldStartDragInertia,
  areCollapsedGroupsEqual,
  type TimelineCameraSample,
  type DragInertiaRelease,
} from "./viewportMath";

export {
  clampSpatialLatitude,
  createSpatialAnchorFromViewport,
  DEFAULT_SPATIAL_MAPPING,
  DEFAULT_SPATIAL_MAP_THEME,
  DEFAULT_SPATIAL_MAP_OPACITY,
  DEFAULT_SPATIAL_METERS_PER_YEAR,
  formatCoordinate,
  getOpenFreeMapStyleUrl,
  getMetersPerYearForMapZoom,
  getSpatialCameraState,
  MAP_EQUATOR_METERS_PER_PIXEL_AT_Z0,
  OPEN_FREE_MAP_MAX_ZOOM,
  OPEN_FREE_MAP_MIN_ZOOM,
  sanitizeMetersPerYear,
  sanitizeSpatialMapTheme,
  sanitizeSpatialMapOpacity,
  sanitizeSpatialMapping,
  SPATIAL_MAX_SAFE_LATITUDE,
  SPATIAL_WORLD_CIRCUMFERENCE_METERS,
} from "./spatialMapping";

export {
  createCardPacker,
  getEventCardFootprint,
  getEventPackingRects,
  getSpanMarkerPrimary,
  VERTICAL_SIDE_LABEL_MIN_WIDTH,
  type PackingRect,
} from "./eventPacking";
