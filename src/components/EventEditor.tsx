import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Event,
  EventCollectionMeta,
  LocalizedText,
  LocalizedTextRecord,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "../constants/types";
import { ChevronDown, Play, X } from "lucide-react";

// Lazy-load the heavy emoji picker — only loaded when user opens the picker UI
const EmojiPicker = lazy(() =>
  import("emoji-picker-react").then((m) => ({ default: m.default })),
);
type EmojiPickerTheme = import("emoji-picker-react").Theme;
import {
  normalizeEmbedVideoUrl,
  normalizeEventTimeParts,
  normalizeExternalLinkUrl,
  normalizeImageUrl,
} from "../helpers";
import {
  getLocalizedText,
  LANGUAGE_OPTIONS,
  normalizeLocalizedText,
} from "../helpers/localization";
import { useI18n } from "../i18n";
import { EventVideoModal } from "./EventVideoModal";

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

const DEFAULT_EDITOR_LANGUAGE: SupportedLanguage = "en";

const createEditableLocalizedTextDraft = (
  value: LocalizedText | null | undefined,
  preferredLanguage: SupportedLanguage = DEFAULT_EDITOR_LANGUAGE,
): LocalizedTextRecord => {
  const emptyDraft = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, ""]),
  ) as LocalizedTextRecord;

  if (typeof value === "string") {
    emptyDraft[preferredLanguage] = value;
    return emptyDraft;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyDraft;
  }

  for (const language of SUPPORTED_LANGUAGES) {
    emptyDraft[language] =
      typeof value[language] === "string" ? value[language] : "";
  }

  return emptyDraft;
};

const getInitialVisibleLanguages = (event: Event): SupportedLanguage[] => {
  const titleDraft = createEditableLocalizedTextDraft(event.title);
  const descriptionDraft = createEditableLocalizedTextDraft(event.description);
  const languagesWithContent = SUPPORTED_LANGUAGES.filter(
    (supportedLanguage) =>
      titleDraft[supportedLanguage].trim() ||
      descriptionDraft[supportedLanguage].trim(),
  );

  if (languagesWithContent.length === 0) {
    return [DEFAULT_EDITOR_LANGUAGE];
  }

  const orderedLanguages = [
    DEFAULT_EDITOR_LANGUAGE,
    ...SUPPORTED_LANGUAGES.filter(
      (supportedLanguage) => supportedLanguage !== DEFAULT_EDITOR_LANGUAGE,
    ),
  ];

  return orderedLanguages.filter((supportedLanguage) =>
    languagesWithContent.includes(supportedLanguage),
  );
};

const normalizeLocalizedDraftForSave = (
  value: LocalizedText | null | undefined,
  visibleLanguages: SupportedLanguage[],
): LocalizedText | null => {
  const draft = createEditableLocalizedTextDraft(value);
  if (visibleLanguages.length <= 1) {
    const [visibleLanguage = DEFAULT_EDITOR_LANGUAGE] = visibleLanguages;
    return normalizeLocalizedText(draft[visibleLanguage]);
  }

  const localizedEntries = visibleLanguages.reduce<LocalizedTextRecord>(
    (acc, language) => {
      const normalizedValue = normalizeLocalizedText(draft[language]);
      if (typeof normalizedValue === "string") {
        acc[language] = normalizedValue;
      }
      return acc;
    },
    {},
  );

  return normalizeLocalizedText(localizedEntries);
};

