import React, { useState } from "react";
import { TimelineEvent, Category } from "../types";
import {
  Search,
  History,
  Clock,
  Plus,
  Tag,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

interface Props {
  events: TimelineEvent[];
  categories: Category[];
  onSelectEvent: (id: string) => void;
  activeCategoryName: string;
  setActiveCategoryName: (name: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onAddCategory: (cat: Category) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<Props> = ({
  events,
  categories,
  onSelectEvent,
  activeCategoryName,
  setActiveCategoryName,
  searchQuery,
  setSearchQuery,
  onAddCategory,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🔖");

  const filtered = events
    .filter(
      (e) =>
        (activeCategoryName === "All" || e.category === activeCategoryName) &&
        e.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.yearsFromStart - b.yearsFromStart);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory({ name: newCatName.trim(), emoji: newCatEmoji });
      setNewCatName("");
      setIsAddingCategory(false);
    }
  };

  return (
    <div className="w-80 max-w-[85vw] bg-slate-900 border-r border-white/10 flex flex-col h-full z-20 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-white/5 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Tag className="w-3 h-3" /> Categories
          </h2>
          <button
            onClick={() => setIsAddingCategory(!isAddingCategory)}
            className="p-1 hover:bg-indigo-500/20 text-indigo-400 rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {isAddingCategory && (
          <form
            onSubmit={handleCreateCategory}
            className="bg-slate-800/50 p-3 rounded-lg border border-indigo-500/30 animate-in slide-in-from-top-2"
          >
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="🔖"
                value={newCatEmoji}
                onChange={(e) => setNewCatEmoji(e.target.value)}
                className="w-10 bg-slate-900 border border-white/10 rounded px-1 py-1 text-center text-sm focus:outline-none focus:border-indigo-500"
              />
              <input
                autoFocus
                type="text"
                placeholder="Category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 bg-slate-900 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingCategory(false)}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-2 py-1 rounded text-[10px] font-bold"
              >
                Create
              </button>
            </div>
          </form>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 rounded-lg text-sm border border-transparent focus:border-indigo-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
          <button
            onClick={() => setActiveCategoryName("All")}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeCategoryName === "All"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategoryName(cat.name)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                activeCategoryName === cat.name
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar touch-pan-y">
        <div className="p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm italic">
              No events in this category.
            </div>
          ) : (
            filtered.map((event) => {
              const catEmoji =
                categories.find((c) => c.name === event.category)?.emoji ||
                "📍";
              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event.id)}
                  className="w-full p-3 rounded-lg hover:bg-white/5 text-left transition-all group border border-transparent hover:border-white/5"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[9px] font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors uppercase tracking-widest flex items-center gap-1">
                      <span>{catEmoji}</span> {event.category}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Clock className="w-3 h-3 text-slate-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">
                      {event.icon || "📍"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white mb-0.5 truncate">
                        {event.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-1 leading-tight">
                        {event.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-900/80 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          <History className="w-3 h-3" />
          <span>{filtered.length} visible events</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
