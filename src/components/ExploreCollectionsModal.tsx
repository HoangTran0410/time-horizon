import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, MoreHorizontal, Trash2, X } from "lucide-react";
import type { Event, EventCollectionMeta } from "../constants/types";
import { useI18n } from "../i18n";

interface ExploreCollectionsModalProps {
  collections: EventCollectionMeta[];
  visibleCollectionIds: string[];
  downloadingCollectionIds: string[];
  collectionEventsById: Record<string, Event[]>;
  onClose: () => void;
  onDownloadCollection: (collectionId: string) => Promise<void> | void;
  onDeleteCollection: (collection: EventCollectionMeta) => void;
  onSetCollectionVisibility: (
    collectionId: string,
    visible: boolean,
  ) => Promise<void> | void;
}

type CollectionInstallFilter = "all" | "installed" | "available";

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
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<CollectionInstallFilter>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isLowHeightViewport, setIsLowHeightViewport] = useState(false);
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<
    string | null
  >(null);

  const normalizedQuery = query.trim().toLowerCase();
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
        const matchesQuery = matchesCollectionQuery(
          collection,
          normalizedQuery,
        );
        if (!matchesQuery) return false;

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
      installedCollectionIds,
      normalizedQuery,
    ],
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
            <div className={`flex items-start justify-between mb-2 gap-3`}>
              <div className="max-w-2xl">
                {/* <div className="ui-kicker mb-2">Curated Catalog</div> */}
                <h2
                  className={`ui-display-title text-white ${
                    isLowHeightViewport ? "text-[1.9rem]" : "text-[2.3rem]"
                  }`}
                >
                  {t("publicCollections")}
                </h2>
                {/* <p className="text-[0.92rem] leading-7 text-zinc-400">
                  Browse the catalog, then filter down to what is already in
                  your library.
                </p> */}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  {/* <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                  /> */}
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
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium">
                  {filterOptions.map((option) => {
                    const isActive = option.value === activeFilter;

                    return (
                      <button
                        key={option.value}
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
              </div>

              {categoryOptions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
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
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.75rem] font-semibold transition-colors ${
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
              ) : null}
            </div>
          </div>

          <div
            className={
              isLowHeightViewport
                ? "min-h-0 flex-1 overflow-y-auto p-4"
                : "min-h-0 flex-1 overflow-y-auto p-6"
            }
          >
            {filteredCollections.length === 0 ? (
              <div className="rounded-[1.4rem] border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center">
                <div className="text-lg font-semibold text-white">
                  {emptyStateTitle}
                </div>
                <p className="mt-2 text-[0.9rem] text-zinc-500">
                  {emptyStateDescription}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCollections.map((collection) => {
                  const collectionCategories =
                    getCollectionCategories(collection);
                  const isDownloaded = installedCollectionIds.has(
                    collection.id,
                  );
                  const isCollectionMenuOpen =
                    openCollectionMenuId === collection.id;
                  const isVisibleOnTimeline = visibleCollectionIds.includes(
                    collection.id,
                  );
                  const isLoading = downloadingCollectionIds.includes(
                    collection.id,
                  );
                  const totalLoadedEvents =
                    collectionEventsById[collection.id]?.length ?? 0;

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
                            <span className="">
                              {t("byAuthor", { author: collection.author })}
                            </span>
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
                        {/* <span>{collection.createdAt}</span> */}
                        <span>
                          {isDownloaded
                            ? t("eventsCount", { count: totalLoadedEvents })
                            : ""}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {!isDownloaded && (
                          <button
                            onClick={() =>
                              void onDownloadCollection(collection.id)
                            }
                            disabled={isLoading}
                            className="ui-button ui-button-primary w-full rounded-[0.95rem] px-3 py-2.5 text-[0.8rem] disabled:cursor-wait disabled:opacity-60"
                          >
                            <Download size={14} />
                            <span>
                              {isLoading ? t("downloading") : t("download")}
                            </span>
                          </button>
                        )}

                        {isDownloaded && (
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
                              {isVisibleOnTimeline ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                              <span>
                                {isVisibleOnTimeline ? t("hide") : t("show")}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenCollectionMenuId((current) =>
                                  current === collection.id
                                    ? null
                                    : collection.id,
                                );
                              }}
                              className={`ui-icon-button h-9 w-9 shrink-0 rounded-[0.95rem] ${
                                isCollectionMenuOpen
                                  ? "border-zinc-600 bg-zinc-800"
                                  : ""
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
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
