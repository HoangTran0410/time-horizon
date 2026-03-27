import React, { useEffect, useRef, useState } from "react";
import { Event, EventCollectionMeta } from "../constants/types";
import EmojiPicker, { type Theme } from "emoji-picker-react";
import { ChevronDown, X } from "lucide-react";
import {
  normalizeEmbedVideoUrl,
  normalizeEventTimeParts,
  normalizeExternalLinkUrl,
  normalizeImageUrl,
} from "../helpers";

interface EventEditorProps {
  event: Event;
  mode: "create" | "edit";
  onSave: (event: Event, collectionId?: string | null) => void;
  onClose: () => void;
  availableCollections?: EventCollectionMeta[];
  initialCollectionId?: string | null;
  onAddCollection?: () => void;
}

const getMaxDay = (year: number, month: number): number => {
  const date = new Date(Date.UTC(0, month, 0));
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
};

const supportsDateInputYear = (year: number): boolean =>
  Number.isInteger(year) && year >= 0 && year <= 9999;

const normalizeEventTime = (time: Event["time"]): Event["time"] => {
  const nextTime = [...normalizeEventTimeParts(time)] as Event["time"];
  const [year, month, day, hour, minute] = nextTime;

  if (month == null) {
    nextTime[2] = null;
    nextTime[3] = null;
    nextTime[4] = null;
    nextTime[5] = null;
    return nextTime;
  }

  if (day == null) {
    nextTime[3] = null;
    nextTime[4] = null;
    nextTime[5] = null;
    return nextTime;
  }

  nextTime[2] = Math.min(day, getMaxDay(year, month));

  if (hour === null) {
    nextTime[4] = null;
    nextTime[5] = null;
    return nextTime;
  }

  if (minute === null) {
    nextTime[5] = null;
  }

  return nextTime;
};

const toDateInputValue = (time: Event["time"]): string => {
  const [year, month, day] = normalizeEventTime(time);
  if (!supportsDateInputYear(year) || month == null || day == null) {
    return "";
  }

  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const padYear = (n: number) => String(n).padStart(4, "0");
  return `${padYear(year)}-${pad(month)}-${pad(day)}`;
};

const parseDateInputValue = (
  value: string,
  prev: Event["time"],
): Event["time"] => {
  if (!value) return prev;
  const [y, m, d] = value.split("-").map(Number);
  return normalizeEventTime([
    y ?? prev[0],
    m ?? prev[1],
    d ?? prev[2],
    prev[3],
    prev[4],
    prev[5],
  ]);
};

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

