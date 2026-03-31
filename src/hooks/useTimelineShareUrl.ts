import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearSharedViewportInUrl,
  getSharedLogZoomFromSearch,
  getSharedCollectionIdsFromSearch,
  getSharedEventIdFromSearch,
  getSharedViewportYearFromSearch,
  hasSharedCollectionIdsInSearch,
  hasSharedEventIdInSearch,
  hasTimelineViewInSearch,
  hasSharedViewportInSearch,
  setSharedCollectionIdsInUrl,
  setSharedEventIdInUrl,
  setSharedViewportInUrl,
} from "../helpers";

const TIMELINE_URL_CHANGE_EVENT = "time-horizon:url-change";

export type ShareOptions = {
  includeWebsite: boolean;
  includeCollections: boolean;
  collectionIds?: string[];
  includeSelectedEvent: boolean;
  overrideEventId?: string | null;
  includeViewport?: boolean;
  focusYear?: number;
  logZoom?: number;
};

// ─── URL state reader ─────────────────────────────────────────────────

type UrlState = {
  hasTimelineView: boolean;
  sharedCollectionIds: string[];
  sharedEventId: string | null;
  sharedFocusYear: number | null;
  sharedLogZoom: number | null;
  shouldOpenTimeline: boolean;
};

const readUrlState = (): UrlState => {
  if (typeof window === "undefined") {
    return {
      hasTimelineView: false,
      sharedCollectionIds: [],
      sharedEventId: null,
      sharedFocusYear: null,
      sharedLogZoom: null,
      shouldOpenTimeline: false,
    };
  }

  const { hash, search } = window.location;
  const hasTimelineView =
    hash === "#timeline" || hasTimelineViewInSearch(search);

  return {
    hasTimelineView,
    sharedCollectionIds: getSharedCollectionIdsFromSearch(search),
    sharedEventId: getSharedEventIdFromSearch(search),
    sharedFocusYear: getSharedViewportYearFromSearch(search),
    sharedLogZoom: getSharedLogZoomFromSearch(search),
    shouldOpenTimeline:
      hasTimelineViewInSearch(search) ||
      hasSharedEventIdInSearch(search) ||
      hasSharedCollectionIdsInSearch(search) ||
      hasSharedViewportInSearch(search),
  };
};

// ─── URL mutator ────────────────────────────────────────────────────

const dispatchUrlChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TIMELINE_URL_CHANGE_EVENT));
};

const writeUrl = (mutateUrl: (url: URL) => void) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  mutateUrl(url);
  window.history.replaceState({}, "", url);
  dispatchUrlChange();
};

// ─── Hook ───────────────────────────────────────────────────────────

export const useTimelineShareUrl = () => {
  const [state, setState] = useState<UrlState>(readUrlState);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setState(readUrlState());

    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    window.addEventListener(TIMELINE_URL_CHANGE_EVENT, sync);
    sync();

    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener(TIMELINE_URL_CHANGE_EVENT, sync);
    };
  }, []);

  /** Navigate to timeline view (pushes browser history) */
  const enterTimelineView = useCallback(() => {}, []);

  /** Return to landing — strip all share params */
  const clearTimelineView = useCallback(() => {
    writeUrl((url) => {
      url.hash = "";
      url.searchParams.delete("t");
      url.searchParams.delete("c");
      url.searchParams.delete("e");
      clearSharedViewportInUrl(url);
    });
  }, []);

  /**
   * Generate a shareable URL.
   * Optionally writes ?c= (collections) and/or ?e= (event focus).
   */
  const generateShareUrl = useCallback(
    ({
      collectionIds,
      includeCollections,
      includeSelectedEvent,
      overrideEventId,
      includeViewport,
      focusYear,
      logZoom,
    }: ShareOptions): string => {
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.delete("t");

      if (includeCollections && collectionIds && collectionIds.length > 0) {
        setSharedCollectionIdsInUrl(url, collectionIds);
      } else {
        url.searchParams.delete("c");
      }

      if (includeSelectedEvent && overrideEventId != null) {
        setSharedEventIdInUrl(url, overrideEventId);
      } else {
        url.searchParams.delete("e");
      }

      if (includeViewport && focusYear != null && logZoom != null) {
        setSharedViewportInUrl(url, focusYear, logZoom);
      } else {
        clearSharedViewportInUrl(url);
      }

      return url.toString();
    },
    [],
  );

  return useMemo(
    () => ({
      ...state,
      enterTimelineView,
      clearTimelineView,
      generateShareUrl,
    }),
    [state, enterTimelineView, clearTimelineView, generateShareUrl],
  );
};
