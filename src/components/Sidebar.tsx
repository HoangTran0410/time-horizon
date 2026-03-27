import React, { useEffect, useMemo, useRef, useState } from "react";
import { Event, EventCollectionMeta } from "../constants/types";
import {
  Compass,
  Eye,
  EyeOff,
  FolderPlus,
  Menu,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { ExploreCollectionsModal } from "./ExploreCollectionsModal";

interface SidebarProps {
  collections: EventCollectionMeta[];
  onDownloadCollection: (collectionId: string) => Promise<void> | void;
  onSyncCollection: (collectionId: string) => Promise<void> | void;
  syncableCollectionIds: string[];
  visibleCollectionIds: string[];
  onSetCollectionVisibility: (
    collectionId: string,
    visible: boolean,
  ) => Promise<void> | void;
  downloadingCollectionIds: string[];
  collectionEventsById: Record<string, Event[]>;
  collectionColors: Record<string, string | null>;
  onSetCollectionColor: (collectionId: string, color: string) => void;
  onDeleteCollection: (collection: EventCollectionMeta) => void;
  onAddEvent: (collectionId?: string) => void;
  onAddCollection: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  onDownloadCollection,
  onSyncCollection,
  syncableCollectionIds,
  visibleCollectionIds,
  onSetCollectionVisibility,
  downloadingCollectionIds,
  collectionEventsById,
  collectionColors,
  onSetCollectionColor,
  onDeleteCollection,
  onAddEvent,
  onAddCollection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    null,
  );
  const [sessionPinnedCollectionIds, setSessionPinnedCollectionIds] = useState<
    string[]
  >([]);
  const prevIsOpenRef = useRef(false);

  const normalizedCollectionQuery = collectionQuery.trim().toLowerCase();

  const hasCollectionData = (collectionId: string) =>
    Object.prototype.hasOwnProperty.call(collectionEventsById, collectionId);

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

  const downloadedCollections = useMemo(
    () => collections.filter((collection) => hasCollectionData(collection.id)),
    [collections, collectionEventsById],
  );
  const downloadedCollectionsById = useMemo(
    () =>
      new Map(
        downloadedCollections.map((collection) => [collection.id, collection]),
      ),
    [downloadedCollections],
  );
  const publicCollections = useMemo(
    () =>
      collections.filter((collection) =>
        syncableCollectionIds.includes(collection.id),
      ),
    [collections, syncableCollectionIds],
  );
  const filteredCollections = useMemo(
    () =>
      downloadedCollections.filter((collection) =>
        matchesCollectionQuery(collection, normalizedCollectionQuery),
      ),
    [downloadedCollections, normalizedCollectionQuery],
  );
  const visibleCollections = useMemo(
    () =>
      downloadedCollections.filter((collection) =>
        visibleCollectionIds.includes(collection.id),
      ),
    [downloadedCollections, visibleCollectionIds],
  );
  const pinnedCollectionIds = sessionPinnedCollectionIds.filter(
    (collectionId) => downloadedCollectionsById.has(collectionId),
  );
  const pinnedCollections = pinnedCollectionIds
    .map((collectionId) => downloadedCollectionsById.get(collectionId))
    .filter((collection): collection is EventCollectionMeta =>
      Boolean(collection),
    );

  const showPinnedVisibleSection = pinnedCollections.length > 0;

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSessionPinnedCollectionIds(visibleCollectionIds);
    }

    if (!isOpen && prevIsOpenRef.current) {
      setSessionPinnedCollectionIds([]);
      setActiveCollectionId(null);
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, visibleCollectionIds]);

  const togglePinnedCollection = async (collectionId: string) => {
    const isVisible = visibleCollectionIds.includes(collectionId);
    await onSetCollectionVisibility(collectionId, !isVisible);

    setSessionPinnedCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );
  };

  const handleDeleteCollection = (collection: EventCollectionMeta) => {
    const message =
      collection.author === "You"
        ? `Delete "${collection.name}" and all of its local events?`
        : `Remove "${collection.name}" from the sidebar and delete its downloaded local copy?`;

    if (!window.confirm(message)) return;

    setSessionPinnedCollectionIds((prev) =>
      prev.filter((id) => id !== collection.id),
    );
    onDeleteCollection(collection);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-95 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white shadow-lg transition-colors hover:bg-zinc-800"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        className={`fixed left-0 top-0 z-90 flex h-full w-screen transform flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-300 ease-in-out sm:w-90 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 pt-20">
          <h2 className="mb-4 text-xl font-bold text-white">Time Horizon</h2>

          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddEvent()}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                <span>Event</span>
              </button>
              <button
                onClick={onAddCollection}
                className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
              >
                <FolderPlus size={16} />
                <span>Collection</span>
              </button>
            </div>
            <button
              onClick={() => setIsExploreOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
            >
              <Compass size={16} />
              <span>Explore Public Collections</span>
            </button>
          </div>

          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Collections ({downloadedCollections.length})
              </h3>
            </div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search..."
                value={collectionQuery}
                onChange={(event) => setCollectionQuery(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white placeholder-zinc-500 transition-colors focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              {downloadedCollections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="mb-2 text-sm font-medium text-zinc-200">
                    No downloaded collections yet
                  </div>
                  <p className="text-sm leading-6 text-zinc-500">
                    Open Explore to browse public collections and download them
                    to your workspace.
                  </p>
                  <button
                    onClick={() => setIsExploreOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    <Compass size={14} />
                    <span>Open Explore</span>
                  </button>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-500">
                  No collections match your search.
                </div>
              ) : (
                <>
                  {showPinnedVisibleSection && (
                    <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                          Visible on timeline
                        </div>
                        <div className="text-[11px] text-emerald-200">
                          {visibleCollections.length}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pinnedCollections.map((collection) => {
                          const isVisible = visibleCollectionIds.includes(
                            collection.id,
                          );
                          const collectionColor =
                            collectionColors[collection.id] ?? "#71717a";

                          return (
                            <div
                              key={`visible-${collection.id}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                                isVisible
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-300"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  void togglePinnedCollection(collection.id)
                                }
                                className="inline-flex items-center gap-2 rounded-full px-1 transition-colors hover:bg-black/20"
                                title={`${isVisible ? "Hide" : "Show"} ${collection.name}`}
                              >
                                <span>{collection.emoji}</span>
                                <span className="max-w-24 truncate">
                                  {collection.name}
                                </span>
                                {isVisible ? (
                                  <Eye size={12} />
                                ) : (
                                  <EyeOff size={12} />
                                )}
                              </button>
                              <label className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-zinc-700">
                                <input
                                  type="color"
                                  value={collectionColor}
                                  onChange={(event) =>
                                    onSetCollectionColor(
                                      collection.id,
                                      event.target.value,
                                    )
                                  }
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  aria-label={`Set color for ${collection.name}`}
                                />
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: collectionColor }}
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filteredCollections.map((collection) => {
                    const isVisibleOnTimeline = visibleCollectionIds.includes(
                      collection.id,
                    );
                    const isCollectionActive =
                      activeCollectionId === collection.id;
                    const isLoading = downloadingCollectionIds.includes(
                      collection.id,
                    );
                    const isSyncable = syncableCollectionIds.includes(
                      collection.id,
                    );
                    const totalLoadedEvents =
                      collectionEventsById[collection.id]?.length ?? 0;
                    const collectionColor =
                      collectionColors[collection.id] ?? "#71717a";

                    let statusLabel = "";
                    let statusClassName =
                      "border-zinc-700/70 bg-zinc-900 text-zinc-400";

                    if (isLoading) {
                      statusLabel = "Syncing";
                      statusClassName =
                        "border-amber-500/30 bg-amber-500/10 text-amber-200";
                    } else if (isVisibleOnTimeline) {
                      statusLabel = "Visible";
                      statusClassName =
                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
                    }

                    return (
                      <div
                        key={collection.id}
                        tabIndex={0}
                        onClick={() => setActiveCollectionId(collection.id)}
                        onFocus={() => setActiveCollectionId(collection.id)}
                        onBlur={(event) => {
                          const nextFocused = event.relatedTarget;
                          if (
                            nextFocused instanceof Node &&
                            event.currentTarget.contains(nextFocused)
                          ) {
                            return;
                          }

                          setActiveCollectionId((current) =>
                            current === collection.id ? null : current,
                          );
                        }}
                        className={`group rounded-xl border px-2.5 py-2 transition-colors outline-none focus-visible:border-emerald-500/45 focus-visible:ring-1 focus-visible:ring-emerald-500/30 ${
                          isVisibleOnTimeline
                            ? "border-emerald-500/35 bg-emerald-500/10"
                            : "border-zinc-800 bg-zinc-900/90"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span className="pt-0.5 text-xl leading-none">
                              {collection.emoji}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="truncate text-[13px] font-semibold text-white">
                                  {collection.name}
                                </h4>
                                {statusLabel ? (
                                  <span
                                    className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] ${statusClassName}`}
                                  >
                                    {statusLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                                <span>{totalLoadedEvents} events</span>
                                <span>by {collection.author}</span>
                                {/* <span className="inline-flex items-center gap-1">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: collectionColor }}
                                  />
                                  Timeline color
                                </span> */}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 transition-opacity duration-150 ${
                              isCollectionActive
                                ? "pointer-events-auto opacity-100"
                                : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                            }`}
                          >
                            <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 transition-colors hover:border-zinc-700">
                              <input
                                type="color"
                                value={collectionColor}
                                onChange={(event) =>
                                  onSetCollectionColor(
                                    collection.id,
                                    event.target.value,
                                  )
                                }
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label={`Set color for ${collection.name}`}
                              />
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: collectionColor }}
                              />
                            </label>
                            <button
                              onClick={() =>
                                void togglePinnedCollection(collection.id)
                              }
                              className={`rounded-lg border p-1.5 transition-colors ${
                                isVisibleOnTimeline
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                                  : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-white"
                              }`}
                              aria-label={
                                isVisibleOnTimeline
                                  ? `Hide ${collection.name} from timeline`
                                  : `Show ${collection.name} on timeline`
                              }
                            >
                              {isVisibleOnTimeline ? (
                                <Eye size={14} />
                              ) : (
                                <EyeOff size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-400">
                          {collection.description}
                        </p>

                        <div
                          className={`overflow-hidden transition-all duration-150 ${
                            isCollectionActive
                              ? "pointer-events-auto mt-2 max-h-16 opacity-100"
                              : "pointer-events-none mt-0 max-h-0 opacity-0 group-hover:pointer-events-auto group-hover:mt-2 group-hover:max-h-16 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:mt-2 group-focus-within:max-h-16 group-focus-within:opacity-100"
                          }`}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => onAddEvent(collection.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15"
                            >
                              <Plus size={12} />
                              {/* <span>Event</span> */}
                            </button>
                            {isSyncable ? (
                              <button
                                onClick={() =>
                                  void onSyncCollection(collection.id)
                                }
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white disabled:cursor-wait disabled:opacity-60"
                              >
                                <RefreshCw
                                  size={12}
                                  className={isLoading ? "animate-spin" : ""}
                                />
                                {/* <span>Refresh</span> */}
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDeleteCollection(collection)}
                              className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 transition-colors hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-200"
                              aria-label={`Delete ${collection.name}`}
                              title={`Delete ${collection.name}`}
                            >
                              <Trash2 size={12} />
                              {/* <span>Delete</span> */}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {isExploreOpen ? (
        <ExploreCollectionsModal
          collections={publicCollections}
          visibleCollectionIds={visibleCollectionIds}
          downloadingCollectionIds={downloadingCollectionIds}
          collectionEventsById={collectionEventsById}
          onClose={() => setIsExploreOpen(false)}
          onDownloadCollection={onDownloadCollection}
          onSetCollectionVisibility={onSetCollectionVisibility}
        />
      ) : null}
    </>
  );
};
