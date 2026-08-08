import { ArrowRight, Compass } from "lucide-react";
import { useI18n } from "../../i18n";

export function LandingCta({
  onEnterTimeline,
}: {
  onEnterTimeline: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="landing-cta">
      <h2 className="landing-cta-title">{t("landingCtaHeading")}</h2>
      <p className="landing-copy">{t("landingCtaCopy")}</p>
      <button
        type="button"
        className="landing-primary-button landing-primary-button-large"
        onClick={onEnterTimeline}
      >
        <Compass size={17} strokeWidth={2} />
        {t("enterTimeline")}
        <ArrowRight size={17} strokeWidth={2} />
      </button>
    </section>
  );
}
