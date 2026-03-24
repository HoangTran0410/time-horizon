import React, { useState } from "react";
import { Event } from "../types";

interface SidebarProps {
  events: Event[];
  selectedGroups: string[];
  onToggleGroup: (group: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFocusEvent: (event: Event) => void;
  onEditEvent: (event: Event) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  events,
  selectedGroups,
  onToggleGroup,
  searchQuery,
  onSearchChange,
  onFocusEvent,
  onEditEvent,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get unique groups
  const allGroups = Array.from(new Set(events.flatMap((e) => e.groups))).sort();

  // Filter events for the list
  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup =
      selectedGroups.length === 0 ||
      e.groups.some((g) => selectedGroups.includes(g));
    return matchesSearch && matchesGroup;
  });

  return (
    <>
      {/* Toggle Button */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 bg-zinc-900 border border-zinc-700 text-white p-2 rounded-lg shadow-lg hover:bg-zinc-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
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
          <h2 className="text-xl font-bold text-white mb-6">Timeline Events</h2>

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
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{event.emoji}</span>
                      <span className="text-sm font-medium text-zinc-200">
                        {event.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEvent(event);
                      }}
                      className="p-1.5 -mr-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-emerald-500 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
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
