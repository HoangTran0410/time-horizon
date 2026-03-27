import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Eye, EyeOff, Search, Trash2, X } from "lucide-react";
import type { Event, EventCollectionMeta } from "../constants/types";

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

const matchesCollectionQuery = (
  collection: EventCollectionMeta,
  query: string,
) => {
  if (!query) return true;

  return (
    collection.name.toLowerCase().includes(query) ||
    collection.description.toLowerCase().includes(query) ||
    collection.author.toLowerCase().includes(query)
  );
};

const hasInstalledCollection = (
  collectionEventsById: Record<string, Event[]>,
  collectionId: string,
) => Object.prototype.hasOwnProperty.call(collectionEventsById, collectionId);

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
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<CollectionInstallFilter>("all");
  const [isClosing, setIsClosing] = useState(false);
  const [isLowHeightViewport, setIsLowHeightViewport] = useState(false);

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

  const filteredCollections = useMemo(
    () =>
      collections.filter((collection) => {
        const matchesQuery = matchesCollectionQuery(
          collection,
          normalizedQuery,
        );
        if (!matchesQuery) return false;

        if (activeFilter === "installed") {
          return installedCollectionIds.has(collection.id);
        }

        if (activeFilter === "available") {
          return !installedCollectionIds.has(collection.id);
        }

        return true;
      }),
    [activeFilter, collections, installedCollectionIds, normalizedQuery],
  );

  const downloadedCollectionCount = installedCollectionIds.size;
  const availableCollectionCount =
    collections.length - downloadedCollectionCount;
  const filterOptions: Array<{
    label: string;
    value: CollectionInstallFilter;
    count: number;
  }> = [
    { label: "All", value: "all", count: collections.length },
    {
      label: "Installed",
      value: "installed",
      count: downloadedCollectionCount,
    },
    {
      label: "Available",
      value: "available",
      count: availableCollectionCount,
    },
  ];

  const emptyStateTitle =
    activeFilter === "installed"
      ? "No installed collections found"
      : activeFilter === "available"
        ? "No available collections found"
        : "No catalog collections found";
  const emptyStateDescription = normalizedQuery
    ? "Try a different keyword or clear the current search."
    : activeFilter === "installed"
      ? "Add collections to your library to see them here."
      : activeFilter === "available"
        ? "Everything in the catalog is already in your library."
        : "Try a different keyword or adjust the current filter.";

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
        className="ui-modal-surface w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div
          className={`flex max-h-[85vh] flex-col ${
            isLowHeightViewport ? "overflow-y-auto" : "overflow-hidden"
          }`}
        >
          <div
            className={`border-b border-zinc-800 ${
              isLowHeightViewport ? "px-4 pb-4 pt-4" : "px-6 pb-5 pt-6"
            }`}
          >
            <div className={`flex items-start justify-between mb-2 gap-3`}>
              <div className="max-w-2xl">
                <h2
                  className={`font-bold text-white ${
                    isLowHeightViewport ? "text-xl" : "text-2xl"
                  }`}
                >
                  Public Collections
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Browse the catalog, then filter down to what is already in
                  your library.
                </p>
              </div>
              <button
                onClick={requestClose}
                className={`rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white ${
                  isLowHeightViewport ? "p-1.5" : "p-2"
                }`}
                aria-label="Close Explore modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="text"
                  placeholder="Search the catalog by title, author, or description…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-11 pr-4 text-sm text-white placeholder-zinc-500 transition-colors focus:border-emerald-500 focus:outline-none ${
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
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
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
          </div>

          <div
            className={
              isLowHeightViewport
                ? "overflow-visible p-4"
                : "min-h-0 flex-1 overflow-y-auto p-6"
            }
          >
            {filteredCollections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center">
                <div className="text-lg font-medium text-white">
                  {emptyStateTitle}
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {emptyStateDescription}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCollections.map((collection) => {
                  const isDownloaded = installedCollectionIds.has(
                    collection.id,
                  );
                  const isVisibleOnTimeline = visibleCollectionIds.includes(
                    collection.id,
                  );
                  const isLoading = downloadingCollectionIds.includes(
                    collection.id,
                  );
                  const totalLoadedEvents =
                    collectionEventsById[collection.id]?.length ?? 0;

                  let primaryActionLabel = "Add to Library";
                  if (isLoading) {
                    primaryActionLabel = "Adding…";
                  } else if (isDownloaded) {
                    primaryActionLabel = "Added";
                  }

                  return (
                    <div
                      key={`explore-${collection.id}`}
                      className={`rounded-2xl border p-3 transition-colors ${
                        isVisibleOnTimeline
                          ? "border-emerald-500/40 bg-emerald-500/8"
                          : "border-zinc-800 bg-zinc-950/55 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-2xl">
                          {collection.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="truncate text-sm font-semibold text-white">
                              {collection.name}
                            </div>
                            {/* {isDownloaded ? (
                              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-emerald-200">
                                Installed
                              </span>
                            ) : null} */}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                            <span className="truncate">
                              by {collection.author}
                            </span>
                            {isVisibleOnTimeline ? (
                              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-emerald-200">
                                On Timeline
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-400">
                        {collection.description}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                        {/* <span>{collection.createdAt}</span> */}
                        <span>
                          {isDownloaded ? `${totalLoadedEvents} events` : ""}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() =>
                            void onDownloadCollection(collection.id)
                          }
                          disabled={isLoading || isDownloaded}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                            isDownloaded
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-default disabled:opacity-80"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-wait disabled:opacity-60"
                          }`}
                        >
                          {isDownloaded ? (
                            <Check size={12} />
                          ) : (
                            <Download size={12} />
                          )}
                          <span>{primaryActionLabel}</span>
                        </button>

                        {isDownloaded && (
                          <>
                            <button
                              onClick={() => {
                                void onSetCollectionVisibility(
                                  collection.id,
                                  !isVisibleOnTimeline,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                            >
                              {isVisibleOnTimeline ? (
                                <EyeOff size={12} />
                              ) : (
                                <Eye size={12} />
                              )}
                              <span>
                                {isVisibleOnTimeline ? "Hide" : "Show"}
                              </span>
                            </button>
                            <button
                              onClick={() => onDeleteCollection(collection)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 transition-colors hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-200"
                              aria-label={`Delete ${collection.name}`}
                              title={`Delete ${collection.name}`}
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
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
