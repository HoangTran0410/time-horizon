import React, { useEffect, useMemo, useRef, useState } from "react";
import { Event, EventCollectionMeta, MediaFilter } from "../constants/types";
import {
  Compass,
  Eye,
  EyeOff,
  FolderPlus,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDialogOptions } from "./ConfirmDialog";
import { ExploreCollectionsModal } from "./ExploreCollectionsModal";
import { SearchPanel, SearchPanelStateAdapter } from "./SearchPanel";
import { DEFAULT_SEARCH_SORT_MODE, type SearchSortMode } from "../stores";

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
  onRequestConfirm: (options: ConfirmDialogOptions) => void;
  onPreviewEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
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
  onRequestConfirm,
  onPreviewEvent,
  onDeleteEvent,
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
  const [browsingCollectionId, setBrowsingCollectionId] = useState<
    string | null
  >(null);
  const [collectionEventQuery, setCollectionEventQuery] = useState("");
  const [collectionEventMediaFilters, setCollectionEventMediaFilters] =
    useState<MediaFilter[]>([]);
  const [collectionEventSortMode, setCollectionEventSortMode] =
    useState<SearchSortMode>(DEFAULT_SEARCH_SORT_MODE);
  const [collectionEventStartInput, setCollectionEventStartInput] =
    useState("");
  const [collectionEventEndInput, setCollectionEventEndInput] = useState("");
  const [showCollectionMatchesOnTimeline, setShowCollectionMatchesOnTimeline] =
    useState(false);
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
  const browsedCollection = browsingCollectionId
    ? (downloadedCollectionsById.get(browsingCollectionId) ?? null)
    : null;
  const browsedCollectionEvents = browsedCollection
    ? (collectionEventsById[browsedCollection.id] ?? [])
    : [];

  const resetCollectionSearchState = () => {
    setCollectionEventQuery("");
    setCollectionEventMediaFilters([]);
    setCollectionEventSortMode(DEFAULT_SEARCH_SORT_MODE);
    setCollectionEventStartInput("");
    setCollectionEventEndInput("");
    setShowCollectionMatchesOnTimeline(false);
  };

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setSessionPinnedCollectionIds(visibleCollectionIds);
    }

    if (!isOpen && prevIsOpenRef.current) {
      setSessionPinnedCollectionIds([]);
      setActiveCollectionId(null);
      setBrowsingCollectionId(null);
      resetCollectionSearchState();
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
    onRequestConfirm({
      title: "Delete collection?",
      description:
        collection.author === "You"
          ? `This will permanently remove "${collection.name}" and all of its local events.`
          : `This will remove "${collection.name}" from your library and delete its downloaded local copy.`,
      confirmLabel: "Delete Collection",
      tone: "danger",
      onConfirm: () => {
        setSessionPinnedCollectionIds((prev) =>
          prev.filter((id) => id !== collection.id),
        );
        onDeleteCollection(collection);
      },
    });
  };

  const toggleCollectionBrowser = (collectionId: string) => {
    setActiveCollectionId(collectionId);
    setBrowsingCollectionId((current) => {
      const nextCollectionId = current === collectionId ? null : collectionId;
      resetCollectionSearchState();
      return nextCollectionId;
    });
  };

  useEffect(() => {
    if (!browsingCollectionId) return;

    if (!downloadedCollectionsById.has(browsingCollectionId)) {
      setBrowsingCollectionId(null);
      resetCollectionSearchState();
    }
  }, [browsingCollectionId, downloadedCollectionsById]);

  const toggleCollectionMediaFilter = (filter: MediaFilter) => {
    setCollectionEventMediaFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    );
  };

  const sidebarSearchState: SearchPanelStateAdapter = {
    searchQuery: collectionEventQuery,
    activeMediaFilters: collectionEventMediaFilters,
    searchSortMode: collectionEventSortMode,
    timeRangeStartInput: collectionEventStartInput,
    timeRangeEndInput: collectionEventEndInput,
    showOnlyResultsOnTimeline: showCollectionMatchesOnTimeline,
    setSearchQuery: setCollectionEventQuery,
    toggleMediaFilter: toggleCollectionMediaFilter,
    setSearchSortMode: setCollectionEventSortMode,
    setTimeRangeStartInput: setCollectionEventStartInput,
    setTimeRangeEndInput: setCollectionEventEndInput,
    setShowOnlyResultsOnTimeline: setShowCollectionMatchesOnTimeline,
  };

  const handleSelectSidebarSearchEvent = (event: Event) => {
    onPreviewEvent(event);
    setBrowsingCollectionId(null);
    resetCollectionSearchState();
  };

  const handleCloseSidebarSearch = () => {
    setBrowsingCollectionId(null);
    resetCollectionSearchState();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ui-panel fixed left-4 top-4 z-95 flex h-12 w-12 items-center justify-center rounded-[1.25rem] text-white"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        className={`fixed left-0 top-0 z-90 flex h-full w-screen max-w-[26rem] transform flex-col border-r border-zinc-800 bg-zinc-950/96 shadow-[0_24px_90px_rgba(2,6,23,0.36)] backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 pt-20 sm:p-5 sm:pt-20">
          <div className="mb-5">
            <div className="ui-kicker mb-2">Timeline Atlas</div>
            <h2 className="ui-display-title text-[2rem] leading-none text-white">
              Time Horizon
            </h2>
            <p className="mt-2 max-w-sm text-[0.9rem] leading-6 text-zinc-400">
              Curate collections, search events, and compose a cleaner view of
              history across every scale.
            </p>
          </div>

          <div className="ui-panel-soft mb-6 rounded-[1.5rem] p-3.5">
            {/* <div className="mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Library
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Create your own collections or add curated ones from the
                catalog.
              </p>
            </div> */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onAddEvent()}
                className="ui-button ui-button-primary rounded-[1.1rem] px-4 py-3"
              >
                <Plus size={16} />
                <span>Event</span>
              </button>
              <button
                onClick={onAddCollection}
                className="ui-button ui-button-secondary rounded-[1.1rem] px-4 py-3"
              >
                <FolderPlus size={16} />
                <span>Collection</span>
              </button>
            </div>
            <button
              onClick={() => setIsExploreOpen(true)}
              className="ui-button ui-button-secondary mt-2 w-full rounded-[1.1rem] px-4 py-3"
            >
              <Compass size={16} />
              <span>Browse Collections</span>
            </button>
          </div>

          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="ui-kicker">
                My Collections ({downloadedCollections.length})
              </h3>
            </div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search my collections…"
                value={collectionQuery}
                onChange={(event) => setCollectionQuery(event.target.value)}
                className="ui-field"
              />
            </div>

            <div className="space-y-2">
              {downloadedCollections.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-zinc-950/50 p-4.5">
                  <div className="mb-2 text-base font-semibold text-zinc-200">
                    Your library is empty
                  </div>
                  <p className="text-[0.9rem] leading-6 text-zinc-500">
                    Add a collection from the catalog, or create your own local
                    collection to start organizing events.
                  </p>
                  <button
                    onClick={() => setIsExploreOpen(true)}
                    className="ui-button ui-button-secondary mt-4 px-4 py-2.5 text-[0.84rem]"
                  >
                    <Compass size={14} />
                    <span>Open Catalog</span>
                  </button>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-zinc-800 bg-zinc-950/40 p-3.5 text-[0.88rem] text-zinc-500">
                  No collections in your library match that search.
                </div>
              ) : (
                <>
                  {showPinnedVisibleSection && (
                    <div className="mb-3 rounded-[1.35rem] border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="ui-kicker text-emerald-300">
                          Visible on timeline
                        </div>
                        <div className="text-[0.76rem] font-semibold text-emerald-200">
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
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.78rem] transition-colors ${
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
                    const isCollectionBrowserOpen =
                      browsingCollectionId === collection.id;
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
                        className={`ui-card group rounded-[1.45rem] p-3.5 outline-none focus-visible:border-emerald-500/45 focus-visible:ring-1 focus-visible:ring-emerald-500/30 ${
                          isVisibleOnTimeline
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-zinc-800"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-zinc-800 bg-zinc-900 text-2xl leading-none">
                              {collection.emoji}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="truncate text-[0.98rem] font-semibold text-white">
                                  {collection.name}
                                </h4>
                                {statusLabel ? (
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.18em] ${statusClassName}`}
                                  >
                                    {statusLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.76rem] text-zinc-500">
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
                            className={`flex items-center gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 ${
                              isCollectionActive
                                ? "pointer-events-auto opacity-100"
                                : "pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100"
                            }`}
                          >
                            <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700">
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
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCollectionBrowser(collection.id);
                              }}
                              className={`rounded-full border p-2 transition-colors ${
                                isCollectionBrowserOpen
                                  ? "border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15"
                                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                              }`}
                              aria-label={`Browse events in ${collection.name}`}
                              title={`Browse events in ${collection.name}`}
                            >
                              <Search size={14} />
                            </button>
                            <button
                              onClick={() =>
                                void togglePinnedCollection(collection.id)
                              }
                              className={`rounded-full border p-2 transition-colors ${
                                isVisibleOnTimeline
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
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

                        <p className="mt-3 line-clamp-2 text-[0.84rem] leading-6 text-zinc-400">
                          {collection.description}
                        </p>

                        <div
                          className={`overflow-hidden transition-all duration-150 ${
                            isCollectionActive
                              ? "pointer-events-auto mt-3 max-h-24 opacity-100"
                              : "pointer-events-none mt-0 max-h-0 opacity-0 group-hover:pointer-events-auto group-hover:mt-3 group-hover:max-h-[32rem] group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:mt-3 group-focus-within:max-h-[32rem] group-focus-within:opacity-100"
                          }`}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => onAddEvent(collection.id)}
                              className="ui-button ui-button-primary gap-1.5 px-2.5 py-1.5 text-[0.68rem]"
                            >
                              <Plus size={12} />
                              <span>Add</span>
                            </button>
                            {isSyncable ? (
                              <button
                                onClick={() =>
                                  void onSyncCollection(collection.id)
                                }
                                disabled={isLoading}
                                className="ui-button ui-button-secondary gap-1.5 px-2.5 py-1.5 text-[0.68rem] disabled:cursor-wait disabled:opacity-60"
                              >
                                <RefreshCw
                                  size={12}
                                  className={isLoading ? "animate-spin" : ""}
                                />
                                <span>Sync</span>
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDeleteCollection(collection)}
                              className="ui-button ui-button-danger gap-1.5 px-2.5 py-1.5 text-[0.68rem]"
                              aria-label={`Delete ${collection.name}`}
                              title={`Delete ${collection.name}`}
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
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

      {browsedCollection ? (
        <div
          className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4"
          onClick={handleCloseSidebarSearch}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div
            className="w-full max-w-[min(92vw,40rem)]"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <SearchPanel
              isOpen
              searchableEvents={browsedCollectionEvents}
              onSearchSelect={handleSelectSidebarSearchEvent}
              onDeleteEvent={onDeleteEvent}
              state={sidebarSearchState}
              title={`Browse '${browsedCollection.name}'`}
              // subtitle={`Browse ${browsedCollectionEvents.length} loaded events.`}
              // searchPlaceholder={`Search ${browsedCollection.name}...`}
              emptyMessage="No events in this collection matched your search."
              resultLabel="collection events"
              showTimelineToggle={false}
              wrapperClassName="w-full"
              panelClassName="w-full max-w-none rounded-[1.6rem] border-zinc-800 bg-zinc-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
              maxHeight="min(82vh, calc(100vh - 3rem))"
              onClose={handleCloseSidebarSearch}
            />
          </div>
        </div>
      ) : null}

      {isExploreOpen ? (
        <ExploreCollectionsModal
          collections={publicCollections}
          visibleCollectionIds={visibleCollectionIds}
          downloadingCollectionIds={downloadingCollectionIds}
          collectionEventsById={collectionEventsById}
          onClose={() => setIsExploreOpen(false)}
          onDownloadCollection={onDownloadCollection}
          onDeleteCollection={handleDeleteCollection}
          onSetCollectionVisibility={onSetCollectionVisibility}
        />
      ) : null}
    </>
  );
};
