import React, {
  Suspense,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  lazy,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, FolderOpen, Plus } from "lucide-react";
import { ThemeMode } from "../constants/theme";
import { Event, EventCollectionMeta, StoredEvent } from "../constants/types";
import { CollectionEditor } from "./CollectionEditor";
import { EventEditor } from "./EventEditor";
import { Sidebar } from "./Sidebar";
import { Controller } from "./Controller";
import { ConfirmDialog, type ConfirmDialogOptions } from "./ConfirmDialog";
import {
  SyncConflictDialog,
  type SyncConflictDialogConflict,
} from "./SyncConflictDialog";
import { ShareModal } from "./ShareModal";
import { ImportEventsDialog } from "./ImportEventsDialog";
import { EventInfoPanel } from "./EventInfoPanel";
import { Toolbar } from "./Toolbar";
import { ControlCenterPanel } from "./ControlCenterPanel";
import { SpatialSettingsPanel } from "./SpatialSettingsPanel";
import { SyncPanel } from "./SyncPanel";
import { TimelineGuidanceOverlay } from "./TimelineGuidanceOverlay";
import { TimelineCanvasViewport } from "./TimelineCanvasViewport";
import { WarpOverlay } from "./TimelineMarkers";
import {
  createSpatialAnchorFromViewport,
  createLocalDateStamp,
  createNewTimelineEvent,
  getEventTimelineYear,
  stripRuntimeEventIds,
} from "../helpers";
import { getLocalizedEventTitle } from "../helpers/localization";
import { exportCollectionToCsv, parseCsvEvents } from "../helpers/csv";
import { useI18n } from "../i18n";
import { useTimelineCollections } from "../hooks/useTimelineCollections";
import { useTimelineShareUrl } from "../hooks/useTimelineShareUrl";
import { useTimelineViewport } from "../hooks/useTimelineViewport";
import {
  buildSyncProjectionSnapshot,
  detectSyncConflicts,
  hasPendingSyncableChanges as hasPendingSyncableChangesForSync,
} from "../sync";
import {
  loadSyncProjectionFromGoogleDrive,
  loadGoogleDriveWorkspaceSummary,
  requestGoogleDriveAccessToken,
  revokeGoogleDriveAccessToken,
  syncProjectionToGoogleDrive,
} from "../sync/googleDrive";
import {
  filterTimelineSearchEvents,
  findEventByIdInCollections,
  sanitizeImportedEvents,
  useStore,
  type ImportedCollectionInput,
} from "../stores";

const LazyTimelineSpatialBackground = lazy(async () => {
  const module = await import("./TimelineSpatialBackground");
  return { default: module.TimelineSpatialBackground };
});

interface TimelineProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onBackToLanding: () => void;
}

type CollectionTransferPayload = {
  version: number;
  source: "time-horizon";
  exportedAt: string;
  collections: Array<{
    meta: EventCollectionMeta;
    events: StoredEvent[];
    color?: string | null;
    visible?: boolean;
  }>;
};

