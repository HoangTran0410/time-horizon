import { startTransition, useEffect, useRef, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { Timeline } from "./components/Timeline";
import { DEFAULT_SEED_COLLECTION_ID } from "./constants";
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

  /**
   * First-run seeding: give a brand-new visitor something on the canvas instead
   * of an empty timeline. Runs at most once ever — `hasSeededDefaultCollection`
   * is persisted, so a user who deliberately empties their library stays empty.
   */
  useEffect(() => {
    if (isCatalogLoading || catalogCollections.length === 0) return;

    const state = useStore.getState();
    if (state.hasSeededDefaultCollection) return;

    // Someone with existing data is not a first-run user — just mark it done.
    if (Object.keys(state.collectionLibrary).length > 0) {
      state.markDefaultCollectionSeeded();
      return;
    }

    let cancelled = false;
    void state.downloadCollection(DEFAULT_SEED_COLLECTION_ID).then((ok) => {
      // Only latch on success, so a failed fetch retries on the next visit.
      if (ok && !cancelled) {
        useStore.getState().markDefaultCollectionSeeded();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isCatalogLoading, catalogCollections.length]);

  const { shouldShowLanding, shouldOpenTimeline, clearTimelineView } =
    useTimelineShareUrl();

  /**
   * Initial route. Share params win; otherwise fall back to the view the user
   * last had open (defaults to "landing", so first-time visitors get the intro).
   * localStorage persist is synchronous, so this is already hydrated here.
   */
  const [view, setView] = useState<AppView>(() => {
    if (shouldShowLanding) return "landing";
    if (shouldOpenTimeline) return "timeline";
    return useStore.getState().lastOpenedView;
  });

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  // React to later URL changes only — the initial route is resolved above, and
  // re-applying it here would stomp on in-app navigation.
  const hasResolvedInitialRoute = useRef(false);
  useEffect(() => {
    if (!hasResolvedInitialRoute.current) {
      hasResolvedInitialRoute.current = true;
      return;
    }

    if (shouldShowLanding) {
      setView("landing");
      return;
    }

    if (shouldOpenTimeline) {
      setView("timeline");
    }
  }, [shouldShowLanding, shouldOpenTimeline]);

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
