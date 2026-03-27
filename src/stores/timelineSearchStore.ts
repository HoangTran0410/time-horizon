import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Event } from "../constants/types";
import { MediaFilter } from "../components/timeline/ControllerTypes";

interface TimelineSearchState {
  searchQuery: string;
  activeMediaFilters: MediaFilter[];
  showOnlyResultsOnTimeline: boolean;
  setSearchQuery: (value: string) => void;
  toggleMediaFilter: (filter: MediaFilter) => void;
  setShowOnlyResultsOnTimeline: (value: boolean) => void;
}

const STORE_KEY = "time-horizon:timeline-search:v1";

const normalizeSearchText = (value: string) => value.trim().toLocaleLowerCase();

const getSearchRank = (event: Event, terms: string[]) => {
  const title = normalizeSearchText(event.title);
  const description = normalizeSearchText(event.description);

  return terms.reduce((score, term) => {
    if (title.startsWith(term)) return score;
    if (title.includes(term)) return score + 1;
    if (description.includes(term)) return score + 2;
    return score + 10;
  }, 0);
};

export const filterTimelineSearchEvents = (
  events: Event[],
  searchQuery: string,
  activeMediaFilters: MediaFilter[],
  options?: { sortByRelevance?: boolean },
) => {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const searchTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  const matches = events.filter((event) => {
    const title = normalizeSearchText(event.title);
    const description = normalizeSearchText(event.description);
    const matchesQuery =
      searchTerms.length === 0 ||
      searchTerms.every(
        (term) => title.includes(term) || description.includes(term),
      );
    const matchesFilters = activeMediaFilters.every((filter) => {
      if (filter === "image") return Boolean(event.image);
      if (filter === "video") return Boolean(event.video);
      return Boolean(event.link);
    });

    return matchesQuery && matchesFilters;
  });

  if (!options?.sortByRelevance || searchTerms.length === 0) {
    return matches;
  }

  return [...matches].sort((left, right) => {
    const rankDiff =
      getSearchRank(left, searchTerms) - getSearchRank(right, searchTerms);
    if (rankDiff !== 0) return rankDiff;
    return left.title.localeCompare(right.title);
  });
};

export const useTimelineSearchStore = create<TimelineSearchState>()(
  persist(
    (set) => ({
      searchQuery: "",
      activeMediaFilters: [],
      showOnlyResultsOnTimeline: false,
      setSearchQuery: (value) => set({ searchQuery: value }),
      toggleMediaFilter: (filter) =>
        set((state) => ({
          activeMediaFilters: state.activeMediaFilters.includes(filter)
            ? state.activeMediaFilters.filter((item) => item !== filter)
            : [...state.activeMediaFilters, filter],
        })),
      setShowOnlyResultsOnTimeline: (value) =>
        set({ showOnlyResultsOnTimeline: value }),
    }),
    {
      name: STORE_KEY,
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        activeMediaFilters: state.activeMediaFilters,
        showOnlyResultsOnTimeline: state.showOnlyResultsOnTimeline,
      }),
    },
  ),
);
