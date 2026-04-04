import {
  SUPPORTED_LANGUAGES,
  type Event,
  type LocalizedText,
  type LocalizedTextRecord,
  type SupportedLanguage,
} from "../constants/types";

export const DEFAULT_LANGUAGE: SupportedLanguage = "vi";
export const LANGUAGE_OPTIONS: Array<{
  value: SupportedLanguage;
  label: string;
  shortLabel: string;
  flag: string;
}> = [
  { value: "vi", label: "Tiếng Việt", shortLabel: "VI", flag: "🇻🇳" },
  { value: "en", label: "English", shortLabel: "EN", flag: "🇺🇸" },
];

export const isLocalizedTextRecord = (
  value: unknown,
): value is LocalizedTextRecord =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value);

const trimOptionalString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getUniqueLanguages = (languages: string[]): string[] => [...new Set(languages)];

export const normalizeLocalizedText = (
  value: unknown,
): LocalizedText | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isLocalizedTextRecord(value)) {
    return null;
  }

  const normalizedEntries = Object.entries(value).reduce<LocalizedTextRecord>(
    (acc, [language, localizedValue]) => {
      const trimmedValue = trimOptionalString(localizedValue);
      if (trimmedValue) {
        acc[language] = trimmedValue;
      }
      return acc;
    },
    {},
  );

  if (Object.keys(normalizedEntries).length === 0) {
    return null;
  }

  return normalizedEntries;
};

export const createLocalizedTextDraft = (
  value: LocalizedText | null | undefined,
  preferredLanguage: SupportedLanguage = DEFAULT_LANGUAGE,
): LocalizedTextRecord => {
  const emptyDraft = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, ""]),
  ) as LocalizedTextRecord;

  const normalized = normalizeLocalizedText(value);
  if (!normalized) {
    return emptyDraft;
  }

  if (typeof normalized === "string") {
    emptyDraft[preferredLanguage] = normalized;
    return emptyDraft;
  }

  const draft = { ...normalized };
  for (const language of SUPPORTED_LANGUAGES) {
    draft[language] = trimOptionalString(normalized[language]);
  }

  return draft;
};

export const getLocalizedText = (
  value: LocalizedText | null | undefined,
  language: SupportedLanguage,
  options?: {
    fallbackLanguage?: SupportedLanguage;
    emptyFallback?: string;
  },
): string => {
  const emptyFallback = options?.emptyFallback ?? "";
  const fallbackLanguage = options?.fallbackLanguage ?? DEFAULT_LANGUAGE;

  if (typeof value === "string") {
    return value.trim() || emptyFallback;
  }

  if (!value) {
    return emptyFallback;
  }

  const localizedValue = getUniqueLanguages([
    language,
    fallbackLanguage,
    ...SUPPORTED_LANGUAGES,
    ...Object.keys(value),
  ]).find((candidateLanguage) =>
    trimOptionalString(value[candidateLanguage]),
  );

  return localizedValue
    ? trimOptionalString(value[localizedValue])
    : emptyFallback;
};

export const getSearchableLocalizedText = (
  value: LocalizedText | null | undefined,
): string => {
  if (typeof value === "string") {
    return value;
  }

  if (!value) {
    return "";
  }

  return Object.values(value)
    .filter((part): part is string => typeof part === "string")
    .join(" ");
};

export const getLocalizedEventTitle = (
  event: Event,
  language: SupportedLanguage,
  emptyFallback = "",
) => getLocalizedText(event.title, language, { emptyFallback });

export const getLocalizedEventDescription = (
  event: Event,
  language: SupportedLanguage,
  emptyFallback = "",
) => getLocalizedText(event.description, language, { emptyFallback });
