import React from "react";
import { AnimatePresence, motion, MotionValue } from "motion/react";
import { Compass, FileText, Search } from "lucide-react";
import { Event, AutoFitRangeTarget, DateJumpTarget, EventCollectionMeta } from "../constants/types";
import { MobileEventInfoPanel } from "./MobileEventInfoPanel";
import { NavigationPanel } from "./NavigationPanel";
import { PanelToggleButton } from "./PanelToggleButton";
import { SearchPanel } from "./SearchPanel";
import { useI18n } from "../i18n";
import { hasActiveTimelineSearch, useStore } from "../stores";

interface ControllerProps {
  zoomRangeLabel: string;
  searchableEvents: Event[];
  selectedEvent: Event | null;
  isRulerActive: boolean;
  visibleCollections?: EventCollectionMeta[];
  collectionEventsById?: Record<string, Event[]>;
  onQuickZoom: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onJumpToDate: (target: DateJumpTarget) => void;
  onSearchSelect: (event: Event) => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
  onAutoFitAll: () => void;
  onAutoFitRange: (target: AutoFitRangeTarget) => void;
  onFocusSelectedEvent: () => void;
  onEditSelectedEvent: () => void;
  onDeleteSelectedEvent: () => void;
  onToggleSelectedEventRuler: () => void;
  onCloseSelectedEvent: () => void;
  zoomTrackRef: React.RefObject<HTMLDivElement | null>;
  zoomThumbY: MotionValue<number>;
  onZoomDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

type ActivePanel = "navigate" | "search" | "info" | null;

export const Controller: React.FC<ControllerProps> = ({
  zoomRangeLabel,
  searchableEvents,
  selectedEvent,
  isRulerActive,
  visibleCollections,
  collectionEventsById,
  onQuickZoom,
  onJumpToDate,
  onSearchSelect,
  onEditEvent,
  onDeleteEvent,
  onAutoFitAll,
  onAutoFitRange,
  onFocusSelectedEvent,
  onEditSelectedEvent,
  onDeleteSelectedEvent,
  onToggleSelectedEventRuler,
  onCloseSelectedEvent,
  zoomTrackRef,
  zoomThumbY,
  onZoomDragStart,
  onZoomDragMove,
  onZoomDragEnd,
}) => {
  const { t } = useI18n();
  const [activePanel, setActivePanel] = React.useState<ActivePanel>(null);
  const previousSelectedEventIdRef = React.useRef<string | null>(null);
  const searchQuery = useStore((state) => state.searchQuery);
  const activeMediaFilters = useStore((state) => state.activeMediaFilters);
  const searchSortMode = useStore((state) => state.searchSortMode);
  const timeRangeStartInput = useStore((state) => state.timeRangeStartInput);
  const timeRangeEndInput = useStore((state) => state.timeRangeEndInput);
  const hasActiveSearch = hasActiveTimelineSearch({
    searchQuery,
    activeMediaFilters,
    searchSortMode,
    timeRangeStartInput,
    timeRangeEndInput,
  });

  const togglePanel = (panel: Exclude<ActivePanel, null>) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const handleSearchSelect = (event: Event) => {
    onSearchSelect(event);
  };

  React.useEffect(() => {
    if (selectedEvent || activePanel !== "info") return;
    setActivePanel(null);
  }, [activePanel, selectedEvent]);

  React.useEffect(() => {
    const nextSelectedEventId = selectedEvent?.id ?? null;
    const previousSelectedEventId = previousSelectedEventIdRef.current;

    if (
      nextSelectedEventId &&
      nextSelectedEventId !== previousSelectedEventId &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      setActivePanel("info");
    }

    previousSelectedEventIdRef.current = nextSelectedEventId;
  }, [selectedEvent]);

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100vw-1.5rem)] max-w-max -translate-x-1/2 items-end gap-2 md:bottom-auto md:left-auto md:right-3 md:top-1/2 md:w-auto md:translate-x-0 md:-translate-y-1/2"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex flex-row items-center gap-2 rounded-[1.6rem] md:flex-col md:items-end">
        <PanelToggleButton
          isOpen={activePanel === "navigate"}
          onClick={() => togglePanel("navigate")}
          openLabel={t("openTimelineNavigation")}
          closeLabel={t("closeTimelineNavigation")}
        >
          <Compass width={18} height={18} />
        </PanelToggleButton>

        <PanelToggleButton
          isOpen={activePanel === "search"}
          onClick={() => togglePanel("search")}
          openLabel={t("openEventSearch")}
          closeLabel={t("closeEventSearch")}
          showIndicator={hasActiveSearch}
        >
          <Search width={16} height={16} />
        </PanelToggleButton>

        {selectedEvent ? (
          <div className="md:hidden">
            <PanelToggleButton
              isOpen={activePanel === "info"}
              onClick={() => togglePanel("info")}
              openLabel={t("openSelectedEventInfo")}
              closeLabel={t("closeSelectedEventInfo")}
            >
              <FileText width={16} height={16} />
            </PanelToggleButton>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] left-1/2 z-30 flex w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 items-end justify-center px-0 md:absolute md:bottom-auto md:left-auto md:right-[calc(100%+0.9rem)] md:top-1/2 md:z-auto md:w-auto md:max-w-none md:translate-x-0 md:-translate-y-1/2">
        <div className="pointer-events-auto flex items-end justify-end">
          <AnimatePresence initial={false} mode="wait">
            {activePanel ? (
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.985 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {activePanel === "navigate" ? (
                  <NavigationPanel
                    isOpen
                    zoomRangeLabel={zoomRangeLabel}
                    onQuickZoom={onQuickZoom}
                    onJumpToDate={onJumpToDate}
                    onAutoFitRange={onAutoFitRange}
                    onAutoFitAll={onAutoFitAll}
                    zoomTrackRef={zoomTrackRef}
                    zoomThumbY={zoomThumbY}
                    onZoomDragStart={onZoomDragStart}
                    onZoomDragMove={onZoomDragMove}
                    onZoomDragEnd={onZoomDragEnd}
                    onComplete={() => setActivePanel(null)}
                  />
                ) : null}
                {activePanel === "search" ? (
                  <SearchPanel
                    isOpen
                    searchableEvents={searchableEvents}
                    onSearchSelect={handleSearchSelect}
                    onEditEvent={onEditEvent}
                    onDeleteEvent={onDeleteEvent}
                    collections={visibleCollections}
                    eventsByCollectionId={collectionEventsById}
                  />
                ) : null}
                {activePanel === "info" ? (
                  <MobileEventInfoPanel
                    isOpen
                    onClose={() => setActivePanel(null)}
                    event={selectedEvent}
                    isRulerActive={isRulerActive}
                    onFocus={onFocusSelectedEvent}
                    onEdit={onEditSelectedEvent}
                    onDelete={onDeleteSelectedEvent}
                    onToggleRuler={onToggleSelectedEventRuler}
                    onCloseSelection={onCloseSelectedEvent}
                  />
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
