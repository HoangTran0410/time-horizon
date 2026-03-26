import React, { useEffect, useRef } from "react";
import { MotionValue } from "motion/react";
import { Event, getEventTimelineYear } from "../../types";
import {
  BigBangMarker,
  CollapsedEventGroup,
  CollapsedMarker,
  EventLayoutState,
  EventMarker,
  TickMarker,
  TimelineTick,
} from "./TimelineMarkers";

interface TimelineViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  focusPixel: MotionValue<number>;
  focusYear: MotionValue<number>;
  zoom: MotionValue<number>;
  ticks: TimelineTick[];
  timelineEvents: Event[];
  collapsedGroups: CollapsedEventGroup[];
  visibleBounds: {
    startYear: number;
    endYear: number;
  };
  eventLayouts: Record<string, EventLayoutState>;
  focusedEventId: string | null;
  eventAccentColors: Record<string, string | null>;
  onRenderFrame: (now: number) => void;
  getViewportWidth: () => number;
  onWheel: (e: React.WheelEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onFocusBigBang: () => void;
  onFocusEvent: (event: Event) => void;
  onFocusCollapsedGroup: (group: CollapsedEventGroup) => void;
}

export const TimelineViewport: React.FC<TimelineViewportProps> = ({
  containerRef,
  focusPixel,
  focusYear,
  zoom,
  ticks,
  timelineEvents,
  collapsedGroups,
  visibleBounds,
  eventLayouts,
  focusedEventId,
  eventAccentColors,
  onRenderFrame,
  getViewportWidth,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onFocusBigBang,
  onFocusEvent,
  onFocusCollapsedGroup,
}) => {
  const onRenderFrameRef = useRef(onRenderFrame);

  useEffect(() => {
    onRenderFrameRef.current = onRenderFrame;
  }, [onRenderFrame]);

  useEffect(() => {
    let frameId = 0;

    const loop = (now: number) => {
      onRenderFrameRef.current(now);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full cursor-grab overflow-hidden bg-zinc-950 text-white touch-none select-none active:cursor-grabbing"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2 bg-zinc-700" />

      <div className="pointer-events-none absolute inset-0 z-10">
        <BigBangMarker
          zoom={zoom}
          focusPixel={focusPixel}
          focusYear={focusYear}
          getViewportWidth={getViewportWidth}
          onClick={onFocusBigBang}
        />

        <div className="pointer-events-none absolute inset-0">
          {ticks.map((tick) => (
            <TickMarker
              key={tick.year}
              tick={tick}
              focusPixel={focusPixel}
              focusYear={focusYear}
              zoom={zoom}
            />
          ))}

          {collapsedGroups.map((group) => (
            <CollapsedMarker
              key={group.id}
              group={group}
              focusPixel={focusPixel}
              focusYear={focusYear}
              zoom={zoom}
              onClick={onFocusCollapsedGroup}
            />
          ))}

          {timelineEvents
            .filter((event) => {
              if (event.id === focusedEventId) {
                return true;
              }

              const year = getEventTimelineYear(event);
              const margin =
                (visibleBounds.endYear - visibleBounds.startYear) * 0.3;
              return (
                year >= visibleBounds.startYear - margin &&
                year <= visibleBounds.endYear + margin
              );
            })
            .map((event) => (
              <EventMarker
                key={event.id}
                event={event}
                accentColor={eventAccentColors[event.id] ?? null}
                focusPixel={focusPixel}
                focusYear={focusYear}
                zoom={zoom}
                layout={eventLayouts[event.id]}
                isFocused={event.id === focusedEventId}
                onClick={onFocusEvent}
              />
            ))}
        </div>
      </div>
    </div>
  );
};
