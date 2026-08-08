import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { LandingPage } from "./components/landing/LandingPage";
import { DEFAULT_SEED_COLLECTION_ID } from "./constants";
import { applyThemeToDocument, resolveThemeMode } from "./constants/theme";
import { useCatalogCollections } from "./hooks/useCatalogCollections";
import { useTimelineShareUrl } from "./hooks/useTimelineShareUrl";
import { useStore } from "./stores";

type AppView = "landing" | "timeline";

/**
 * The timeline app — editors, dialogs, sidebar, Drive sync, CSV — is the bulk
 * of the bundle and none of it is on the landing page's path. Splitting it out
 * halves what a first visitor downloads to see the intro.
 *
 * Kept as a module-level promise so `prefetchTimeline` and the render share one
 * request: whichever runs first starts the download, the other reuses it.
 */
const importTimeline = () => import("./components/Timeline");

const Timeline = lazy(() =>
  importTimeline().then((module) => ({ default: module.Timeline })),
);

/**
 * Pull the timeline chunk in while the visitor is still reading the landing
 * page, so pressing the CTA switches views instead of showing a spinner.
 */
const prefetchTimeline = () => {
  void importTimeline();
};

/**
 * Shown only if the timeline chunk is still in flight when the view switches —
 * a prefetched or cached chunk resolves before React ever paints this.
 */
function AppLoadingScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-rose-400" />
    </div>
  );
}

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

  // Warm the timeline chunk once the landing page has settled. Idle time on the
  // intro is free; the moment the visitor presses "enter" is not.
  useEffect(() => {
    if (view !== "landing") return;

    if (typeof window.requestIdleCallback !== "function") {
      const timeoutId = window.setTimeout(prefetchTimeline, 1200);
      return () => window.clearTimeout(timeoutId);
    }

    const handle = window.requestIdleCallback(prefetchTimeline, {
      timeout: 3000,
    });
    return () => window.cancelIdleCallback(handle);
  }, [view]);

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

  const handleOpenCollection = (collectionId: string) => {
    const state = useStore.getState();
    void state.downloadCollection(collectionId).then((ok) => {
      const next = useStore.getState();
      if (ok) {
        next.setCollectionVisibility(collectionId, true);
        return;
      }
      // The app has no global toast, and every other downloadCollection call
      // site ignores the result outright. The least-invasive way to stop the
      // user staring at a timeline that silently lacks what they clicked is to
      // drop them into the Explore panel, where the collection still shows its
      // Download button and can be retried.
      next.openSidebarExplore();
    });
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
    <div
      className={`app-shell w-full ${
        view === "timeline" ? "h-screen" : "min-h-screen"
      }`}
    >
      {view === "timeline" ? (
        <Suspense fallback={<AppLoadingScreen />}>
          <Timeline
            theme={resolvedTheme}
            onToggleTheme={handleToggleTheme}
            onBackToLanding={handleBackToLanding}
          />
        </Suspense>
      ) : (
        <LandingPage
          theme={resolvedTheme}
          catalogCollections={catalogCollections}
          onToggleTheme={handleToggleTheme}
          onEnterTimeline={handleEnterTimeline}
          onOpenCollection={handleOpenCollection}
        />
      )}
    </div>
  );
}
