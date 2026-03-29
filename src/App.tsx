import { startTransition, useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { Timeline } from "./components/Timeline";
import { applyThemeToDocument, resolveThemeMode } from "./constants/theme";
import { useTimelineStore } from "./stores";

type AppView = "landing" | "timeline";

const getInitialView = (): AppView => {
  if (typeof window === "undefined") return "landing";
  return window.location.hash === "#timeline" ? "timeline" : "landing";
};

export default function App() {
  const theme = useTimelineStore((state) => state.theme);
  const setTheme = useTimelineStore((state) => state.setTheme);
  const resolvedTheme = resolveThemeMode(theme);
  const [view, setView] = useState<AppView>(getInitialView);

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewFromHash = () => {
      setView(window.location.hash === "#timeline" ? "timeline" : "landing");
    };

    window.addEventListener("hashchange", syncViewFromHash);
    syncViewFromHash();

    return () => {
      window.removeEventListener("hashchange", syncViewFromHash);
    };
  }, []);

  const handleToggleTheme = () => {
    startTransition(() => {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    });
  };

  const handleEnterTimeline = () => {
    if (typeof window === "undefined") return;
    window.location.hash = "timeline";
  };

  const handleBackToLanding = () => {
    if (typeof window === "undefined") return;
    window.location.hash = "";
  };

  return (
    <div className="app-shell w-full h-screen">
      {view === "timeline" ? (
        <Timeline
          theme={resolvedTheme}
          onToggleTheme={handleToggleTheme}
          onBackToLanding={handleBackToLanding}
        />
      ) : (
        <LandingPage
          theme={resolvedTheme}
          onToggleTheme={handleToggleTheme}
          onEnterTimeline={handleEnterTimeline}
        />
      )}
    </div>
  );
}
