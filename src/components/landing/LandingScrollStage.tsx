import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
import type { ThemeMode } from "../../constants/theme";
import { useI18n } from "../../i18n";
import { useTimelineViewport } from "../../hooks/useTimelineViewport";
import { TimelineCanvasViewport } from "../TimelineCanvasViewport";
import { useLandingCamera } from "./useLandingCamera";
import {
  buildLandingEvents,
  LANDING_CAMERA_WAYPOINTS,
  LANDING_WAYPOINTS,
} from "./landingWaypoints";

type LandingScrollStageProps = {
  theme: ThemeMode;
  onEnterTimeline: () => void;
};

/** Scroll length per segment. One constant so the pacing is tunable in one place. */
const SEGMENT_VH = 55;

const EMPTY_DIMMED_IDS: ReadonlySet<string> = new Set();

export function LandingScrollStage({
  theme,
  onEnterTimeline,
}: LandingScrollStageProps) {
  const { t, language } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

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
    initialLogZoom: LANDING_WAYPOINTS[0].logZoom,
    orientation: "horizontal",
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
    enabled: !prefersReducedMotion && isStageVisible,
  });

  if (prefersReducedMotion) {
    return (
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
    );
  }

  const active = LANDING_WAYPOINTS[activeIndex];
  const scrollHeight = `${LANDING_WAYPOINTS.length * SEGMENT_VH}vh`;

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
            orientation="horizontal"
            verticalTimeDirection="down"
            ticks={ticks}
            timelineEvents={events}
            collapsedGroups={collapsedGroups}
            expandedCollapsedGroup={expandedCollapsedGroup}
            visibleBounds={visibleBounds}
            eventLayouts={eventLayouts}
            focusedEventId={null}
            rulerEvent={null}
            eventAccentColors={{}}
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
          <div className="landing-scroll-hint">{t("landingScrollHint")}</div>
        </div>

        <div className="landing-caption" key={active.eventUid}>
          <div className="landing-caption-time">{t(active.timeLabelKey)}</div>
          <h2 className="landing-caption-title">{t(active.titleKey)}</h2>
          <p className="landing-caption-copy">{t(active.captionKey)}</p>
        </div>
      </div>
    </div>
  );
}
