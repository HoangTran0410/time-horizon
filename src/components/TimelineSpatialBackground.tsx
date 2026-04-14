import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MotionValue, useMotionValueEvent } from "motion/react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type {
  SpatialMappingConfig,
  TimelineOrientation,
  VerticalTimeDirection,
} from "../constants/types";
import {
  getOpenFreeMapStyleUrl,
  getMetersPerYearForMapZoom,
  getSpatialCameraState,
  OPEN_FREE_MAP_MAX_ZOOM,
  OPEN_FREE_MAP_MIN_ZOOM,
} from "../helpers";
import { useI18n } from "../i18n";

const GENERATED_ICON_ID_PATTERN = /^(circle|circle-stroked)-(\d+)$/u;

const createGeneratedCircleIcon = (
  kind: "circle" | "circle-stroked",
  size: number,
) => {
  const dimension = Math.max(8, Math.min(64, Math.round(size)));
  const data = new Uint8Array(dimension * dimension * 4);
  const center = (dimension - 1) / 2;
  const radius = dimension * 0.28;
  const strokeWidth = Math.max(1, dimension * 0.14);

  for (let y = 0; y < dimension; y += 1) {
    for (let x = 0; x < dimension; x += 1) {
      const offset = (y * dimension + x) * 4;
      const distance = Math.hypot(x - center, y - center);
      const fillAlpha =
        kind === "circle"
          ? distance <= radius
            ? 255
            : 0
          : distance <= radius && distance >= radius - strokeWidth
            ? 255
            : 0;

      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = fillAlpha;
    }
  }

  return {
    width: dimension,
    height: dimension,
    data,
  };
};

const addGeneratedStyleImage = (map: MapLibreMap, id: string) => {
  if (map.hasImage(id)) return;
  const match = GENERATED_ICON_ID_PATTERN.exec(id);
  if (!match) return;

  const [, kind, rawSize] = match;
  const size = Number(rawSize);
  if (!Number.isFinite(size) || size <= 0) return;

  map.addImage(
    id,
    createGeneratedCircleIcon(kind as "circle" | "circle-stroked", size),
  );
};

interface TimelineSpatialBackgroundProps {
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
  orientation: TimelineOrientation;
  verticalTimeDirection: VerticalTimeDirection;
  mapping: SpatialMappingConfig;
  isAnchorPickMode: boolean;
  onStartPickMode: () => void;
  onCancelPick: () => void;
  onPickAnchor: (
    year: number,
    lat: number,
    lng: number,
    metersPerYear: number,
  ) => void;
}

export const TimelineSpatialBackground: React.FC<
  TimelineSpatialBackgroundProps
