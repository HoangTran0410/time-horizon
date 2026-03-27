import React from "react";
import { X } from "lucide-react";
import { Event } from "../constants/types";
import { MEDIA_FILTERS, MediaFilter } from "../constants/types";
import { SearchResultItem } from "./SearchResultItem";
import {
  SearchSortMode,
  filterTimelineSearchEvents,
  getTimelineSearchDateInputError,
  hasActiveTimelineSearchFilters,
  SEARCH_SORT_OPTIONS,
  useTimelineStore,
} from "../stores";

export interface SearchPanelStateAdapter {
  searchQuery: string;
  activeMediaFilters: MediaFilter[];
  searchSortMode: SearchSortMode;
  timeRangeStartInput: string;
  timeRangeEndInput: string;
  showOnlyResultsOnTimeline: boolean;
  setSearchQuery: (value: string) => void;
  toggleMediaFilter: (filter: MediaFilter) => void;
  setSearchSortMode: (value: SearchSortMode) => void;
  setTimeRangeStartInput: (value: string) => void;
  setTimeRangeEndInput: (value: string) => void;
  setShowOnlyResultsOnTimeline: (value: boolean) => void;
}

interface SearchPanelProps {
  isOpen: boolean;
  searchableEvents: Event[];
  onSearchSelect: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
  state?: SearchPanelStateAdapter;
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  resultLabel?: string;
  showTimelineToggle?: boolean;
  timelineToggleLabel?: string;
  wrapperClassName?: string;
  panelClassName?: string;
  maxHeight?: string;
  onClose?: () => void;
}

const INITIAL_VISIBLE_RESULTS = 16;
const RESULTS_BATCH_SIZE = 24;
const SEARCH_PANEL_MAX_HEIGHT = "min(400px, calc(100vh - 3rem))";

