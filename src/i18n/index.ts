import { useMemo } from "react";
import type { SupportedLanguage } from "../constants/types";
import { DEFAULT_LANGUAGE } from "../helpers/localization";
import { useStore } from "../stores";

import viMessages from "./vi.json";
import enMessages from "./en.json";

export type MessageParams = Record<string, string | number>;

/**
 * Replace placeholders with actual values.
 * Handles ICU plural syntax: {key, plural, one {X} other {Y}}
 */
const interpolate = (template: string, params?: MessageParams): string => {
  // 1. Handle ICU plural blocks first
  let result = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g,
    (_, key, singular, plural) => {
      const n = Number(params?.[key]) ?? 0;
      const selected = n === 1 ? singular : plural;
      // Replace # with the actual count value (ICU # shorthand)
      return selected.replace(/#/g, String(n));
    },
  );

  // 2. Replace remaining {key} placeholders
  result = result.replace(/\{(\w+)\}/g, (_, key) =>
    params?.[key] != null ? String(params[key]) : `{${key}}`,
  );

  return result;
};

type Messages = Record<string, string>;

const messages: Record<SupportedLanguage, Messages> = {
  vi: viMessages as Messages,
  en: enMessages as Messages,
};

export const useI18n = () => {
  const language = useStore((state) => state.currentLanguage);

  return useMemo(() => {
    const activeLanguage: SupportedLanguage =
      typeof language === "string" && language in messages
        ? (language as SupportedLanguage)
        : DEFAULT_LANGUAGE;

    return {
      language: activeLanguage,
      t: (key: string, params?: MessageParams): string => {
        const template =
          messages[activeLanguage]?.[key] ??
          messages[DEFAULT_LANGUAGE]?.[key] ??
          key;
        return interpolate(template, params);
      },
    };
  }, [language]);
};
