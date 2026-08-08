import React, { useMemo } from "react";
import { EyeOff, Layers, Settings2 } from "lucide-react";
import { useI18n } from "../i18n";
import { useStore } from "../stores";
import { hasPendingSyncableChanges as hasPendingSyncableChangesForSync } from "../sync";
import { getSyncStatusPresentation } from "./syncStatus";

interface ToolbarProps {
  logicFps: number;
  renderFps: number;
  zoomRangeLabel: string;
  visibleCollectionCount: number;
  onOpenCollections: () => void;
  onOpenControlCenter: () => void;
}

// @ts-ignore — import.meta.env is provided by Vite
const IS_DEV = import.meta.env.DEV;

export const Toolbar: React.FC<ToolbarProps> = ({
  logicFps,
  renderFps,
  zoomRangeLabel,
  visibleCollectionCount,
  onOpenCollections,
  onOpenControlCenter,
}) => {
  const { t } = useI18n();
  const dimmedEventUids = useStore((s) => s.dimmedEventUids);
  const clearDimmedEvents = useStore((s) => s.clearDimmedEvents);
  const syncPreferences = useStore((s) => s.syncPreferences);
  const syncConnectionStatus = useStore((s) => s.syncConnectionStatus);
  const collectionLibrary = useStore((s) => s.collectionLibrary);
  const collectionColorPreferences = useStore(
    (s) => s.collectionColorPreferences,
  );
  const deletedCollectionSyncTombstones = useStore(
    (s) => s.deletedCollectionSyncTombstones,
  );
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

  const syncIndicatorClassName = getSyncStatusPresentation({
    hasPendingSyncableChanges,
    syncConnectionStatus,
  }).indicatorClassName;

  return (
    <div
      className="fixed right-4 top-4 z-60 flex max-w-[calc(100vw-1.5rem)] items-start justify-end gap-1 sm:max-w-none"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        {/* Dev-only frame counter. It used to sit here permanently, taking the
            most valuable corner of the screen from actual app state. */}
        {IS_DEV ? (
          <div className="ui-badge shrink-0 font-mono text-[0.72rem] opacity-60">
            {logicFps}|{renderFps}
          </div>
        ) : null}

        {/* Reads out what you are currently looking at — visible time span and
            how many collections are on — and doubles as a labelled way into the
            collections drawer. */}
        <button
          type="button"
          onClick={onOpenCollections}
          className="ui-badge flex shrink-0 items-center gap-2 whitespace-nowrap transition hover:brightness-125"
          aria-label={t("statusChipAria", { count: visibleCollectionCount })}
          title={t("statusChipAria", { count: visibleCollectionCount })}
        >
          {zoomRangeLabel ? (
            <>
              <span className="font-mono text-[0.72rem]">{zoomRangeLabel}</span>
              <span aria-hidden className="opacity-40">
                ·
              </span>
            </>
          ) : null}
          <span className="flex items-center gap-1 text-[0.72rem]">
            <Layers width={12} height={12} />
            {visibleCollectionCount}
          </span>
        </button>

        {/* Muted events go faint, which makes them easy to lose track of.
            This is the one always-visible way back. */}
        {dimmedEventUids.length > 0 ? (
          <button
            type="button"
            onClick={clearDimmedEvents}
            className="ui-badge flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.72rem] transition hover:brightness-125"
            aria-label={t("unmuteAllEvents", { count: dimmedEventUids.length })}
            title={t("unmuteAllEvents", { count: dimmedEventUids.length })}
          >
            <EyeOff width={12} height={12} />
            {dimmedEventUids.length}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenControlCenter}
          className="ui-icon-button relative h-10 w-10 shrink-0"
          aria-label={t("openControlCenter")}
          title={t("openControlCenter")}
        >
          <Settings2 width={15} height={15} />
          <span
            className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ${syncIndicatorClassName}`}
          />
        </button>
      </div>
    </div>
  );
};
