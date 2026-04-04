import React, { useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { EventCollectionMeta } from "../constants/types";
import { useI18n } from "../i18n";

interface ImportEventsDialogProps {
  eventCount: number;
  collections: EventCollectionMeta[];
  onImportToCollection: (targetCollectionId: string) => void;
  onCreateNewCollection: () => void;
  onCancel: () => void;
}

export const ImportEventsDialog: React.FC<ImportEventsDialogProps> = ({
  eventCount,
  collections,
  onImportToCollection,
  onCreateNewCollection,
  onCancel,
}) => {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string>(
    collections.length > 0 ? collections[0].id : "",
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onCancel();
    }, 180);
  };

  return (
    <div
      className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4"
      data-ui-state={isClosing ? "closing" : "open"}
      onPointerDown={() => requestClose()}
      onPointerUp={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      onPointerCancel={() => {}}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="ui-modal-surface ui-panel w-full max-w-md rounded-[1.9rem] p-6 sm:p-8"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerCancel={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="ui-kicker mb-2">{t("import")}</div>
            <h2 className="ui-display-title text-[1.9rem] leading-none text-white">
              {t("importDialogTitle", { count: eventCount })}
            </h2>
          </div>
          <button
            onClick={requestClose}
            className="ui-icon-button h-10 w-10"
            aria-label={t("close")}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-6 text-sm text-zinc-400">
          {t("importDialogDescription")}
        </p>

        {collections.length > 0 && (
          <div className="mb-4">
            <label className="ui-label mb-2 block">{t("importInto")}</label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="ui-field w-full appearance-none pr-10"
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                width={14}
                height={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {collections.length > 0 && (
            <button
              onClick={() => onImportToCollection(selectedId)}
              className="ui-button w-full"
            >
              {t("importIntoSelected")}
            </button>
          )}

          <button
            onClick={onCreateNewCollection}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 px-4 py-3 text-sm text-zinc-400 transition-colors hover:border-zinc-400 hover:text-white"
          >
            <Plus width={16} height={16} />
            {t("createNewCollection")}
          </button>

          <button
            onClick={requestClose}
            className="w-full text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};
