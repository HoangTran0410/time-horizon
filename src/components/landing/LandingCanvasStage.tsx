import { useEffect, useMemo, useRef, useState } from "react";
import type { ThemeMode } from "../../constants/theme";
import { useI18n } from "../../i18n";
import { useAutoTimelineOrientation } from "../../hooks/useAutoTimelineOrientation";
import { useTimelineViewport } from "../../hooks/useTimelineViewport";
import { TimelineCanvasViewport } from "../TimelineCanvasViewport";
import { WarpOverlay } from "../TimelineMarkers";
import {
  LANDING_REFERENCE_AXIS_PX,
  resolveLandingAxisLogZoom,
} from "./landingCamera";
import { LandingHeroContent } from "./LandingHeroContent";
import { INTRO_HOLD_FRACTION, LANDING_TRACK_HEIGHT } from "./landingStageLayout";
import { useLandingCamera } from "./useLandingCamera";
import { useLandingZoomWarp } from "./useLandingZoomWarp";
import {
  buildLandingEvents,
  LANDING_CAMERA_WAYPOINTS,
  LANDING_WAYPOINTS,
} from "./landingWaypoints";

export type LandingCanvasStageProps = {
  theme: ThemeMode;
  /** Catalog size, shown in the hero stat row. 0 while the catalog is loading. */
  collectionCount: number;
  onEnterTimeline: () => void;
};

const EMPTY_DIMMED_IDS: ReadonlySet<string> = new Set();
/** Stable identity: this lands in dependency arrays inside the canvas viewport. */
const EMPTY_EVENT_ACCENT_COLORS: Record<string, string | null> = {};

/**
 * The live stage. Split out so it is only ever *mounted* when motion is
 * allowed — `useTimelineViewport` runs an unconditional rAF loop for FPS
 * sampling, and calling it above the reduced-motion early return would keep
 * that loop alive at 60Hz for users who only ever see the static list.
 */
export function LandingCanvasStage({
  theme,
  collectionCount,
  onEnterTimeline,
}: LandingCanvasStageProps) {
  const { t, language } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // A phone-width stage cannot show a horizontal timeline usefully — the same
  // reasoning that flips the app itself, applied to the preview.
  const orientation = useAutoTimelineOrientation();

  // Length of the axis time runs along. Feeds the zoom rescale, so the scripted
  // framing survives both orientations and every viewport size.
  const [axisPx, setAxisPx] = useState(() =>
    typeof window === "undefined"
      ? LANDING_REFERENCE_AXIS_PX
      : orientation === "vertical"
        ? window.innerHeight
        : window.innerWidth,
  );
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const sync = () => {
      const rect = node.getBoundingClientRect();
      const measured = orientation === "vertical" ? rect.height : rect.width;
      if (measured > 0) setAxisPx(measured);
    };
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [orientation]);

  const [isStageVisible, setIsStageVisible] = useState(true);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStageVisible(entry.isIntersecting),
      { rootMargin: "10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Titles and descriptions are stored as i18n keys; resolve them here so the
  // canvas draws real localized text and re-draws when the language changes.
  const events = useMemo(
    () =>
      buildLandingEvents().map((event) => ({
        ...event,
        title: t(event.title as string),
        description: t(event.description as string),
      })),
    // `t` is stable per language; language is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  const {
    focusPixel,
    focusYear,
    zoom,
    currentLogZoom,
    warpPivot,
    ticks,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds,
    eventLayouts,
    recordRenderFrame,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeClickSuppression,
    handleFocusBigBang,
    handleFocusEvent,
    handleFocusCollapsedGroup,
  } = useTimelineViewport({
    containerRef,
    renderedTimelineEvents: events,
    selectedEventId: null,
    dimmedEventIds: EMPTY_DIMMED_IDS,
    // Boot straight at the first waypoint instead of running auto-fit.
    initialFocusYear: LANDING_WAYPOINTS[0].year,
    initialLogZoom: resolveLandingAxisLogZoom(
      LANDING_WAYPOINTS[0].logZoom,
      axisPx,
    ),
    orientation,
    verticalWheelBehavior: "pan",
    verticalTimeDirection: "down",
    onSelectEvent: () => {},
    setIsRulerActive: () => {},
  });

  const { activeIndex } = useLandingCamera({
    scrollRef,
    waypoints: LANDING_CAMERA_WAYPOINTS,
    focusYear,
    logZoom: currentLogZoom,
    axisPx,
    introHoldFraction: INTRO_HOLD_FRACTION,
    enabled: isStageVisible,
  });

  const warp = useLandingZoomWarp(currentLogZoom);

  const active = LANDING_WAYPOINTS[activeIndex];

  return (
    <div
      ref={scrollRef}
      className="landing-scroll-track"
      style={{ height: LANDING_TRACK_HEIGHT }}
    >
      <div className="landing-sticky-stage">
        <div
          ref={containerRef}
          className="landing-stage-canvas"
          aria-label={t("landingStageAriaLabel")}
          role="img"
        >
          <TimelineCanvasViewport
            theme={theme}
            language={language}
            containerRef={containerRef}
            isInteractionDisabled
            focusPixel={focusPixel}
            focusYear={focusYear}
            zoom={zoom}
            orientation={orientation}
            verticalTimeDirection="down"
            ticks={ticks}
            timelineEvents={events}
            collapsedGroups={collapsedGroups}
            expandedCollapsedGroup={expandedCollapsedGroup}
            visibleBounds={visibleBounds}
            eventLayouts={eventLayouts}
            focusedEventId={null}
            rulerEvent={null}
            eventAccentColors={EMPTY_EVENT_ACCENT_COLORS}
            onRenderFrame={recordRenderFrame}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            consumeClickSuppression={consumeClickSuppression}
            onFocusBigBang={handleFocusBigBang}
            onFocusEvent={handleFocusEvent}
            onFocusCollapsedGroup={handleFocusCollapsedGroup}
          />
        </div>

        {/* Wrapped so it inherits the stage's scroll reveal — the overlay is
            fixed to the viewport and would otherwise draw over the hero on the
            first screen, before the timeline itself has appeared. */}
        <div className="landing-warp-layer">
          <WarpOverlay
            isWarping={warp.isWarping}
            mode={warp.mode}
            direction={1}
            theme={theme}
            zoom={warp.zoom}
            orientation={orientation}
            zoomPivot={warpPivot}
          />
        </div>

        <div className="landing-stage-scrim" aria-hidden="true" />

        <div className="landing-hero-overlay">
          <LandingHeroContent
            collectionCount={collectionCount}
            onEnterTimeline={onEnterTimeline}
          >
            <div className="landing-scroll-hint">{t("landingScrollHint")}</div>
          </LandingHeroContent>
        </div>

        {/* The opening waypoint used to be hidden from assistive tech, on the
            grounds that its caption was never really on screen — the camera had
            already moved on by the time the reveal finished. The intro hold
            makes it a stop like any other, so it gets announced like one. */}
        <div className="landing-caption-layer">
          <div className="landing-caption" key={active.eventUid}>
            <div className="landing-caption-time">{t(active.timeLabelKey)}</div>
            <h2 className="landing-caption-title">{t(active.titleKey)}</h2>
            <p className="landing-caption-copy">{t(active.captionKey)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
