import React, { useEffect, useMemo, useRef, useState } from "react";
import { Event, EventCollectionMeta, MediaFilter } from "../constants/types";
import {
  ArrowLeft,
  Compass,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
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
  onImportCollections: (file: File) => Promise<string> | string;
  onExportCollection: (
    collectionId: string,
  ) => Promise<string | void> | string | void;
  onBackToLanding: () => void;
  openRequestKey?: number;
  openExploreRequestKey?: number;
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
  onImportCollections,
  onExportCollection,
  onBackToLanding,
  openRequestKey = 0,
  openExploreRequestKey = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    null,
  );
  const [openCollectionMenuId, setOpenCollectionMenuId] = useState<
    string | null
  >(null);
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
  const [libraryTransferStatus, setLibraryTransferStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const prevIsOpenRef = useRef(false);
  const prevOpenRequestKeyRef = useRef(openRequestKey);
  const prevOpenExploreRequestKeyRef = useRef(openExploreRequestKey);

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
      setOpenCollectionMenuId(null);
      setBrowsingCollectionId(null);
      setLibraryTransferStatus(null);
      resetCollectionSearchState();
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, visibleCollectionIds]);

  useEffect(() => {
    if (!libraryTransferStatus) return;

    const timeoutId = window.setTimeout(() => {
      setLibraryTransferStatus(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [libraryTransferStatus]);

  useEffect(() => {
    if (openRequestKey === prevOpenRequestKeyRef.current) return;
    prevOpenRequestKeyRef.current = openRequestKey;
    setIsOpen(true);
  }, [openRequestKey]);

  useEffect(() => {
    if (openExploreRequestKey === prevOpenExploreRequestKeyRef.current) return;
    prevOpenExploreRequestKeyRef.current = openExploreRequestKey;
    setIsOpen(true);
    setIsExploreOpen(true);
  }, [openExploreRequestKey]);

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
    setOpenCollectionMenuId(null);
    setBrowsingCollectionId((current) => {
      const nextCollectionId = current === collectionId ? null : collectionId;
      resetCollectionSearchState();
      return nextCollectionId;
    });
  };

  const toggleCollectionMenu = (collectionId: string) => {
    setActiveCollectionId(collectionId);
    setOpenCollectionMenuId((current) =>
      current === collectionId ? null : collectionId,
    );
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

  const handleExportCollection = async (collectionId: string) => {
    try {
      const message = await onExportCollection(collectionId);
      setLibraryTransferStatus({
        tone: "success",
        message: message || "Collection export is ready.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to export collection.";
      setLibraryTransferStatus({ tone: "error", message });
    }
  };

  const handleImportCollections = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const message = await onImportCollections(file);
      setLibraryTransferStatus({
        tone: "success",
        message: message || `Imported ${file.name}.`,
      });
      setIsOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to import collections.";
      setLibraryTransferStatus({ tone: "error", message });
    }
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
        className={`ui-sidebar-shell fixed left-0 top-0 z-90 flex h-full w-screen max-w-[26rem] transform flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 pt-20 sm:p-5 sm:pt-20">
          <div className="mb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="ui-display-title text-[2rem] leading-none text-white">
                  Time Horizon
                </h2>
                <p className="mt-2 max-w-sm text-[0.9rem] leading-6 text-zinc-400">
                  Curate collections, search events, and compose a cleaner
                  view of history across every scale.
                </p>
              </div>
              <button
                type="button"
                onClick={onBackToLanding}
                className="ui-button ui-button-compact ui-button-secondary shrink-0 rounded-full px-3 py-2"
                aria-label="Back to landing page"
                title="Back to landing"
              >
                <ArrowLeft size={14} />
                <span>Landing</span>
              </button>
            </div>
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
              <span>Public Collections</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportCollections(event)}
            />
            {libraryTransferStatus ? (
              <div
                className={`mt-3 rounded-[1rem] border px-3 py-2.5 text-[0.78rem] leading-6 ${
                  libraryTransferStatus.tone === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-500/20 bg-rose-500/10 text-rose-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    {libraryTransferStatus.message}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLibraryTransferStatus(null)}
                    className="mt-0.5 shrink-0 rounded-full p-1 transition-colors hover:bg-black/20"
                    aria-label="Dismiss library transfer status"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="ui-display-title">
                My Collections ({downloadedCollections.length})
              </h3>
              <button
                onClick={() => importInputRef.current?.click()}
                className="ui-button ui-button-compact ui-button-secondary shrink-0"
              >
                <Upload />
                <span>Import</span>
              </button>
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
                    const isCollectionMenuOpen =
                      openCollectionMenuId === collection.id;
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
                          setOpenCollectionMenuId((current) =>
                            current === collection.id ? null : current,
                          );
                        }}
                        className={`ui-card group relative rounded-[1.45rem] p-3.5 outline-none focus-visible:border-emerald-500/45 focus-visible:ring-1 focus-visible:ring-emerald-500/30 ${
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
                        </div>

                        <p className="mt-3 line-clamp-2 text-[0.84rem] leading-6 text-zinc-400">
                          {collection.description}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCollectionBrowser(collection.id);
                            }}
                            className={`ui-button ${
                              isCollectionBrowserOpen
                                ? "ui-button-primary"
                                : "ui-button-secondary"
                            } flex-1 rounded-[0.95rem] px-3 py-2.5 text-[0.8rem]`}
                            aria-label={`Browse events in ${collection.name}`}
                            title={`Browse events in ${collection.name}`}
                          >
                            <Search size={14} />
                            <span>Browse</span>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void togglePinnedCollection(collection.id);
                            }}
                            className={`ui-button ${
                              isVisibleOnTimeline
                                ? "ui-button-primary"
                                : "ui-button-secondary"
                            } flex-1 rounded-[0.95rem] px-3 py-2.5 text-[0.8rem]`}
                            aria-label={
                              isVisibleOnTimeline
                                ? `Hide ${collection.name} from timeline`
                                : `Show ${collection.name} on timeline`
                            }
                            title={
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
                            <span>{isVisibleOnTimeline ? "Hide" : "Show"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCollectionMenu(collection.id);
                            }}
                            className={`ui-icon-button h-9 w-9 shrink-0 rounded-[0.95rem] ${
                              isCollectionMenuOpen
                                ? "border-zinc-600 bg-zinc-800"
                                : ""
                            }`}
                            aria-label={`More actions for ${collection.name}`}
                            title={`More actions for ${collection.name}`}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>

                        {isCollectionMenuOpen ? (
                          <div className="ui-floating-menu absolute bottom-15 right-3 z-20 w-[13rem] rounded-[1rem] p-2">
                            <div className="mb-1.5 px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              More Actions
                            </div>
                            <div className="grid gap-1.5">
                              <label
                                className="ui-button ui-button-compact ui-button-secondary relative w-full cursor-pointer justify-start rounded-[0.85rem]"
                                title={`Set color for ${collection.name}`}
                              >
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
                                <span>Color</span>
                              </label>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  onAddEvent(collection.id);
                                }}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem]"
                              >
                                <Plus />
                                <span>Add Event</span>
                              </button>
                              {isSyncable ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenCollectionMenuId(null);
                                    void onSyncCollection(collection.id);
                                  }}
                                  disabled={isLoading}
                                  className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem] disabled:cursor-wait disabled:opacity-60"
                                >
                                  <RefreshCw
                                    className={isLoading ? "animate-spin" : ""}
                                  />
                                  <span>Sync</span>
                                </button>
                              ) : null}
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  void handleExportCollection(collection.id);
                                }}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem]"
                              >
                                <Download />
                                <span>Export</span>
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  handleDeleteCollection(collection);
                                }}
                                className="ui-button ui-button-compact ui-button-danger w-full justify-start rounded-[0.85rem]"
                                aria-label={`Delete ${collection.name}`}
                                title={`Delete ${collection.name}`}
                              >
                                <Trash2 />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        ) : null}
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
              panelClassName="w-full max-w-none rounded-[1.6rem] border-zinc-800 bg-zinc-950/95 shadow-2xl"
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
