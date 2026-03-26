import React, { useState } from "react";
import { Event, EventCollectionMeta, getEventTimelineYear } from "../types";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Menu,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { getEventDisplayLabel } from "../utils";

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
  onFocusEvent: (event: Event) => void;
  onEditEvent: (event: Event) => void;
  onAddEvent: () => void;
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
  onFocusEvent,
  onEditEvent,
  onAddEvent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<string[]>(
    [],
  );

  const normalizedCollectionQuery = collectionQuery.trim().toLowerCase();
  const filteredCollections = collections.filter((collection) => {
    if (!normalizedCollectionQuery) return true;

    return (
      collection.name.toLowerCase().includes(normalizedCollectionQuery) ||
      collection.description.toLowerCase().includes(normalizedCollectionQuery)
    );
  });

  const getCollectionEvents = (collectionId: string) => {
    const collectionEvents = collectionEventsById[collectionId] ?? [];

    return [...collectionEvents]
      .sort((a, b) => {
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

  const handleEventAction = async (
    collectionId: string,
    event: Event,
    action: (target: Event) => void,
  ) => {
    if (!visibleCollectionIds.includes(collectionId)) {
      await onSetCollectionVisibility(collectionId, true);
    }

    action(event);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[95] bg-zinc-900 border border-zinc-700 text-white p-2 rounded-lg shadow-lg hover:bg-zinc-800 transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 h-full w-screen sm:w-80 bg-zinc-950 border-r border-zinc-800 z-[90] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 pt-20 flex-1 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">Timeline Events</h2>

          <div className="mb-6">
            <button
              onClick={onAddEvent}
              className="w-full bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Event
            </button>
          </div>

          {/* Collections */}
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Collections
              </h3>
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                {filteredCollections.length}/{collections.length}
              </span>
            </div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search collection titles or descriptions..."
                value={collectionQuery}
                onChange={(e) => setCollectionQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white placeholder-zinc-500 transition-colors focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              {filteredCollections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-500">
                  No collections match the current search.
                </div>
              ) : (
                filteredCollections.map((collection) => {
                  const isDownloaded = Object.prototype.hasOwnProperty.call(
                    collectionEventsById,
                    collection.id,
                  );
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
                  const collectionEvents = getCollectionEvents(collection.id);
                  const totalLoadedEvents =
                    collectionEventsById[collection.id]?.length ?? 0;
                  const collectionColor = collectionColors[collection.id];
                  const hasCustomColor = Object.prototype.hasOwnProperty.call(
                    collectionColorPreferences,
                    collection.id,
                  );

                  let statusLabel = "";
                  let statusClassName =
                    "border-zinc-700/70 bg-zinc-900 text-zinc-400";

                  if (isLoading) {
                    statusLabel = "Loading...";
                    statusClassName =
                      "border-amber-500/30 bg-amber-500/10 text-amber-200";
                  }
                  // else if (isDownloaded) {
                  //   statusLabel = "Downloaded";
                  //   statusClassName =
                  //     "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
                  // }

                  return (
                    <div
                      key={collection.id}
                      className={`rounded-2xl border transition-colors ${
                        isVisibleOnTimeline
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : "bg-zinc-900 border-zinc-800"
                      }`}
                    >
                      <div className="flex items-start gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="min-w-0">
                            <div className="flex items-start gap-2">
                              <span className="pt-0.5 text-xl leading-none">
                                {collection.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white">
                                  {collection.name}
                                </div>
                                <div className="mt-1 text-xs leading-relaxed text-zinc-400">
                                  {collection.description}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                              {statusLabel && (
                                <span
                                  className={`rounded-full border px-2 py-1 font-medium ${statusClassName}`}
                                >
                                  {statusLabel}
                                </span>
                              )}
                              {isDownloaded && (
                                <span className="text-zinc-500">
                                  {totalLoadedEvents} events
                                </span>
                              )}
                              <span className="text-zinc-500">
                                by {collection.author}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
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
                                <span>Set Color</span>
                              </label>
                              {hasCustomColor && (
                                <button
                                  onClick={() =>
                                    onResetCollectionColor(collection.id)
                                  }
                                  className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-2 pt-0.5">
                          {isDownloaded ? (
                            <>
                              <button
                                onClick={() =>
                                  void onSetCollectionVisibility(
                                    collection.id,
                                    !isVisibleOnTimeline,
                                  )
                                }
                                className={`rounded-xl border p-2 transition-colors ${
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
                                  <Eye size={18} />
                                ) : (
                                  <EyeOff size={18} />
                                )}
                              </button>
                              {isSyncable && (
                                <button
                                  onClick={() =>
                                    void onSyncCollection(collection.id)
                                  }
                                  disabled={isLoading}
                                  className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white disabled:cursor-wait disabled:opacity-60"
                                  aria-label={`Sync ${collection.name}`}
                                >
                                  <RefreshCw
                                    size={18}
                                    className={isLoading ? "animate-spin" : ""}
                                  />
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  toggleCollection(collection.id, isExpanded)
                                }
                                className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
                                aria-label={
                                  isExpanded
                                    ? `Collapse ${collection.name}`
                                    : `Expand ${collection.name}`
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown size={18} />
                                ) : (
                                  <ChevronRight size={18} />
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                void onDownloadCollection(collection.id)
                              }
                              disabled={isLoading}
                              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white disabled:cursor-wait disabled:opacity-60"
                              aria-label={`Download ${collection.name}`}
                            >
                              <Download size={18} />
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-zinc-800/80 px-3 pb-3 pt-3">
                          {isLoading ? (
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
                              Downloading collection events...
                            </div>
                          ) : !isDownloaded ? (
                            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-500">
                              This collection has not been downloaded yet.
                            </div>
                          ) : collectionEvents.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-500">
                              No events in this collection yet.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between px-1 text-[11px] uppercase tracking-wider text-zinc-500">
                                <span>Events ({collectionEvents.length})</span>
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
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
