import React, { useMemo } from "react";
import { Settings2 } from "lucide-react";
import { useI18n } from "../i18n";
import { useStore } from "../stores";
import { hasPendingSyncableChanges as hasPendingSyncableChangesForSync } from "../sync";
import { getSyncStatusPresentation } from "./syncStatus";

interface ToolbarProps {
  logicFps: number;
  renderFps: number;
  onOpenControlCenter: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  logicFps,
  renderFps,
  onOpenControlCenter,
}) => {
  const { t } = useI18n();
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
        <div className="ui-badge shrink-0 font-mono text-[0.72rem]">
          {logicFps}|{renderFps}
        </div>
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
