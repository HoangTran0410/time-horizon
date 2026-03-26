import React, { useState } from "react";
import { Event } from "../types";
import EmojiPicker, { type Theme } from "emoji-picker-react";
import { X, ChevronDown } from "lucide-react";

interface EventEditorProps {
  event: Event;
  mode: "create" | "edit";
  onSave: (event: Event) => void;
  onClose: () => void;
}

// Returns the last valid day of the given year+month.
const getMaxDay = (year: number, month: number): number =>
  new Date(year, month, 0).getDate();

// Converts Event.time tuple to a datetime-local <input> value string.
// Only produced when year, month, day are all non-null.
const toDatetimeLocal = (time: Event["time"]): string => {
  const [year, month, day, hour, minute, seconds] = time;
  if (year === null || month === null || day === null) return "";
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${year}-${pad(month)}-${pad(day)}` +
    `T${hour !== null ? pad(hour) : "00"}:${minute !== null ? pad(minute) : "00"}`
  );
};

// Parses a datetime-local value back into the time tuple.
const parseDatetimeLocal = (
  value: string,
  prev: Event["time"],
): Event["time"] => {
  if (!value) return prev;
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h = 0, min = 0] = (timePart ?? "00:00").split(":").map(Number);
  return [
    y ?? prev[0],
    m ?? prev[1],
    d ?? prev[2],
    h ?? prev[3],
    min ?? prev[4],
    prev[5],
  ];
};

// Default accent colors for event color swatches.
const COLOR_SWATCHES = [
  { label: "None", value: null },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#22c55e" },
  { label: "Emerald", value: "#10b981" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Fuchsia", value: "#d946ef" },
  { label: "Pink", value: "#ec4899" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Zinc", value: "#71717a" },
];

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  mode,
  onSave,
  onClose,
}) => {
  const [editedEvent, setEditedEvent] = useState<Event>({ ...event });
  const [dateError, setDateError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const [year, month, day, hour, minute, seconds] = editedEvent.time;

  const hasMonth = month !== null;
  const hasDay = day !== null;
  const hasHour = day !== null; // hour shows once day is set
  const hasMinute = hour !== null; // minute shows once hour is set
  const hasSeconds = minute !== null;

  const validateDate = (): boolean => {
    setDateError(null);
    if (month === null || day === null) return true;
    if (year) {
      const maxDay = getMaxDay(year, month);
      if (day > maxDay) {
        setDateError(
          `Invalid date: ${month}/${day} exceeds ${maxDay} days in month ${month} of ${year}.`,
        );
        return false;
      }
    }
    return true;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setEditedEvent((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  // const handleGroupsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const groups = e.target.value
  //     .split(",")
  //     .map((g) => g.trim())
  //     .filter((g) => g);
  //   setEditedEvent((prev) => ({ ...prev, groups }));
  // };

  const handleTimeChange = (index: 1 | 2 | 3 | 4 | 5, raw: string) => {
    if (raw !== "" && isNaN(Number(raw))) return;
    const v = raw === "" ? null : Number(raw);
    if (v !== null) {
      if (index === 1 && (v < 1 || v > 12)) return;
      if (index === 2 && (v < 1 || v > 31)) return;
      if (index === 3 && (v < 0 || v > 23)) return;
      if (index === 4 && (v < 0 || v > 59)) return;
      if (index === 5 && (v < 0 || v > 59)) return;
    }
    setEditedEvent((prev) => {
      const nextTime = [...prev.time] as Event["time"];
      nextTime[index] = v;
      return { ...prev, time: nextTime };
    });
    setDateError(null);
  };

  const handleDatetimeLocal = (value: string) => {
    setEditedEvent((prev) => ({
      ...prev,
      time: parseDatetimeLocal(value, prev.time),
    }));
    setDateError(null);
  };

  // Close emoji/color pickers when clicking outside.
  React.useEffect(() => {
    if (!showEmojiPicker && !showColorPicker) return;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(".emoji-trigger")) setShowEmojiPicker(false);
      if (!el.closest(".color-trigger")) setShowColorPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker, showColorPicker]);

  // Clears this field and all finer-grained fields after it.
  const handleClearTimeField = (index: 1 | 2 | 3 | 4 | 5) => {
    setEditedEvent((prev) => {
      const nextTime = [...prev.time] as Event["time"];
      for (let i = index; i <= 5; i++) nextTime[i] = null;
      return { ...prev, time: nextTime };
    });
    setDateError(null);
  };

  const handleColorChange = (color: string | null) => {
    setEditedEvent((prev) => ({ ...prev, color: color ?? undefined }));
  };

  const handleSave = () => {
    if (!validateDate()) return;
    onSave(editedEvent);
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
        {/* Header with close button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {mode === "create" ? "Add Event" : "Edit Event"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X width={20} height={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
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

          {/* Emoji + color row */}
          <div className="flex gap-4">
            {/* Emoji */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Emoji
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="emoji-trigger w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white text-left flex items-center justify-between hover:border-zinc-600 transition-colors"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                >
                  <span className="text-lg">{editedEvent.emoji}</span>
                  <ChevronDown
                    width={14}
                    height={14}
                    className="text-zinc-500"
                  />
                </button>
                {showEmojiPicker && (
                  <div className="emoji-trigger absolute z-10 mt-1">
                    <EmojiPicker
                      theme={"dark" as Theme}
                      onEmojiClick={(emojiData) => {
                        setEditedEvent((prev) => ({
                          ...prev,
                          emoji: emojiData.emoji,
                        }));
                        setShowEmojiPicker(false);
                      }}
                      height={350}
                      width={320}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Color */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Color
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="color-trigger w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white text-left flex items-center gap-2 hover:border-zinc-600 transition-colors"
                  onClick={() => setShowColorPicker((v) => !v)}
                >
                  <span
                    className="w-5 h-5 rounded border border-zinc-600 shrink-0"
                    style={{
                      backgroundColor: editedEvent.color ?? "transparent",
                    }}
                  />
                  <span className="text-sm text-zinc-300">
                    {COLOR_SWATCHES.find(
                      (c) => c.value === (editedEvent.color ?? null),
                    )?.label ?? "None"}
                  </span>
                  <ChevronDown
                    width={14}
                    height={14}
                    className="text-zinc-500 ml-auto"
                  />
                </button>

                {/* Swatch popover */}
                {showColorPicker && (
                  <div className="color-trigger absolute z-10 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl p-3 shadow-xl">
                    <div className="grid grid-cols-4 gap-2">
                      {COLOR_SWATCHES.map((swatch) => (
                        <button
                          key={swatch.value ?? "none"}
                          type="button"
                          title={swatch.label}
                          onClick={() => {
                            handleColorChange(swatch.value);
                            setShowColorPicker(false);
                          }}
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            (swatch.value ?? null) ===
                            (editedEvent.color ?? null)
                              ? "border-white scale-110"
                              : "border-zinc-600"
                          }`}
                          style={{
                            backgroundColor: swatch.value ?? "transparent",
                            backgroundImage:
                              swatch.value === null
                                ? "linear-gradient(135deg, #fff 45%, transparent 45%, transparent 55%, #fff 55%)"
                                : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
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

          {/* Time */}
          <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-zinc-400">Time</label>
              {/* Quick picker — shown whenever year is set */}
              {year && (
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(editedEvent.time)}
                  onChange={(e) => handleDatetimeLocal(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                />
              )}
            </div>

            {/* Year — always visible */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Year *</label>
              <input
                type="number"
                value={year}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setEditedEvent((prev) => ({
                    ...prev,
                    time: [
                      v,
                      prev.time[1],
                      prev.time[2],
                      prev.time[3],
                      prev.time[4],
                      prev.time[5],
                    ],
                  }));
                }}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Month */}
            {year && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Month
                  </label>
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
                <button
                  type="button"
                  onClick={() => handleClearTimeField(1)}
                  title="Clear month and below"
                  className="mt-5 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {/* Day */}
            {hasMonth && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Day
                  </label>
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
                <button
                  type="button"
                  onClick={() => handleClearTimeField(2)}
                  title="Clear day and below"
                  className="mt-5 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {/* Hour */}
            {hasDay && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Hour
                  </label>
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
                <button
                  type="button"
                  onClick={() => handleClearTimeField(3)}
                  title="Clear hour and below"
                  className="mt-5 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {/* Minute */}
            {hasMinute && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Minute
                  </label>
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
                <button
                  type="button"
                  onClick={() => handleClearTimeField(4)}
                  title="Clear minute and below"
                  className="mt-5 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {/* Seconds */}
            {hasSeconds && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">
                    Seconds
                  </label>
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
                <button
                  type="button"
                  onClick={() => handleClearTimeField(5)}
                  title="Clear seconds"
                  className="mt-5 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {/* Date validation error */}
            {dateError && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {dateError}
              </p>
            )}
          </div>

          {/* Duration */}
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

          {/* Groups */}
          {/* <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Groups (comma separated)
            </label>
            <input
              type="text"
              value={editedEvent.groups.join(", ")}
              onChange={handleGroupsChange}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div> */}

          {/* Priority */}
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

        {/* Actions */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-zinc-800 text-white px-6 py-2 rounded-full hover:bg-zinc-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-emerald-500 text-white px-6 py-2 rounded-full hover:bg-emerald-600 transition-colors text-sm font-medium"
          >
            {mode === "create" ? "Add Event" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
