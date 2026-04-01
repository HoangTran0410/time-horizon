import {
  ArrowRight,
  Clock3,
  Compass,
  Database,
  Layers3,
  MoonStar,
  Orbit,
  Sparkles,
  SunMedium,
  Telescope,
} from "lucide-react";
import { ThemeMode } from "../constants/theme";

type LandingPageProps = {
  theme: ThemeMode;
  collectionCount: number;
  onToggleTheme: () => void;
  onEnterTimeline: () => void;
};

const previewMoments = [
  { year: "13.8B years ago", title: "Big Bang", tone: "emerald" },
  { year: "4.54B years ago", title: "Earth forms", tone: "amber" },
  { year: "66M years ago", title: "Dinosaurs vanish", tone: "zinc" },
  { year: "1969", title: "Moon landing", tone: "emerald" },
  { year: "Right now", title: "Your own custom events", tone: "amber" },
] as const;

const featureCards = [
  {
    icon: Telescope,
    eyebrow: "Scale Shift",
    title: "Zoom from deep time to one life.",
    copy: "Move from billions of years to a single moment in seconds.",
  },
  {
    icon: Layers3,
    eyebrow: "Curated Layers",
    title: "Mix eras, people, and ideas.",
    copy: "Place multiple collections on one shared timeline.",
  },
  {
    icon: Clock3,
    eyebrow: "Focus Mode",
    title: "Focus without losing context.",
    copy: "Nearby events stay visible while you inspect one point in time.",
  },
] as const;

const stats = [
  {
    icon: Database,
    label: "Collections ready",
    value: "38+",
  },
  {
    icon: Orbit,
    label: "Time span",
    value: "13.8B+ yrs",
  },
  {
    icon: Sparkles,
    label: "Custom events",
    value: "Yours",
  },
] as const;

export function LandingPage({
  theme,
  collectionCount,
  onToggleTheme,
  onEnterTimeline,
}: LandingPageProps) {
  const ThemeIcon = theme === "dark" ? SunMedium : MoonStar;

  return (
    <div className="landing-shell relative min-h-screen overflow-hidden text-zinc-50">
      <div className="landing-orbit landing-orbit-left" aria-hidden="true" />
      <div className="landing-orbit landing-orbit-right" aria-hidden="true" />

      <div className="landing-noise absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
        <header className="landing-nav landing-reveal landing-delay-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="landing-mark flex h-11 w-11 items-center justify-center rounded-full">
              <MoonStar size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="ui-kicker text-[0.62rem]">Chronology Engine</div>
              <div className="landing-brand-title font-semibold tracking-[0.02em] text-zinc-100">
                Time Horizon
              </div>
            </div>
          </div>

          <div className="landing-nav-actions flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="landing-theme-button landing-theme-button-icon"
              onClick={onToggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              <ThemeIcon size={18} strokeWidth={1.9} />
            </button>
          </div>
        </header>

        <main className="grid flex-1 gap-8 py-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-center lg:gap-10 lg:py-10">
          <section className="landing-reveal landing-delay-2 flex flex-col justify-center">
            <div className="landing-kicker-row">
              <span className="landing-kicker-icon" aria-hidden="true">
                <Sparkles size={14} strokeWidth={2} />
              </span>
              <span className="ui-kicker">Interactive history atlas</span>
              <span className="landing-kicker-line" aria-hidden="true" />
            </div>

            <h1 className="ui-display-title landing-title mt-6 max-w-4xl text-5xl leading-[0.94] sm:text-6xl lg:text-7xl">
              History.
              <br />
              One line.
            </h1>

            <p className="landing-copy mt-6 max-w-2xl text-base sm:text-lg">
              From the Big Bang to modern history, all in one place.
            </p>

            <div className="landing-action-row mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="landing-primary-button landing-primary-button-large"
                onClick={onEnterTimeline}
              >
                <Compass size={17} strokeWidth={2} />
                Enter Timeline
                <ArrowRight size={17} strokeWidth={2} />
              </button>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`landing-stat-card landing-reveal landing-delay-${index + 3}`}
                >
                  <div className="landing-stat-icon">
                    <stat.icon size={16} strokeWidth={1.9} />
                  </div>
                  <div className="landing-stat-value">{stat.value}</div>
                  <div className="landing-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-reveal landing-delay-4">
            <div className="landing-preview-panel">
              <div className="landing-preview-topline">
                <span className="ui-kicker">Preview Trajectory</span>
                <div className="landing-live-pill">
                  <Sparkles size={14} strokeWidth={1.9} />
                  Context stays visible
                </div>
              </div>

              <div className="landing-preview-axis" aria-hidden="true">
                <div className="landing-preview-axis-line" />
                {previewMoments.map((moment, index) => (
                  <div
                    key={moment.title}
                    className={`landing-preview-node landing-preview-node-${moment.tone}`}
                    style={{ top: `${10 + index * 19}%` }}
                  />
                ))}
              </div>

              <div className="landing-preview-list">
                {previewMoments.map((moment) => (
                  <article key={moment.title} className="landing-preview-item">
                    <div className="landing-preview-year">{moment.year}</div>
                    <div className="landing-preview-title">{moment.title}</div>
                  </article>
                ))}
              </div>

              <div className="landing-preview-footer">
                Jump to any event and still see what happened around it.
              </div>
            </div>
          </section>
        </main>

        <section className="landing-feature-grid">
          {featureCards.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className={`landing-feature-card landing-reveal landing-delay-${index + 4}`}
              >
                <div className="landing-feature-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div className="ui-kicker">{feature.eyebrow}</div>
                <h2 className="landing-feature-title">{feature.title}</h2>
                <p className="landing-feature-copy">{feature.copy}</p>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
