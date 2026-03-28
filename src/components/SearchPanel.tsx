import React from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
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
const EMPTY_RESULTS: Event[] = [];

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
  const shouldHydrateResults = isOpen && isResultsReady;

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

  const filteredResults = React.useMemo(() => {
    if (!shouldHydrateResults) {
      return EMPTY_RESULTS;
    }

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
    shouldHydrateResults,
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
  const activeFilterCount = React.useMemo(() => {
    let count = activeMediaFilters.length;
    if (searchSortMode !== SEARCH_SORT_OPTIONS[0]?.value) count += 1;
    if (timeRangeStartInput.trim()) count += 1;
    if (timeRangeEndInput.trim()) count += 1;
    return count;
  }, [
    activeMediaFilters.length,
    searchSortMode,
    timeRangeEndInput,
    timeRangeStartInput,
  ]);

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
    () =>
      shouldHydrateResults
        ? filteredResults.slice(0, visibleResultCount)
        : EMPTY_RESULTS,
    [filteredResults, shouldHydrateResults, visibleResultCount],
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

    if (!shouldHydrateResults) return;

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
        className={`ui-panel flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[1.7rem] p-4 ${
          panelClassName ?? ""
        }`.trim()}
        style={{ maxHeight }}
      >
        <div ref={resultsListRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="ui-display-title text-[1.5rem] leading-none text-white">
                {title}
              </div>
              {subtitle ? (
                <p className="mt-1.5 max-w-[32rem] text-[0.82rem] leading-6 text-zinc-400">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="ui-icon-button h-9 w-9"
                aria-label="Close search panel"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="ui-field mb-3"
          />
          <div className="ui-panel-soft mb-3 rounded-[1.35rem] p-3">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen((current) => !current)}
              className="group flex w-full items-center gap-2 rounded-[0.95rem] px-0.5 py-0.5 text-left transition-colors duration-200"
              aria-expanded={isAdvancedFiltersOpen}
            >
              <SlidersHorizontal
                size={14}
                className="shrink-0 text-zinc-500 transition-colors duration-200 group-hover:text-zinc-300"
              />
              <div className="min-w-0 flex flex-1 items-center gap-2">
                <span className="text-[0.7rem] font-mono uppercase tracking-[0.18em] text-zinc-300">
                  Filters
                </span>
                {hasActiveFilters ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[0.6rem] font-mono uppercase tracking-[0.14em] text-emerald-200">
                    {activeFilterCount}
                  </span>
                ) : null}
              </div>
              <ChevronDown
                size={15}
                className={`shrink-0 text-zinc-500 transition-all duration-200 group-hover:text-zinc-300 ${
                  isAdvancedFiltersOpen ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>
            <div
              className="overflow-hidden transition-[max-height,opacity,margin-top] duration-200 ease-out"
              style={{
                maxHeight: isAdvancedFiltersOpen
                  ? `${advancedFiltersHeight}px`
                  : "0px",
                opacity: isAdvancedFiltersOpen ? 1 : 0,
                marginTop: isAdvancedFiltersOpen ? "0.75rem" : "0rem",
              }}
              aria-hidden={!isAdvancedFiltersOpen}
            >
              <div
                ref={advancedFiltersContentRef}
                className="flex flex-col gap-2 pt-3"
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
                        className="ui-chip"
                        data-active={isActive}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <select
                  value={searchSortMode}
                  onChange={(e) => handleSortModeChange(e.target.value)}
                  className="ui-field"
                >
                  {SEARCH_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeRangeStartInput}
                    onChange={(e) => handleTimeRangeStartChange(e.target.value)}
                    placeholder="From: 2024-03"
                    className="ui-field"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeRangeEndInput}
                    onChange={(e) => handleTimeRangeEndChange(e.target.value)}
                    placeholder="To: 2024-03-27"
                    className="ui-field"
                  />
                </div>
                <div className="mt-1 text-[0.68rem] font-mono text-zinc-500">
                  Use <span className="text-zinc-400">YYYY</span>,{" "}
                  <span className="text-zinc-400">YYYY-MM</span>, or{" "}
                  <span className="text-zinc-400">YYYY-MM-DD</span>.
                </div>

                {dateRangeError && (
                  <div className="mt-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[0.72rem] leading-5 text-amber-200">
                    {dateRangeError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showTimelineToggle &&
            shouldHydrateResults &&
            filteredResults.length > 0 && (
              <label className="ui-panel-soft mb-3 flex items-center gap-2.5 rounded-[1rem] px-3 py-2.5 text-[0.82rem] text-zinc-300">
                <input
                  type="checkbox"
                  checked={showOnlyResultsOnTimeline}
                  onChange={(e) =>
                    setShowOnlyResultsOnTimeline(e.target.checked)
                  }
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span>{timelineToggleLabel}</span>
              </label>
            )}
          <div className="mb-3 text-[0.68rem] font-mono uppercase tracking-[0.18em] text-zinc-500">
            {shouldHydrateResults ? filteredResults.length : "…"}
            {shouldHydrateResults &&
            filteredResults.length != searchableEvents.length
              ? `/${searchableEvents.length}`
              : ""}{" "}
            {resultLabel}
          </div>

          {!shouldHydrateResults ? (
            <div className="rounded-[1.15rem] border border-dashed border-zinc-800 px-3 py-5 text-center text-[0.8rem] leading-5 text-zinc-500">
              Loading events...
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="rounded-[1.15rem] border border-dashed border-zinc-800 px-3 py-5 text-center text-[0.8rem] leading-5 text-zinc-500">
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
                  className="flex items-center justify-center py-3 text-[0.68rem] font-mono uppercase tracking-[0.18em] text-zinc-500"
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