export const SearchPanel: React.FC<SearchPanelProps> = ({
  isOpen,
  searchableEvents,
  onSearchSelect,
  onDeleteEvent,
  state,
  title = "Search Events",
  subtitle,
  searchPlaceholder = "Name or description",
  emptyMessage = "No visible events matched your search.",
  resultLabel = "visible events",
  showTimelineToggle = true,
  timelineToggleLabel = "Only show matched events on timeline",
  wrapperClassName,
  panelClassName,
  maxHeight = SEARCH_PANEL_MAX_HEIGHT,
  onClose,
}) => {
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] =
    React.useState(false);
  const [advancedFiltersHeight, setAdvancedFiltersHeight] = React.useState(0);
  const [isResultsReady, setIsResultsReady] = React.useState(false);
  const [visibleResultCount, setVisibleResultCount] = React.useState(
    INITIAL_VISIBLE_RESULTS,
  );
  const globalSearchQuery = useTimelineStore((state) => state.searchQuery);
  const globalActiveMediaFilters = useTimelineStore(
    (state) => state.activeMediaFilters,
  );
  const globalSearchSortMode = useTimelineStore(
    (state) => state.searchSortMode,
  );
  const globalTimeRangeStartInput = useTimelineStore(
    (state) => state.timeRangeStartInput,
  );
  const globalTimeRangeEndInput = useTimelineStore(
    (state) => state.timeRangeEndInput,
  );
  const globalShowOnlyResultsOnTimeline = useTimelineStore(
    (state) => state.showOnlyResultsOnTimeline,
  );
  const globalSetSearchQuery = useTimelineStore(
    (state) => state.setSearchQuery,
  );
  const globalToggleStoredMediaFilter = useTimelineStore(
    (state) => state.toggleMediaFilter,
  );
  const globalSetSearchSortMode = useTimelineStore(
    (state) => state.setSearchSortMode,
  );
  const globalSetTimeRangeStartInput = useTimelineStore(
    (state) => state.setTimeRangeStartInput,
  );
  const globalSetTimeRangeEndInput = useTimelineStore(
    (state) => state.setTimeRangeEndInput,
  );
  const globalSetShowOnlyResultsOnTimeline = useTimelineStore(
    (state) => state.setShowOnlyResultsOnTimeline,
  );
  const advancedFiltersContentRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const resultsListRef = React.useRef<HTMLDivElement>(null);
  const resultsSentinelRef = React.useRef<HTMLDivElement>(null);
  const effectiveState = state ?? {
    searchQuery: globalSearchQuery,
    activeMediaFilters: globalActiveMediaFilters,
    searchSortMode: globalSearchSortMode,
    timeRangeStartInput: globalTimeRangeStartInput,
    timeRangeEndInput: globalTimeRangeEndInput,
    showOnlyResultsOnTimeline: globalShowOnlyResultsOnTimeline,
    setSearchQuery: globalSetSearchQuery,
    toggleMediaFilter: globalToggleStoredMediaFilter,
    setSearchSortMode: globalSetSearchSortMode,
    setTimeRangeStartInput: globalSetTimeRangeStartInput,
    setTimeRangeEndInput: globalSetTimeRangeEndInput,
    setShowOnlyResultsOnTimeline: globalSetShowOnlyResultsOnTimeline,
  };
  const {
    searchQuery,
    activeMediaFilters,
    searchSortMode,
    timeRangeStartInput,
    timeRangeEndInput,
    showOnlyResultsOnTimeline,
    setSearchQuery,
    toggleMediaFilter: toggleStoredMediaFilter,
    setSearchSortMode,
    setTimeRangeStartInput,
    setTimeRangeEndInput,
    setShowOnlyResultsOnTimeline,
  } = effectiveState;
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  React.useEffect(() => {
    if (!isOpen) {
      setIsResultsReady(false);
      return;
    }

    let hydrateFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      // searchInputRef.current?.focus();
      // searchInputRef.current?.select();
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

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(
      "(max-width: 640px), (max-height: 760px)",
    );
    const syncAdvancedFiltersState = () => {
      setIsAdvancedFiltersOpen(!mediaQuery.matches);
    };

    syncAdvancedFiltersState();
    mediaQuery.addEventListener("change", syncAdvancedFiltersState);

    return () => {
      mediaQuery.removeEventListener("change", syncAdvancedFiltersState);
    };
  }, []);

  const filteredResults = React.useMemo(() => {
    return filterTimelineSearchEvents(
      searchableEvents,
      deferredSearchQuery,
      activeMediaFilters,
      {
        sortMode: searchSortMode,
        startTimeInput: timeRangeStartInput,
        endTimeInput: timeRangeEndInput,
      },
    );
  }, [
    activeMediaFilters,
    deferredSearchQuery,
    searchSortMode,
    searchableEvents,
    timeRangeEndInput,
    timeRangeStartInput,
  ]);

  const dateRangeError = React.useMemo(
    () =>
      getTimelineSearchDateInputError(timeRangeStartInput, timeRangeEndInput),
    [timeRangeEndInput, timeRangeStartInput],
  );
  const hasActiveFilters = React.useMemo(
    () =>
      hasActiveTimelineSearchFilters({
        activeMediaFilters,
        searchSortMode,
        timeRangeStartInput,
        timeRangeEndInput,
      }),
    [
      activeMediaFilters,
      searchSortMode,
      timeRangeEndInput,
      timeRangeStartInput,
    ],
  );

  React.useLayoutEffect(() => {
    const content = advancedFiltersContentRef.current;
    if (!content) return;

    const updateHeight = () => {
      setAdvancedFiltersHeight(content.scrollHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);

    return () => observer.disconnect();
  }, [dateRangeError]);

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

  const handleSortModeChange = (value: string) => {
    React.startTransition(() => {
      setSearchSortMode(value as (typeof SEARCH_SORT_OPTIONS)[number]["value"]);
    });
  };

  const handleTimeRangeStartChange = (value: string) => {
    React.startTransition(() => {
      setTimeRangeStartInput(value);
    });
  };

  const handleTimeRangeEndChange = (value: string) => {
    React.startTransition(() => {
      setTimeRangeEndInput(value);
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
      className={`ui-popover ${wrapperClassName ?? ""}`.trim()}
      data-open={isOpen}
      style={isOpen ? { maxHeight } : undefined}
    >
      <form
        onSubmit={handleSearchSubmit}
        className={`flex w-[24rem] max-w-[calc(100vw-4rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 p-2.5 ${
          panelClassName ?? ""
        }`.trim()}
        style={{ maxHeight }}
      >
        <div
          ref={resultsListRef}
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                {title}
              </div>
              {subtitle ? (
                <p className="mt-1 text-[11px] leading-5 text-zinc-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-800 bg-zinc-900/90 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                aria-label="Close search panel"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <div className="mb-2 rounded-xl border border-zinc-800  p-2">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-lg text-left"
              aria-expanded={isAdvancedFiltersOpen}
            >
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
                <span>Filters</span>
                {hasActiveFilters && (
                  <span className="h-2 w-2 rounded-full bg-rose-500/80" />
                )}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-400">
                {isAdvancedFiltersOpen ? "Hide" : "Show"}
              </span>
            </button>
            <div
              className="overflow-hidden transition-[max-height,opacity,margin-top] duration-200 ease-out"
              style={{
                maxHeight: isAdvancedFiltersOpen
                  ? `${advancedFiltersHeight}px`
                  : "0px",
                opacity: isAdvancedFiltersOpen ? 1 : 0,
                // marginTop: isAdvancedFiltersOpen ? "0.5rem" : "0rem",
              }}
              aria-hidden={!isAdvancedFiltersOpen}
            >
              <div
                ref={advancedFiltersContentRef}
                className="pt-2 flex flex-col gap-1"
              >
                <div className="flex flex-wrap gap-1.5">
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
                <select
                  value={searchSortMode}
                  onChange={(e) => handleSortModeChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  {SEARCH_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeRangeStartInput}
                    onChange={(e) => handleTimeRangeStartChange(e.target.value)}
                    placeholder="From: 2024-03"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeRangeEndInput}
                    onChange={(e) => handleTimeRangeEndChange(e.target.value)}
                    placeholder="To: 2024-03-27"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="mt-1.5 text-[10px] font-mono text-zinc-500">
                  Use <span className="text-zinc-400">YYYY</span>,{" "}
                  <span className="text-zinc-400">YYYY-MM</span>, or{" "}
                  <span className="text-zinc-400">YYYY-MM-DD</span>.
                </div>

                {dateRangeError && (
                  <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[10px] leading-4 text-amber-200">
                    {dateRangeError}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">
            {filteredResults.length}
            {filteredResults.length != searchableEvents.length
              ? `/${searchableEvents.length}`
              : ""}{" "}
            {resultLabel}
          </div>
          {showTimelineToggle && filteredResults.length > 0 && (
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-800 px-2.5 py-2 text-[11px] text-zinc-300">
              <input
                type="checkbox"
                checked={showOnlyResultsOnTimeline}
                onChange={(e) => setShowOnlyResultsOnTimeline(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
              />
              <span>{timelineToggleLabel}</span>
            </label>
          )}

          {!isResultsReady ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] leading-4 text-zinc-500">
              Loading events...
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] leading-4 text-zinc-500">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-1">
              {visibleResults.map((event) => (
                <SearchResultItem
                  key={event.id}
                  event={event}
                  onSelect={onSearchSelect}
                  onDelete={onDeleteEvent}
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
        </div>
      </form>
    </div>
  );
};
