import type {
  SpatialMapTheme,
  SpatialMappingConfig,
} from "../constants/types";

export const DEFAULT_SPATIAL_METERS_PER_YEAR = 100000;
export const DEFAULT_SPATIAL_MAP_OPACITY = 1;
export const SPATIAL_MAX_SAFE_LATITUDE = 85;
export const SPATIAL_WORLD_CIRCUMFERENCE_METERS = 40_075_016.686;
const MAPLIBRE_WORLD_SIZE_PX_AT_Z0 = 512;
export const MAP_EQUATOR_METERS_PER_PIXEL_AT_Z0 =
  SPATIAL_WORLD_CIRCUMFERENCE_METERS / MAPLIBRE_WORLD_SIZE_PX_AT_Z0;
export const DEFAULT_SPATIAL_MAP_THEME: SpatialMapTheme = "dark";
export const OPEN_FREE_MAP_STYLE_URLS: Record<SpatialMapTheme, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};
export const OPEN_FREE_MAP_MIN_ZOOM = 0;
export const OPEN_FREE_MAP_MAX_ZOOM = 19;

export const DEFAULT_SPATIAL_MAPPING: SpatialMappingConfig = {
  enabled: false,
  anchorYear: null,
  anchorLat: null,
  anchorLng: null,
  metersPerYear: DEFAULT_SPATIAL_METERS_PER_YEAR,
  mapTheme: DEFAULT_SPATIAL_MAP_THEME,
  mapOpacity: DEFAULT_SPATIAL_MAP_OPACITY,
};

type SpatialCameraInput = {
  focusYear: number;
  pixelsPerYear: number;
  mapping: SpatialMappingConfig;
  mapMinZoom?: number;
  mapMaxZoom?: number;
};

export type SpatialCameraState = {
  centerLat: number;
  centerLng: number;
  mapZoom: number;
  visible: boolean;
  anchorLat: number;
  anchorLng: number;
  anchorYear: number;
  metersPerYear: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const wrapLongitude = (lng: number) => {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
};

export const clampSpatialLatitude = (value: number) =>
  clamp(value, -SPATIAL_MAX_SAFE_LATITUDE, SPATIAL_MAX_SAFE_LATITUDE);

export const sanitizeMetersPerYear = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SPATIAL_METERS_PER_YEAR;

export const sanitizeSpatialMapOpacity = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(value, 0, 1)
    : DEFAULT_SPATIAL_MAP_OPACITY;

export const sanitizeSpatialMapTheme = (value: unknown): SpatialMapTheme =>
  value === "light" ? "light" : "dark";

export const getOpenFreeMapStyleUrl = (mapTheme: SpatialMapTheme): string =>
  OPEN_FREE_MAP_STYLE_URLS[sanitizeSpatialMapTheme(mapTheme)];

export const getMetersPerYearForMapZoom = ({
  pixelsPerYear,
  latitude,
  mapZoom,
}: {
  pixelsPerYear: number;
  latitude: number;
  mapZoom: number;
}): number => {
  const safePixelsPerYear =
    Number.isFinite(pixelsPerYear) && pixelsPerYear > 0
      ? pixelsPerYear
      : DEFAULT_SPATIAL_METERS_PER_YEAR;
  const latitudeCosine = Math.max(
    Math.cos((clampSpatialLatitude(latitude) * Math.PI) / 180),
    1e-6,
  );
  const latitudeGroundResolution =
    MAP_EQUATOR_METERS_PER_PIXEL_AT_Z0 * latitudeCosine;
  const metersPerPixel =
    Number.isFinite(mapZoom)
      ? latitudeGroundResolution / Math.pow(2, mapZoom)
      : DEFAULT_SPATIAL_METERS_PER_YEAR / safePixelsPerYear;

  return sanitizeMetersPerYear(safePixelsPerYear * metersPerPixel);
};

export const sanitizeSpatialMapping = (
  value: Partial<SpatialMappingConfig> | null | undefined,
): SpatialMappingConfig => {
  const anchorLat =
    typeof value?.anchorLat === "number" && Number.isFinite(value.anchorLat)
      ? clampSpatialLatitude(value.anchorLat)
      : null;
  const anchorLng =
    typeof value?.anchorLng === "number" && Number.isFinite(value.anchorLng)
      ? wrapLongitude(value.anchorLng)
      : null;
  const anchorYear =
    typeof value?.anchorYear === "number" && Number.isFinite(value.anchorYear)
      ? value.anchorYear
      : null;

  return {
    enabled: value?.enabled === true,
    anchorYear,
    anchorLat,
    anchorLng,
    metersPerYear: sanitizeMetersPerYear(value?.metersPerYear),
    mapTheme: sanitizeSpatialMapTheme(value?.mapTheme),
    mapOpacity: sanitizeSpatialMapOpacity(value?.mapOpacity),
  };
};

export const createSpatialAnchorFromViewport = (
  focusYear: number,
  latitude: number,
  longitude: number,
): Pick<SpatialMappingConfig, "anchorYear" | "anchorLat" | "anchorLng"> => ({
  anchorYear: focusYear,
  anchorLat: clampSpatialLatitude(latitude),
  anchorLng: wrapLongitude(longitude),
});

export const formatCoordinate = (
  value: number | null,
  positiveLabel: string,
  negativeLabel: string,
) => {
  if (value === null || !Number.isFinite(value)) return "—";
  const direction = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
};

export const getSpatialCameraState = ({
  focusYear,
  pixelsPerYear,
  mapping,
  mapMinZoom = OPEN_FREE_MAP_MIN_ZOOM,
  mapMaxZoom = OPEN_FREE_MAP_MAX_ZOOM,
}: SpatialCameraInput): SpatialCameraState => {
  const safeMapping = sanitizeSpatialMapping(mapping);
  const anchorYear = safeMapping.anchorYear ?? focusYear;
  const anchorLat = safeMapping.anchorLat ?? 0;
  const anchorLng = safeMapping.anchorLng ?? 0;
  const metersPerYear = safeMapping.metersPerYear;
  const safePixelsPerYear =
    Number.isFinite(pixelsPerYear) && pixelsPerYear > 0 ? pixelsPerYear : 0;
  const latitudeCosine = Math.max(
    Math.cos((clampSpatialLatitude(anchorLat) * Math.PI) / 180),
    1e-6,
  );
  const parallelCircumference =
    SPATIAL_WORLD_CIRCUMFERENCE_METERS * latitudeCosine;
  const deltaMeters = (focusYear - anchorYear) * metersPerYear;
  const deltaLongitude = (deltaMeters / parallelCircumference) * 360;
  const centerLng = wrapLongitude(anchorLng + deltaLongitude);
  const centerLat = anchorLat;
  const metersPerPixel =
    safePixelsPerYear > 0
      ? metersPerYear / safePixelsPerYear
      : Number.POSITIVE_INFINITY;
  const latitudeGroundResolution =
    MAP_EQUATOR_METERS_PER_PIXEL_AT_Z0 * latitudeCosine;
  const mapZoom =
    Number.isFinite(metersPerPixel) && metersPerPixel > 0
      ? Math.log2(latitudeGroundResolution / metersPerPixel)
      : Number.NEGATIVE_INFINITY;
  const visible =
    safeMapping.enabled &&
    Number.isFinite(mapZoom) &&
    mapZoom >= mapMinZoom &&
    mapZoom <= mapMaxZoom;

  return {
    centerLat,
    centerLng,
    mapZoom,
    visible,
    anchorLat,
    anchorLng,
    anchorYear,
    metersPerYear,
  };
};
