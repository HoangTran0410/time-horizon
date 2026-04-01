import { useCallback, useEffect, useMemo, useState } from "react";

const SHARED_COLLECTIONS_QUERY_PARAM = "c";
const LEGACY_SHARED_COLLECTIONS_QUERY_PARAM = "collections";
const SHARED_EVENT_QUERY_PARAM = "e";
const TIMELINE_VIEW_QUERY_PARAM = "t";
const TIMELINE_VIEWPORT_YEAR_PARAM = "y";
const TIMELINE_VIEWPORT_ZOOM_PARAM = "z";
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
  shouldShowLanding: boolean;
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
      shouldShowLanding: false,
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
    shouldShowLanding: search.includes("?l=1") || search.includes("&l=1"),
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
      url.searchParams.delete("l");
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

const uniqueCollectionIds = (collectionIds: string[]): string[] =>
  collectionIds.filter(
    (collectionId, index, allCollectionIds) =>
      collectionId.length > 0 &&
      allCollectionIds.indexOf(collectionId) === index,
  );

export const getSharedCollectionIdsFromSearch = (search: string): string[] => {
  const params = new URLSearchParams(search);
  const rawValue =
    params.get(SHARED_COLLECTIONS_QUERY_PARAM) ??
    params.get(LEGACY_SHARED_COLLECTIONS_QUERY_PARAM);
  if (!rawValue) return [];

  return uniqueCollectionIds(
    rawValue
      .split(",")
      .map((collectionId) => collectionId.trim())
      .filter(Boolean),
  );
};

export const hasSharedCollectionIdsInSearch = (search: string): boolean =>
  getSharedCollectionIdsFromSearch(search).length > 0;

export const getSharedEventIdFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const rawValue = params.get(SHARED_EVENT_QUERY_PARAM);
  if (!rawValue) return null;

  const eventId = rawValue.trim();
  return eventId.length > 0 ? eventId : null;
};

export const hasSharedEventIdInSearch = (search: string): boolean =>
  getSharedEventIdFromSearch(search) !== null;

export const hasTimelineViewInSearch = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return params.get(TIMELINE_VIEW_QUERY_PARAM) === "1";
};

export const setTimelineViewInUrl = (url: URL, enabled: boolean): void => {
  if (enabled) {
    url.searchParams.set(TIMELINE_VIEW_QUERY_PARAM, "1");
  } else {
    url.searchParams.delete(TIMELINE_VIEW_QUERY_PARAM);
  }
};

export const setSharedCollectionIdsInUrl = (
  url: URL,
  collectionIds: string[],
): void => {
  const serializedIds = uniqueCollectionIds(collectionIds).join(",");
  if (serializedIds) {
    url.searchParams.set(SHARED_COLLECTIONS_QUERY_PARAM, serializedIds);
  } else {
    url.searchParams.delete(SHARED_COLLECTIONS_QUERY_PARAM);
  }

  url.searchParams.delete(LEGACY_SHARED_COLLECTIONS_QUERY_PARAM);
};

export const setSharedEventIdInUrl = (
  url: URL,
  eventId: string | null,
): void => {
  const nextEventId = eventId?.trim() ?? "";

  if (nextEventId) {
    url.searchParams.set(SHARED_EVENT_QUERY_PARAM, nextEventId);
  } else {
    url.searchParams.delete(SHARED_EVENT_QUERY_PARAM);
  }
};

/**
 * Parse a viewport year from URL search params.
 * Accepts plain year number, or scientific notation (e.g. "-6.6e7" → -66000000).
 * Returns null if absent or invalid.
 */
export const getSharedViewportYearFromSearch = (
  search: string,
): number | null => {
  const params = new URLSearchParams(search);
  const raw = params.get(TIMELINE_VIEWPORT_YEAR_PARAM);
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Accept plain numbers or scientific notation (e.g. "-6.6e7", "1.5e9")
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) return parsed;

  // Fallback: try parsing scientific notation manually for precision
  const sciMatch = /^(-?\d*\.?\d+)[eE]([+-]?\d+)$/.exec(trimmed);
  if (sciMatch) {
    const base = Number.parseFloat(sciMatch[1]!);
    const exp = Number.parseInt(sciMatch[2]!, 10);
    const result = base * 10 ** exp;
    if (Number.isFinite(result)) return result;
  }

  return null;
};

/**
 * Parse a log-zoom value from URL search params.
 * logZoom = ln(zoom), so URL value is the log base e directly.
 * Accepts plain number or scientific notation.
 * Returns null if absent or invalid.
 */
export const getSharedLogZoomFromSearch = (search: string): number | null => {
  const params = new URLSearchParams(search);
  const raw = params.get(TIMELINE_VIEWPORT_ZOOM_PARAM);
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) return parsed;

  const sciMatch = /^(-?\d*\.?\d+)[eE]([+-]?\d+)$/.exec(trimmed);
  if (sciMatch) {
    const base = Number.parseFloat(sciMatch[1]!);
    const exp = Number.parseInt(sciMatch[2]!, 10);
    const result = base * 10 ** exp;
    if (Number.isFinite(result)) return result;
  }

  return null;
};

/** Returns true if the URL has a viewport year or zoom param. */
export const hasSharedViewportInSearch = (search: string): boolean =>
  getSharedViewportYearFromSearch(search) !== null ||
  getSharedLogZoomFromSearch(search) !== null;

/** Write focusYear + logZoom to URL params. Uses scientific notation for large values. */
export const setSharedViewportInUrl = (
  url: URL,
  focusYear: number,
  logZoom: number,
): void => {
  const roundedYear = Math.round(focusYear * 100) / 100;
  const roundedLogZoom = Math.round(logZoom * 1000) / 1000;

  // Use scientific notation for large numbers for readability in the URL
  const yearStr =
    Math.abs(roundedYear) >= 1e6
      ? roundedYear.toExponential(3)
      : String(roundedYear);

  url.searchParams.set(TIMELINE_VIEWPORT_YEAR_PARAM, yearStr);
  url.searchParams.set(TIMELINE_VIEWPORT_ZOOM_PARAM, String(roundedLogZoom));
};

/** Remove all viewport params from the URL. */
export const clearSharedViewportInUrl = (url: URL): void => {
  url.searchParams.delete(TIMELINE_VIEWPORT_YEAR_PARAM);
  url.searchParams.delete(TIMELINE_VIEWPORT_ZOOM_PARAM);
};
