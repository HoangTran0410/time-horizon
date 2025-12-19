
import React from 'react';
import { TimelineEvent } from '../types';
import { X, Edit2, Trash2, Clock } from 'lucide-react';
import { UNIVERSE_AGE_YEARS, YEAR_ZERO_FROM_BANG } from '../constants';

interface Props {
  event: TimelineEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const EventDetails: React.FC<Props> = ({ event, onClose, onEdit, onDelete }) => {
  const formatYearLabel = (years: number) => {
    const abs = Math.abs(years);
    // For individual event details, we can show full numbers more often if they aren't billions
    if (abs < 1_000_000) return Math.floor(abs).toLocaleString();
    if (abs >= 1_000_000_000) return `${(years / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(years / 1_000_000).toFixed(2)}M`;
    return Math.floor(years).toString();
  };

  const formatJesusYear = (years: number) => {
    if (years === 0) return "Big Bang";
    if (years === UNIVERSE_AGE_YEARS) return "Present Day";
    
    const jesusYear = years - YEAR_ZERO_FROM_BANG;
    const suffix = jesusYear < 0 ? ' BC' : ' AD';
    
    return `${formatYearLabel(Math.abs(jesusYear))}${suffix}`;
  };

  const getTimeDisplay = () => {
    const start = formatJesusYear(event.yearsFromStart);
    if (event.endYearsFromStart && event.endYearsFromStart !== event.yearsFromStart) {
      const end = formatJesusYear(event.endYearsFromStart);
      return `${start} — ${end}`;
    }
    return start;
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl p-4 md:p-6 z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-full text-slate-400 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
        <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0 bg-slate-800 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-3xl border border-white/5 shadow-inner">
          {event.icon || '📍'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] md:text-[10px] font-bold uppercase rounded tracking-wider">
              {event.category}
            </span>
            <span className="text-[9px] md:text-[10px] text-slate-500 font-medium">
              Importance: {event.importance}/10
            </span>
          </div>
          
          <h2 className="text-xl md:text-2xl font-bold mb-0.5">{event.title}</h2>
          <p className="text-xs md:text-sm text-indigo-300 font-semibold mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {getTimeDisplay()}
          </p>

          <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-4 md:mb-6 line-clamp-6">
            {event.description}
          </p>

          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={onEdit}
              className="flex-1 sm:flex-none px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-white/5"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
            <button 
              onClick={onDelete}
              className="flex-1 sm:flex-none px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[11px] md:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
