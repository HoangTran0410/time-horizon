import { MoonStar } from "lucide-react";
import { useI18n } from "../../i18n";

/**
 * Language and theme controls deliberately live in `LandingTopBar`, not here —
 * a visitor should not have to reach the bottom of a five-section page to find
 * them.
 */
export function LandingFooter() {
  const { t } = useI18n();

  return (
    <footer className="landing-footer">
      <div className="landing-footer-brand">
        <div className="landing-mark">
          <MoonStar size={16} strokeWidth={1.8} />
        </div>
        <div>
          <div className="ui-kicker text-[0.62rem]">
            {t("chronologyEngine")}
          </div>
          <div className="landing-brand-title">Time Horizon</div>
        </div>
      </div>

      <nav className="landing-footer-links">
        <a href="https://github.com/HoangTran0410/time-horizon">
          {t("landingFooterSource")}
        </a>
        <a href="https://github.com/HoangTran0410/time-horizon-data">
          {t("landingFooterData")}
        </a>
        {/* Relative, not root-absolute: `base: "./"` and the site is served
            from a subpath (…/time-horizon/), where "/privacy.html" 404s. */}
        <a href="./privacy.html">{t("landingFooterPrivacy")}</a>
        <a href="./terms.html">{t("landingFooterTerms")}</a>
      </nav>
    </footer>
  );
}