const normalizeEventForSave = (
  event: Event,
  visibleLanguages: SupportedLanguage[],
): Event => ({
  ...event,
  title: normalizeLocalizedDraftForSave(event.title, visibleLanguages) ?? "",
  description:
    normalizeLocalizedDraftForSave(event.description, visibleLanguages) ?? "",
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
  const { language, t } = useI18n();
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [editedEvent, setEditedEvent] = useState<Event>({
    ...event,
    title: createEditableLocalizedTextDraft(event.title),
    description: createEditableLocalizedTextDraft(event.description),
    time: [...event.time] as Event["time"],
  });
  const [visibleLanguages, setVisibleLanguages] = useState<SupportedLanguage[]>(
    () => getInitialVisibleLanguages(event),
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    initialCollectionId ?? availableCollections[0]?.id ?? "",
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [languageToAdd, setLanguageToAdd] = useState<SupportedLanguage | "">("");

  useEffect(() => {
    setEditedEvent({
      ...event,
      title: createEditableLocalizedTextDraft(event.title),
      description: createEditableLocalizedTextDraft(event.description),
      time: [...event.time] as Event["time"],
    });
    setVisibleLanguages(getInitialVisibleLanguages(event));
  }, [event.id]);

  useEffect(() => {
    if (mode !== "create") return;
    const fallbackCollectionId = availableCollections[0]?.id ?? "";
    const nextCollectionId = initialCollectionId ?? fallbackCollectionId;
    setSelectedCollectionId((prev) =>
      prev === nextCollectionId ? prev : nextCollectionId,
    );
  }, [availableCollections, initialCollectionId, mode]);

  const [year, month, day, hour, minute, seconds] = editedEvent.time;
  const imagePreviewUrl = normalizeImageUrl(editedEvent.image) ?? null;
  const videoPreviewUrl = normalizeEmbedVideoUrl(editedEvent.video) ?? null;
  const previewTitle =
    getLocalizedText(editedEvent.title, language, {
      emptyFallback: t("newEvent"),
    }) || t("newEvent");
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
      setDateError(t("invalidDate", { month, day, maxDay, year }));
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

  const handleLocalizedFieldChange =
    (field: "title" | "description", localizedLanguage: SupportedLanguage) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = e.target;
      setEditedEvent((prev) => ({
        ...prev,
        [field]: {
          ...createEditableLocalizedTextDraft(prev[field]),
          [localizedLanguage]: value,
        },
      }));
    };

  const titleDraft = createEditableLocalizedTextDraft(editedEvent.title);
  const descriptionDraft = createEditableLocalizedTextDraft(
    editedEvent.description,
  );
  const handleAddLanguageVariant = (nextLanguage: SupportedLanguage | "") => {
    setLanguageToAdd(nextLanguage);
    if (!nextLanguage || visibleLanguages.includes(nextLanguage)) {
      return;
    }

    setVisibleLanguages((prev) => [...prev, nextLanguage]);
    setLanguageToAdd("");
  };

  const handleRemoveLanguageVariant = (localizedLanguage: SupportedLanguage) => {
    setVisibleLanguages((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((languageOption) => languageOption !== localizedLanguage);
    });
  };

  const stopEditorShortcutPropagation = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.stopPropagation();
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

  useEffect(() => {
    if (!videoPreviewUrl && isVideoPreviewOpen) {
      setIsVideoPreviewOpen(false);
    }
  }, [isVideoPreviewOpen, videoPreviewUrl]);

  const handleSave = () => {
    if (!validateDate()) return;

    const normalizedEvent = normalizeEventForSave(editedEvent, visibleLanguages);
    if (!normalizeLocalizedText(normalizedEvent.title)) {
      setCollectionError(t("titleRequiredAtLeastOneLanguage"));
      return;
    }

    if (mode === "create" && availableCollections.length > 0) {
      if (!selectedCollectionId) {
        setCollectionError(t("collectionRequired"));
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
        className="ui-modal-surface ui-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.9rem] p-4 md:p-8"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            {/* <div className="ui-kicker mb-2">
              {mode === "create" ? "Collection Entry" : "Event Details"}
            </div> */}
            <h2 className="ui-display-title text-[1.9rem] leading-none text-white">
              {mode === "create" ? t("newEvent") : t("editEvent")}
            </h2>
          </div>
          <button
            onClick={requestClose}
            className="ui-icon-button h-10 w-10"
            aria-label={t("close")}
          >
            <X width={20} height={20} />
          </button>
        </div>

        {mode === "create" && (
          <div className="mb-6">
            <div className="mb-1 flex items-center justify-between">
              <label className="ui-label mb-0">{t("saveToCollection")}</label>
              {onAddCollection && (
                <button
                  type="button"
                  onClick={onAddCollection}
                  className="ui-button ui-button-secondary px-3 py-2 text-[0.72rem]"
                >
                  {t("createNewCollection")}
                </button>
              )}
            </div>
            {availableCollections.length === 0 ? (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                <p className="text-xs text-rose-300">
                  {t("noCollectionsAvailable")}
                </p>
              </div>
            ) : (
              <>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => {
                    setSelectedCollectionId(e.target.value);
                    setCollectionError(null);
                  }}
                  className="ui-field"
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
              </>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            <section className="space-y-3 rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/45 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <label className="block text-sm font-medium text-zinc-300">
                    {t("title")}
                  </label>
                </div>
                <div className="md:flex md:justify-end">
                  <select
                    value={languageToAdd}
                    onChange={(e) =>
                      handleAddLanguageVariant(
                        e.target.value as SupportedLanguage | "",
                      )
                    }
                    className="h-9 w-auto min-w-[8.5rem] rounded-full border border-zinc-700 bg-zinc-950 px-3 text-xs font-medium text-zinc-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">{t("addLanguageVariant")}</option>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option
                        key={`add-language-${option.value}`}
                        value={option.value}
                        disabled={visibleLanguages.includes(option.value)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4">
                {visibleLanguages.map((visibleLanguage) => {
                  const option = LANGUAGE_OPTIONS.find(
                    (languageOption) => languageOption.value === visibleLanguage,
                  );
                  if (!option) return null;

                  return (
                    <div
                      key={`title-${option.value}`}
                      className="relative rounded-[1.1rem] border border-zinc-800 bg-zinc-950/70 px-3 pb-3 pt-5"
                    >
                      <div className="absolute left-3 right-3 top-0 flex -translate-y-1/2 items-center justify-between">
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[0.64rem] font-semibold tracking-[0.14em] text-zinc-300">
                          <span aria-hidden="true">{option.flag}</span>
                          <span>{option.label}</span>
                        </div>
                        {visibleLanguages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLanguageVariant(option.value)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                            aria-label={t("removeLanguageVariant", {
                              language: option.label,
                            })}
                          >
                            <X width={14} height={14} />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={titleDraft[option.value]}
                        onChange={handleLocalizedFieldChange("title", option.value)}
                        onKeyDown={stopEditorShortcutPropagation}
                        placeholder={`${t("title")} • ${option.label}`}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2 rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/35 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-300">
                  {t("description")}
                </label>
              </div>
              <div className="grid gap-3">
                {visibleLanguages.map((visibleLanguage) => {
                  const option = LANGUAGE_OPTIONS.find(
                    (languageOption) => languageOption.value === visibleLanguage,
                  );
                  if (!option) return null;

                  return (
                    <div
                      key={`description-${option.value}`}
                      className="relative rounded-[1.1rem] border border-zinc-800 bg-zinc-950/70 px-3 pb-3 pt-5"
                    >
                      <div className="absolute left-3 top-0 inline-flex -translate-y-1/2 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[0.64rem] font-semibold tracking-[0.14em] text-zinc-300">
                        <span aria-hidden="true">{option.flag}</span>
                        <span>{option.label}</span>
                      </div>
                      <textarea
                        value={descriptionDraft[option.value]}
                        onChange={handleLocalizedFieldChange(
                          "description",
                          option.value,
                        )}
                        onKeyDown={stopEditorShortcutPropagation}
                        rows={3}
                        placeholder={`${t("description")} • ${option.label}`}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-400">
                  {t("icon")}
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
                      <Suspense
                        fallback={
                          <div className="flex h-\[400px\] w-\[320px\] items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-rose-400" />
                          </div>
                        }
                      >
                        <EmojiPicker
                          theme={"dark" as EmojiPickerTheme}
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
                      </Suspense>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-zinc-400">
                  {t("color")}
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
                        (swatch) =>
                          swatch.value === (editedEvent.color ?? null),
                      )?.label ?? t("none")}
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

            <div className="space-y-3 rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-400">
                  {t("time")}
                </label>
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
                <label className="mb-1 block text-xs text-zinc-500">
                  {t("year")} *
                </label>
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
                      {t("month")}
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
                    title={t("clearMonthAndBelow")}
                    className="mt-5 text-ink-subtle transition-colors hover:text-zinc-300"
                  >
                    <X width={14} height={14} />
                  </button>
                </div>
              )}

              {hasMonth && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-zinc-500">
                      {t("day")}
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
                    title={t("clearDayAndBelow")}
                    className="mt-5 text-ink-subtle transition-colors hover:text-zinc-300"
                  >
                    <X width={14} height={14} />
                  </button>
                </div>
              )}

              {hasDay && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-zinc-500">
                      {t("hour")}
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
                    title={t("clearHourAndBelow")}
                    className="mt-5 text-ink-subtle transition-colors hover:text-zinc-300"
                  >
                    <X width={14} height={14} />
                  </button>
                </div>
              )}

              {hasHour && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-zinc-500">
                      {t("minute")}
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
                    title={t("clearMinuteAndBelow")}
                    className="mt-5 text-ink-subtle transition-colors hover:text-zinc-300"
                  >
                    <X width={14} height={14} />
                  </button>
                </div>
              )}

              {hasMinute && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-zinc-500">
                      {t("seconds")}
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
                    title={t("clearSeconds")}
                    className="mt-5 text-ink-subtle transition-colors hover:text-zinc-300"
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
                  {t("mediaLinks")}
                </label>
                <span className="text-xs text-zinc-500">{t("optional")}</span>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  {t("imageUrl")}
                </label>
                <input
                  type="text"
                  value={editedEvent.image ?? ""}
                  onChange={handleOptionalFieldChange("image")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="https://upload.wikimedia.org/..."
                />
                {imagePreviewUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">
                    <img
                      src={imagePreviewUrl}
                      alt={previewTitle}
                      className="max-h-64 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                {/* <p className="mt-1 text-xs text-zinc-500">
                Paste any direct image URL.
              </p> */}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-xs text-zinc-500">
                    {t("video")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsVideoPreviewOpen(true)}
                    disabled={!videoPreviewUrl}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={t("previewVideo")}
                    title={t("previewVideo")}
                  >
                    <Play width={12} height={12} className="translate-x-[1px]" />
                  </button>
                </div>
                <input
                  type="text"
                  value={editedEvent.video ?? ""}
                  onChange={handleOptionalFieldChange("video")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="id or https://youtu.be/<id>"
                />
                {/* <p className="mt-1 text-xs text-zinc-500">
                Supports YouTube IDs, `youtu.be`, and full YouTube links. Other
                video URLs still work as-is.
              </p> */}
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  {t("externalLink")}
                </label>
                <input
                  type="text"
                  value={editedEvent.link ?? ""}
                  onChange={handleOptionalFieldChange("link")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Apollo_11 or https://en.wikipedia.org/wiki/Apollo_11"
                />
                {/* <p className="mt-1 text-xs text-zinc-500">
                Paste any URL, or enter a Wikipedia article name and it will be
                expanded automatically when you save.
              </p> */}
              </div>
            </div>

            {/* <div>
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
          </div> */}

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                {t("priority")}
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
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={requestClose}
            className="ui-button ui-button-secondary px-6 py-3"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={mode === "create" && availableCollections.length === 0}
            className="ui-button ui-button-primary px-6 py-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mode === "create" ? t("addEvent") : t("save")}
          </button>
        </div>

        <EventVideoModal
          isOpen={isVideoPreviewOpen}
          videoUrl={videoPreviewUrl}
          title={previewTitle}
          onClose={() => setIsVideoPreviewOpen(false)}
        />
      </div>
    </div>
  );
};
