import React, { useState } from "react";
import { Event } from "../types";

interface EventEditorProps {
  event: Event;
  onSave: (event: Event) => void;
  onClose: () => void;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  onSave,
  onClose,
}) => {
  const [editedEvent, setEditedEvent] = useState<Event>({ ...event });
  const [inputMode, setInputMode] = useState<"datetime" | "offset">(
    Math.abs(event.absoluteYear) < 2000 ? "datetime" : "offset",
  );

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

  /** Convert absolute year → datetime-local string (YYYY-MM-DDTHH:MM). */
  const absoluteYearToDatetimeLocal = (absoluteYear: number) => {
    const date = new Date(Math.round(absoluteYear), 0, 1);
    if (isNaN(date.getTime())) return "";
    const Y = date.getFullYear();
    if (Y < 0 || Y > 9999) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${Y.toString().padStart(4, Y < 0 ? "-" : "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  /** Convert datetime-local string → absolute year. */
  const datetimeLocalToAbsoluteYear = (dt: string): number => {
    if (!dt) return editedEvent.pivotYear;
    // Handle negative years: datetime-local uses "0001-01-01T00:00" as the earliest,
    // so negative years must be handled by detecting a leading "-" prefix.
    const isNegative = dt.startsWith("-");
    const dateStr = isNegative ? dt.slice(1) : dt;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0;
    const year = date.getFullYear();
    return isNegative ? -year : year;
  };

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
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 mb-4">
              <button
                type="button"
                onClick={() => setInputMode("datetime")}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${inputMode === "datetime" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Date & Time
              </button>
              <button
                type="button"
                onClick={() => setInputMode("offset")}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${inputMode === "offset" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Year Offset
              </button>
            </div>

            {inputMode === "datetime" ? (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={absoluteYearToDatetimeLocal(editedEvent.absoluteYear)}
                  onChange={(e) => {
                    const newAbsoluteYear = datetimeLocalToAbsoluteYear(
                      e.target.value,
                    );
                    setEditedEvent((prev) => ({
                      ...prev,
                      absoluteYear: newAbsoluteYear,
                    }));
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Absolute Year
                </label>
                <input
                  type="number"
                  name="absoluteYear"
                  value={editedEvent.absoluteYear}
                  onChange={handleChange}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Pivot Year (reference "now", e.g. 0 for cosmic, 2026 for current)
            </label>
            <input
              type="number"
              name="pivotYear"
              value={editedEvent.pivotYear}
              onChange={handleChange}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
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
