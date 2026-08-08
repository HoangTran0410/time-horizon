import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
import type { ThemeMode } from "../../constants/theme";
import { useI18n } from "../../i18n";
import { useAutoTimelineOrientation } from "../../hooks/useAutoTimelineOrientation";
import { useTimelineViewport } from "../../hooks/useTimelineViewport";
import { TimelineCanvasViewport } from "../TimelineCanvasViewport";
import {
  LANDING_REFERENCE_AXIS_PX,
  resolveLandingAxisLogZoom,
} from "./landingCamera";
import { LandingZoomGauge } from "./LandingZoomGauge";
import { useLandingCamera } from "./useLandingCamera";
import {
  buildLandingEvents,
  LANDING_CAMERA_WAYPOINTS,
  LANDING_WAYPOINTS,
} from "./landingWaypoints";

type LandingScrollStageProps = {
  theme: ThemeMode;
  /** Catalog size, shown in the hero stat row. 0 while the catalog is loading. */
  collectionCount: number;
  onEnterTimeline: () => void;
};

/** Scroll length per segment. One constant so the pacing is tunable in one place. */
const SEGMENT_VH = 55;

const EMPTY_DIMMED_IDS: ReadonlySet<string> = new Set();
/** Stable identity: this lands in dependency arrays inside the canvas viewport. */
const EMPTY_EVENT_ACCENT_COLORS: Record<string, string | null> = {};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const readPrefersReducedMotion = (): boolean =>
  typeof window === "undefined"
    ? false
    : window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * The hero block: kicker, title, subtitle, primary CTA and the stat row.
 *
 * Shared by both paths — it sits over the canvas on the animated stage, and
 * stands alone above the static list under reduced motion. Reduced-motion users
 * were previously getting the moments list with no title and no CTA at all.
 */
function LandingHeroContent({
  collectionCount,
  onEnterTimeline,
  children,
}: {
  collectionCount: number;
  onEnterTimeline: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();

  const stats = [
    {
      // Falls back to a static claim rather than "0" while the catalog loads
      // or when the fetch failed outright.
      value: collectionCount > 0 ? `${collectionCount}+` : "—",
      label: t("collectionsReady"),
    },
    { value: "13.8B+", label: t("timeSpan") },
    { value: t("yours"), label: t("customEvents") },
  ];

  return (
    <>
      <div className="ui-kicker">{t("landingHeroKicker")}</div>
      <h1 className="ui-display-title landing-title">
        {t("historyOneLine")
          .split("\n")
          .map((line, index, lines) => (
            <span key={line} className="landing-title-line">
              {line}
              {index < lines.length - 1 ? <br /> : null}
            </span>
          ))}
      </h1>
      <p className="landing-copy">{t("landingSubtitle")}</p>
      <button
        type="button"
        className="landing-primary-button landing-primary-button-large"
        onClick={onEnterTimeline}
      >
        <Compass size={17} strokeWidth={2} />
        {t("enterTimeline")}
        <ArrowRight size={17} strokeWidth={2} />
      </button>

      <div className="landing-hero-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="landing-hero-stat">
            <div className="landing-hero-stat-value">{stat.value}</div>
            <div className="landing-hero-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {children}
    </>
  );
}

export function LandingScrollStage({
  theme,
  collectionCount,
  onEnterTimeline,
}: LandingScrollStageProps) {
  const { t } = useI18n();

  // Lazy initialiser, so the very first commit already knows the answer. Read
  // it in an effect instead and reduced-motion users would briefly mount the
  // canvas stage — sizing a canvas and booting the engine — before it swaps out.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    readPrefersReducedMotion,
  );
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (prefersReducedMotion) {
    return (
      <>
        <section className="landing-static-hero">
          <LandingHeroContent
            collectionCount={collectionCount}
            onEnterTimeline={onEnterTimeline}
          />
        </section>

        <section className="landing-moments">
        <h2 className="landing-moments-heading">{t("landingMomentsHeading")}</h2>
        <ol className="landing-moments-list">
          {LANDING_WAYPOINTS.map((waypoint) => (
            <li key={waypoint.eventUid} className="landing-moment">
              <div className="landing-moment-time">{t(waypoint.timeLabelKey)}</div>
              <h3 className="landing-moment-title">{t(waypoint.titleKey)}</h3>
              <p className="landing-moment-caption">{t(waypoint.captionKey)}</p>
            </li>
          ))}
        </ol>
        </section>
      </>
    );
  }

  return (
    <LandingCanvasStage
      theme={theme}
      collectionCount={collectionCount}
      onEnterTimeline={onEnterTimeline}
    />
  );
}

/**
 * The live stage. Split out so it is only ever *mounted* when motion is
 * allowed — `useTimelineViewport` runs an unconditional rAF loop for FPS
 * sampling, and calling it above the reduced-motion early return would keep
 * that loop alive at 60Hz for users who only ever see the static list.
 */
function LandingCanvasStage({
  theme,
  collectionCount,
  onEnterTimeline,
}: LandingScrollStageProps) {
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
    enabled: isStageVisible,
  });

  const active = LANDING_WAYPOINTS[activeIndex];
  const scrollHeight = `${LANDING_WAYPOINTS.length * SEGMENT_VH}vh`;

  // The gauge arc spans the tour's own zoom range, rescaled onto this axis the
  // same way the camera is — otherwise a phone would start the arc off-scale.
  const gaugeRange = useMemo(
    () =>
      [
        resolveLandingAxisLogZoom(LANDING_WAYPOINTS[0].logZoom, axisPx),
        resolveLandingAxisLogZoom(
          LANDING_WAYPOINTS[LANDING_WAYPOINTS.length - 1].logZoom,
          axisPx,
        ),
      ] as const,
    [axisPx],
  );

  return (
    <div
      ref={scrollRef}
      className="landing-scroll-track"
      style={{ height: scrollHeight }}
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

        <div className="landing-stage-scrim" aria-hidden="true" />

        <div className="landing-hero-overlay">
          <LandingHeroContent
            collectionCount={collectionCount}
            onEnterTimeline={onEnterTimeline}
          >
            <div className="landing-scroll-hint">{t("landingScrollHint")}</div>
          </LandingHeroContent>
        </div>

        <div className="landing-zoom-gauge-layer">
          <LandingZoomGauge
            logZoom={currentLogZoom}
            axisPx={axisPx}
            range={gaugeRange}
          />
        </div>

        <div className="landing-caption-layer" aria-hidden={activeIndex === 0}>
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
