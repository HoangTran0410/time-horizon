import React, { useState } from "react";
import { Event, getEventTimelineYear } from "../types";
import { Menu, X, Pencil } from "lucide-react";
import { getEventDisplayLabel } from "../utils";

interface SidebarProps {
  events: Event[];
  selectedGroups: string[];
  onToggleGroup: (group: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFocusEvent: (event: Event) => void;
  onEditEvent: (event: Event) => void;
  onAddEvent: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  events,
  selectedGroups,
  onToggleGroup,
  searchQuery,
  onSearchChange,
  onFocusEvent,
  onEditEvent,
  onAddEvent,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const allGroups = Array.from(new Set(events.flatMap((e) => e.groups))).sort();

  const filteredEvents = [...events]
    .filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup =
        selectedGroups.length === 0 ||
        e.groups.some((g) => selectedGroups.includes(g));
      return matchesSearch && matchesGroup;
    })
    .sort((a, b) => {
      const yearDiff = getEventTimelineYear(a) - getEventTimelineYear(b);
      if (Math.abs(yearDiff) > 1e-9) return yearDiff;
      return a.title.localeCompare(b.title);
    });

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 bg-zinc-900 border border-zinc-700 text-white p-2 rounded-lg shadow-lg hover:bg-zinc-800 transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 h-full w-80 bg-zinc-950 border-r border-zinc-800 z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 pt-20 flex-1 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">
            Timeline Events
          </h2>

          <div className="mb-6">
            <button
              onClick={onAddEvent}
              className="w-full bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-sm font-semibold"
            >
              Add Event
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Groups */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Filter by Group
            </h3>
            <div className="flex flex-wrap gap-2">
              {allGroups.map((group) => (
                <button
                  key={group}
                  onClick={() => onToggleGroup(group)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    selectedGroups.includes(group)
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                      : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Event List */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Events ({filteredEvents.length})
            </h3>
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors cursor-pointer group"
                  onClick={() => onFocusEvent(event)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-xl mt-0.5">{event.emoji}</span>
                      <div className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-200 truncate">
                          {event.title}
                        </span>
                        <span className="block text-xs text-zinc-500 truncate">
                          {getEventDisplayLabel(event)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      className="p-1.5 -mr-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-emerald-500 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
