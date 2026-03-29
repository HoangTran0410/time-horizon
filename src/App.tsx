import { startTransition, useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { Timeline } from "./components/Timeline";
import { applyThemeToDocument, resolveThemeMode } from "./constants/theme";
import { useTimelineShareUrl } from "./hooks/useTimelineShareUrl";
import { useTimelineStore } from "./stores";

type AppView = "landing" | "timeline";

export default function App() {
  const theme = useTimelineStore((state) => state.theme);
  const setTheme = useTimelineStore((state) => state.setTheme);
  const resolvedTheme = resolveThemeMode(theme);
  const {
    shouldOpenTimeline,
    enterTimelineView,
    clearTimelineView,
  } = useTimelineShareUrl();
  const [view, setView] = useState<AppView>(() =>
    shouldOpenTimeline ? "timeline" : "landing",
  );

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    setView(shouldOpenTimeline ? "timeline" : "landing");
  }, [shouldOpenTimeline]);

  const handleToggleTheme = () => {
    startTransition(() => {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    });
  };

  const handleEnterTimeline = () => {
    enterTimelineView();
    setView("timeline");
  };

  const handleBackToLanding = () => {
    clearTimelineView();
    setView("landing");
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
