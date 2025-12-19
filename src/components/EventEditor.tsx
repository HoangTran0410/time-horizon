
import React, { useState } from 'react';
import { TimelineEvent, Category } from '../types';
import { X, Save } from 'lucide-react';
import { UNIVERSE_AGE_YEARS } from '../constants';

interface Props {
  event?: TimelineEvent;
  categories: Category[];
  onSave: (event: TimelineEvent) => void;
  onClose: () => void;
}

const EventEditor: React.FC<Props> = ({ event, categories, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<TimelineEvent>>(event || {
    title: '',
    description: '',
    yearsFromStart: UNIVERSE_AGE_YEARS,
    endYearsFromStart: undefined,
    category: categories[0]?.name || 'Human History',
    importance: 5,
    color: '#6366f1',
    icon: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: event?.id || Math.random().toString(36).substr(2, 9),
      title: formData.title || 'Untitled Event',
      description: formData.description || '',
      yearsFromStart: Number(formData.yearsFromStart),
      endYearsFromStart: formData.endYearsFromStart ? Number(formData.endYearsFromStart) : undefined,
      category: formData.category as string,
      importance: Number(formData.importance),
      color: formData.color,
      icon: formData.icon
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{event ? 'Edit Event' : 'Add Universal Event'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="flex gap-4">
            <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Event Title</label>
                <input 
                required
                autoFocus
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm"
                placeholder="e.g. Roman Empire"
                />
            </div>
            <div className="w-20">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 text-center">Icon</label>
                <input 
                type="text"
                value={formData.icon}
                onChange={e => setFormData({...formData, icon: e.target.value})}
                className="w-full px-2 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm text-center"
                placeholder="🚀"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Category</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm"
              >
                {categories.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.emoji} {cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Importance (1-10)</label>
              <input 
                type="number"
                min="1"
                max="10"
                value={formData.importance}
                onChange={e => setFormData({...formData, importance: Number(e.target.value)})}
                className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Start Year (Bang)</label>
              <input 
                required
                type="number"
                value={formData.yearsFromStart}
                onChange={e => setFormData({...formData, yearsFromStart: Number(e.target.value)})}
                className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">End Year (Optional)</label>
              <input 
                type="number"
                value={formData.endYearsFromStart || ''}
                onChange={e => setFormData({...formData, endYearsFromStart: e.target.value ? Number(e.target.value) : undefined})}
                className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm"
                placeholder="Range end"
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic">
            Year 0 AD = 13,800,000,000 PB
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Description</label>
            <textarea 
              rows={3}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2 bg-slate-800 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none text-sm resize-none"
              placeholder="Provide historical context..."
            />
          </div>

          <button 
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Save className="w-4 h-4" /> {event ? 'Update' : 'Save'} Event
          </button>
        </form>
      </div>
    </div>
  );
};

export default EventEditor;
