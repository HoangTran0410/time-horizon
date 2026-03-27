import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Event,
  EventCollectionMeta,
  getEventTimelineYear,
} from "../constants/types";
import {
  Compass,
  Eye,
  EyeOff,
  FolderPlus,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { getEventDisplayLabel } from "../helpers";
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
  collectionColorPreferences: Record<string, string>;
  onSetCollectionColor: (collectionId: string, color: string) => void;
  onResetCollectionColor: (collectionId: string) => void;
  onDeleteCollection: (collection: EventCollectionMeta) => void;
  onFocusEvent: (event: Event) => void;
  onEditEvent: (event: Event) => void;
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
  collectionColorPreferences,
  onSetCollectionColor,
  onResetCollectionColor,
  onDeleteCollection,
  onFocusEvent,
  onEditEvent,
  onAddEvent,
  onAddCollection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<string[]>(
    [],
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
  const publicCollections = useMemo(
    () =>
      collections.filter((collection) =>
        syncableCollectionIds.includes(collection.id),
      ),
    [collections, syncableCollectionIds],
  );
  const filteredCollections = downloadedCollections.filter((collection) =>
    matchesCollectionQuery(collection, normalizedCollectionQuery),
  );

  const visibleCollections = downloadedCollections.filter((collection) =>
    visibleCollectionIds.includes(collection.id),
  );
  const pinnedCollectionIds = sessionPinnedCollectionIds.filter(
    (collectionId) =>
      downloadedCollections.some(
        (collection) => collection.id === collectionId,
      ),
  );
  const pinnedCollections = pinnedCollectionIds
    .map((collectionId) =>
      downloadedCollections.find(
        (collection) => collection.id === collectionId,
      ),
    )
    .filter((collection): collection is EventCollectionMeta =>
      Boolean(collection),
    );

  const showPinnedVisibleSection = pinnedCollections.length > 0;

  useEffect(() => {
    // Open sidebar: start pinned list from currently visible collections.
    if (isOpen && !prevIsOpenRef.current) {
      setSessionPinnedCollectionIds(visibleCollectionIds);
    }

    // Close sidebar: clear pinned quick-toggle list as requested.
    if (!isOpen && prevIsOpenRef.current) {
      setSessionPinnedCollectionIds([]);
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, visibleCollectionIds]);

  const togglePinnedCollection = async (collectionId: string) => {
    const isVisible = visibleCollectionIds.includes(collectionId);
    await onSetCollectionVisibility(collectionId, !isVisible);

    // Keep chip visible during this sidebar session for quick undo/redo toggles.
    setSessionPinnedCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );
  };

  const getCollectionEvents = (collectionId: string) => {
    const collectionEvents = collectionEventsById[collectionId] ?? [];

    return [...collectionEvents].sort((a, b) => {
      const yearDiff = getEventTimelineYear(a) - getEventTimelineYear(b);
      if (Math.abs(yearDiff) > 1e-9) return yearDiff;
      return a.title.localeCompare(b.title);
    });
  };

  const toggleCollection = (collectionId: string, isExpanded: boolean) => {
    setExpandedCollectionIds((prev) =>
      isExpanded
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId],
    );
  };

  const handleDeleteCollection = (collection: EventCollectionMeta) => {
    const message =
      collection.author === "You"
        ? `Delete "${collection.name}" and all of its local events?`
        : `Remove "${collection.name}" from the sidebar and delete its downloaded local copy?`;

    if (!window.confirm(message)) return;

    setExpandedCollectionIds((prev) =>
      prev.filter((id) => id !== collection.id),
    );
    setSessionPinnedCollectionIds((prev) =>
      prev.filter((id) => id !== collection.id),
    );
    onDeleteCollection(collection);
  };

  const handleEventAction = async (
    collectionId: string,
    event: Event,
    action: (target: Event) => void,
  ) => {
    if (!visibleCollectionIds.includes(collectionId)) {
      await onSetCollectionVisibility(collectionId, true);
      setSessionPinnedCollectionIds((prev) =>
        prev.includes(collectionId) ? prev : [...prev, collectionId],
      );
    }

    action(event);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-95 bg-zinc-900 border border-zinc-700 text-white p-2 rounded-lg shadow-lg hover:bg-zinc-800 transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 h-full w-screen sm:w-90 bg-zinc-950 border-r border-zinc-800 z-90 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 pt-20 flex-1 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">Time Horizon</h2>

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

          {/* Collections */}
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
                onChange={(e) => setCollectionQuery(e.target.value)}
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
                                  onChange={(e) =>
                                    onSetCollectionColor(
                                      collection.id,
                                      e.target.value,
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
                    const isExpanded = expandedCollectionIds.includes(
                      collection.id,
                    );
                    const isVisibleOnTimeline = visibleCollectionIds.includes(
                      collection.id,
                    );
                    const isLoading = downloadingCollectionIds.includes(
                      collection.id,
                    );
                    const isSyncable = syncableCollectionIds.includes(
                      collection.id,
                    );
                    const totalLoadedEvents =
                      collectionEventsById[collection.id]?.length ?? 0;
                    const collectionColor = collectionColors[collection.id];
                    const hasCustomColor = Object.prototype.hasOwnProperty.call(
                      collectionColorPreferences,
                      collection.id,
                    );
                    const collectionEvents = isExpanded
                      ? getCollectionEvents(collection.id)
                      : [];

                    let statusLabel = "";
                    let statusClassName =
                      "border-zinc-700/70 bg-zinc-900 text-zinc-400";

                    if (isLoading) {
                      statusLabel = "Loading...";
                      statusClassName =
                        "border-amber-500/30 bg-amber-500/10 text-amber-200";
                    }

                    return (
                      <div
                        key={collection.id}
                        className={`group relative rounded-xl border transition-colors ${
                          isVisibleOnTimeline
                            ? "bg-emerald-500/10 border-emerald-500/50"
                            : "bg-zinc-900 border-zinc-800"
                        }`}
                      >
                        <div
                          className="flex cursor-pointer items-center gap-3 p-2.5"
                          onClick={() => {
                            toggleCollection(collection.id, isExpanded);
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl leading-none">
                                {collection.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">
                                  {collection.name}
                                </div>
                                {statusLabel && (
                                  <div className="mt-0.5 text-[11px] text-amber-200">
                                    {statusLabel}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void togglePinnedCollection(collection.id);
                              }}
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
                                <Eye size={16} />
                              ) : (
                                <EyeOff size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="ui-disclosure" data-open={isExpanded}>
                          <div
                            className={`ui-disclosure-inner border-t border-zinc-800/80 px-3 ${isExpanded ? "pb-3 pt-3" : ""}`}
                          >
                            <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
                              {collection.description}
                              <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                                <span>{totalLoadedEvents} events</span>
                                <span>by {collection.author}</span>
                              </div>
                            </div>

                            <div className="mb-3 flex items-center justify-end gap-2">
                              {/* <div className="flex items-center gap-2"> */}
                              {/* <div className="flex gap-0">
                                  <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white">
                                    <input
                                      type="color"
                                      value={collectionColor ?? "#71717a"}
                                      onChange={(e) =>
                                        onSetCollectionColor(
                                          collection.id,
                                          e.target.value,
                                        )
                                      }
                                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                      aria-label={`Set color for ${collection.name}`}
                                    />
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{
                                        backgroundColor:
                                          collectionColor ?? "#71717a",
                                      }}
                                    />
                                    <span>Color</span>
                                  </label>
                                  {hasCustomColor && (
                                    <button
                                      onClick={() =>
                                        onResetCollectionColor(collection.id)
                                      }
                                      className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div> */}
                              {isSyncable && (
                                <button
                                  onClick={() =>
                                    void onSyncCollection(collection.id)
                                  }
                                  disabled={isLoading}
                                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white disabled:cursor-wait disabled:opacity-60"
                                  aria-label={`Sync ${collection.name}`}
                                >
                                  <RefreshCw
                                    size={16}
                                    className={isLoading ? "animate-spin" : ""}
                                  />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  handleDeleteCollection(collection)
                                }
                                className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 transition-colors hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-200"
                                aria-label={`Delete ${collection.name}`}
                                title={`Delete ${collection.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                onClick={() => onAddEvent(collection.id)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/15"
                              >
                                <Plus size={14} />
                                <span>Event</span>
                              </button>
                              {/* </div> */}
                            </div>

                            {isLoading ? (
                              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
                                Syncing collection events...
                              </div>
                            ) : collectionEvents.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-500">
                                No events in this collection yet.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between px-1 text-[11px] uppercase tracking-wider text-zinc-500">
                                  <span>
                                    Events ({collectionEvents.length})
                                  </span>
                                </div>
                                {collectionEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 transition-colors hover:border-zinc-700"
                                    onClick={() =>
                                      void handleEventAction(
                                        collection.id,
                                        event,
                                        onFocusEvent,
                                      )
                                    }
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-start gap-2">
                                        <span className="mt-0.5 text-xl leading-none">
                                          {event.emoji}
                                        </span>
                                        <div className="min-w-0">
                                          <span className="block truncate text-sm font-medium text-zinc-200">
                                            {event.title}
                                          </span>
                                          <span className="block truncate text-xs text-zinc-500">
                                            {getEventDisplayLabel(event)}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleEventAction(
                                            collection.id,
                                            event,
                                            onEditEvent,
                                          );
                                        }}
                                        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-emerald-500"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
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

      {isExploreOpen && (
        <ExploreCollectionsModal
          collections={publicCollections}
          visibleCollectionIds={visibleCollectionIds}
          downloadingCollectionIds={downloadingCollectionIds}
          collectionEventsById={collectionEventsById}
          onClose={() => setIsExploreOpen(false)}
          onDownloadCollection={onDownloadCollection}
          onSetCollectionVisibility={onSetCollectionVisibility}
        />
      )}
    </>
  );
};
