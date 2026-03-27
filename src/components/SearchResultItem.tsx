import React from "react";
import { Image, Link2, Play, Trash2 } from "lucide-react";
import { Event } from "../constants/types";
import { getEventDisplayLabel } from "../helpers";

interface SearchResultItemProps {
  event: Event;
  onSelect: (event: Event) => void;
  onDelete: (event: Event) => void;
}

const getSearchSummary = (description: string) => {
  const summary = description.replace(/\s+/g, " ").trim();
  if (summary.length <= 100) return summary;
  return `${summary.slice(0, 97).trimEnd()}...`;
};

export const SearchResultItem = React.memo<SearchResultItemProps>(
  ({ event, onSelect, onDelete }) => (
    <div className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 transition-colors hover:border-zinc-700 hover:bg-zinc-800">
      <button
        type="button"
        onClick={() => onSelect(event)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-start gap-2">
          <span className="text-sm leading-5">{event.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-zinc-100">
              {event.title}
            </div>
          </div>
        </div>
        <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
          {getEventDisplayLabel(event)}
        </div>
        {(event.image || event.video || event.link) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {event.image && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-200">
                <Image width={10} height={10} />
                Image
              </span>
            )}
            {event.video && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                <Play width={10} height={10} />
                Video
              </span>
            )}
            {event.link && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <Link2 width={10} height={10} />
                Link
              </span>
            )}
          </div>
        )}
        {event.description.trim() && (
          <div className="mt-1 text-[11px] leading-4 text-zinc-400">
            {getSearchSummary(event.description)}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => onDelete(event)}
        className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:border-red-500/35 hover:bg-red-500/15 hover:text-red-200"
        aria-label={`Delete ${event.title}`}
        title={`Delete ${event.title}`}
      >
        <Trash2 width={13} height={13} />
      </button>
    </div>
  ),
);
