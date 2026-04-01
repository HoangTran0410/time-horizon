import { startTransition, useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { Timeline } from "./components/Timeline";
import { applyThemeToDocument, resolveThemeMode } from "./constants/theme";
import { useCatalogCollections } from "./hooks/useCatalogCollections";
import { useTimelineShareUrl } from "./hooks/useTimelineShareUrl";
import { useStore } from "./stores";

type AppView = "landing" | "timeline";

export default function App() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const setLastOpenedView = useStore((state) => state.setLastOpenedView);
  const setCatalogMeta = useStore((state) => state.setCatalogMeta);
  const resolvedTheme = resolveThemeMode(theme);

  // Fetch catalog metadata once at app root
  const { catalogCollections, isCatalogLoading } = useCatalogCollections();

  // Sync catalog metadata into store so Timeline/Sidebar can use it
  useEffect(() => {
    if (!isCatalogLoading && catalogCollections.length > 0) {
      const meta: Record<string, (typeof catalogCollections)[number]> = {};
      const ids: string[] = [];
      for (const item of catalogCollections) {
        meta[item.id] = item;
        ids.push(item.id);
      }
      setCatalogMeta(
        meta as Record<string, import("./constants/types").EventCollectionMeta>,
        ids,
      );
    }
  }, [isCatalogLoading, catalogCollections, setCatalogMeta]);

  const { shouldShowLanding, clearTimelineView } =
    useTimelineShareUrl();
  const [view, setView] = useState<AppView>(() =>
    shouldShowLanding ? "landing" : "timeline",
  );

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (shouldShowLanding) {
      setView("landing");
      return;
    }

    if (!hasHydrated) {
      return;
    }

    setView("timeline");
  }, [hasHydrated, shouldShowLanding]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    setLastOpenedView(view);
  }, [hasHydrated, setLastOpenedView, view]);

  const handleToggleTheme = () => {
    startTransition(() => {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    });
  };

  const handleEnterTimeline = () => {
    clearTimelineView();
    setView("timeline");
  };

  const handleBackToLanding = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("l", "1");
    window.history.replaceState({}, "", url.toString());
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
          collectionCount={catalogCollections.length}
          onToggleTheme={handleToggleTheme}
          onEnterTimeline={handleEnterTimeline}
        />
      )}
    </div>
  );
}
