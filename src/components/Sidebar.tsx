import React, { useEffect, useMemo, useRef, useState } from "react";
import { Event, EventCollectionMeta, MediaFilter } from "../constants/types";
import {
  ArrowLeft,
  Cloud,
  Code,
  Compass,
  Download,
  Eye,
  EyeOff,
  FolderPlus,
  Pencil,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ConfirmDialog, ConfirmDialogOptions } from "./ConfirmDialog";
import { ExploreCollectionsModal } from "./ExploreCollectionsModal";
import { SearchPanel, SearchPanelStateAdapter } from "./SearchPanel";
import { CollectionJsonEditorModal } from "./CollectionJsonEditorModal";
import { stripRuntimeEventIds } from "../helpers";
import { useI18n } from "../i18n";
import {
  DEFAULT_SEARCH_SORT_MODE,
  sanitizeImportedEvents,
  type SearchSortMode,
  useStore,
} from "../stores";

// Props that cannot be derived from the store alone
interface SidebarProps {
  collections: EventCollectionMeta[];
  syncableCollectionIds: string[];
  editableCollectionIds: string[];
  onOpenSyncPanel: () => void;
  /** For passing to Timeline (app-level concern, not sidebar UI state) */
  onBackToLanding: () => void;
  /** External file import — requires user interaction in this component */
  onImportCollections: (file: File) => Promise<string | void> | string | void;
  /** User event interactions — controlled by parent */
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
  onAddEvent: (collectionId?: string) => void;
  onAddCollection: () => void;
  /** JSON editor saves directly to store via this callback */
  onUpdateCollectionEvents: (collectionId: string, events: Event[]) => void;
  /** Opens the event editor for a collection (owned by Timeline) */
  onEditCollection: (collection: EventCollectionMeta) => void;
  /** Exports a collection to file (owned by Timeline) */
  onExportCollection: (
    collectionId: string,
    format?: "csv" | "json",
  ) => Promise<string>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  syncableCollectionIds,
  editableCollectionIds,
  onOpenSyncPanel,
  onBackToLanding,
  onImportCollections,
  onEditEvent,
  onDeleteEvent,
  onAddEvent,
  onAddCollection,
  onUpdateCollectionEvents,
  onEditCollection,
  onExportCollection,
}) => {
  const { t } = useI18n();
  // ── Store state (read directly) ──────────────────────────────────────────
  const collectionLibrary = useStore((s) => s.collectionLibrary);
  const catalogMeta = useStore((s) => s.catalogMeta);
  const visibleCollectionIds = useStore((s) => s.visibleCollectionIds);
  const downloadingCollectionIds = useStore((s) => s.downloadingCollectionIds);
  const collectionColorPreferences = useStore(
    (s) => s.collectionColorPreferences,
  );
  const syncConnectionStatus = useStore((s) => s.syncConnectionStatus);
  const syncPreferences = useStore((s) => s.syncPreferences);
  const deletedCollectionSyncTombstones = useStore(
    (s) => s.deletedCollectionSyncTombstones,
  );

  // Derive from store data (no prop needed)
  const collectionEventsById: Record<string, Event[]> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(collectionLibrary).map(([id, c]) => [id, c.events]),
      ),
    [collectionLibrary],
  );

  const collectionColors: Record<string, string | null> = useMemo(
    () =>
      Object.fromEntries(
        collections.map((c) => [
          c.id,
          collectionColorPreferences[c.id] ?? c.color ?? null,
        ]),
      ),
    [collectionColorPreferences, collections],
  );

  const localCollectionIds: string[] = useMemo(
    () =>
      Object.entries(collectionLibrary)
        .filter(([, c]) => c.isLocal)
        .map(([id]) => id),
    [collectionLibrary],
  );
  const hasPendingSyncableChanges = useMemo(
    () =>
      syncPreferences.onboardingCompleted &&
      (Object.keys(deletedCollectionSyncTombstones).length > 0 ||
        Object.values(collectionLibrary).some(
          (collection) => collection.sync?.dirty,
        )),
    [
      collectionLibrary,
      deletedCollectionSyncTombstones,
      syncPreferences.onboardingCompleted,
    ],
  );
  // Store actions
  const downloadCollection = useStore((s) => s.downloadCollection);
  const syncCollection = useStore((s) => s.syncCollection);
  const setCollectionVisibility = useStore((s) => s.setCollectionVisibility);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const setCollectionColor = useStore((s) => s.setCollectionColor);
  const openSidebar = useStore((s) => s.openSidebar);
  const openSidebarExplore = useStore((s) => s.openSidebarExplore);
  const closeSidebarExplore = useStore((s) => s.closeSidebarExplore);
  const isSidebarOpen = useStore((s) => s.isSidebarOpen);
  const isSidebarExploreOpen = useStore((s) => s.isSidebarExploreOpen);

  const toggleSidebar = () =>
    isSidebarOpen
      ? useStore.getState().closeSidebar()
      : useStore.getState().openSidebar();

  // ── Local UI state ────────────────────────────────────────────────────────
  const importInputRef = useRef<HTMLInputElement>(null);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [, setActiveCollectionId] = useState<string | null>(null);
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
  const [jsonEditorCollection, setJsonEditorCollection] =
    useState<EventCollectionMeta | null>(null);

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
  // Build catalog collections: prefer downloaded meta, fall back to catalog metadata
  const catalogCollectionMetaById = useMemo((): Record<
    string,
    EventCollectionMeta
  > => {
    const syncableSet = new Set(syncableCollectionIds);
    const allCollections = [...collections].filter((c) =>
      syncableSet.has(c.id),
    );
    const result: Record<string, EventCollectionMeta> = {};
    // Catalog metadata: loaded from data/collections-metadata.json
    for (const [id, meta] of Object.entries(catalogMeta)) {
      result[id] = meta as EventCollectionMeta;
    }
    // Downloaded/persisted meta overrides catalog meta
    for (const c of allCollections) {
      result[c.id] = c;
    }
    return result;
  }, [catalogMeta, collections, syncableCollectionIds]);

  const publicCollections = useMemo(
    () =>
      (
        Object.values(catalogCollectionMetaById) as EventCollectionMeta[]
      ).filter((collection) => syncableCollectionIds.includes(collection.id)),
    [catalogCollectionMetaById, syncableCollectionIds],
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
    if (isSidebarOpen && visibleCollectionIds.length > 0) {
      setSessionPinnedCollectionIds((prev) => {
        const next = [...prev];
        let changed = false;
        for (const id of visibleCollectionIds) {
          if (!next.includes(id)) {
            next.push(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [isSidebarOpen, visibleCollectionIds]);

  useEffect(() => {
    if (!libraryTransferStatus) return;
    const id = window.setTimeout(() => setLibraryTransferStatus(null), 5000);
    return () => window.clearTimeout(id);
  }, [libraryTransferStatus]);

  const togglePinnedCollection = async (collectionId: string) => {
    const isVisible = visibleCollectionIds.includes(collectionId);
    setCollectionVisibility(collectionId, !isVisible);

    setSessionPinnedCollectionIds((prev) =>
      prev.includes(collectionId) ? prev : [...prev, collectionId],
    );
  };

  const [confirmDialogOptions, setConfirmDialogOptions] =
    useState<ConfirmDialogOptions | null>(null);

  const handleDeleteCollection = (collection: EventCollectionMeta) => {
    setConfirmDialogOptions({
      title: t("deleteCollectionTitle"),
      description:
        collection.author === "You"
          ? t("deleteCollectionDescriptionLocal", { name: collection.name })
          : t("deleteCollectionDescriptionRemote", { name: collection.name }),
      confirmLabel: t("deleteCollectionConfirm"),
      tone: "danger",
      onConfirm: () => {
        setSessionPinnedCollectionIds((prev) =>
          prev.filter((id) => id !== collection.id),
        );
        deleteCollection(collection.id);
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
    onEditEvent(event);
  };

  const handleCloseSidebarSearch = () => {
    setBrowsingCollectionId(null);
    resetCollectionSearchState();
    closeSidebarExplore();
  };

  const handleExportCollection = async (
    collectionId: string,
    format: "csv" | "json" = "csv",
  ) => {
    try {
      const message = await onExportCollection(collectionId, format);
      setLibraryTransferStatus({
        tone: "success",
        message: message || t("collectionExportReady"),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("collectionExportFailed");
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
        message: message || t("importedFile", { name: file.name }),
      });
      openSidebar();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("importCollectionsFailed");
      setLibraryTransferStatus({ tone: "error", message });
    }
  };

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="ui-panel fixed left-4 top-4 z-95 flex h-12 w-12 items-center justify-center rounded-[1.25rem] text-white"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        className={`ui-sidebar-shell fixed left-0 top-0 z-90 flex h-full w-screen max-w-[26rem] transform flex-col transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
                  {t("sidebarSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={onBackToLanding}
                className="ui-button ui-button-compact ui-button-secondary shrink-0 rounded-full px-3 py-2"
                aria-label={t("backToLandingPage")}
                title={t("backToLandingPage")}
              >
                <ArrowLeft size={14} />
                <span>{t("backHome")}</span>
              </button>
            </div>
          </div>

          <div className="ui-panel-soft mb-4 rounded-[1.5rem] p-3.5">
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
                <span>{t("event")}</span>
              </button>
              <button
                onClick={onAddCollection}
                className="ui-button ui-button-secondary rounded-[1.1rem] px-4 py-3"
              >
                <FolderPlus size={16} />
                <span>{t("collection")}</span>
              </button>
            </div>
            <button
              onClick={openSidebarExplore}
              className="ui-button ui-button-secondary mt-2 w-full rounded-[1.1rem] px-4 py-3"
            >
              <Compass size={16} />
              <span>{t("publicCollections")}</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json,text/csv,.csv"
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
                    aria-label={t("dismiss")}
                    title={t("dismiss")}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-6 flex items-center justify-between gap-2 rounded-[1.1rem] border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${syncConnectionStatus === "error" ? "bg-rose-400" : hasPendingSyncableChanges ? "bg-amber-400" : syncConnectionStatus === "connected" ? "bg-emerald-400" : "bg-zinc-500"}`}
              />
              <span className="text-[0.78rem] font-semibold text-zinc-300">
                {syncConnectionStatus === "connected"
                  ? t("syncConnected")
                  : syncConnectionStatus === "error"
                    ? t("syncError")
                    : hasPendingSyncableChanges
                      ? t("pendingSyncChanges")
                      : t("syncDisconnected")}
              </span>
            </div>
            <button
              onClick={onOpenSyncPanel}
              className="ui-button ui-button-compact ui-button-secondary shrink-0 rounded-full px-3 py-1.5"
            >
              <Cloud size={13} />
              <span className="text-[0.74rem]">{t("openSyncPanel")}</span>
            </button>
          </div>

          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="ui-display-title">
                {t("myCollections", { count: downloadedCollections.length })}
              </h3>
              <button
                onClick={() => importInputRef.current?.click()}
                className="ui-button ui-button-compact ui-button-secondary shrink-0"
              >
                <Upload />
                <span>{t("import")}</span>
              </button>
            </div>
            <div className="mb-3">
              <input
                type="text"
                placeholder={t("searchMyCollections")}
                value={collectionQuery}
                onChange={(event) => setCollectionQuery(event.target.value)}
                className="ui-field"
              />
            </div>

            <div className="space-y-2">
              {downloadedCollections.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-zinc-950/50 p-4.5">
                  <div className="mb-2 text-base font-semibold text-zinc-200">
                    {t("yourLibraryIsEmpty")}
                  </div>
                  <p className="text-[0.9rem] leading-6 text-zinc-500">
                    {t("yourLibraryIsEmptyCopy")}
                  </p>
                  <button
                    onClick={openSidebarExplore}
                    className="ui-button ui-button-secondary mt-4 px-4 py-2.5 text-[0.84rem]"
                  >
                    <Compass size={14} />
                    <span>{t("openCatalog")}</span>
                  </button>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-zinc-800 bg-zinc-950/40 p-3.5 text-[0.88rem] text-zinc-500">
                  {t("noCollectionsMatch")}
                </div>
              ) : (
                <>
                  {showPinnedVisibleSection && (
                    <div className="mb-3 rounded-[1.35rem] border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="ui-kicker text-emerald-300">
                          {t("visibleOnTimeline")}
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
                                title={
                                  isVisible
                                    ? t("hideCollection", {
                                        name: collection.name,
                                      })
                                    : t("showCollection", {
                                        name: collection.name,
                                      })
                                }
                              >
                                <span>{collection.emoji}</span>
                                <span className="">{collection.name}</span>
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
                                    setCollectionColor(
                                      collection.id,
                                      event.target.value,
                                    )
                                  }
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  aria-label={t("setCollectionColor", {
                                    name: collection.name,
                                  })}
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
                    const isCollectionMenuOpen =
                      openCollectionMenuId === collection.id;
                    const isCollectionBrowserOpen =
                      browsingCollectionId === collection.id;
                    const isEditableCollection = editableCollectionIds.includes(
                      collection.id,
                    );
                    const isLocalCollection = localCollectionIds.includes(
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
                    const collectionColor =
                      collectionColors[collection.id] ?? "#71717a";

                    let statusLabel = "";
                    let statusClassName =
                      "border-zinc-700/70 bg-zinc-900 text-zinc-400";

                    if (isLoading) {
                      statusLabel = t("syncing");
                      statusClassName =
                        "border-amber-500/30 bg-amber-500/10 text-amber-200";
                    } else if (isVisibleOnTimeline) {
                      statusLabel = t("visible");
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
                                {isLocalCollection ? (
                                  <span
                                    className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-sky-200"
                                    title={t("localCollectionHelp")}
                                  >
                                    {t("local")}
                                  </span>
                                ) : null}
                                {statusLabel ? (
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.18em] ${statusClassName}`}
                                  >
                                    {statusLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.76rem] text-zinc-500">
                                <span>
                                  {t("eventsCount", {
                                    count: totalLoadedEvents,
                                  })}
                                </span>
                                <span>
                                  {t("byAuthor", { author: collection.author })}
                                </span>
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

                        <p className="mt-2 text-[0.84rem] text-zinc-400">
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
                            aria-label={t("browseCollection", {
                              name: collection.name,
                            })}
                            title={t("browseCollection", {
                              name: collection.name,
                            })}
                          >
                            <Search size={14} />
                            <span>{t("browse")}</span>
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
                                ? t("hideFromTimeline", {
                                    name: collection.name,
                                  })
                                : t("showOnTimeline", { name: collection.name })
                            }
                            title={
                              isVisibleOnTimeline
                                ? t("hideFromTimeline", {
                                    name: collection.name,
                                  })
                                : t("showOnTimeline", { name: collection.name })
                            }
                          >
                            {isVisibleOnTimeline ? (
                              <Eye size={14} />
                            ) : (
                              <EyeOff size={14} />
                            )}
                            <span>
                              {isVisibleOnTimeline ? t("hide") : t("show")}
                            </span>
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
                            aria-label={t("moreActionsForCollection", {
                              name: collection.name,
                            })}
                            title={t("moreActionsForCollection", {
                              name: collection.name,
                            })}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>

                        {isCollectionMenuOpen ? (
                          <div className="ui-floating-menu absolute bottom-15 right-3 z-20 w-[13rem] rounded-[1rem] p-2">
                            <div className="mb-1.5 px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              {t("moreActions")}
                            </div>
                            <div className="grid gap-1.5">
                              <label
                                className="ui-button ui-button-compact ui-button-secondary relative w-full cursor-pointer justify-start rounded-[0.85rem]"
                                title={t("setCollectionColor", {
                                  name: collection.name,
                                })}
                              >
                                <input
                                  type="color"
                                  value={collectionColor}
                                  onChange={(event) =>
                                    setCollectionColor(
                                      collection.id,
                                      event.target.value,
                                    )
                                  }
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  aria-label={t("setCollectionColor", {
                                    name: collection.name,
                                  })}
                                />
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: collectionColor }}
                                />
                                <span>{t("color")}</span>
                              </label>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  onEditCollection(collection);
                                }}
                                disabled={!isEditableCollection}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem] disabled:cursor-not-allowed disabled:opacity-50"
                                title={
                                  isEditableCollection
                                    ? t("editCollection")
                                    : t("editCollectionDisabled")
                                }
                              >
                                <Pencil />
                                <span>{t("editCollection")}</span>
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  onAddEvent(collection.id);
                                }}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem]"
                              >
                                <Plus />
                                <span>{t("addEvent")}</span>
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  setJsonEditorCollection(collection);
                                }}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem]"
                              >
                                <Code />
                                <span>{t("editJson")}</span>
                              </button>
                              {isSyncable ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenCollectionMenuId(null);
                                    void syncCollection(collection.id);
                                  }}
                                  disabled={isLoading}
                                  className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem] disabled:cursor-wait disabled:opacity-60"
                                >
                                  <RefreshCw
                                    className={isLoading ? "animate-spin" : ""}
                                  />
                                  <span>{t("sync")}</span>
                                </button>
                              ) : null}
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  void handleExportCollection(
                                    collection.id,
                                    "csv",
                                  );
                                }}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem]"
                              >
                                <Download />
                                <span>{t("exportCsv")}</span>
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  void handleExportCollection(
                                    collection.id,
                                    "json",
                                  );
                                }}
                                className="ui-button ui-button-compact ui-button-secondary w-full justify-start rounded-[0.85rem]"
                              >
                                <Download />
                                <span>{t("exportJson")}</span>
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenCollectionMenuId(null);
                                  handleDeleteCollection(collection);
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
                                <span>{t("deleteCollection")}</span>
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
          className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4"
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
              onEditEvent={onEditEvent}
              onDeleteEvent={onDeleteEvent}
              state={sidebarSearchState}
              title={t("browseCollectionTitle", {
                name: browsedCollection.name,
              })}
              // subtitle={`Browse ${browsedCollectionEvents.length} loaded events.`}
              // searchPlaceholder={`Search ${browsedCollection.name}...`}
              emptyMessage={t("noResultsForCollection")}
              resultLabel={`${t("collection")} events`}
              showTimelineToggle={false}
              wrapperClassName="w-full"
              panelClassName="w-full max-w-none rounded-[1.6rem] border-zinc-800 bg-zinc-950/95 shadow-2xl"
              maxHeight="min(82vh, calc(100vh - 3rem))"
              onClose={handleCloseSidebarSearch}
            />
          </div>
        </div>
      ) : null}

      {isSidebarExploreOpen ? (
        <ExploreCollectionsModal
          collections={publicCollections}
          visibleCollectionIds={visibleCollectionIds}
          downloadingCollectionIds={downloadingCollectionIds}
          collectionEventsById={collectionEventsById}
          onClose={closeSidebarExplore}
          onDownloadCollection={downloadCollection}
          onDeleteCollection={handleDeleteCollection}
          onSetCollectionVisibility={setCollectionVisibility}
        />
      ) : null}
      {jsonEditorCollection ? (
        <CollectionJsonEditorModal
          collectionId={jsonEditorCollection.id}
          collectionName={jsonEditorCollection.name}
          jsonData={JSON.stringify(
            stripRuntimeEventIds(
              collectionEventsById[jsonEditorCollection.id] ?? [],
            ),
            null,
            2,
          )}
          onSave={(json) => {
            try {
              const events = sanitizeImportedEvents(JSON.parse(json), {
                collectionId: jsonEditorCollection.id,
              });
              onUpdateCollectionEvents(jsonEditorCollection.id, events);
            } catch {
              // invalid — modal shows its own parse error
            }
          }}
          onClose={() => setJsonEditorCollection(null)}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(confirmDialogOptions)}
        title={confirmDialogOptions?.title ?? ""}
        description={confirmDialogOptions?.description ?? ""}
        confirmLabel={confirmDialogOptions?.confirmLabel}
        cancelLabel={confirmDialogOptions?.cancelLabel}
        tone={confirmDialogOptions?.tone}
        onConfirm={() => {
          confirmDialogOptions?.onConfirm();
          setConfirmDialogOptions(null);
        }}
        onCancel={() => setConfirmDialogOptions(null)}
      />
    </>
  );
};
