import { ArrowRight, Compass } from "lucide-react";
import { useI18n } from "../../i18n";

/**
 * The hero block: kicker, title, subtitle, primary CTA and the stat row.
 *
 * Shared by three paths — it sits over the canvas on the animated stage, stands
 * in for it while that stage's chunk downloads, and stands alone above the
 * static list under reduced motion. Reduced-motion users were previously
 * getting the moments list with no title and no CTA at all.
 *
 * It lives in its own module so the two eager paths do not have to reach into
 * the lazily loaded stage to render it.
 */
export function LandingHeroContent({
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
