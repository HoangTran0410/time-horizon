import { MoonStar, SunMedium } from "lucide-react";
import type { ThemeMode } from "../../constants/theme";
import { LanguagePickerButton } from "../LanguagePickerButton";
import { useI18n } from "../../i18n";

type LandingFooterProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export function LandingFooter({ theme, onToggleTheme }: LandingFooterProps) {
  const { t } = useI18n();
  const ThemeIcon = theme === "dark" ? SunMedium : MoonStar;

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
        <a href="/privacy.html">{t("landingFooterPrivacy")}</a>
        <a href="/terms.html">{t("landingFooterTerms")}</a>
      </nav>

      <div className="landing-footer-actions">
        <LanguagePickerButton
          buttonClassName="landing-theme-button landing-theme-button-icon font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em]"
          textClassName="leading-none"
        />
        <button
          type="button"
          className="landing-theme-button landing-theme-button-icon"
          onClick={onToggleTheme}
          aria-label={
            theme === "dark" ? t("switchToLightTheme") : t("switchToDarkTheme")
          }
          title={theme === "dark" ? t("lightMode") : t("darkMode")}
        >
          <ThemeIcon size={18} strokeWidth={1.9} />
        </button>
      </div>
    </footer>
  );
}
