import React from "react";
import { MotionValue } from "motion/react";
import { CalendarSearch, Focus, Search, ZoomIn } from "lucide-react";
import { Event, AutoFitRangeTarget, DateJumpTarget } from "../constants/types";
import { AutoFitPanel } from "./AutoFitPanel";
import { JumpPanel } from "./JumpPanel";
import { PanelToggleButton } from "./PanelToggleButton";
import { SearchPanel } from "./SearchPanel";
import { ZoomPanel } from "./ZoomPanel";
import { hasActiveTimelineSearch, useTimelineStore } from "../stores";

interface ControllerProps {
  zoomRangeLabel: string;
  searchableEvents: Event[];
  onQuickZoom: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onJumpToDate: (target: DateJumpTarget) => void;
  onSearchSelect: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
  onAutoFitAll: () => void;
  onAutoFitRange: (target: AutoFitRangeTarget) => void;
  zoomTrackRef: React.RefObject<HTMLDivElement | null>;
  zoomThumbY: MotionValue<number>;
  onZoomDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onZoomDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
}

type ActivePanel = "zoom" | "jump" | "search" | "autofit" | null;

export const Controller: React.FC<ControllerProps> = ({
  zoomRangeLabel,
  searchableEvents,
  onQuickZoom,
  onJumpToDate,
  onSearchSelect,
  onDeleteEvent,
  onAutoFitAll,
  onAutoFitRange,
  zoomTrackRef,
  zoomThumbY,
  onZoomDragStart,
  onZoomDragMove,
  onZoomDragEnd,
}) => {
  const [activePanel, setActivePanel] = React.useState<ActivePanel>(null);
  const searchQuery = useTimelineStore((state) => state.searchQuery);
  const activeMediaFilters = useTimelineStore(
    (state) => state.activeMediaFilters,
  );
  const searchSortMode = useTimelineStore((state) => state.searchSortMode);
  const timeRangeStartInput = useTimelineStore(
    (state) => state.timeRangeStartInput,
  );
  const timeRangeEndInput = useTimelineStore(
    (state) => state.timeRangeEndInput,
  );
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

  return (
    <div
      className="fixed right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col items-end gap-2"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <PanelToggleButton
        isOpen={activePanel === "zoom"}
        onClick={() => togglePanel("zoom")}
        openLabel="Expand zoom controls"
        closeLabel="Collapse zoom controls"
      >
        <ZoomIn width={18} height={18} />
      </PanelToggleButton>

      <PanelToggleButton
        isOpen={activePanel === "search"}
        onClick={() => togglePanel("search")}
        openLabel="Open event search"
        closeLabel="Close event search"
        showIndicator={hasActiveSearch}
      >
        <Search width={16} height={16} />
      </PanelToggleButton>

      <PanelToggleButton
        isOpen={activePanel === "jump"}
        onClick={() => togglePanel("jump")}
        openLabel="Open jump form"
        closeLabel="Close jump form"
      >
        <CalendarSearch width={16} height={16} />
      </PanelToggleButton>

      <PanelToggleButton
        isOpen={activePanel === "autofit"}
        onClick={() => togglePanel("autofit")}
        openLabel="Open auto-fit controls"
        closeLabel="Close auto-fit controls"
      >
        <Focus width={18} height={18} />
      </PanelToggleButton>

      <div className="pointer-events-none fixed right-12 md:right-14 top-1/2 -translate-y-1/2">
        <div className="pointer-events-auto">
          <ZoomPanel
            isOpen={activePanel === "zoom"}
            zoomRangeLabel={zoomRangeLabel}
            onQuickZoom={onQuickZoom}
            zoomTrackRef={zoomTrackRef}
            zoomThumbY={zoomThumbY}
            onZoomDragStart={onZoomDragStart}
            onZoomDragMove={onZoomDragMove}
            onZoomDragEnd={onZoomDragEnd}
          />
          <SearchPanel
            isOpen={activePanel === "search"}
            searchableEvents={searchableEvents}
            onSearchSelect={handleSearchSelect}
            onDeleteEvent={onDeleteEvent}
          />
          <JumpPanel
            isOpen={activePanel === "jump"}
            onJumpToDate={onJumpToDate}
            onJumpComplete={() => setActivePanel(null)}
          />

          <AutoFitPanel
            isOpen={activePanel === "autofit"}
            onAutoFitRange={onAutoFitRange}
            onAutoFitAll={onAutoFitAll}
            onComplete={() => setActivePanel(null)}
          />
        </div>
      </div>
    </div>
  );
};
