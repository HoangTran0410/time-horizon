import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Event,
  EventCollectionMeta,
  LocalizedText,
  LocalizedTextRecord,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from "../constants/types";
import { ChevronDown, Clock, MoveHorizontal, Play, X } from "lucide-react";

// Lazy-load the heavy emoji picker — only loaded when user opens the picker UI
const EmojiPicker = lazy(() =>
  import("emoji-picker-react").then((m) => ({ default: m.default })),
);
type EmojiPickerTheme = import("emoji-picker-react").Theme;
import {
  formatYear,
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
  /** Editing will turn a tracked catalog collection into a local fork. */
  willForkCollection?: boolean;
  /** Create mode: lets the editor warn once a catalog target is picked. */
  isCatalogCollection?: (collectionId: string) => boolean;
  initialCollectionId?: string | null;
  onAddCollection?: () => void;
}

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * Proleptic Gregorian day count. The previous implementation went through
 * `Date.setUTCFullYear`, which returns NaN outside ±273,790 years — so every
 * deep-time event silently wrote NaN into the day slot.
 */
const getMaxDay = (year: number, month: number): number => {
  if (!Number.isFinite(year) || month < 1 || month > 12) return 31;
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_PER_MONTH[month - 1];
};

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

const NO_COLOR_SWATCH_BACKGROUND =
  "linear-gradient(135deg, #fff 45%, transparent 45%, transparent 55%, #fff 55%)";