export const Timeline = ({
  theme,
  onToggleTheme,
  onBackToLanding,
}: TimelineProps) => {
  const { language, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogOptions | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImportEvents, setPendingImportEvents] = useState<
    Event[] | null
  >(null);
  const [pendingImportDialog, setPendingImportDialog] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<EventCollectionMeta | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isSpatialSettingsPanelOpen, setIsSpatialSettingsPanelOpen] =
    useState(false);
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false);
  const [isSyncBusy, setIsSyncBusy] = useState(false);
  const [syncAccessToken, setSyncAccessToken] = useState<string | null>(null);
  const [syncConflictDialog, setSyncConflictDialog] = useState<{
    mode: "sync" | "restore";
    conflicts: SyncConflictDialogConflict[];
    remoteSnapshot: Awaited<
      ReturnType<typeof loadSyncProjectionFromGoogleDrive>
    >["remoteState"];
  } | null>(null);

  // Store state — individual selectors avoid useShallow overhead
  const selectedEventId = useStore((s) => s.selectedEventId);
  const isRulerActive = useStore((s) => s.isRulerActive);
  const isEventInfoCollapsed = useStore((s) => s.isEventInfoCollapsed);
  const editingEventId = useStore((s) => s.editingEventId);
  const addingEvent = useStore((s) => s.addingEvent);
  const addingCollectionId = useStore((s) => s.addingCollectionId);
  const isCreatingCollection = useStore((s) => s.isCreatingCollection);
  const savedFocusYear = useStore((s) => s.savedFocusYear);
  const savedLogZoom = useStore((s) => s.savedLogZoom);
  const timelineOrientation = useStore((s) => s.timelineOrientation);
  const verticalWheelBehavior = useStore((s) => s.verticalWheelBehavior);
  const verticalTimeDirection = useStore((s) => s.verticalTimeDirection);
  const spatialMapping = useStore((s) => s.spatialMapping);
  const isSpatialAnchorPickMode = useStore((s) => s.isSpatialAnchorPickMode);
  const syncPreferences = useStore((s) => s.syncPreferences);
  const syncConnectionStatus = useStore((s) => s.syncConnectionStatus);
  const collectionLibrary = useStore((s) => s.collectionLibrary);
  const collectionColorPreferences = useStore(
    (s) => s.collectionColorPreferences,
  );
  const deletedCollectionSyncTombstones = useStore(
    (s) => s.deletedCollectionSyncTombstones,
  );
  const focusEvent = useStore((s) => s.focusEvent);
  const previewEvent = useStore((s) => s.previewEvent);
  const clearFocusedEvent = useStore((s) => s.clearFocusedEvent);
  const reopenMobileInfoPanel = useStore((s) => s.reopenMobileInfoPanel);
  const setSavedViewport = useStore((s) => s.setSavedViewport);
  const setTimelineOrientation = useStore((s) => s.setTimelineOrientation);
  const setVerticalWheelBehavior = useStore((s) => s.setVerticalWheelBehavior);
  const setVerticalTimeDirection = useStore((s) => s.setVerticalTimeDirection);
  const setSpatialMapping = useStore((s) => s.setSpatialMapping);
  const startSpatialAnchorPickMode = useStore(
    (s) => s.startSpatialAnchorPickMode,
  );
  const stopSpatialAnchorPickMode = useStore(
    (s) => s.stopSpatialAnchorPickMode,
  );
  const setIsRulerActive = useStore((s) => s.setIsRulerActive);
  const toggleEventInfoCollapsed = useStore((s) => s.toggleEventInfoCollapsed);
  const openEventEditor = useStore((s) => s.openEventEditor);
  const closeEventEditor = useStore((s) => s.closeEventEditor);
  const openEventCreator = useStore((s) => s.openEventCreator);
  const closeEventCreator = useStore((s) => s.closeEventCreator);
  const openCollectionCreator = useStore((s) => s.openCollectionCreator);
  const closeCollectionCreator = useStore((s) => s.closeCollectionCreator);
  const downloadingCollectionIds = useStore((s) => s.downloadingCollectionIds);
  const searchQuery = useStore((s) => s.searchQuery);
  const activeMediaFilters = useStore((s) => s.activeMediaFilters);
  const timeRangeStartInput = useStore((s) => s.timeRangeStartInput);
  const timeRangeEndInput = useStore((s) => s.timeRangeEndInput);
  const showOnlyResultsOnTimeline = useStore(
    (s) => s.showOnlyResultsOnTimeline,
  );

  const {
    collections,
    collectionEventsById,
    visibleCollectionIds,
    collectionColors,
    localCollectionIds,
    catalogCollectionIds,
    writableCollections,
    timelineEvents,
    eventAccentColors,
    singleVisibleCollectionId,
    findEventCollectionId,
    catalogMeta,
    editableCollectionIds,
  } = useTimelineCollections();

  const visibleCollections = collections.filter((c) =>
    visibleCollectionIds.includes(c.id),
  );

  // Store actions — call directly, no need to route through hook
  const addVisibleCollection = useStore((s) => s.addVisibleCollection);
  const setSyncConnectionStatus = useStore((s) => s.setSyncConnectionStatus);
  const completeSyncOnboarding = useStore((s) => s.completeSyncOnboarding);
  const setAutosyncEnabled = useStore((s) => s.setAutosyncEnabled);
  const markSyncSuccess = useStore((s) => s.markSyncSuccess);
  const restoreSyncSnapshot = useStore((s) => s.restoreSyncSnapshot);
  const duplicateCollectionsForConflictResolution = useStore(
    (s) => s.duplicateCollectionsForConflictResolution,
  );
  const downloadCollection = useStore((s) => s.downloadCollection);
  const syncCollection = useStore((s) => s.syncCollection);
  const setCollectionVisibility = useStore((s) => s.setCollectionVisibility);
  const importCollections = useStore((s) => s.importCollections);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const saveEvent = useStore((s) => s.saveEvent);
  const addEvent = useStore((s) => s.addEvent);
  const addEvents = useStore((s) => s.addEvents);
  const replaceCollectionEvents = useStore((s) => s.replaceCollectionEvents);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const createCollection = useStore((s) => s.createCollection);
  const updateCollection = useStore((s) => s.updateCollection);
  const setCollectionColor = useStore((s) => s.setCollectionColor);
  const openSidebar = useStore((s) => s.openSidebar);
  const openSidebarExplore = useStore((s) => s.openSidebarExplore);
  const {
    sharedCollectionIds: sharedCollectionIdsFromUrlRaw,
    sharedEventId: sharedEventIdFromUrl,
    sharedFocusYear,
    sharedLogZoom,
    sharedOrientation,
    sharedSpatialMapping,
    generateShareUrl,
  } = useTimelineShareUrl();
  const selectedEventInfo = useMemo(
    () =>
      selectedEventId
        ? findEventByIdInCollections(collectionEventsById, selectedEventId)
        : null,
    [collectionEventsById, selectedEventId],
  );
  const editingEvent = useMemo(
    () =>
      editingEventId
        ? findEventByIdInCollections(collectionEventsById, editingEventId)
        : null,
    [collectionEventsById, editingEventId],
  );
  const draftEventForCreate = useMemo(
    () => (addingEvent ? createNewTimelineEvent() : null),
    [addingEvent],
  );

  const deferredTimelineSearchQuery = useDeferredValue(searchQuery);
  const hasSharedTimelineState =
    sharedCollectionIdsFromUrlRaw.length > 0 ||
    sharedEventIdFromUrl !== null ||
    sharedFocusYear !== null ||
    sharedLogZoom !== null ||
    sharedOrientation !== null ||
    sharedSpatialMapping !== null;
  const effectiveTimelineOrientation = timelineOrientation;
  const googleClientId =
    (
      import.meta as ImportMeta & {
        env?: Record<string, string | undefined>;
      }
    ).env?.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
  const hasGoogleClientId = googleClientId.length > 0;
  const hasPendingSyncableChanges = useMemo(
    () =>
      hasPendingSyncableChangesForSync({
        collectionLibrary,
        collectionColorPreferences,
        deletedCollectionSyncTombstones,
        syncPreferences,
      }),
    [
      collectionColorPreferences,
      collectionLibrary,
      deletedCollectionSyncTombstones,
      syncPreferences,
    ],
  );

  const resolveSyncAccessToken = async (
    prompt: string,
    onboardingOptions?: {
      enabledScopes: Parameters<typeof completeSyncOnboarding>[0];
      autosyncEnabled: boolean;
    },
  ) => {
    if (!hasGoogleClientId) {
      throw new Error(t("syncNotConfiguredHelp"));
    }

    setSyncConnectionStatus("connecting", null);
    const accessToken = await requestGoogleDriveAccessToken({
      clientId: googleClientId,
      prompt,
    });
    setSyncAccessToken(accessToken);
    if (onboardingOptions) {
      completeSyncOnboarding(onboardingOptions.enabledScopes);
      setAutosyncEnabled(onboardingOptions.autosyncEnabled);
    }
    const workspaceSummary = await loadGoogleDriveWorkspaceSummary({
      accessToken,
    });
    setSyncConnectionStatus(
      "connected",
      workspaceSummary.recoveredManifest
        ? t("syncManifestRecovered", {
            collections: workspaceSummary.manifestCollectionCount,
          })
        : workspaceSummary.hasManifest
          ? t("syncRemoteSummary", {
              collections: workspaceSummary.manifestCollectionCount,
              deleted: workspaceSummary.deletedCollectionCount,
            })
          : t("syncRemoteEmpty"),
    );
    return accessToken;
  };

  const handleConnectSync = async (options: {
    enabledScopes: Parameters<typeof completeSyncOnboarding>[0];
    autosyncEnabled: boolean;
  }) => {
    setIsSyncBusy(true);
    try {
      await resolveSyncAccessToken("consent", options);
    } catch (error) {
      setSyncConnectionStatus(
        "error",
        error instanceof Error ? error.message : t("syncError"),
      );
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleDisconnectSync = async () => {
    setIsSyncBusy(true);
    try {
      if (syncAccessToken) {
        await revokeGoogleDriveAccessToken(syncAccessToken);
      }
      setSyncAccessToken(null);
      setSyncConnectionStatus("disconnected", null);
    } catch (error) {
      setSyncConnectionStatus(
        "error",
        error instanceof Error ? error.message : t("syncError"),
      );
    } finally {
      setIsSyncBusy(false);
    }
  };

  const executeManualSync = async (
    source: "manual" | "autosync" = "manual",
    options?: {
      ignoreConflicts?: boolean;
      remoteSnapshotOverride?: Awaited<
        ReturnType<typeof loadSyncProjectionFromGoogleDrive>
      >["remoteState"];
    },
  ) => {
    setIsSyncBusy(true);

    try {
      const accessToken =
        syncAccessToken ??
        (await resolveSyncAccessToken(source === "manual" ? "consent" : ""));
      const remoteStateResult = options?.remoteSnapshotOverride
        ? {
            remoteState: options.remoteSnapshotOverride,
            recoveredManifest: false,
          }
        : await loadSyncProjectionFromGoogleDrive({
            accessToken,
          });
      if (remoteStateResult.remoteState) {
        const conflicts = detectSyncConflicts({
          collectionLibrary,
          deletedCollectionSyncTombstones,
          syncPreferences,
          collectionColorPreferences,
          remoteState: remoteStateResult.remoteState,
        });

        if (conflicts.length > 0 && !options?.ignoreConflicts) {
          if (source === "manual") {
            setSyncConflictDialog({
              mode: "sync",
              conflicts: conflicts.map((conflict) => ({
                id: conflict.id,
                name:
                  collectionLibrary[conflict.id]?.meta?.name ??
                  remoteStateResult.remoteState?.collections.find(
                    (collection) => collection.id === conflict.id,
                  )?.meta?.name ??
                  conflict.id,
              })),
              remoteSnapshot: remoteStateResult.remoteState,
            });
            return;
          }
          setSyncConnectionStatus(
            "error",
            t("syncConflictsDetected", {
              count: conflicts.length,
            }),
          );
          return;
        }
      }
      const snapshot = buildSyncProjectionSnapshot({
        collectionLibrary,
        deletedCollectionSyncTombstones,
        syncPreferences,
        collectionColorPreferences,
      });
      const result = await syncProjectionToGoogleDrive({
        accessToken,
        snapshot,
      });

      markSyncSuccess({
        syncedAt: result.syncedAt,
        syncedCollections: result.syncedCollections,
        clearedDeletedCollectionIds: result.clearedDeletedCollectionIds,
      });
      setSyncConnectionStatus(
        "connected",
        t("syncRunCompleted", {
          time: new Date(result.syncedAt).toLocaleTimeString(
            language === "vi" ? "vi-VN" : "en-US",
          ),
          uploaded: result.syncedCollections.length,
          skipped: result.skippedCollections.length,
        }),
      );
    } catch (error) {
      setSyncConnectionStatus(
        "error",
        error instanceof Error ? error.message : t("syncError"),
      );
    } finally {
      setIsSyncBusy(false);
    }
  };

  const applyRemoteRestoreSnapshot = (
    remoteSnapshot: NonNullable<
      Awaited<
        ReturnType<typeof loadSyncProjectionFromGoogleDrive>
      >["remoteState"]
    >,
  ) => {
    restoreSyncSnapshot(remoteSnapshot);
    setSyncConnectionStatus(
      "connected",
      t("syncRestoreCompleted", {
        collections: remoteSnapshot.collections.length,
        deleted: remoteSnapshot.deletedCollections.length,
      }),
    );
  };

  const handleRestoreFromDrive = async () => {
    setIsSyncBusy(true);

    try {
      const accessToken =
        syncAccessToken ?? (await resolveSyncAccessToken("consent"));
      const remoteStateResult = await loadSyncProjectionFromGoogleDrive({
        accessToken,
      });
      const remoteSnapshot = remoteStateResult.remoteState;

      if (!remoteSnapshot) {
        setSyncConnectionStatus("connected", t("syncRemoteEmpty"));
        return;
      }
      const conflicts = detectSyncConflicts({
        collectionLibrary,
        deletedCollectionSyncTombstones,
        syncPreferences,
        collectionColorPreferences,
        remoteState: remoteSnapshot,
      });

      if (conflicts.length > 0) {
        const conflictingNames = conflicts
          .map(
            (conflict) =>
              collectionLibrary[conflict.id]?.meta?.name ??
              remoteSnapshot.collections.find(
                (collection) => collection.id === conflict.id,
              )?.meta?.name ??
              conflict.id,
          )
          .slice(0, 3)
          .join(", ");

        setSyncConflictDialog({
          mode: "restore",
          conflicts: conflicts.map((conflict) => ({
            id: conflict.id,
            name:
              collectionLibrary[conflict.id]?.meta?.name ??
              remoteSnapshot.collections.find(
                (collection) => collection.id === conflict.id,
              )?.meta?.name ??
              conflict.id,
          })),
          remoteSnapshot,
        });
        setSyncConnectionStatus(
          "error",
          t("restoreConflictsDescription", {
            count: conflicts.length,
            names: conflictingNames,
          }),
        );
        return;
      }

      applyRemoteRestoreSnapshot(remoteSnapshot);
      if (remoteStateResult.recoveredManifest) {
        setSyncConnectionStatus(
          "connected",
          t("syncManifestRecovered", {
            collections: remoteSnapshot.collections.length,
          }),
        );
      }
    } catch (error) {
      setSyncConnectionStatus(
        "error",
        error instanceof Error ? error.message : t("syncError"),
      );
    } finally {
      setIsSyncBusy(false);
    }
  };

  const runAutosync = useEffectEvent(() => {
    void executeManualSync("autosync");
  });

  useEffect(() => {
    if (sharedOrientation && sharedOrientation !== timelineOrientation) {
      setTimelineOrientation(sharedOrientation);
    }
  }, [setTimelineOrientation, sharedOrientation, timelineOrientation]);

  const renderedTimelineEvents = useMemo(
    () =>
      showOnlyResultsOnTimeline
        ? filterTimelineSearchEvents(
            timelineEvents,
            deferredTimelineSearchQuery,
            activeMediaFilters,
            {
              language,
              startTimeInput: timeRangeStartInput,
              endTimeInput: timeRangeEndInput,
            },
          )
        : timelineEvents,
    [
      activeMediaFilters,
      deferredTimelineSearchQuery,
      language,
      showOnlyResultsOnTimeline,
      timeRangeEndInput,
      timeRangeStartInput,
      timelineEvents,
    ],
  );

  const orderedTimelineEvents = useMemo(
    () =>
      [...renderedTimelineEvents].sort((first, second) => {
        const yearDiff =
          getEventTimelineYear(first) - getEventTimelineYear(second);
        if (yearDiff !== 0) return yearDiff;
        return first.id.localeCompare(second.id);
      }),
    [renderedTimelineEvents],
  );

  const selectedEventNeighbors = useMemo(() => {
    if (!selectedEventInfo) {
      return { previousEvent: null, nextEvent: null };
    }

    const selectedIndex = orderedTimelineEvents.findIndex(
      (event) => event.id === selectedEventInfo.id,
    );

    if (selectedIndex === -1) {
      return { previousEvent: null, nextEvent: null };
    }

    return {
      previousEvent:
        selectedIndex > 0 ? orderedTimelineEvents[selectedIndex - 1] : null,
      nextEvent:
        selectedIndex < orderedTimelineEvents.length - 1
          ? orderedTimelineEvents[selectedIndex + 1]
          : null,
    };
  }, [orderedTimelineEvents, selectedEventInfo]);

  const {
    focusPixel,
    focusYear,
    zoom,
    ticks,
    collapsedGroups,
    expandedCollapsedGroup,
    visibleBounds,
    eventLayouts,
    logicFps,
    renderFps,
    zoomRangeLabel,
    zoomTrackRef,
    zoomThumbY,
    isViewportBeforeBigBang,
    isWarping,
    warpMode,
    warpDirection,
    recordRenderFrame,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeClickSuppression,
    handleFocusBigBang,
    handleFocusEvent,
    handleFocusCollapsedGroup,
    handleAutoFit,
    handleAutoFitRange,
    handleQuickZoom,
    handleJumpToDate,
    handleZoomDragStart,
    handleZoomDragMove,
    handleZoomDragEnd,
    clearFocusedEvent: clearFocusedEventFromViewport,
    currentLogZoom,
    hasBootstrappedRef,
  } = useTimelineViewport({
    containerRef,
    renderedTimelineEvents,
    selectedEventId,
    initialFocusYear: hasSharedTimelineState
      ? (sharedFocusYear ?? undefined)
      : (savedFocusYear ?? undefined),
    initialLogZoom: hasSharedTimelineState
      ? (sharedLogZoom ?? undefined)
      : (savedLogZoom ?? undefined),
    orientation: effectiveTimelineOrientation,
    verticalWheelBehavior,
    verticalTimeDirection,
    onSelectEvent: (event) => {
      if (event) {
        // If re-selecting the same event, trigger mobile panel to re-open
        if (event.id === selectedEventId) {
          reopenMobileInfoPanel();
        }
        focusEvent(event.id);
        return;
      }

      clearFocusedEvent();
    },
    onViewportChange: ({ focusYear, logZoom }) => {
      setSavedViewport(focusYear, logZoom);
    },
    setIsRulerActive,
  });

  // Auto-fit when user toggles collection visibility in Sidebar
  const handleAutoFitRef = useRef<any | null>(null);
  useEffect(() => {
    handleAutoFitRef.current = handleAutoFit;
  }, [handleAutoFit]);

  useEffect(() => {
    if (!hasBootstrappedRef.current) return;
    // Defer to next frame so events have finished rendering first
    const frame = requestAnimationFrame(() =>
      handleAutoFitRef.current?.(false),
    );
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [visibleCollectionIds]);

  const downloadedCollectionIds = useMemo(
    () => Object.keys(collectionEventsById),
    [collectionEventsById],
  );
  const hiddenDownloadedCollectionIds = useMemo(
    () =>
      downloadedCollectionIds.filter(
        (collectionId) => !visibleCollectionIds.includes(collectionId),
      ),
    [downloadedCollectionIds, visibleCollectionIds],
  );
  const shouldShowEmptyTimelineGuidance =
    !isViewportBeforeBigBang && timelineEvents.length === 0;

  const handleExportCollection = async (
    collectionId: string,
    format: "csv" | "json" = "csv",
  ): Promise<string> => {
    const collectionMeta = collections.find((c) => c.id === collectionId);
    if (!collectionMeta) {
      throw new Error("That collection could not be found for export.");
    }
    if (
      !Object.prototype.hasOwnProperty.call(collectionEventsById, collectionId)
    ) {
      throw new Error("Only downloaded collections can be exported.");
    }

    const events = collectionEventsById[collectionId] ?? [];
    const serializedEvents = stripRuntimeEventIds(events);
    const timestamp = createLocalDateStamp();
    const filename = `${collectionMeta.id}-${timestamp}`;

    let blob: Blob;
    let extension: string;

    if (format === "csv") {
      blob = exportCollectionToCsv(collectionMeta, serializedEvents);
      extension = "csv";
    } else {
      const payload: CollectionTransferPayload = {
        version: 1,
        source: "time-horizon",
        exportedAt: new Date().toISOString(),
        collections: [
          {
            meta: collectionMeta,
            events: serializedEvents,
            color: collectionColors[collectionId] ?? null,
            visible: visibleCollectionIds.includes(collectionId),
          },
        ],
      };
      blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      extension = "json";
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${filename}.${extension}`;
    link.click();
    URL.revokeObjectURL(blobUrl);

    return t("exportedCollection", {
      name: collectionMeta.name,
      format: extension.toUpperCase(),
    });
  };

  const handleImportCollectionFile = async (file: File) => {
    const rawText = await file.text();

    // ── CSV ──────────────────────────────────────────────────────────────────
    if (
      file.name.endsWith(".csv") ||
      rawText.trimStart().startsWith("#meta;") ||
      rawText.trimStart().startsWith("id,") ||
      rawText.trimStart().startsWith("title,")
    ) {
      try {
        const { events: parsedEvents, meta } = parseCsvEvents(rawText);
        if (parsedEvents.length === 0) {
          throw new Error(
            "No events found in that CSV. Make sure it includes a header row with: title, description, time, ...",
          );
        }

        // Self-contained CSV with #meta header — import directly, no dialog
        if (meta?.name && meta?.emoji) {
          const inputs: ImportedCollectionInput[] = [
            { meta, events: parsedEvents },
          ];
          importCollections(inputs);
          openSidebar();
          return t("importedCollection", { name: meta.name });
        }

        // Plain CSV (no embedded metadata) — prompt via ImportEventsDialog
        const events = sanitizeImportedEvents(parsedEvents);
        if (events.length === 0) {
          throw new Error(
            "The file loaded, but none of its rows matched the expected event format.",
          );
        }
        setPendingImportEvents(events);
        setPendingImportDialog(true);
        return;
      } catch (err) {
        if (err instanceof Error && !file.name.endsWith(".csv")) {
          // Not actually CSV — fall through to JSON parsing
        } else {
          throw err;
        }
      }
    }

    // ── JSON ─────────────────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(
        "That file is not valid JSON or CSV. Make sure it has a .json or .csv extension.",
      );
    }

    // Detect flat array of events (no "meta" field on items)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as Record<string, unknown>;
      const isFlatEventArray =
        first &&
        typeof first === "object" &&
        "time" in first &&
        "title" in first &&
        !("meta" in first);

      if (isFlatEventArray) {
        const events = sanitizeImportedEvents(parsed);
        if (events.length === 0) {
          throw new Error(
            "The file loaded, but none of its events matched the expected format.",
          );
        }
        setPendingImportEvents(events);
        setPendingImportDialog(true);
        return;
      }
    }

    const rawCollections = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? "collections" in parsed &&
          Array.isArray((parsed as CollectionTransferPayload).collections)
          ? (parsed as CollectionTransferPayload).collections
          : "meta" in parsed && "events" in parsed
            ? [parsed]
            : []
        : [];

    if (rawCollections.length === 0) {
      throw new Error(
        "No collections were found in that file. Export from Time Horizon and try again.",
      );
    }

    const { importedCollectionIds } = importCollections(rawCollections);
    if (importedCollectionIds.length === 0) {
      throw new Error(
        "The file loaded, but none of its collections matched the expected format.",
      );
    }

    openSidebar();
    return t("importedCollections", { count: importedCollectionIds.length });
  };

  // ── Full-page drag-and-drop ───────────────────────────────────────────────
  const handleFileDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setIsDraggingFile(true);
  };

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files"))
      e.dataTransfer.dropEffect = "copy";
  };

  const handleFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setIsDraggingFile(false);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      await handleImportCollectionFile(file);
    } catch (error) {
      console.error(error);
      setImportError(
        error instanceof Error ? error.message : "Import failed unexpectedly.",
      );
    }
  };

  const handleStartAddEvent = (targetCollectionId?: string) => {
    const resolvedTargetCollectionId =
      targetCollectionId ??
      (visibleCollectionIds.length === 1 &&
      Object.prototype.hasOwnProperty.call(
        collectionEventsById,
        visibleCollectionIds[0],
      )
        ? visibleCollectionIds[0]
        : null);

    openEventCreator(resolvedTargetCollectionId);
  };

  const handleEditCollection = (collection: EventCollectionMeta) => {
    setEditingCollection(collection);
  };

  const handleCreateEvent = (
    newEvent: Event,
    targetCollectionId?: string | null,
  ) => {
    const resolvedTargetCollectionId =
      targetCollectionId ?? addingCollectionId ?? singleVisibleCollectionId;
    if (!resolvedTargetCollectionId) return;

    addEvent(newEvent, resolvedTargetCollectionId);
    closeEventCreator();
  };

  const handleDeleteTimelineEvent = (event: Event) => {
    const ownerCollectionId = findEventCollectionId(event.id);
    if (!ownerCollectionId) return;

    const ownerCollection = collections.find(
      (collection) => collection.id === ownerCollectionId,
    );
    const eventTitle = getLocalizedEventTitle(event, language);
    const confirmationMessage = ownerCollection
      ? t("deleteEventDescriptionWithCollection", {
          event: eventTitle,
          collection: ownerCollection.name,
        })
      : t("deleteEventDescription", {
          event: eventTitle,
        });

    setConfirmDialog({
      title: t("deleteEventTitle"),
      description: confirmationMessage,
      confirmLabel: t("deleteEventConfirm"),
      tone: "danger",
      onConfirm: () => {
        deleteEvent(event.id);
      },
    });
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const handleConfirmDialog = () => {
    if (!confirmDialog) return;

    const { onConfirm } = confirmDialog;
    setConfirmDialog(null);
    onConfirm();
  };

  const handleUpdateEvent = (updatedEvent: Event) => {
    saveEvent(updatedEvent);
    closeEventEditor();
  };

  const handleCreateNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (pendingImportEvents) {
      handleImportEventsToNewCollection(collection);
    } else {
      const nextCollection = createCollection(collection);
      openEventCreator(nextCollection.id);
      closeCollectionCreator();
    }
  };

  const handleUpdateExistingCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (!editingCollection) return;

    updateCollection(editingCollection.id, collection);
    setEditingCollection(null);
  };

  const handleCloseAddEvent = () => {
    closeEventCreator();
  };

  const handleImportEventsToCollection = (targetCollectionId: string) => {
    if (!pendingImportEvents) return;
    addEvents(pendingImportEvents, targetCollectionId);
    addVisibleCollection(targetCollectionId);
    setPendingImportEvents(null);
    setPendingImportDialog(false);
    openSidebar();
  };

  const handleImportEventsToNewCollection = (
    collection: Pick<EventCollectionMeta, "emoji" | "name" | "description">,
  ) => {
    if (!pendingImportEvents) return;
    const nextCollection = createCollection(collection);
    addEvents(pendingImportEvents, nextCollection.id);
    addVisibleCollection(nextCollection.id);
    closeCollectionCreator();
    setPendingImportEvents(null);
    setPendingImportDialog(false);
    openSidebar();
  };

  const handleCloseImportDialog = () => {
    closeCollectionCreator();
    setPendingImportEvents(null);
    setPendingImportDialog(false);
  };

  const sharedCollectionIdsFromUrl = useMemo(
    () =>
      sharedCollectionIdsFromUrlRaw.filter((id) =>
        catalogCollectionIds.has(id),
      ),
    [sharedCollectionIdsFromUrlRaw, catalogCollectionIds],
  );

  // Collections that are visible AND URL-shareable (i.e. can be restored from ?c= URL param).
  // Local collections are NOT shareable — they live in localStorage and are restored
  // on every load regardless of the URL. Only catalog collections go in ?c=.
  const shareableVisibleCollectionIds = useMemo(
    () =>
      visibleCollectionIds.filter(
        (id) =>
          (collectionEventsById[id]?.length ?? 0) > 0 &&
          catalogCollectionIds.has(id) &&
          !localCollectionIds.includes(id),
      ),
    [
      visibleCollectionIds,
      collectionEventsById,
      localCollectionIds,
      catalogCollectionIds,
    ],
  );
  const shareableSelectedEventId = useMemo(() => {
    if (!selectedEventInfo) return null;
    const selectedCollectionId = findEventCollectionId(selectedEventInfo.id);
    if (!selectedCollectionId) return null;
    if (!catalogCollectionIds.has(selectedCollectionId)) return null;
    if (!shareableVisibleCollectionIds.includes(selectedCollectionId))
      return null;
    return selectedEventInfo.id;
  }, [
    findEventCollectionId,
    selectedEventInfo,
    shareableVisibleCollectionIds,
    catalogCollectionIds,
  ]);

  const sharedUrlSignature = useMemo(
    () =>
      `${sharedCollectionIdsFromUrl.join(",")}::${sharedEventIdFromUrl ?? ""}`,
    [sharedCollectionIdsFromUrl, sharedEventIdFromUrl],
  );
  const lastAppliedSharedUrlSignatureRef = useRef<string | null>(null);
  const sharedUrlFocusFrameRef = useRef<number | null>(null);
  const sharedUrlFocusRequestedSignatureRef = useRef<string | null>(null);
  const [isApplyingSharedUrl, setIsApplyingSharedUrl] = useState(false);
  const [
    sharedUrlCollectionsReadySignature,
    setSharedUrlCollectionsReadySignature,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (lastAppliedSharedUrlSignatureRef.current === sharedUrlSignature) {
      return;
    }

    if (
      sharedCollectionIdsFromUrl.length === 0 &&
      sharedEventIdFromUrl === null
    ) {
      if (sharedUrlFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
        sharedUrlFocusFrameRef.current = null;
      }
      sharedUrlFocusRequestedSignatureRef.current = null;
      setSharedUrlCollectionsReadySignature(null);
      lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
      setIsApplyingSharedUrl(false);
      return;
    }

    let isCancelled = false;
    const requestedCollectionIds = new Set(sharedCollectionIdsFromUrl);
    setIsApplyingSharedUrl(true);
    setSharedUrlCollectionsReadySignature(null);
    sharedUrlFocusRequestedSignatureRef.current = null;

    if (sharedUrlFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
      sharedUrlFocusFrameRef.current = null;
    }

    for (const collectionId of visibleCollectionIds.filter((id) =>
      catalogCollectionIds.has(id),
    )) {
      if (!requestedCollectionIds.has(collectionId)) {
        setCollectionVisibility(collectionId, false);
      }
    }

    const applySharedUrl = async () => {
      const downloadResults = await Promise.all(
        sharedCollectionIdsFromUrl.map((collectionId) =>
          downloadCollection(collectionId),
        ),
      );

      if (isCancelled) return;

      if (downloadResults.some((result) => !result)) {
        sharedUrlFocusRequestedSignatureRef.current = null;
        setSharedUrlCollectionsReadySignature(null);
        lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
        setIsApplyingSharedUrl(false);
        return;
      }

      setSharedUrlCollectionsReadySignature(sharedUrlSignature);
    };

    void applySharedUrl();

    return () => {
      isCancelled = true;
    };
  }, [
    downloadCollection,
    setCollectionVisibility,
    sharedEventIdFromUrl,
    sharedCollectionIdsFromUrl,
    sharedUrlSignature,
    visibleCollectionIds,
  ]);

  useEffect(() => {
    if (!isApplyingSharedUrl) {
      return;
    }

    if (sharedUrlCollectionsReadySignature !== sharedUrlSignature) {
      return;
    }

    const hasRequestedCollectionsLoaded = sharedCollectionIdsFromUrl.every(
      (collectionId) =>
        Object.prototype.hasOwnProperty.call(
          collectionEventsById,
          collectionId,
        ),
    );
    const hasRequestedCollectionsVisible = sharedCollectionIdsFromUrl.every(
      (collectionId) => visibleCollectionIds.includes(collectionId),
    );

    if (!hasRequestedCollectionsLoaded || !hasRequestedCollectionsVisible) {
      return;
    }

    if (sharedEventIdFromUrl) {
      const sharedEvent = findEventByIdInCollections(
        collectionEventsById,
        sharedEventIdFromUrl,
      );

      if (!sharedEvent) {
        sharedUrlFocusRequestedSignatureRef.current = null;
        setSharedUrlCollectionsReadySignature(null);
        lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
        setIsApplyingSharedUrl(false);
        return;
      }

      if (sharedUrlFocusRequestedSignatureRef.current !== sharedUrlSignature) {
        sharedUrlFocusRequestedSignatureRef.current = sharedUrlSignature;
        previewEvent(sharedEvent.id);

        if (sharedUrlFocusFrameRef.current !== null) {
          window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
        }

        sharedUrlFocusFrameRef.current = window.requestAnimationFrame(() => {
          sharedUrlFocusFrameRef.current = null;
          handleFocusEvent(sharedEvent);
        });
      }

      if (selectedEventId !== sharedEvent.id) {
        return;
      }
    }

    sharedUrlFocusRequestedSignatureRef.current = null;
    setSharedUrlCollectionsReadySignature(null);
    lastAppliedSharedUrlSignatureRef.current = sharedUrlSignature;
    setIsApplyingSharedUrl(false);
  }, [
    collectionEventsById,
    handleFocusEvent,
    isApplyingSharedUrl,
    previewEvent,
    selectedEventId,
    sharedCollectionIdsFromUrl,
    sharedEventIdFromUrl,
    sharedUrlCollectionsReadySignature,
    sharedUrlSignature,
    visibleCollectionIds,
  ]);

  useEffect(
    () => () => {
      if (sharedUrlFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(sharedUrlFocusFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!sharedSpatialMapping) return;
    setSpatialMapping(sharedSpatialMapping);
  }, [setSpatialMapping, sharedSpatialMapping]);

  useEffect(() => {
    if (
      !syncPreferences.onboardingCompleted ||
      !syncPreferences.autosyncEnabled ||
      !syncPreferences.lastSuccessfulSyncAt ||
      !syncAccessToken ||
      syncConnectionStatus !== "connected" ||
      !hasPendingSyncableChanges ||
      isSyncBusy
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      runAutosync();
    }, 30000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    hasPendingSyncableChanges,
    isSyncBusy,
    runAutosync,
    syncAccessToken,
    syncConnectionStatus,
    syncPreferences.autosyncEnabled,
    syncPreferences.lastSuccessfulSyncAt,
    syncPreferences.onboardingCompleted,
  ]);

  useEffect(() => {
    if (!hasPendingSyncableChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasPendingSyncableChanges]);

  return (
    <>
      {isDraggingFile && (
        <div
          onDragEnter={handleFileDragEnter}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleFileDrop}
          className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
        >
          <div className="pointer-events-auto flex h-full w-full items-center justify-center rounded-[2rem] border-2 border-dashed border-emerald-400/70 bg-emerald-950/85 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/15">
                <FileText size={36} className="text-emerald-300" />
              </div>
              <div>
                <div className="text-[1.15rem] font-semibold text-emerald-100">
                  Drop to import
                </div>
                <div className="mt-1 text-[0.85rem] text-emerald-300/70">
                  Time Horizon collection file (.json)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        onDragEnter={handleFileDragEnter}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
        className="contents"
      >
        <Sidebar
          collections={collections}
          syncableCollectionIds={Array.from(catalogCollectionIds)}
          editableCollectionIds={editableCollectionIds}
          onOpenSyncPanel={() => setIsSyncPanelOpen(true)}
          onEditEvent={(event) => {
            openEventEditor(event.id);
          }}
          onDeleteEvent={handleDeleteTimelineEvent}
          onAddEvent={handleStartAddEvent}
          onAddCollection={openCollectionCreator}
          onImportCollections={handleImportCollectionFile}
          onExportCollection={handleExportCollection}
          onEditCollection={handleEditCollection}
          onUpdateCollectionEvents={(collectionId, events) => {
            replaceCollectionEvents(collectionId, events);
          }}
          onBackToLanding={onBackToLanding}
        />

        {shouldShowEmptyTimelineGuidance ? (
          <TimelineGuidanceOverlay
            eyebrow={t("timelineEmpty")}
            title={
              hiddenDownloadedCollectionIds.length > 0
                ? t("nothingVisible")
                : downloadedCollectionIds.length > 0
                  ? t("visibleTimelineEmpty")
                  : t("welcomeTimeline")
            }
            description={
              hiddenDownloadedCollectionIds.length > 0
                ? t("nothingVisibleDescription", {
                    count: hiddenDownloadedCollectionIds.length,
                  })
                : downloadedCollectionIds.length > 0
                  ? t("visibleTimelineEmptyDescription")
                  : t("welcomeTimelineDescription")
            }
            actions={[
              {
                label:
                  downloadedCollectionIds.length > 0 ||
                  hiddenDownloadedCollectionIds.length > 0
                    ? t("openCollections")
                    : t("browseCollections"),
                icon: <FolderOpen size={16} />,
                onClick:
                  downloadedCollectionIds.length > 0 ||
                  hiddenDownloadedCollectionIds.length > 0
                    ? openSidebar
                    : openSidebarExplore,
              },
              {
                label: t("newEvent"),
                icon: <Plus size={16} />,
                onClick: () => {
                  handleStartAddEvent();
                },
                tone: "secondary",
              },
            ]}
          />
        ) : null}

        {isViewportBeforeBigBang ? (
          <TimelineGuidanceOverlay
            eyebrow={t("beyondBigBang")}
            position="top"
            title={t("beyondBigBangTitle")}
            description={t("beyondBigBangDescription")}
            actions={[
              {
                label: t("returnToBigBang"),
                onClick: handleFocusBigBang,
              },
            ]}
          />
        ) : null}

        <TimelineCanvasViewport
          theme={theme}
          language={language}
          containerRef={containerRef}
          backgroundLayer={
            spatialMapping.enabled || isSpatialAnchorPickMode ? (
              <Suspense fallback={null}>
                <LazyTimelineSpatialBackground
                  focusPixel={focusPixel}
                  focusYear={focusYear}
                  zoom={zoom}
                  orientation={effectiveTimelineOrientation}
                  verticalTimeDirection={verticalTimeDirection}
                  mapping={spatialMapping}
                  isAnchorPickMode={isSpatialAnchorPickMode}
                  onStartPickMode={startSpatialAnchorPickMode}
                  onCancelPick={stopSpatialAnchorPickMode}
                  onPickAnchor={(year, lat, lng, metersPerYear) => {
                    setSpatialMapping({
                      enabled: true,
                      metersPerYear,
                      ...createSpatialAnchorFromViewport(year, lat, lng),
                    });
                    stopSpatialAnchorPickMode();
                  }}
                />
              </Suspense>
            ) : null
          }
          isInteractionDisabled={isSpatialAnchorPickMode}
          focusPixel={focusPixel}
          focusYear={focusYear}
          zoom={zoom}
          orientation={effectiveTimelineOrientation}
          verticalTimeDirection={verticalTimeDirection}
          ticks={ticks}
          timelineEvents={renderedTimelineEvents}
          collapsedGroups={collapsedGroups}
          expandedCollapsedGroup={expandedCollapsedGroup}
          visibleBounds={visibleBounds}
          eventLayouts={eventLayouts}
          focusedEventId={selectedEventInfo?.id ?? null}
          rulerEvent={isRulerActive ? selectedEventInfo : null}
          eventAccentColors={eventAccentColors}
          onRenderFrame={recordRenderFrame}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          consumeClickSuppression={consumeClickSuppression}
          onFocusBigBang={handleFocusBigBang}
          onFocusEvent={handleFocusEvent}
          onFocusCollapsedGroup={handleFocusCollapsedGroup}
        />

        <Toolbar
          logicFps={logicFps}
          renderFps={renderFps}
          onOpenControlCenter={() => setIsSettingsPanelOpen(true)}
        />
        <ControlCenterPanel
          isOpen={isSettingsPanelOpen}
          theme={theme}
          onOpenSyncPanel={() => setIsSyncPanelOpen(true)}
          onShare={() => setShareModalOpen(true)}
          onToggleTheme={onToggleTheme}
          onOpenSpatialPanel={() => setIsSpatialSettingsPanelOpen(true)}
          onClose={() => setIsSettingsPanelOpen(false)}
        />
        <SpatialSettingsPanel
          isOpen={isSpatialSettingsPanelOpen}
          currentFocusYear={focusYear.get()}
          onClose={() => setIsSpatialSettingsPanelOpen(false)}
        />
        <SyncPanel
          isOpen={isSyncPanelOpen}
          isBusy={isSyncBusy}
          onConnect={handleConnectSync}
          onDisconnect={handleDisconnectSync}
          onManualSync={() => executeManualSync("manual")}
          onRestoreFromDrive={handleRestoreFromDrive}
          onClose={() => setIsSyncPanelOpen(false)}
        />

        <SyncConflictDialog
          isOpen={Boolean(syncConflictDialog)}
          mode={syncConflictDialog?.mode ?? "sync"}
          conflicts={syncConflictDialog?.conflicts ?? []}
          onKeepLocal={() => {
            const dialog = syncConflictDialog;
            setSyncConflictDialog(null);
            if (!dialog) return;
            if (dialog.mode === "sync") {
              void executeManualSync("manual", {
                ignoreConflicts: true,
                remoteSnapshotOverride: dialog.remoteSnapshot,
              });
              return;
            }
            setSyncConnectionStatus("connected", t("keptLocalConflicts"));
          }}
          onKeepRemote={() => {
            const dialog = syncConflictDialog;
            setSyncConflictDialog(null);
            if (!dialog?.remoteSnapshot) return;
            applyRemoteRestoreSnapshot(dialog.remoteSnapshot);
          }}
          onDuplicateAndRestore={() => {
            const dialog = syncConflictDialog;
            setSyncConflictDialog(null);
            if (!dialog?.remoteSnapshot) return;
            const duplicatedIds = duplicateCollectionsForConflictResolution(
              dialog.conflicts.map((conflict) => conflict.id),
            );
            applyRemoteRestoreSnapshot(dialog.remoteSnapshot);
            setSyncConnectionStatus(
              "connected",
              t("duplicatedLocalConflicts", {
                count: duplicatedIds.length,
              }),
            );
          }}
          onCancel={() => setSyncConflictDialog(null)}
        />

        <Controller
          zoomRangeLabel={zoomRangeLabel}
          searchableEvents={timelineEvents}
          selectedEvent={selectedEventInfo}
          previousEvent={selectedEventNeighbors.previousEvent}
          nextEvent={selectedEventNeighbors.nextEvent}
          visibleCollections={visibleCollections}
          collectionEventsById={collectionEventsById}
          isRulerActive={isRulerActive}
          onQuickZoom={handleQuickZoom}
          onJumpToDate={handleJumpToDate}
          onSearchSelect={handleFocusEvent}
          onEditEvent={(event) => {
            openEventEditor(event.id);
          }}
          onDeleteEvent={handleDeleteTimelineEvent}
          onAutoFitAll={() => handleAutoFit()}
          onAutoFitRange={handleAutoFitRange}
          onFocusSelectedEvent={() => {
            if (selectedEventInfo) {
              handleFocusEvent(selectedEventInfo);
            }
          }}
          onEditSelectedEvent={() => {
            if (selectedEventInfo) {
              openEventEditor(selectedEventInfo.id);
            }
          }}
          onDeleteSelectedEvent={() => {
            if (selectedEventInfo) {
              handleDeleteTimelineEvent(selectedEventInfo);
            }
          }}
          onToggleSelectedEventRuler={() => {
            setIsRulerActive(!isRulerActive);
          }}
          onCloseSelectedEvent={clearFocusedEventFromViewport}
          zoomTrackRef={zoomTrackRef}
          zoomThumbY={zoomThumbY}
          onZoomDragStart={handleZoomDragStart}
          onZoomDragMove={handleZoomDragMove}
          onZoomDragEnd={handleZoomDragEnd}
          timelineOrientation={effectiveTimelineOrientation}
          onTimelineOrientationChange={setTimelineOrientation}
          verticalWheelBehavior={verticalWheelBehavior}
          onVerticalWheelBehaviorChange={setVerticalWheelBehavior}
          verticalTimeDirection={verticalTimeDirection}
          onVerticalTimeDirectionChange={setVerticalTimeDirection}
        />

        {selectedEventInfo && !isSpatialAnchorPickMode && (
          <EventInfoPanel
            event={selectedEventInfo}
            previousEvent={selectedEventNeighbors.previousEvent}
            nextEvent={selectedEventNeighbors.nextEvent}
            isRulerActive={isRulerActive}
            isCollapsed={isEventInfoCollapsed}
            hideOnMobile
            onFocus={() => {
              handleFocusEvent(selectedEventInfo);
            }}
            onEdit={() => {
              openEventEditor(selectedEventInfo.id);
            }}
            onDelete={() => handleDeleteTimelineEvent(selectedEventInfo)}
            onSelectPreviousEvent={() => {
              if (selectedEventNeighbors.previousEvent) {
                handleFocusEvent(selectedEventNeighbors.previousEvent);
              }
            }}
            onSelectNextEvent={() => {
              if (selectedEventNeighbors.nextEvent) {
                handleFocusEvent(selectedEventNeighbors.nextEvent);
              }
            }}
            onToggleRuler={() => {
              setIsRulerActive(!isRulerActive);
            }}
            onToggleCollapsed={() => {
              toggleEventInfoCollapsed();
            }}
            onClose={clearFocusedEventFromViewport}
          />
        )}

        {editingEvent && (
          <EventEditor
            mode="edit"
            event={editingEvent}
            onSave={handleUpdateEvent}
            onClose={closeEventEditor}
          />
        )}

        {addingEvent && draftEventForCreate && (
          <EventEditor
            mode="create"
            event={draftEventForCreate}
            availableCollections={writableCollections}
            initialCollectionId={addingCollectionId}
            onAddCollection={openCollectionCreator}
            onSave={handleCreateEvent}
            onClose={handleCloseAddEvent}
          />
        )}

        {isCreatingCollection && (
          <CollectionEditor
            mode="create"
            onSubmit={handleCreateNewCollection}
            onClose={handleCloseImportDialog}
            title={
              pendingImportEvents ? "New Collection for Import" : undefined
            }
          />
        )}

        {editingCollection && (
          <CollectionEditor
            mode="edit"
            initialValue={{
              emoji: editingCollection.emoji,
              name: editingCollection.name,
              description: editingCollection.description,
            }}
            onSubmit={handleUpdateExistingCollection}
            onClose={() => setEditingCollection(null)}
            title="Edit Collection"
          />
        )}

        {shareModalOpen && (
          <ShareModal
            focusYear={focusYear.get()}
            logZoom={currentLogZoom.get()}
            selectedEventId={shareableSelectedEventId}
            visibleCollectionIds={shareableVisibleCollectionIds}
            collectionNames={Object.fromEntries(
              shareableVisibleCollectionIds.map((id) => {
                const collection = collections.find((c) => c.id === id);
                return [id, collection?.name ?? id];
              }),
            )}
            onGenerateUrl={(opts) =>
              generateShareUrl({
                // Website is always included — share links always open timeline directly
                includeWebsite: true,
                includeCollections: opts.includeCollections,
                includeSelectedEvent: opts.includeSelectedEvent,
                includeViewport: opts.includeViewport,
                // Only syncable collections can be restored from ?c= URL param.
                // Local collections are persisted separately in localStorage.
                collectionIds: shareableVisibleCollectionIds,
                focusYear: focusYear.get(),
                logZoom: currentLogZoom.get(),
                orientation: effectiveTimelineOrientation,
                spatialMapping,
                overrideEventId: opts.includeSelectedEvent
                  ? shareableSelectedEventId
                  : null,
              })
            }
            onClose={() => setShareModalOpen(false)}
          />
        )}

        <ConfirmDialog
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog?.title ?? ""}
          description={confirmDialog?.description ?? ""}
          confirmLabel={confirmDialog?.confirmLabel}
          cancelLabel={confirmDialog?.cancelLabel}
          tone={confirmDialog?.tone}
          onConfirm={handleConfirmDialog}
          onCancel={handleCloseConfirmDialog}
        />

        <ConfirmDialog
          isOpen={Boolean(importError)}
          title="Import failed"
          description={importError ?? ""}
          confirmLabel="OK"
          cancelLabel="Close"
          onConfirm={() => setImportError(null)}
          onCancel={() => setImportError(null)}
        />

        {pendingImportDialog && (
          <ImportEventsDialog
            eventCount={pendingImportEvents?.length ?? 0}
            collections={writableCollections}
            onImportToCollection={handleImportEventsToCollection}
            onCreateNewCollection={() => {
              setPendingImportDialog(false);
              openCollectionCreator();
            }}
            onCancel={handleCloseImportDialog}
          />
        )}

        <WarpOverlay
          isWarping={isWarping}
          mode={warpMode}
          direction={warpDirection}
          theme={theme}
          zoom={zoom}
          orientation={effectiveTimelineOrientation}
          zoomPivot={focusPixel}
        />
      </div>
    </>
  );
};
