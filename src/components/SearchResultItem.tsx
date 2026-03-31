import React from "react";
import { Image, Link2, MoreHorizontal, Play } from "lucide-react";
import { Event } from "../constants/types";
import { getEventDisplayLabel } from "../helpers";

interface SearchResultItemProps {
  event: Event;
  onSelect: (event: Event) => void;
  onOpenActions: (event: Event, trigger: HTMLButtonElement) => void;
  isActionsOpen: boolean;
}

const getSearchSummary = (description: string) => {
  const summary = description.replace(/\s+/g, " ").trim();
  if (summary.length <= 100) return summary;
  return `${summary.slice(0, 97).trimEnd()}...`;
};

export const SearchResultItem = React.memo<SearchResultItemProps>(
  ({ event, onSelect, onOpenActions, isActionsOpen }) => (
    <div className="ui-card flex items-start gap-3 rounded-[1.25rem] px-3.5 py-3">
      <button
        type="button"
        onClick={() => onSelect(event)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-start gap-2">
          <span className="text-lg leading-5">{event.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-zinc-100">
              {event.title}
            </div>
          </div>
        </div>
        <div className="mt-1 text-[0.66rem] font-mono uppercase tracking-[0.18em] text-zinc-500">
          {getEventDisplayLabel(event)}
        </div>
        {(event.image || event.video || event.link) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.image && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[0.65rem] font-semibold text-sky-200">
                <Image width={10} height={10} />
                Image
              </span>
            )}
            {event.video && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[0.65rem] font-semibold text-rose-200">
                <Play width={10} height={10} />
                Video
              </span>
            )}
            {event.link && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[0.65rem] font-semibold text-amber-200">
                <Link2 width={10} height={10} />
                Link
              </span>
            )}
          </div>
        )}
        {event.description.trim() && (
          <div className="mt-2 text-[0.82rem] leading-5 text-zinc-400">
            {getSearchSummary(event.description)}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={(clickEvent) => onOpenActions(event, clickEvent.currentTarget)}
        className={`ui-icon-button h-10 w-10 shrink-0 rounded-[0.95rem] ${
          isActionsOpen ? "border-zinc-600 bg-zinc-800" : ""
        }`}
        aria-label={`More actions for ${event.title}`}
        aria-expanded={isActionsOpen}
        aria-haspopup="menu"
        title={`More actions for ${event.title}`}
      >
        <MoreHorizontal width={15} height={15} />
      </button>
    </div>
  ),
);
