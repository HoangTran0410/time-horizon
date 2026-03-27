import React from "react";
import { Event } from "../../constants/types";
import { MEDIA_FILTERS, MediaFilter } from "../../constants/types";
import { SearchResultItem } from "./SearchResultItem";
import {
  filterTimelineSearchEvents,
  useTimelineSearchStore,
} from "../../stores/timelineSearchStore";

interface SearchPanelProps {
  isOpen: boolean;
  searchableEvents: Event[];
  onSearchSelect: (event: Event) => void;
}

const INITIAL_VISIBLE_RESULTS = 16;
const RESULTS_BATCH_SIZE = 24;

export const SearchPanel: React.FC<SearchPanelProps> = ({
  isOpen,
  searchableEvents,
  onSearchSelect,
}) => {
  const [isResultsReady, setIsResultsReady] = React.useState(false);
  const [visibleResultCount, setVisibleResultCount] = React.useState(
    INITIAL_VISIBLE_RESULTS,
  );
  const searchQuery = useTimelineSearchStore((state) => state.searchQuery);
  const activeMediaFilters = useTimelineSearchStore(
    (state) => state.activeMediaFilters,
  );
  const showOnlyResultsOnTimeline = useTimelineSearchStore(
    (state) => state.showOnlyResultsOnTimeline,
  );
  const setSearchQuery = useTimelineSearchStore(
    (state) => state.setSearchQuery,
  );
  const toggleStoredMediaFilter = useTimelineSearchStore(
    (state) => state.toggleMediaFilter,
  );
  const setShowOnlyResultsOnTimeline = useTimelineSearchStore(
    (state) => state.setShowOnlyResultsOnTimeline,
  );
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const resultsListRef = React.useRef<HTMLDivElement>(null);
  const resultsSentinelRef = React.useRef<HTMLDivElement>(null);
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  React.useEffect(() => {
    if (!isOpen) {
      setIsResultsReady(false);
      return;
    }

    let hydrateFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      if (resultsListRef.current) {
        resultsListRef.current.scrollTop = 0;
      }
      setVisibleResultCount(INITIAL_VISIBLE_RESULTS);
      hydrateFrame = window.requestAnimationFrame(() => {
        React.startTransition(() => {
          setIsResultsReady(true);
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(hydrateFrame);
    };
  }, [isOpen]);

  const filteredResults = React.useMemo(() => {
    return filterTimelineSearchEvents(
      searchableEvents,
      deferredSearchQuery,
      activeMediaFilters,
      { sortByRelevance: true },
    );
  }, [activeMediaFilters, deferredSearchQuery, searchableEvents]);

  React.useEffect(() => {
    setVisibleResultCount(INITIAL_VISIBLE_RESULTS);
  }, [filteredResults]);

  React.useEffect(() => {
    if (!isOpen || !isResultsReady) return;

    const root = resultsListRef.current;
    const sentinel = resultsSentinelRef.current;
    if (!root || !sentinel || visibleResultCount >= filteredResults.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleResultCount((prev) =>
          Math.min(prev + RESULTS_BATCH_SIZE, filteredResults.length),
        );
      },
      {
        root,
        rootMargin: "0px 0px 160px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredResults.length, isOpen, isResultsReady, visibleResultCount]);

  const visibleResults = React.useMemo(
    () => filteredResults.slice(0, visibleResultCount),
    [filteredResults, visibleResultCount],
  );

  const toggleMediaFilter = (filter: MediaFilter) => {
    React.startTransition(() => {
      toggleStoredMediaFilter(filter);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const firstResult = filteredResults[0];
    if (!firstResult) return;
    onSearchSelect(firstResult);
  };

  return (
    <div
      className="ui-popover"
      data-open={isOpen}
      style={isOpen ? { maxHeight: "calc(100vh - 1.5rem)" } : undefined}
    >
      <form
        onSubmit={handleSearchSubmit}
        className="mt-0.5 w-[20rem] rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2.5 shadow-lg"
      >
        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
          Search Events
        </div>
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name or description"
          className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="mb-2 flex flex-wrap gap-1.5">
          {MEDIA_FILTERS.map((filter) => {
            const isActive = activeMediaFilters.includes(filter);
            const label =
              filter === "image"
                ? "Image"
                : filter === "video"
                  ? "Video"
                  : "Link";

            return (
              <button
                key={filter}
                type="button"
                onClick={() => toggleMediaFilter(filter)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-200"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
          {filteredResults.length}
          {filteredResults.length != searchableEvents.length
            ? `/${searchableEvents.length}`
            : ""}{" "}
          visible events
        </div>
        <label className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={showOnlyResultsOnTimeline}
            onChange={(e) => setShowOnlyResultsOnTimeline(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
          />
          <span>Only show matched events on timeline</span>
        </label>

        {!isResultsReady ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/60 px-3 py-4 text-center text-[11px] leading-4 text-zinc-500">
            Loading events...
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/60 px-3 py-4 text-center text-[11px] leading-4 text-zinc-500">
            No visible events matched your search.
          </div>
        ) : (
          <div
            ref={resultsListRef}
            className="max-h-64 space-y-1 overflow-y-auto pr-1"
          >
            {visibleResults.map((event) => (
              <SearchResultItem
                key={event.id}
                event={event}
                onSelect={onSearchSelect}
              />
            ))}
            {visibleResultCount < filteredResults.length && (
              <div
                ref={resultsSentinelRef}
                className="flex items-center justify-center py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500"
              >
                Loading more...
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