const normalizeEventForSave = (event: Event): Event => ({
  ...event,
  title: event.title.trim(),
  description: event.description.trim(),
  image: normalizeImageUrl(event.image) ?? undefined,
  video: normalizeEmbedVideoUrl(event.video) ?? undefined,
  link: normalizeExternalLinkUrl(event.link) ?? undefined,
});

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  mode,
  onSave,
  onClose,
  availableCollections = [],
  initialCollectionId = null,
  onAddCollection,
}) => {
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [editedEvent, setEditedEvent] = useState<Event>({
    ...event,
    time: [...event.time] as Event["time"],
  });
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    initialCollectionId ?? availableCollections[0]?.id ?? "",
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (mode !== "create") return;
    const fallbackCollectionId = availableCollections[0]?.id ?? "";
    const nextCollectionId = initialCollectionId ?? fallbackCollectionId;
    setSelectedCollectionId((prev) =>
      prev === nextCollectionId ? prev : nextCollectionId,
    );
  }, [availableCollections, initialCollectionId, mode]);

  const [year, month, day, hour, minute, seconds] = editedEvent.time;
  const hasMonth = month != null;
  const hasDay = day != null;
  const hasHour = hour != null;
  const hasMinute = minute != null;
  const canUseDateInput = supportsDateInputYear(year);

  const validateDate = (): boolean => {
    setDateError(null);
    if (month == null || day == null) return true;
    const maxDay = getMaxDay(year, month);
    if (day > maxDay) {
      setDateError(
        `Invalid date: ${month}/${day} exceeds ${maxDay} days in month ${month} of ${year}.`,
      );
      return false;
    }
    return true;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setEditedEvent((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleTimeChange = (index: 1 | 2 | 3 | 4 | 5, raw: string) => {
    if (raw !== "" && isNaN(Number(raw))) return;
    const value = raw === "" ? null : Number(raw);

    if (value !== null) {
      if (index === 1 && (value < 1 || value > 12)) return;
      if (index === 2 && (value < 1 || value > 31)) return;
      if (index === 3 && (value < 0 || value > 23)) return;
      if (index === 4 && (value < 0 || value > 59)) return;
      if (index === 5 && (value < 0 || value > 59)) return;
    }

    setEditedEvent((prev) => {
      const nextTime = [...prev.time] as Event["time"];
      if (value === null) {
        for (let i = index; i <= 5; i += 1) nextTime[i] = null;
      } else {
        nextTime[index] = value;
      }
      return { ...prev, time: normalizeEventTime(nextTime) };
    });
    setDateError(null);
  };

  const handleDateInputChange = (value: string) => {
    setEditedEvent((prev) => ({
      ...prev,
      time: parseDateInputValue(value, prev.time),
    }));
    setDateError(null);
  };

  useEffect(() => {
    if (!showEmojiPicker && !showColorPicker) return;

    const handler = (e: MouseEvent) => {
      const element = e.target as HTMLElement;
      if (!element.closest(".emoji-trigger")) setShowEmojiPicker(false);
      if (!element.closest(".color-trigger")) setShowColorPicker(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColorPicker, showEmojiPicker]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    },
    [],
  );

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 180);
  };

  const handleClearTimeField = (index: 1 | 2 | 3 | 4 | 5) => {
    setEditedEvent((prev) => {
      const nextTime = [...prev.time] as Event["time"];
      for (let i = index; i <= 5; i += 1) nextTime[i] = null;
      return { ...prev, time: normalizeEventTime(nextTime) };
    });
    setDateError(null);
  };

  const handleColorChange = (color: string | null) => {
    setEditedEvent((prev) => ({ ...prev, color: color ?? undefined }));
  };

  const handleOptionalFieldChange =
    (field: "image" | "video" | "link") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setEditedEvent((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleSave = () => {
    if (!validateDate()) return;

    const normalizedEvent = normalizeEventForSave(editedEvent);

    if (mode === "create" && availableCollections.length > 0) {
      if (!selectedCollectionId) {
        setCollectionError("Choose a destination collection.");
        return;
      }
      onSave(normalizedEvent, selectedCollectionId);
      return;
    }

    onSave(normalizedEvent);
  };

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    shouldCloseOnPointerUpRef.current = e.target === e.currentTarget;
  };

  const handleBackdropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldCloseOnPointerUpRef.current && e.target === e.currentTarget) {
      requestClose();
    }

    shouldCloseOnPointerUpRef.current = false;
  };

  return (
    <div
      className="ui-modal-overlay fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4"
      data-ui-state={isClosing ? "closing" : "open"}
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={() => {
        shouldCloseOnPointerUpRef.current = false;
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={`ui-modal-surface max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 md:p-8 p-4 max-w-md`}
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {mode === "create" ? "New Event" : "Edit Event"}
          </h2>
          <button
            onClick={requestClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <X width={20} height={20} />
          </button>
        </div>

        {mode === "create" && (
          <div className="mb-6">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-400">
                Save To Collection
              </label>
              {onAddCollection && (
                <button
                  type="button"
                  onClick={onAddCollection}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                >
                  + New Collection
                </button>
              )}
            </div>
            <select
              value={selectedCollectionId}
              onChange={(e) => {
                setSelectedCollectionId(e.target.value);
                setCollectionError(null);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              {availableCollections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.emoji} {collection.name}
                </option>
              ))}
            </select>
            {collectionError && (
              <p className="mt-2 text-xs text-red-400">{collectionError}</p>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={editedEvent.title}
              onChange={handleChange}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                Emoji
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="emoji-trigger flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-left text-white transition-colors hover:border-zinc-600"
                  onClick={() => setShowEmojiPicker((value) => !value)}
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
                      height={400}
                      width={320}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                Color
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="color-trigger flex w-full items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-left text-white transition-colors hover:border-zinc-600"
                  onClick={() => setShowColorPicker((value) => !value)}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded border border-zinc-600"
                    style={{
                      backgroundColor: editedEvent.color ?? "transparent",
                    }}
                  />
                  <span className="text-sm text-zinc-300">
                    {COLOR_SWATCHES.find(
                      (swatch) => swatch.value === (editedEvent.color ?? null),
                    )?.label ?? "None"}
                  </span>
                  <ChevronDown
                    width={14}
                    height={14}
                    className="ml-auto text-zinc-500"
                  />
                </button>

                {showColorPicker && (
                  <div className="color-trigger absolute z-10 mt-1 rounded-xl border border-zinc-700 bg-zinc-800 p-3">
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
                          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            (swatch.value ?? null) ===
                            (editedEvent.color ?? null)
                              ? "scale-110 border-white"
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

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Description
            </label>
            <textarea
              name="description"
              value={editedEvent.description}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400">Time</label>
              {canUseDateInput && (
                <input
                  type="date"
                  value={toDateInputValue(editedEvent.time)}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-500">Year *</label>
              <input
                type="number"
                value={year}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setEditedEvent((prev) => ({
                    ...prev,
                    time: normalizeEventTime([
                      value,
                      prev.time[1],
                      prev.time[2],
                      prev.time[3],
                      prev.time[4],
                      prev.time[5],
                    ]),
                  }));
                  setDateError(null);
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {year !== null && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-zinc-500">
                    Month
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={month ?? ""}
                    onChange={(e) => handleTimeChange(1, e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="null"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleClearTimeField(1)}
                  title="Clear month and below"
                  className="mt-5 text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {hasMonth && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-zinc-500">
                    Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={day ?? ""}
                    onChange={(e) => handleTimeChange(2, e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="null"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleClearTimeField(2)}
                  title="Clear day and below"
                  className="mt-5 text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {hasDay && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-zinc-500">
                    Hour
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={hour ?? ""}
                    onChange={(e) => handleTimeChange(3, e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="null"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleClearTimeField(3)}
                  title="Clear hour and below"
                  className="mt-5 text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {hasHour && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-zinc-500">
                    Minute
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minute ?? ""}
                    onChange={(e) => handleTimeChange(4, e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="null"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleClearTimeField(4)}
                  title="Clear minute and below"
                  className="mt-5 text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {hasMinute && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-zinc-500">
                    Seconds
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={seconds ?? ""}
                    onChange={(e) => handleTimeChange(5, e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="null"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleClearTimeField(5)}
                  title="Clear seconds"
                  className="mt-5 text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            )}

            {dateError && (
              <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">
                {dateError}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-400">
                Media & Links
              </label>
              <span className="text-xs text-zinc-500">Optional</span>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                Image URL
              </label>
              <input
                type="text"
                value={editedEvent.image ?? ""}
                onChange={handleOptionalFieldChange("image")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                placeholder="https://upload.wikimedia.org/..."
              />
              <p className="mt-1 text-xs text-zinc-500">
                Paste any direct image URL.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-500">Video</label>
              <input
                type="text"
                value={editedEvent.video ?? ""}
                onChange={handleOptionalFieldChange("video")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                placeholder="dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Supports YouTube IDs, `youtu.be`, and full YouTube links. Other
                video URLs still work as-is.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-500">
                External Link
              </label>
              <input
                type="text"
                value={editedEvent.link ?? ""}
                onChange={handleOptionalFieldChange("link")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Apollo_11 or https://en.wikipedia.org/wiki/Apollo_11"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Paste any URL, or enter a Wikipedia article name and it will be
                expanded automatically when you save.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. 1"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Used for auto-zoom when focusing this event.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400">
              Priority (Higher = more visible)
            </label>
            <input
              type="number"
              name="priority"
              value={editedEvent.priority}
              onChange={handleChange}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={requestClose}
            className="rounded-full bg-zinc-800 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            {mode === "create" ? "Add Event" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
