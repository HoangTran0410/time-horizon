import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { Event, EventCollectionMeta } from "../constants/types";
import { useI18n } from "../i18n";

interface ExploreCollectionsModalProps {
  collections: EventCollectionMeta[];
  visibleCollectionIds: string[];
  downloadingCollectionIds: string[];
  collectionEventsById: Record<string, Event[]>;
  onClose: () => void;
  onDownloadCollection: (collectionId: string) => Promise<boolean> | boolean;
  onDeleteCollection: (collection: EventCollectionMeta) => void;
  onSetCollectionVisibility: (
    collectionId: string,
    visible: boolean,
  ) => Promise<void> | void;
}

type CollectionInstallFilter = "all" | "installed" | "available";
type CollectionDisplayMode = "grid" | "table";

const GRID_INITIAL_VISIBLE_COUNT = 24;
const GRID_BATCH_SIZE = 12;
const TABLE_INITIAL_VISIBLE_COUNT = 20;
const TABLE_BATCH_SIZE = 16;

const getInitialVisibleCount = (displayMode: CollectionDisplayMode) =>
  displayMode === "grid"
    ? GRID_INITIAL_VISIBLE_COUNT
    : TABLE_INITIAL_VISIBLE_COUNT;

const getVisibleBatchSize = (displayMode: CollectionDisplayMode) =>
  displayMode === "grid" ? GRID_BATCH_SIZE : TABLE_BATCH_SIZE;

const getCollectionCategories = (collection: EventCollectionMeta) =>
  (collection.categories ?? [])
    .map((category) => category.trim())
    .filter((category) => category.length > 0);

const matchesCollectionQuery = (
  collection: EventCollectionMeta,
  query: string,
) => {
  if (!query) return true;

  const categorySearchText = getCollectionCategories(collection)
    .join(" ")
    .toLowerCase();

  return (
    collection.name.toLowerCase().includes(query) ||
    collection.description.toLowerCase().includes(query) ||
    collection.author.toLowerCase().includes(query) ||
    categorySearchText.includes(query)
  );
};

const hasInstalledCollection = (
  collectionEventsById: Record<string, Event[]>,
  collectionId: string,
) => Object.prototype.hasOwnProperty.call(collectionEventsById, collectionId);

const matchesInstallFilter = (
  collectionId: string,
  activeFilter: CollectionInstallFilter,
  installedCollectionIds: Set<string>,
) => {
  if (activeFilter === "installed") {
    return installedCollectionIds.has(collectionId);
  }

  if (activeFilter === "available") {
    return !installedCollectionIds.has(collectionId);
  }

  return true;
};

export const ExploreCollectionsModal: React.FC<
  ExploreCollectionsModalProps
