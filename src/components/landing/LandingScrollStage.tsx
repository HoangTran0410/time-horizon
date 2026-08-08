import { lazy, Suspense, useEffect, useState } from "react";
import type { ThemeMode } from "../../constants/theme";
import { useI18n } from "../../i18n";
import { LandingHeroContent } from "./LandingHeroContent";
import { LANDING_TRACK_HEIGHT } from "./landingStageLayout";
import { LANDING_WAYPOINTS } from "./landingWaypoints";

type LandingScrollStageProps = {
  theme: ThemeMode;
  /** Catalog size, shown in the hero stat row. 0 while the catalog is loading. */
  collectionCount: number;
  onEnterTimeline: () => void;
};

/**
 * The canvas stage carries the timeline engine — the viewport hook, the canvas
 * renderer and their share of `motion`. That is the heaviest thing on the page
 * and none of it is needed to paint the hero, which is what a visitor actually
 * sees first: the canvas sits behind it and only surfaces 14vh into the scroll.
 * Loading it separately lets the hero paint against the entry chunk alone.
 *
 * Reduced-motion visitors never mount it, so they never download it either.
 */
const LandingCanvasStage = lazy(() =>
  import("./LandingCanvasStage").then((module) => ({
    default: module.LandingCanvasStage,
  })),
);

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const readPrefersReducedMotion = (): boolean =>
  typeof window === "undefined"
    ? false
    : window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * The stage before its chunk lands: the hero, in its final position, over the
 * full-height scroll track.
 *
 * It matters that this is the *same* markup the live stage wraps its canvas in.
 * Rendering nothing would leave the page a couple of screens tall and then grow
 * it by six, throwing the scroll position and the hero's own scroll-driven
 * dissolve. Reserving the height means the swap changes nothing but the canvas
 * fading in behind.
 */
function LandingStageSkeleton({
  collectionCount,
  onEnterTimeline,
}: Omit<LandingScrollStageProps, "theme">) {
  const { t } = useI18n();

  return (
    <div className="landing-scroll-track" style={{ height: LANDING_TRACK_HEIGHT }}>
      <div className="landing-sticky-stage">
        <div className="landing-stage-scrim" aria-hidden="true" />

        <div className="landing-hero-overlay">
          <LandingHeroContent
            collectionCount={collectionCount}
            onEnterTimeline={onEnterTimeline}
          >
            <div className="landing-scroll-hint">{t("landingScrollHint")}</div>
          </LandingHeroContent>
        </div>
      </div>
    </div>
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
          <h2 className="landing-moments-heading">
            {t("landingMomentsHeading")}
          </h2>
          <ol className="landing-moments-list">
            {LANDING_WAYPOINTS.map((waypoint) => (
              <li key={waypoint.eventUid} className="landing-moment">
                <div className="landing-moment-time">
                  {t(waypoint.timeLabelKey)}
                </div>
                <h3 className="landing-moment-title">{t(waypoint.titleKey)}</h3>
                <p className="landing-moment-caption">
                  {t(waypoint.captionKey)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </>
    );
  }

  return (
    <Suspense
      fallback={
        <LandingStageSkeleton
          collectionCount={collectionCount}
          onEnterTimeline={onEnterTimeline}
        />
      }
    >
      <LandingCanvasStage
        theme={theme}
        collectionCount={collectionCount}
        onEnterTimeline={onEnterTimeline}
      />
    </Suspense>
  );
}
