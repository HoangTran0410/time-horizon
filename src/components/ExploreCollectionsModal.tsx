import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search, X } from "lucide-react";
import type { Event, EventCollectionMeta } from "../constants/types";

interface ExploreCollectionsModalProps {
  collections: EventCollectionMeta[];
  visibleCollectionIds: string[];
  downloadingCollectionIds: string[];
  collectionEventsById: Record<string, Event[]>;
  onClose: () => void;
  onDownloadCollection: (collectionId: string) => Promise<void> | void;
  onSetCollectionVisibility: (
    collectionId: string,
    visible: boolean,
  ) => Promise<void> | void;
}

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

export const ExploreCollectionsModal: React.FC<
  ExploreCollectionsModalProps
> = ({
  collections,
  visibleCollectionIds,
  downloadingCollectionIds,
  collectionEventsById,
  onClose,
  onDownloadCollection,
  onSetCollectionVisibility,
}) => {
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [query, setQuery] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCollections = useMemo(
    () =>
      collections.filter((collection) =>
        matchesCollectionQuery(collection, normalizedQuery),
      ),
    [collections, normalizedQuery],
  );

  const downloadedCollectionCount = collections.filter((collection) =>
    Object.prototype.hasOwnProperty.call(collectionEventsById, collection.id),
  ).length;
  const availableCollectionCount =
    collections.length - downloadedCollectionCount;

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
      className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      data-ui-state={isClosing ? "closing" : "open"}
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={() => {
        shouldCloseOnPointerUpRef.current = false;
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="ui-modal-surface w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-b border-zinc-800 px-6 pb-5 pt-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-white">
                  Browse Public Collections
                </h2>
                {/* <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Search the public catalog, then download a collection into
                  your local workspace to manage it from the sidebar.
                </p> */}
              </div>
              <button
                onClick={requestClose}
                className="rounded-full border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
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
                  placeholder="Search by title, author, or description..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 transition-colors focus:border-emerald-500 focus:outline-none"
                />
              </div>
              {/* <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
                <span>{collections.length} public</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>{availableCollectionCount} available</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>{downloadedCollectionCount} downloaded</span>
              </div> */}
            </div>
          </div>

          <div className="overflow-y-auto p-6">
            {filteredCollections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center">
                <div className="text-lg font-medium text-white">
                  No public collections found
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  Try a different keyword or clear the current search.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCollections.map((collection) => {
                  const isDownloaded = Object.prototype.hasOwnProperty.call(
                    collectionEventsById,
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

                  let badgeLabel = "";
                  let badgeClassName =
                    "border-zinc-700 bg-zinc-900 text-zinc-300";

                  if (isLoading) {
                    badgeLabel = "Downloading";
                    badgeClassName =
                      "border-amber-500/30 bg-amber-500/10 text-amber-200";
                  } else if (isDownloaded) {
                    badgeLabel = "Downloaded";
                    badgeClassName =
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
                  }

                  let actionLabel = "Download";
                  if (isLoading) {
                    actionLabel = "Downloading...";
                  } else if (isDownloaded && isVisibleOnTimeline) {
                    actionLabel = "On Timeline";
                  } else if (isDownloaded) {
                    actionLabel = "Show";
                  }

                  return (
                    <div
                      key={`explore-${collection.id}`}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        isVisibleOnTimeline
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-2xl">
                          {collection.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-semibold text-white">
                            {collection.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                            <span className="truncate">
                              by {collection.author}
                            </span>
                            {!!badgeLabel && (
                              <span
                                className={`rounded-full border px-2 py-0.5 font-medium ${badgeClassName}`}
                              >
                                {badgeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                        {collection.description}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                        {/* <span>{collection.createdAt}</span> */}
                        <span>
                          {isDownloaded ? `${totalLoadedEvents} events` : ""}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          onClick={() =>
                            void onDownloadCollection(collection.id)
                          }
                          disabled={
                            isLoading || (isDownloaded && isVisibleOnTimeline)
                          }
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            isDownloaded
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-default disabled:opacity-80"
                              : "bg-emerald-500 text-white hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-60"
                          }`}
                        >
                          <Download size={12} />
                          <span>{actionLabel}</span>
                        </button>

                        {isDownloaded && (
                          <button
                            onClick={() => {
                              void onSetCollectionVisibility(
                                collection.id,
                                !isVisibleOnTimeline,
                              );
                            }}
                            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                          >
                            {isVisibleOnTimeline ? "Hide" : "Toggle"}
                          </button>
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