> = ({
  collections,
  visibleCollectionIds,
  downloadingCollectionIds,
  collectionEventsById,
  onClose,
  onDownloadCollection,
  onDeleteCollection,
  onSetCollectionVisibility,
}) => {
  const { t } = useI18n();
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<CollectionInstallFilter>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<CollectionDisplayMode>("grid");
  const [visibleCollectionCount, setVisibleCollectionCount] = useState(
    getInitialVisibleCount("grid"),
  );
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLowHeightViewport, setIsLowHeightViewport] = useState(false);
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<
    string | null
  >(null);

  const normalizedQuery = query.trim().toLowerCase();
  const deferredNormalizedQuery = useDeferredValue(normalizedQuery);
  const installedCollectionIds = useMemo(
    () =>
      new Set(
        collections
          .filter((collection) =>
            hasInstalledCollection(collectionEventsById, collection.id),
          )
          .map((collection) => collection.id),
      ),
    [collections, collectionEventsById],
  );

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();

    collections.forEach((collection) => {
      if (
        !matchesInstallFilter(
          collection.id,
          activeFilter,
          installedCollectionIds,
        )
      ) {
        return;
      }

      getCollectionCategories(collection).forEach((category) => {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort(([left], [right]) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      )
      .map(([category, count]) => ({
        value: category,
        label: category,
        count,
      }));
  }, [activeFilter, collections, installedCollectionIds]);

  const filteredCollections = useMemo(
    () =>
      collections.filter((collection) => {
        if (!matchesCollectionQuery(collection, deferredNormalizedQuery)) {
          return false;
        }

        if (
          !matchesInstallFilter(
            collection.id,
            activeFilter,
            installedCollectionIds,
          )
        ) {
          return false;
        }

        if (activeCategory) {
          return getCollectionCategories(collection).includes(activeCategory);
        }

        return true;
      }),
    [
      activeCategory,
      activeFilter,
      collections,
      deferredNormalizedQuery,
      installedCollectionIds,
    ],
  );

  const visibleCollections = filteredCollections.slice(
    0,
    visibleCollectionCount,
  );

  const downloadedCollectionCount = installedCollectionIds.size;
  const availableCollectionCount =
    collections.length - downloadedCollectionCount;
  const filterOptions: Array<{
    label: string;
    value: CollectionInstallFilter;
    count: number;
  }> = [
    { label: t("all"), value: "all", count: collections.length },
    {
      label: t("installed"),
      value: "installed",
      count: downloadedCollectionCount,
    },
    {
      label: t("available"),
      value: "available",
      count: availableCollectionCount,
    },
  ];

  const emptyStateTitle =
    activeFilter === "installed"
      ? t("noInstalledCollectionsFound")
      : activeFilter === "available"
        ? t("noAvailableCollectionsFound")
        : t("noCatalogCollectionsFound");
  const emptyStateDescription = normalizedQuery
    ? t("tryDifferentKeyword")
    : activeFilter === "installed"
      ? t("addCollectionsToLibrary")
      : activeFilter === "available"
        ? t("everythingAlreadyInLibrary")
        : t("tryAdjustCurrentFilter");

  useEffect(() => {
    if (
      activeCategory &&
      !categoryOptions.some((option) => option.value === activeCategory)
    ) {
      setActiveCategory(null);
    }
  }, [activeCategory, categoryOptions]);

  useEffect(() => {
    const nextVisibleCount = getInitialVisibleCount(displayMode);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setVisibleCollectionCount(nextVisibleCount);
  }, [activeCategory, activeFilter, deferredNormalizedQuery, displayMode]);

  useEffect(() => {
    setVisibleCollectionCount((current) => {
      if (filteredCollections.length === 0) {
        return getInitialVisibleCount(displayMode);
      }

      return Math.min(
        Math.max(current, getInitialVisibleCount(displayMode)),
        filteredCollections.length,
      );
    });
  }, [displayMode, filteredCollections.length]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel || visibleCollectionCount >= filteredCollections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        setVisibleCollectionCount((current) =>
          Math.min(
            current + getVisibleBatchSize(displayMode),
            filteredCollections.length,
          ),
        );
      },
      {
        root,
        rootMargin: "0px 0px 320px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayMode, filteredCollections.length, visibleCollectionCount]);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 180);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isClosing, onClose]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-height: 760px)");
    const syncViewportMode = () => {
      setIsLowHeightViewport(mediaQuery.matches);
    };

    syncViewportMode();
    mediaQuery.addEventListener("change", syncViewportMode);

    return () => {
      mediaQuery.removeEventListener("change", syncViewportMode);
    };
  }, []);

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    shouldCloseOnPointerUpRef.current = e.target === e.currentTarget;
  };

  const handleBackdropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldCloseOnPointerUpRef.current && e.target === e.currentTarget) {
      requestClose();
    }

    shouldCloseOnPointerUpRef.current = false;
  };

  const renderGridCard = (collection: EventCollectionMeta) => {
    const collectionCategories = getCollectionCategories(collection);
    const isDownloaded = installedCollectionIds.has(collection.id);
    const isCollectionMenuOpen = openCollectionMenuId === collection.id;
    const isVisibleOnTimeline = visibleCollectionIds.includes(collection.id);
    const isLoading = downloadingCollectionIds.includes(collection.id);
    const totalLoadedEvents = collectionEventsById[collection.id]?.length ?? 0;

    return (
      <div
        key={`explore-${collection.id}`}
        className={`ui-card relative rounded-[1.45rem] p-3.5 ${
          isVisibleOnTimeline
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-zinc-800 bg-zinc-950/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-zinc-800 bg-zinc-900 text-2xl">
            {collection.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="text-[0.96rem] font-semibold text-white">
                {collection.name}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.76rem] text-zinc-500">
              <span>{t("byAuthor", { author: collection.author })}</span>
              {isVisibleOnTimeline ? (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-emerald-200">
                  {t("onTimeline")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[0.84rem] leading-6 text-zinc-400">
          {collection.description}
        </p>

        {collectionCategories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {collectionCategories.map((category) => (
              <span
                key={`${collection.id}-${category}`}
                className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300"
              >
                {category}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
          <span>
            {isDownloaded ? t("eventsCount", { count: totalLoadedEvents }) : ""}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {!isDownloaded ? (
            <button
              onClick={() => void onDownloadCollection(collection.id)}
              disabled={isLoading}
              className="ui-button ui-button-primary w-full rounded-[0.95rem] px-3 py-2.5 text-[0.8rem] disabled:cursor-wait disabled:opacity-60"
            >
              <Download size={14} />
              <span>{isLoading ? t("downloading") : t("download")}</span>
            </button>
          ) : (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  void onSetCollectionVisibility(
                    collection.id,
                    !isVisibleOnTimeline,
                  );
                }}
                className={`ui-button ${
                  isVisibleOnTimeline
                    ? "ui-button-primary"
                    : "ui-button-secondary"
                } flex-1 rounded-[0.95rem] px-3 py-2.5 text-[0.8rem]`}
              >
                {isVisibleOnTimeline ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{isVisibleOnTimeline ? t("hide") : t("show")}</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenCollectionMenuId((current) =>
                    current === collection.id ? null : collection.id,
                  );
                }}
                className={`ui-icon-button h-9 w-9 shrink-0 rounded-[0.95rem] ${
                  isCollectionMenuOpen ? "border-zinc-600 bg-zinc-800" : ""
                }`}
                aria-label={t("moreActionsForCollection", {
                  name: collection.name,
                })}
                title={t("moreActionsForCollection", {
                  name: collection.name,
                })}
              >
                <MoreHorizontal size={15} />
              </button>
            </>
          )}
        </div>

        {isCollectionMenuOpen ? (
          <div className="ui-floating-menu absolute bottom-15 right-3 z-20 w-[12rem] rounded-[1rem] p-2">
            <div className="mb-1.5 px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {t("moreActions")}
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setOpenCollectionMenuId(null);
                onDeleteCollection(collection);
              }}
              className="ui-button ui-button-compact ui-button-danger w-full justify-start rounded-[0.85rem]"
              aria-label={t("deleteCollectionAction", {
                name: collection.name,
              })}
              title={t("deleteCollectionAction", {
                name: collection.name,
              })}
            >
              <Trash2 />
              <span>{t("delete")}</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderTableRow = (collection: EventCollectionMeta) => {
    const collectionCategories = getCollectionCategories(collection);
    const isDownloaded = installedCollectionIds.has(collection.id);
    const isVisibleOnTimeline = visibleCollectionIds.includes(collection.id);
    const isLoading = downloadingCollectionIds.includes(collection.id);
    const totalLoadedEvents = collectionEventsById[collection.id]?.length ?? 0;

    return (
      <tr key={`explore-table-${collection.id}`} className="align-top">
        <td className="px-3 py-3 md:px-4">
          <div className="flex min-w-[18rem] items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-zinc-800 bg-zinc-900 text-xl">
              {collection.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">
                {collection.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.76rem] text-zinc-500">
                <span>{t("byAuthor", { author: collection.author })}</span>
                {isDownloaded ? (
                  <span className="text-zinc-400">
                    {t("eventsCount", { count: totalLoadedEvents })}
                  </span>
                ) : null}
                {isVisibleOnTimeline ? (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-emerald-200">
                    {t("onTimeline")}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 line-clamp-2 text-[0.8rem] text-zinc-400">
                {collection.description}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 md:px-4">
          <div className="flex min-w-[10rem] flex-wrap gap-1.5">
            {collectionCategories.length > 0 ? (
              collectionCategories.map((category) => (
                <span
                  key={`${collection.id}-table-${category}`}
                  className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300"
                >
                  {category}
                </span>
              ))
            ) : (
              <span className="text-[0.8rem] text-zinc-600">-</span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 md:px-4">
          <div className="flex min-w-[11rem] items-center justify-end gap-2">
            {!isDownloaded ? (
              <button
                onClick={() => void onDownloadCollection(collection.id)}
                disabled={isLoading}
                className="ui-button ui-button-primary rounded-[0.95rem] px-3 py-2 text-[0.78rem] disabled:cursor-wait disabled:opacity-60"
              >
                <Download size={14} />
                <span>{isLoading ? t("downloading") : t("download")}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() =>
                    void onSetCollectionVisibility(
                      collection.id,
                      !isVisibleOnTimeline,
                    )
                  }
                  className={`ui-button ${
                    isVisibleOnTimeline
                      ? "ui-button-primary"
                      : "ui-button-secondary"
                  } rounded-[0.95rem] px-3 py-2 text-[0.78rem]`}
                >
                  {isVisibleOnTimeline ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{isVisibleOnTimeline ? t("hide") : t("show")}</span>
                </button>
                <button
                  onClick={() => onDeleteCollection(collection)}
                  className="ui-button ui-button-danger rounded-[0.95rem] px-3 py-2 text-[0.78rem]"
                >
                  <Trash2 size={14} />
                  <span>{t("delete")}</span>
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div
      className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4"
      data-ui-state={isClosing ? "closing" : "open"}
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={() => {
        shouldCloseOnPointerUpRef.current = false;
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="ui-modal-surface ui-panel w-full max-w-5xl overflow-hidden rounded-[2rem]"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <div
            className={`sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl ${
              isLowHeightViewport ? "px-4 pb-4 pt-4" : "px-6 pb-5 pt-6"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0 max-w-2xl">
                <h2
                  className={`ui-display-title truncate whitespace-nowrap text-white ${
                    isLowHeightViewport ? "text-[1.9rem]" : "text-[2.3rem]"
                  }`}
                >
                  {t("publicCollections")}
                </h2>
              </div>
              <button
                onClick={requestClose}
                className={`ui-icon-button ${
                  isLowHeightViewport ? "p-1.5" : "p-2"
                }`}
                aria-label={t("closeExploreModal")}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="text"
                      placeholder={t("searchCatalogPlaceholder")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className={`ui-field pl-11 pr-4 ${
                        isLowHeightViewport ? "py-2.5" : "py-3"
                      }`}
                    />
                  </div>
                  <div
                    className={`hidden shrink-0 items-center gap-1 text-[11px] font-medium md:flex ${
                      areFiltersVisible ? "md:flex" : "md:hidden"
                    }`}
                  >
                    {filterOptions.map((option) => {
                      const isActive = option.value === activeFilter;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setActiveFilter(option.value)}
                          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors ${
                            isActive
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                          }`}
                        >
                          <span>{option.label}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              isActive
                                ? "bg-emerald-500/15 text-emerald-50"
                                : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/90 p-1">
                    <button
                      type="button"
                      onClick={() => setAreFiltersVisible((current) => !current)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-100"
                      aria-label={
                        areFiltersVisible
                          ? t("hideCatalogFilters")
                          : t("showCatalogFilters")
                      }
                      title={
                        areFiltersVisible
                          ? t("hideCatalogFilters")
                          : t("showCatalogFilters")
                      }
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${
                          areFiltersVisible ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode("grid")}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        displayMode === "grid"
                          ? "bg-emerald-500/12 text-emerald-100"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                      aria-label={t("gridView")}
                      title={t("gridView")}
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode("table")}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        displayMode === "table"
                          ? "bg-emerald-500/12 text-emerald-100"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                      aria-label={t("tableView")}
                      title={t("tableView")}
                    >
                      <List size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`items-center gap-1 text-[11px] font-medium md:hidden ${
                  areFiltersVisible ? "flex flex-wrap" : "hidden"
                }`}
              >
                {filterOptions.map((option) => {
                  const isActive = option.value === activeFilter;

                  return (
                    <button
                      key={`mobile-${option.value}`}
                      type="button"
                      onClick={() => setActiveFilter(option.value)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.78rem] font-semibold transition-colors ${
                        isActive
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                      }`}
                    >
                      <span>{option.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-50"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {categoryOptions.length > 0 ? (
                <div
                  className={`-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                    areFiltersVisible ? "block" : "hidden"
                  }`}
                >
                  <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                    <span className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {t("categories")}
                    </span>
                    {categoryOptions.map((option) => {
                      const isActive = option.value === activeCategory;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setActiveCategory((current) =>
                              current === option.value ? null : option.value,
                            )
                          }
                          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
                            isActive
                              ? "border-sky-500/40 bg-sky-500/12 text-sky-100"
                              : "border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                          }`}
                          aria-pressed={isActive}
                        >
                          <span>{option.label}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              isActive
                                ? "bg-sky-500/15 text-sky-50"
                                : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={
              displayMode === "grid"
                ? isLowHeightViewport
                  ? "min-h-0 flex-1 overflow-y-auto p-4"
                  : "min-h-0 flex-1 overflow-y-auto p-6"
                : isLowHeightViewport
                  ? "min-h-0 flex-1 overflow-y-auto px-0 pb-4"
                  : "min-h-0 flex-1 overflow-y-auto px-0 pb-6"
            }
            ref={scrollContainerRef}
          >
            {filteredCollections.length === 0 ? (
              <div className="mx-4 rounded-[1.4rem] border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center md:mx-6">
                <div className="text-lg font-semibold text-white">
                  {emptyStateTitle}
                </div>
                <p className="mt-2 text-[0.9rem] text-zinc-500">
                  {emptyStateDescription}
                </p>
              </div>
            ) : displayMode === "grid" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCollections.map(renderGridCard)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800/80 text-left">
                  <thead className="sticky top-0 z-10 bg-zinc-950/95 text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500 backdrop-blur-xl">
                    <tr>
                      <th className="px-3 py-3 md:px-4">{t("collection")}</th>
                      <th className="px-3 py-3 md:px-4">{t("categories")}</th>
                      <th className="px-3 py-3 text-right md:px-4">
                        {t("moreActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {visibleCollections.map(renderTableRow)}
                  </tbody>
                </table>
              </div>
            )}

            {visibleCollectionCount < filteredCollections.length ? (
              <div
                ref={loadMoreSentinelRef}
                className={
                  displayMode === "grid"
                    ? "h-8 w-full"
                    : "mx-3 h-8 w-full md:mx-4"
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