> = ({
  focusPixel,
  focusYear,
  zoom,
  orientation,
  verticalTimeDirection,
  mapping,
  isAnchorPickMode,
  onStartPickMode,
  onCancelPick,
  onPickAnchor,
}) => {
  const axisDirection =
    orientation === "vertical" && verticalTimeDirection === "up" ? -1 : 1;
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const implicitAnchorYearRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [isMapHiddenForZoom, setIsMapHiddenForZoom] = useState(false);
  const [isZoomClamped, setIsZoomClamped] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapHiddenActionDismissed, setIsMapHiddenActionDismissed] =
    useState(false);
  const showMapHiddenAction =
    mapping.enabled &&
    isMapHiddenForZoom &&
    !isAnchorPickMode &&
    !isMapHiddenActionDismissed;

  const getCenterYear = () => {
    const primarySize =
      orientation === "horizontal"
        ? (mapContainerRef.current?.clientWidth ?? window.innerWidth)
        : (mapContainerRef.current?.clientHeight ?? window.innerHeight);
    const centerPixel = primarySize / 2;
    return (
      focusYear.get() +
      (centerPixel - focusPixel.get()) / (zoom.get() * axisDirection)
    );
  };

  const applyInteractionMode = (map: MapLibreMap, isInteractive: boolean) => {
    if (isInteractive) {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.keyboard.enable();
      return;
    }

    map.dragPan.disable();
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.keyboard.disable();
  };

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: getOpenFreeMapStyleUrl(mapping.mapTheme),
      center: [0, 0],
      zoom: OPEN_FREE_MAP_MIN_ZOOM,
      minZoom: OPEN_FREE_MAP_MIN_ZOOM,
      maxZoom: OPEN_FREE_MAP_MAX_ZOOM,
      interactive: true,
      attributionControl: false,
      fadeDuration: 0,
    });

    map.setRenderWorldCopies(true);
    applyInteractionMode(map, isAnchorPickMode);
    mapRef.current = map;

    const handleLoad = () => {
      setMapError(null);
      setIsReady(true);
      map.resize();
      requestAnimationFrame(() => {
        map.resize();
      });
    };
    const handleError = (event: { error?: { message?: string } }) => {
      const nextMessage = event.error?.message?.trim();
      setMapError(nextMessage || "Map failed to load");
    };
    const handleStyleImageMissing = (event: { id: string }) => {
      addGeneratedStyleImage(map, event.id);
    };

    map.on("load", handleLoad);
    map.on("error", handleError);
    map.on("styleimagemissing", handleStyleImageMissing);

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.off("styleimagemissing", handleStyleImageMissing);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyInteractionMode(map, isAnchorPickMode);
  }, [isAnchorPickMode]);

  useEffect(() => {
    if (isAnchorPickMode) {
      setIsMapHiddenActionDismissed(true);
      return;
    }

    setIsMapHiddenActionDismissed(false);
  }, [isAnchorPickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextStyleUrl = getOpenFreeMapStyleUrl(mapping.mapTheme);
    map.setStyle(nextStyleUrl);
  }, [mapping.mapTheme]);

  useEffect(() => {
    if (mapping.anchorYear !== null) {
      implicitAnchorYearRef.current = mapping.anchorYear;
      return;
    }

    if (mapping.enabled || isAnchorPickMode) {
      implicitAnchorYearRef.current ??= getCenterYear();
      return;
    }

    implicitAnchorYearRef.current = null;
  }, [
    axisDirection,
    focusYear,
    isAnchorPickMode,
    mapping.anchorYear,
    mapping.enabled,
    orientation,
  ]);

  const syncCamera = () => {
    syncFrameRef.current = null;
    const map = mapRef.current;
    if (!map) return;

    const centerYear = getCenterYear();
    const effectiveAnchorYear =
      mapping.anchorYear ?? implicitAnchorYearRef.current ?? centerYear;

    const nextCamera = getSpatialCameraState({
      focusYear: centerYear,
      pixelsPerYear: zoom.get(),
      mapping: {
        ...mapping,
        anchorYear: effectiveAnchorYear,
      },
    });
    const isWithinMapZoomRange = nextCamera.visible;
    const shouldForceVisible = isAnchorPickMode;
    const shouldShowMap =
      shouldForceVisible || (mapping.enabled && isWithinMapZoomRange);

    setIsMapHiddenForZoom(mapping.enabled && !isWithinMapZoomRange);
    setIsZoomClamped(shouldForceVisible && !isWithinMapZoomRange);
    setIsMapVisible(shouldShowMap);

    if (!shouldShowMap) {
      return;
    }

    map.resize();
    map.jumpTo({
      center: [nextCamera.centerLng, nextCamera.centerLat],
      zoom: Math.min(
        OPEN_FREE_MAP_MAX_ZOOM,
        Math.max(
          OPEN_FREE_MAP_MIN_ZOOM,
          Number.isFinite(nextCamera.mapZoom)
            ? nextCamera.mapZoom
            : OPEN_FREE_MAP_MIN_ZOOM,
        ),
      ),
    });
  };

  const scheduleSync = () => {
    if (syncFrameRef.current !== null) return;
    syncFrameRef.current = window.requestAnimationFrame(syncCamera);
  };

  useEffect(() => {
    if (!isReady) return;
    scheduleSync();
    return () => {
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
        syncFrameRef.current = null;
      }
    };
  }, [isReady, mapping, isAnchorPickMode]);

  useMotionValueEvent(focusYear, "change", () => {
    if (isReady) scheduleSync();
  });

  useMotionValueEvent(focusPixel, "change", () => {
    if (isReady) scheduleSync();
  });

  useMotionValueEvent(zoom, "change", () => {
    if (isReady) scheduleSync();
  });

  const confirmCenterPick = () => {
    if (!isAnchorPickMode) return;
    const map = mapRef.current;
    if (!map) return;
    const lngLat = map.getCenter();
    onPickAnchor(
      getCenterYear(),
      lngLat.lat,
      lngLat.lng,
      getMetersPerYearForMapZoom({
        pixelsPerYear: zoom.get(),
        latitude: lngLat.lat,
        mapZoom: Math.min(
          OPEN_FREE_MAP_MAX_ZOOM,
          Math.max(OPEN_FREE_MAP_MIN_ZOOM, map.getZoom()),
        ),
      }),
    );
  };

  return (
    <>
      <div
        className={[
          "absolute inset-0 overflow-hidden",
          isAnchorPickMode
            ? "z-20 pointer-events-auto"
            : "z-0 pointer-events-none",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!isAnchorPickMode}
      >
        <div
          ref={mapContainerRef}
          className="absolute inset-0 h-full w-full transition-opacity duration-200"
          style={{
            opacity: isMapVisible ? mapping.mapOpacity : 0,
          }}
          data-spatial-map-container="true"
          onWheel={(event) => {
            if (isAnchorPickMode) {
              event.stopPropagation();
            }
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-slate-950/8 transition-opacity duration-200"
          style={{
            opacity: isMapVisible && !mapError ? mapping.mapOpacity : 0,
          }}
          data-spatial-map-overlay="scrim"
        />
        {mapping.enabled ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-950/18 via-slate-950/6 to-transparent transition-opacity duration-200"
            style={{
              opacity: isMapVisible && !mapError ? mapping.mapOpacity : 0,
            }}
            data-spatial-map-overlay="gradient"
          />
        ) : null}
        {isAnchorPickMode ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-none relative flex h-10 w-10 items-center justify-center">
              <div className="absolute h-px w-10 bg-amber-200/85" />
              <div className="absolute h-10 w-px bg-amber-200/85" />
              <div className="absolute h-3 w-3 rounded-full border border-amber-100 bg-amber-300/30 shadow-[0_0_24px_rgba(252,211,77,0.42)]" />
            </div>
            <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-amber-200/25 bg-slate-950/88 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-100 shadow-lg backdrop-blur-sm">
              {t("positionMapAnchor")}
            </div>
            <div className="pointer-events-auto absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
              <button
                type="button"
                onClick={onCancelPick}
                className="ui-button ui-button-secondary min-w-[8.5rem] justify-center"
              >
                {t("cancelPickMode")}
              </button>
              <button
                type="button"
                onClick={confirmCenterPick}
                className="ui-button ui-button-primary min-w-[8.5rem] justify-center"
              >
                {t("applyMapView")}
              </button>
            </div>
          </div>
        ) : null}
        {mapping.enabled && !isReady && !mapError ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
            <div className="rounded-full border border-slate-200/10 bg-slate-950/82 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-200/70">
              Loading map…
            </div>
          </div>
        ) : null}
        {mapping.enabled && mapError ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
            <div className="rounded-2xl border border-rose-300/20 bg-slate-950/88 px-4 py-3 text-center text-[0.72rem] leading-5 text-rose-100 shadow-lg">
              {mapError}
            </div>
          </div>
        ) : null}
        {/* {mapping.enabled && isZoomClamped ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
            <div className="rounded-full border border-slate-200/10 bg-slate-950/82 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-200/70">
              {t("mapScaleClamped")}
            </div>
          </div>
        ) : null} */}
      </div>
      {showMapHiddenAction && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onTouchStart={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setIsMapHiddenActionDismissed(true);
                onStartPickMode();
              }}
              className="ui-button ui-button-compact ui-button-secondary fixed bottom-5 left-1/2 z-[220] -translate-x-1/2 px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] hover:translate-x-[-50%] hover:translate-y-0"
              title={t("pickCurrentTimeOnMap")}
              aria-label={t("pickCurrentTimeOnMap")}
            >
              {t("mapHiddenAtCurrentZoom")}
            </button>,
            document.body,
          )
        : null}
    </>
  );
};
