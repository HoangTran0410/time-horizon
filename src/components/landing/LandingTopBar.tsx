import { useEffect, useState } from "react";
import { ArrowUp, MoonStar, SunMedium } from "lucide-react";
import type { ThemeMode } from "../../constants/theme";
import { LanguagePickerButton } from "../LanguagePickerButton";
import { useI18n } from "../../i18n";

type LandingTopBarProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

/** How far down the page the back-to-top control starts being useful. */
const BACK_TO_TOP_AFTER_PX = 900;

/**
 * Fixed brand mark and controls, pinned to the top corners for the whole page.
 *
 * These used to live only in the footer, five sections down — a visitor could
 * scroll the entire page without ever learning the site's name or finding the
 * language and theme switches.
 */
export function LandingTopBar({ theme, onToggleTheme }: LandingTopBarProps) {
  const { t } = useI18n();
  const ThemeIcon = theme === "dark" ? SunMedium : MoonStar;

  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setIsScrolled(window.scrollY > BACK_TO_TOP_AFTER_PX);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      // Honour the same accessibility preference the stage does.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <div className="landing-topbar">
      <a className="landing-topbar-brand" href="./" aria-label="Time Horizon">
        <span className="landing-mark" aria-hidden="true">
          <MoonStar size={17} strokeWidth={1.8} />
        </span>
        <span className="landing-topbar-brand-text">
          <span className="ui-kicker text-[0.58rem]">
            {t("chronologyEngine")}
          </span>
          <span className="landing-brand-title">Time Horizon</span>
        </span>
      </a>

      <div className="landing-topbar-actions">
        <button
          type="button"
          className={`landing-theme-button landing-theme-button-icon landing-topbar-totop ${
            isScrolled ? "is-visible" : ""
          }`}
          onClick={scrollToTop}
          aria-label={t("landingBackToTop")}
          title={t("landingBackToTop")}
          // Keeps it out of the tab order and off screen readers while hidden.
          tabIndex={isScrolled ? 0 : -1}
          aria-hidden={!isScrolled}
        >
          <ArrowUp size={18} strokeWidth={1.9} />
        </button>

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
    </div>
  );
}