const createEditableLocalizedTextDraft = (
  value: LocalizedText | null | undefined,
  preferredLanguage: SupportedLanguage,
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

const getInitialVisibleLanguages = (
  event: Event,
  preferredLanguage: SupportedLanguage,
): SupportedLanguage[] => {
  const titleDraft = createEditableLocalizedTextDraft(
    event.title,
    preferredLanguage,
  );
  const descriptionDraft = createEditableLocalizedTextDraft(
    event.description,
    preferredLanguage,
  );
  const languagesWithContent = SUPPORTED_LANGUAGES.filter(
    (supportedLanguage) =>
      titleDraft[supportedLanguage].trim() ||
      descriptionDraft[supportedLanguage].trim(),
  );

  if (languagesWithContent.length === 0) {
    return [preferredLanguage];
  }

  const orderedLanguages = [
    preferredLanguage,
    ...SUPPORTED_LANGUAGES.filter(
      (supportedLanguage) => supportedLanguage !== preferredLanguage,
    ),
  ];

  return orderedLanguages.filter((supportedLanguage) =>
    languagesWithContent.includes(supportedLanguage),
  );
};

const normalizeLocalizedDraftForSave = (
  value: LocalizedText | null | undefined,
  visibleLanguages: SupportedLanguage[],
  preferredLanguage: SupportedLanguage,
): LocalizedText | null => {
  const draft = createEditableLocalizedTextDraft(value, preferredLanguage);
  if (visibleLanguages.length <= 1) {
    const [visibleLanguage = preferredLanguage] = visibleLanguages;
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
  preferredLanguage: SupportedLanguage,
): Event => ({
  ...event,
  title:
    normalizeLocalizedDraftForSave(
      event.title,
      visibleLanguages,
      preferredLanguage,
    ) ?? "",
  description:
    normalizeLocalizedDraftForSave(
      event.description,
      visibleLanguages,
      preferredLanguage,
    ) ?? "",
  image: normalizeImageUrl(event.image) ?? undefined,
  video: normalizeEmbedVideoUrl(event.video) ?? undefined,
  link: normalizeExternalLinkUrl(event.link) ?? undefined,
});

/** Which of the two dates on a span event a control is editing. */
type TimeTarget = "start" | "end";

/** Everything after the year: month, day, hour, minute, second. */
type EventTimeTail = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

const getEventTimeTail = (time: Event["time"] | null | undefined): EventTimeTail => [
  time?.[1] ?? null,
  time?.[2] ?? null,
  time?.[3] ?? null,
  time?.[4] ?? null,
  time?.[5] ?? null,
];

/** Shared shape for the compact month/day/hour number boxes. */
const TIME_INPUT_CLASS =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white transition-colors focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const TIME_SUBLABEL_CLASS =
  "mb-1 block text-[0.68rem] font-medium tracking-wide text-zinc-500";

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  mode,
  onSave,
  onClose,
  availableCollections = [],
  willForkCollection = false,
  isCatalogCollection,
  initialCollectionId = null,
  onAddCollection,
}) => {
  const { language, t } = useI18n();
  const closeTimeoutRef = useRef<number | null>(null);
  const shouldCloseOnPointerUpRef = useRef(false);
  const [editedEvent, setEditedEvent] = useState<Event>({
    ...event,
    title: createEditableLocalizedTextDraft(event.title, language),
    description: createEditableLocalizedTextDraft(event.description, language),
    time: [...event.time] as Event["time"],
  });
  const [visibleLanguages, setVisibleLanguages] = useState<SupportedLanguage[]>(
    () => getInitialVisibleLanguages(event, language),
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    initialCollectionId ?? availableCollections[0]?.id ?? "",
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [pendingLanguageRemoval, setPendingLanguageRemoval] =
    useState<SupportedLanguage | null>(null);
  /**
   * The year field is held as raw text so it can legitimately be empty or a
   * lone "-" mid-typing. Coercing with Number() turned "" into 0, which the
   * timeline renders as "1 BC" — a silent wrong date rather than a validation
   * error.
   */
  const [yearInput, setYearInput] = useState<string>(() =>
    event.time[0] === undefined || event.time[0] === null
      ? ""
      : String(event.time[0]),
  );
  const [endYearInput, setEndYearInput] = useState<string>(() =>
    event.endTime?.[0] === undefined || event.endTime?.[0] === null
      ? ""
      : String(event.endTime[0]),
  );
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  /** Optional fields start collapsed; auto-opened below when already in use. */
  const [showAdvancedFields, setShowAdvancedFields] = useState(
    () => Boolean(event.image || event.video || event.link),
  );
  /** Hour/minute/second are rare — kept out of the way unless already used. */
  const [showTimeOfDay, setShowTimeOfDay] = useState(
    () => event.time[3] != null || event.endTime?.[3] != null,
  );
  const [showSpan, setShowSpan] = useState(() => event.endTime?.[0] != null);
  /**
   * Month/day/time of the end date live here as well as on the event, because
   * an empty end year has to null out `endTime` entirely — without this,
   * backspacing over the year to retype it would silently drop the rest.
   */
  const endTimeTailRef = useRef<EventTimeTail>(getEventTimeTail(event.endTime));
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    setEditedEvent({
      ...event,
      title: createEditableLocalizedTextDraft(event.title, language),
      description: createEditableLocalizedTextDraft(event.description, language),
      time: [...event.time] as Event["time"],
    });
    setVisibleLanguages(getInitialVisibleLanguages(event, language));
    endTimeTailRef.current = getEventTimeTail(event.endTime);
  }, [event.id]);

  useEffect(() => {
    if (mode !== "create") return;
    const fallbackCollectionId = availableCollections[0]?.id ?? "";
    const nextCollectionId = initialCollectionId ?? fallbackCollectionId;
    setSelectedCollectionId((prev) =>
      prev === nextCollectionId ? prev : nextCollectionId,
    );
  }, [availableCollections, initialCollectionId, mode]);

  const [year, month, day] = editedEvent.time;
  const imagePreviewUrl = normalizeImageUrl(editedEvent.image) ?? null;
  const videoPreviewUrl = normalizeEmbedVideoUrl(editedEvent.video) ?? null;
  const previewTitle =
    getLocalizedText(editedEvent.title, language, {
      emptyFallback: t("newEvent"),
    }) || t("newEvent");
  const hasDay = day != null;
  const hasValidYear =
    yearInput.trim() !== "" && Number.isInteger(Number(yearInput));
  const hasValidEndYear =
    endYearInput.trim() !== "" && Number.isInteger(Number(endYearInput));
  const missingLanguages = LANGUAGE_OPTIONS.filter(
    (option) => !visibleLanguages.includes(option.value),
  );

  const getTargetTime = (target: TimeTarget) =>
    target === "start" ? editedEvent.time : editedEvent.endTime ?? null;

  /**
   * Echoes back how the entered numbers will actually be read — the bare boxes
   * never communicated that a negative year means BCE, nor which box was which.
   */
  const buildDateReadout = (target: TimeTarget): string => {
    const rawYear = target === "start" ? yearInput : endYearInput;
    const isValid = target === "start" ? hasValidYear : hasValidEndYear;
    if (!isValid) return t("yearBceHint");

    const readableYear = formatYear(Number(rawYear));
    const time = getTargetTime(target);
    const targetMonth = time?.[1] ?? null;
    const targetDay = time?.[2] ?? null;
    if (targetMonth == null) return readableYear;
    if (targetDay == null)
      return t("dateReadoutMonth", { month: targetMonth, year: readableYear });
    return t("dateReadoutFull", {
      day: targetDay,
      month: targetMonth,
      year: readableYear,
    });
  };

  const validateDate = (): boolean => {
    setDateError(null);

    const trimmedYear = yearInput.trim();
    if (!trimmedYear || !Number.isInteger(Number(trimmedYear))) {
      setDateError(t("yearRequired"));
      return false;
    }

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
          ...createEditableLocalizedTextDraft(prev[field], language),
          [localizedLanguage]: value,
        },
      }));
    };

  const titleDraft = createEditableLocalizedTextDraft(editedEvent.title, language);
  const descriptionDraft = createEditableLocalizedTextDraft(
    editedEvent.description,
    language,
  );

  const handleAddLanguageVariant = (nextLanguage: SupportedLanguage) => {
    if (visibleLanguages.includes(nextLanguage)) return;
    setVisibleLanguages((prev) => [...prev, nextLanguage]);
  };

  /**
   * Removing a variant drops that language from the saved payload, so it is a
   * destructive edit. When the language actually has content the button asks
   * for a second click first — previously the text was gone with no warning
   * and no undo.
   */
  const handleRemoveLanguageVariant = (localizedLanguage: SupportedLanguage) => {
    const hasContent = Boolean(
      normalizeLocalizedText(titleDraft[localizedLanguage]) ||
        normalizeLocalizedText(descriptionDraft[localizedLanguage]),
    );

    if (hasContent && pendingLanguageRemoval !== localizedLanguage) {
      setPendingLanguageRemoval(localizedLanguage);
      return;
    }

    setPendingLanguageRemoval(null);
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

  const TIME_PART_RANGES: Record<1 | 2 | 3 | 4 | 5, [number, number]> = {
    1: [1, 12],
    2: [1, 31],
    3: [0, 23],
    4: [0, 59],
    5: [0, 59],
  };

  const handleTimePartChange = (
    target: TimeTarget,
    index: 1 | 2 | 3 | 4 | 5,
    raw: string,
  ) => {
    if (raw !== "" && isNaN(Number(raw))) return;
    const value = raw === "" ? null : Number(raw);

    if (value !== null) {
      const [min, max] = TIME_PART_RANGES[index];
      if (value < min || value > max) return;
    }

    setEditedEvent((prev) => {
      const current = target === "start" ? prev.time : prev.endTime;
      // No end year yet means there is no tuple to write into.
      if (!current) return prev;

      const nextTime = [...current] as Event["time"];
      if (value === null) {
        for (let i = index; i <= 5; i += 1) nextTime[i] = null;
      } else {
        nextTime[index] = value;
      }

      const normalized = normalizeEventTime(nextTime);
      if (target === "start") return { ...prev, time: normalized };

      endTimeTailRef.current = getEventTimeTail(normalized);
      return { ...prev, endTime: normalized };
    });
    setDateError(null);
  };

  const handleYearChange = (target: TimeTarget, raw: string) => {
    if (target === "start") setYearInput(raw);
    else setEndYearInput(raw);
    setDateError(null);

    // "" and "-" are valid intermediate text but not valid years, so they must
    // never reach the event tuple.
    const parsed = Number(raw);
    const isValidYear = raw.trim() !== "" && Number.isInteger(parsed);

    setEditedEvent((prev) => {
      if (target === "start") {
        if (!isValidYear) return prev;
        return {
          ...prev,
          time: normalizeEventTime([parsed, ...getEventTimeTail(prev.time)]),
        };
      }

      if (!isValidYear) return { ...prev, endTime: null };
      return {
        ...prev,
        endTime: normalizeEventTime([parsed, ...endTimeTailRef.current]),
      };
    });
  };

  const handleToggleTimeOfDay = () => {
    // Collapsing discards hour/minute/second, matching what the user sees.
    if (showTimeOfDay) {
      handleTimePartChange("start", 3, "");
      handleTimePartChange("end", 3, "");
    }
    setShowTimeOfDay((prev) => !prev);
  };

  const handleToggleSpan = () => {
    if (showSpan) handleYearChange("end", "");
    setShowSpan((prev) => !prev);
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

    const normalizedEvent = normalizeEventForSave(
      editedEvent,
      visibleLanguages,
      language,
    );
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

  /**
   * Capture phase, because the text inputs stop propagation on keydown to keep
   * the timeline's single-letter shortcuts from firing while typing — a bubble
   * listener here would never see Escape from inside a field.
   */
  const handleEditorKeyDownCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (showEmojiPicker || showColorPicker) {
        setShowEmojiPicker(false);
        setShowColorPicker(false);
        return;
      }
      requestClose();
      return;
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    }
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

  /**
   * Year / month / day for one end of the event. Number boxes rather than
   * dropdowns: on a keyboard, typing "3" then tabbing beats opening a select,
   * and a span needs two of these rows.
   */
  const renderDateRow = (target: TimeTarget) => {
    const isStart = target === "start";
    const time = getTargetTime(target);
    const rawYear = isStart ? yearInput : endYearInput;
    const isYearValid = isStart ? hasValidYear : hasValidEndYear;
    const rowMonth = time?.[1] ?? null;
    const rowDay = time?.[2] ?? null;
    const maxDay =
      isYearValid && rowMonth != null
        ? getMaxDay(Number(rawYear), rowMonth)
        : 31;

    return (
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <div>
          <span className={TIME_SUBLABEL_CLASS}>
            {t("year")}
            {isStart ? " *" : ""}
          </span>
          <input
            type="number"
            value={rawYear}
            onChange={(e) => handleYearChange(target, e.target.value)}
            onKeyDown={stopEditorShortcutPropagation}
            className={TIME_INPUT_CLASS}
            placeholder={isStart ? "2026" : yearInput || "2026"}
          />
        </div>
        <div>
          <span className={TIME_SUBLABEL_CLASS}>{t("month")}</span>
          <input
            type="number"
            min={1}
            max={12}
            value={rowMonth ?? ""}
            disabled={!isYearValid}
            onChange={(e) => handleTimePartChange(target, 1, e.target.value)}
            onKeyDown={stopEditorShortcutPropagation}
            className={TIME_INPUT_CLASS}
            placeholder="—"
          />
        </div>
        <div>
          <span className={TIME_SUBLABEL_CLASS}>{t("day")}</span>
          <input
            type="number"
            min={1}
            max={maxDay}
            value={rowDay ?? ""}
            disabled={rowMonth == null}
            onChange={(e) => handleTimePartChange(target, 2, e.target.value)}
            onKeyDown={stopEditorShortcutPropagation}
            className={TIME_INPUT_CLASS}
            placeholder="—"
            title={rowMonth == null ? t("dayNeedsMonth") : undefined}
          />
        </div>
      </div>
    );
  };

  const renderTimeOfDayRow = (target: TimeTarget) => {
    const time = getTargetTime(target);
    const rowDay = time?.[2] ?? null;
    const rowHour = time?.[3] ?? null;
    const rowMinute = time?.[4] ?? null;

    const fields: Array<{
      index: 3 | 4 | 5;
      label: string;
      max: number;
      value: number | null;
      disabled: boolean;
    }> = [
      { index: 3, label: t("hour"), max: 23, value: rowHour, disabled: rowDay == null },
      { index: 4, label: t("minute"), max: 59, value: rowMinute, disabled: rowHour == null },
      {
        index: 5,
        label: t("seconds"),
        max: 59,
        value: time?.[5] ?? null,
        disabled: rowMinute == null,
      },
    ];

    return (
      <div className="grid grid-cols-3 gap-2">
        {fields.map((field) => (
          <div key={field.index}>
            <span className={TIME_SUBLABEL_CLASS}>{field.label}</span>
            <input
              type="number"
              min={0}
              max={field.max}
              value={field.value ?? ""}
              disabled={field.disabled}
              onChange={(e) =>
                handleTimePartChange(target, field.index, e.target.value)
              }
              onKeyDown={stopEditorShortcutPropagation}
              className={TIME_INPUT_CLASS}
              placeholder="—"
            />
          </div>
        ))}
      </div>
    );
  };

  const renderLanguageBadge = (option: (typeof LANGUAGE_OPTIONS)[number]) => (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[0.66rem] font-semibold tracking-[0.12em] text-zinc-400">
        <span aria-hidden="true">{option.flag}</span>
        {option.shortLabel}
      </span>
      {visibleLanguages.length > 1 &&
        (pendingLanguageRemoval === option.value ? (
          <button
            type="button"
            onClick={() => handleRemoveLanguageVariant(option.value)}
            onBlur={() => setPendingLanguageRemoval(null)}
            className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[0.62rem] font-semibold text-red-200 transition hover:bg-red-500/25"
          >
            <X width={10} height={10} />
            {t("confirmDeleteTranslation")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleRemoveLanguageVariant(option.value)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-800 hover:text-white"
            aria-label={t("removeLanguageVariant", { language: option.label })}
          >
            <X width={12} height={12} />
          </button>
        ))}
    </div>
  );

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
        className="ui-modal-surface ui-panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.9rem]"
        data-ui-state={isClosing ? "closing" : "open"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onKeyDownCapture={handleEditorKeyDownCapture}
      >
        {/* Header stays put so the title/close never scroll away. */}
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-5 md:px-8 md:pt-6">
          <h2 className="ui-display-title text-[1.5rem] leading-none text-white md:text-[1.75rem]">
            {mode === "create" ? t("newEvent") : t("editEvent")}
          </h2>
          <button
            onClick={requestClose}
            className="ui-icon-button h-9 w-9 shrink-0"
            aria-label={t("close")}
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 md:px-8">
          {/* The store promotes a catalog collection to a local fork on the first
              edit. That used to happen with no indication at all — the only clue
              was a "LOCAL" badge appearing afterwards. */}
          {(mode === "create"
            ? Boolean(
                selectedCollectionId && isCatalogCollection?.(selectedCollectionId),
              )
            : willForkCollection) && (
            <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <p className="text-xs leading-5 text-amber-200">
                {t("catalogForkNotice")}
              </p>
            </div>
          )}

          {mode === "create" && (
            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="ui-label mb-0">{t("saveToCollection")}</label>
                {onAddCollection && (
                  <button
                    type="button"
                    onClick={onAddCollection}
                    className="ui-button ui-button-secondary ui-button-compact"
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

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
            <div className="space-y-4">
              {/* Emoji and colour sit on the title row rather than owning a
                  labelled row each — they are one-tap choices, not fields. */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      className="emoji-trigger flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 text-xl transition-colors hover:border-zinc-500"
                      onClick={() => setShowEmojiPicker((value) => !value)}
                      aria-label={t("icon")}
                      title={t("icon")}
                    >
                      {editedEvent.emoji}
                    </button>
                    {showEmojiPicker && (
                      <div className="emoji-trigger absolute left-0 top-full z-20 mt-2 w-max">
                        <Suspense
                          fallback={
                            <div className="flex h-[400px] w-[320px] items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900">
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

                  <div className="relative shrink-0">
                    <button
                      type="button"
                      className="color-trigger flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 transition-colors hover:border-zinc-500"
                      onClick={() => setShowColorPicker((value) => !value)}
                      aria-label={t("color")}
                      title={`${t("color")}: ${
                        COLOR_SWATCHES.find(
                          (swatch) => swatch.value === (editedEvent.color ?? null),
                        )?.label ?? t("none")
                      }`}
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-zinc-600"
                        style={{
                          backgroundColor: editedEvent.color ?? "transparent",
                          backgroundImage: editedEvent.color
                            ? undefined
                            : NO_COLOR_SWATCH_BACKGROUND,
                        }}
                      />
                    </button>

                    {/* w-max on the popover: its containing block is the 44px
                        trigger, so without it the swatch grid sizes its columns
                        against 44px and the colours stack on top of each other. */}
                    {showColorPicker && (
                      <div className="color-trigger absolute left-0 top-full z-20 mt-2 w-max rounded-xl border border-zinc-700 bg-zinc-800 p-3">
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
                                    ? NO_COLOR_SWATCH_BACKGROUND
                                    : undefined,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="ui-label mb-0 min-w-0 flex-1 truncate">
                    {t("title")}
                  </label>

                  {missingLanguages.map((option) => (
                    <button
                      key={`add-language-${option.value}`}
                      type="button"
                      onClick={() => handleAddLanguageVariant(option.value)}
                      className="ui-chip shrink-0 px-2.5 py-1"
                      title={t("addLanguageVariant")}
                    >
                      <span aria-hidden="true">{option.flag}</span>
                      <span>+ {option.shortLabel}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {visibleLanguages.map((visibleLanguage) => {
                    const option = LANGUAGE_OPTIONS.find(
                      (languageOption) =>
                        languageOption.value === visibleLanguage,
                    );
                    if (!option) return null;

                    return (
                      <div key={`title-${option.value}`} className="space-y-1">
                        {/* A single-language event needs no label at all — the
                            badge row only earns its space once there are two. */}
                        {visibleLanguages.length > 1 &&
                          renderLanguageBadge(option)}
                        <input
                          type="text"
                          value={titleDraft[option.value]}
                          onChange={handleLocalizedFieldChange(
                            "title",
                            option.value,
                          )}
                          onKeyDown={stopEditorShortcutPropagation}
                          autoFocus={
                            mode === "create" &&
                            visibleLanguage === visibleLanguages[0]
                          }
                          placeholder={
                            visibleLanguages.length > 1
                              ? `${t("title")} • ${option.label}`
                              : t("title")
                          }
                          className="ui-field"
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <label className="ui-label mb-0">{t("description")}</label>
                <div className="space-y-2">
                  {visibleLanguages.map((visibleLanguage) => {
                    const option = LANGUAGE_OPTIONS.find(
                      (languageOption) =>
                        languageOption.value === visibleLanguage,
                    );
                    if (!option) return null;

                    return (
                      <div
                        key={`description-${option.value}`}
                        className="space-y-1"
                      >
                        {visibleLanguages.length > 1 && (
                          <span className="inline-flex items-center gap-1.5 text-[0.66rem] font-semibold tracking-[0.12em] text-zinc-400">
                            <span aria-hidden="true">{option.flag}</span>
                            {option.shortLabel}
                          </span>
                        )}
                        <textarea
                          value={descriptionDraft[option.value]}
                          onChange={handleLocalizedFieldChange(
                            "description",
                            option.value,
                          )}
                          onKeyDown={stopEditorShortcutPropagation}
                          rows={visibleLanguages.length > 1 ? 3 : 4}
                          placeholder={
                            visibleLanguages.length > 1
                              ? `${t("description")} • ${option.label}`
                              : t("description")
                          }
                          className="ui-field resize-y"
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              {/* Year / month / day on one row, all three always present, all
                  typed rather than picked — they used to be a chained cascade
                  where the day box did not exist until a month was entered, so
                  most users only ever saw a year. */}
              <div className="space-y-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/50 p-4">
                <label className="ui-label mb-0">{t("time")}</label>

                {renderDateRow("start")}
                {showTimeOfDay && renderTimeOfDayRow("start")}
                <p className="text-[0.72rem] text-zinc-500">
                  {buildDateReadout("start")}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleToggleTimeOfDay}
                    data-active={showTimeOfDay}
                    disabled={!hasDay}
                    className="ui-chip px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                    title={hasDay ? undefined : t("timeOfDayNeedsDay")}
                  >
                    <Clock width={12} height={12} />
                    {t("timeOfDay")}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleSpan}
                    data-active={showSpan}
                    className="ui-chip px-2.5 py-1"
                  >
                    <MoveHorizontal width={12} height={12} />
                    {t("timeSpan")}
                  </button>
                </div>

                {/* An end date turns the event into a span, drawn as a bar
                    covering the range instead of a single marker. It takes the
                    same precision as the start — year through seconds. */}
                {showSpan && (
                  <div className="space-y-3 border-t border-zinc-800/70 pt-3">
                    <span className="ui-label mb-0 block">{t("endDate")}</span>
                    {renderDateRow("end")}
                    {showTimeOfDay && renderTimeOfDayRow("end")}
                    <p className="text-[0.72rem] text-zinc-500">
                      {hasValidYear && hasValidEndYear
                        ? `${buildDateReadout("start")} → ${buildDateReadout("end")}`
                        : t("endYearSpanHint")}
                    </p>
                  </div>
                )}

                {dateError && (
                  <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-400">
                    {dateError}
                  </p>
                )}
              </div>

              {/* Everything below is optional. Collapsed by default so a first
                  event is emoji + title + year rather than a wall of inputs. */}
              <button
                type="button"
                onClick={() => setShowAdvancedFields((value) => !value)}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                aria-expanded={showAdvancedFields}
              >
                <span>{t("advancedFields")}</span>
                <ChevronDown
                  width={14}
                  height={14}
                  className={`transition-transform ${
                    showAdvancedFields ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showAdvancedFields && (
                <div className="space-y-3 rounded-2xl border border-zinc-800/60 bg-zinc-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-400">
                      {t("mediaLinks")}
                    </label>
                    <span className="text-xs text-zinc-500">{t("optional")}</span>
                  </div>

                  <div>
                    <span className={TIME_SUBLABEL_CLASS}>{t("imageUrl")}</span>
                    <input
                      type="text"
                      value={editedEvent.image ?? ""}
                      onChange={handleOptionalFieldChange("image")}
                      onKeyDown={stopEditorShortcutPropagation}
                      className={TIME_INPUT_CLASS}
                      placeholder="https://upload.wikimedia.org/..."
                    />
                    {imagePreviewUrl && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">
                        <img
                          src={imagePreviewUrl}
                          alt={previewTitle}
                          className="max-h-48 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={TIME_SUBLABEL_CLASS}>{t("video")}</span>
                      <button
                        type="button"
                        onClick={() => setIsVideoPreviewOpen(true)}
                        disabled={!videoPreviewUrl}
                        className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={t("previewVideo")}
                        title={t("previewVideo")}
                      >
                        <Play width={11} height={11} className="translate-x-[1px]" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editedEvent.video ?? ""}
                      onChange={handleOptionalFieldChange("video")}
                      onKeyDown={stopEditorShortcutPropagation}
                      className={TIME_INPUT_CLASS}
                      placeholder="id or https://youtu.be/<id>"
                    />
                  </div>

                  <div>
                    <span className={TIME_SUBLABEL_CLASS}>
                      {t("externalLink")}
                    </span>
                    <input
                      type="text"
                      value={editedEvent.link ?? ""}
                      onChange={handleOptionalFieldChange("link")}
                      onKeyDown={stopEditorShortcutPropagation}
                      className={TIME_INPUT_CLASS}
                      placeholder="Apollo_11 or https://en.wikipedia.org/wiki/Apollo_11"
                    />
                  </div>

                  <div>
                    <span className={TIME_SUBLABEL_CLASS}>{t("priority")}</span>
                    <input
                      type="number"
                      name="priority"
                      value={editedEvent.priority}
                      onChange={handleChange}
                      onKeyDown={stopEditorShortcutPropagation}
                      className={TIME_INPUT_CLASS}
                    />
                    <p className="mt-1 text-[0.7rem] text-zinc-500">
                      {t("priorityHelp")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pinned so Save is one click away no matter how far the body scrolls. */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-800/70 px-5 py-4 md:px-8">
          <button
            onClick={requestClose}
            className="ui-button ui-button-secondary px-5 py-2.5"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={mode === "create" && availableCollections.length === 0}
            className="ui-button ui-button-primary px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
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
