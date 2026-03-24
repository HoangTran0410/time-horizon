import React, { useState } from "react";
import { Event } from "../types";

interface EventEditorProps {
  event: Event;
  onSave: (event: Event) => void;
  onClose: () => void;
}

type TimeField = 1 | 2 | 3 | 4 | 5;

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  onSave,
  onClose,
}) => {
  const [editedEvent, setEditedEvent] = useState<Event>({ ...event });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setEditedEvent((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleGroupsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const groups = e.target.value
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g);
    setEditedEvent((prev) => ({ ...prev, groups }));
  };

  const handleTimeChange = (index: TimeField, raw: string) => {
    if (raw !== "" && isNaN(Number(raw))) return; // reject non-numeric input
    const v = raw === "" ? null : Number(raw);
    if (v !== null) {
      if (index === 1 && (v < 1 || v > 12)) return; // month 1-12
      if (index === 2 && (v < 1 || v > 31)) return; // day 1-31
      if (index === 3 && (v < 0 || v > 23)) return; // hour 0-23
      if (index === 4 && (v < 0 || v > 59)) return; // minute 0-59
      if (index === 5 && (v < 0 || v > 59)) return; // seconds 0-59
    }
    setEditedEvent((prev) => {
      const nextTime = [...prev.time] as Event["time"];
      nextTime[index] = v;
      return { ...prev, time: nextTime };
    });
  };

  const [year, month, day, hour, minute, seconds] = editedEvent.time;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-6">Edit Event</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={editedEvent.title}
              onChange={handleChange}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Emoji
            </label>
            <input
              type="text"
              name="emoji"
              value={editedEvent.emoji}
              onChange={handleChange}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={editedEvent.description}
              onChange={handleChange}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
            <label className="block text-sm font-medium text-zinc-400 mb-3">
              Time [year, month, day, hour, minute, seconds]
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">Year *</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setEditedEvent((prev) => ({
                      ...prev,
                      time: [v, prev.time[1], prev.time[2], prev.time[3], prev.time[4], prev.time[5]],
                    }));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Month</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={month ?? ""}
                  onChange={(e) => handleTimeChange(1, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="null"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Day</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={day ?? ""}
                  onChange={(e) => handleTimeChange(2, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="null"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Hour</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hour ?? ""}
                  onChange={(e) => handleTimeChange(3, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="null"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Minute</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minute ?? ""}
                  onChange={(e) => handleTimeChange(4, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="null"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">Seconds</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={seconds ?? ""}
                  onChange={(e) => handleTimeChange(5, e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="null"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Duration (years, optional)
            </label>
            <input
              type="number"
              step="0.000001"
              value={editedEvent.duration ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setEditedEvent((prev) => ({
                  ...prev,
                  duration: raw === "" ? undefined : Number(raw),
                }));
              }}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="e.g. 1"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Used for auto-zoom when focusing this event.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Groups (comma separated)
            </label>
            <input
              type="text"
              value={editedEvent.groups.join(", ")}
              onChange={handleGroupsChange}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Priority (Higher = more visible)
            </label>
            <input
              type="number"
              name="priority"
              value={editedEvent.priority}
              onChange={handleChange}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-zinc-800 text-white px-6 py-2 rounded-full hover:bg-zinc-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editedEvent)}
            className="bg-emerald-500 text-white px-6 py-2 rounded-full hover:bg-emerald-600 transition-colors text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
