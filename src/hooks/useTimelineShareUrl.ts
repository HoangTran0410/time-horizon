import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSharedCollectionIdsFromSearch,
  getSharedEventIdFromSearch,
  hasSharedCollectionIdsInSearch,
  hasSharedEventIdInSearch,
  hasTimelineViewInSearch,
  setSharedCollectionIdsInUrl,
  setSharedEventIdInUrl,
  setTimelineViewInUrl,
} from "../helpers";

const TIMELINE_URL_CHANGE_EVENT = "time-horizon:url-change";

type TimelineShareUrlState = {
  hasTimelineView: boolean;
  sharedCollectionIds: string[];
  sharedEventId: string | null;
  shouldOpenTimeline: boolean;
};

const readTimelineShareUrlState = (): TimelineShareUrlState => {
  if (typeof window === "undefined") {
    return {
      hasTimelineView: false,
      sharedCollectionIds: [],
      sharedEventId: null,
      shouldOpenTimeline: false,
    };
  }

  const { hash, search } = window.location;
  const hasTimelineView =
    hash === "#timeline" || hasTimelineViewInSearch(search);
  const sharedCollectionIds = getSharedCollectionIdsFromSearch(search);
  const sharedEventId = getSharedEventIdFromSearch(search);

  return {
    hasTimelineView,
    sharedCollectionIds,
    sharedEventId,
    shouldOpenTimeline:
      hasTimelineView ||
      hasSharedEventIdInSearch(search) ||
      hasSharedCollectionIdsInSearch(search),
  };
};

const dispatchTimelineUrlChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TIMELINE_URL_CHANGE_EVENT));
};

type UpdateUrlMode = "push" | "replace";

const updateTimelineUrl = (
  mode: UpdateUrlMode,
  mutateUrl: (url: URL) => void,
) => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  mutateUrl(url);

  if (mode === "push") {
    window.history.pushState({}, "", url);
  } else {
    window.history.replaceState({}, "", url);
  }

  dispatchTimelineUrlChange();
};

export const useTimelineShareUrl = () => {
  const [state, setState] = useState<TimelineShareUrlState>(
    readTimelineShareUrlState,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncState = () => {
      setState(readTimelineShareUrlState());
    };

    window.addEventListener("popstate", syncState);
    window.addEventListener("hashchange", syncState);
    window.addEventListener(TIMELINE_URL_CHANGE_EVENT, syncState);
    syncState();

    return () => {
      window.removeEventListener("popstate", syncState);
      window.removeEventListener("hashchange", syncState);
      window.removeEventListener(TIMELINE_URL_CHANGE_EVENT, syncState);
    };
  }, []);

  const enterTimelineView = useCallback(() => {
    updateTimelineUrl("push", (url) => {
      url.hash = "";
      setTimelineViewInUrl(url, true);
    });
  }, []);

  const clearTimelineView = useCallback(() => {
    updateTimelineUrl("replace", (url) => {
      url.hash = "";
      setSharedCollectionIdsInUrl(url, []);
      setSharedEventIdInUrl(url, null);
      setTimelineViewInUrl(url, false);
    });
  }, []);

  const replaceTimelineShareState = useCallback(
    (nextState: {
      sharedCollectionIds: string[];
      sharedEventId: string | null;
      keepTimelineView?: boolean;
    }) => {
      const {
        sharedCollectionIds,
        sharedEventId,
        keepTimelineView = sharedCollectionIds.length === 0,
      } = nextState;

      updateTimelineUrl("replace", (url) => {
        url.hash = "";
        setSharedCollectionIdsInUrl(url, sharedCollectionIds);
        setSharedEventIdInUrl(url, sharedEventId);
        setTimelineViewInUrl(url, keepTimelineView);
      });
    },
    [],
  );

  return useMemo(
    () => ({
      ...state,
      enterTimelineView,
      clearTimelineView,
      replaceTimelineShareState,
    }),
    [clearTimelineView, enterTimelineView, replaceTimelineShareState, state],
  );
};
