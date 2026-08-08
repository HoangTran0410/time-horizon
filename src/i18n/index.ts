import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SUPPORTED_LANGUAGES } from "../constants/types";
import type { SupportedLanguage } from "../constants/types";
import { DEFAULT_LANGUAGE } from "../helpers/localization";
import { useStore } from "../stores";
import {
  ensureMessagesLoaded,
  getFallbackMessages,
  getMessages,
  getMessagesVersion,
  subscribeToMessages,
} from "./messages";

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

const resolveLanguage = (value: unknown): SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
    ? (value as SupportedLanguage)
    : DEFAULT_LANGUAGE;

// The persisted language is already known here — localStorage rehydration is
// synchronous — so start fetching it now rather than waiting for React's first
// effect. Nothing renders any sooner for it, but the fallback is on screen for
// fewer frames.
ensureMessagesLoaded(resolveLanguage(useStore.getState().currentLanguage));

export const useI18n = () => {
  const language = useStore((state) => state.currentLanguage);
  const activeLanguage = resolveLanguage(language);

  // Only the default language is bundled; the rest arrive later and have to
  // re-render whatever is already on screen showing the fallback.
  const messagesVersion = useSyncExternalStore(
    subscribeToMessages,
    getMessagesVersion,
    getMessagesVersion,
  );

  useEffect(() => {
    ensureMessagesLoaded(activeLanguage);
  }, [activeLanguage]);

  return useMemo(() => {
    const active = getMessages(activeLanguage);
    const fallback = getFallbackMessages();

    return {
      language: activeLanguage,
      t: (key: string, params?: MessageParams): string => {
        const template = active?.[key] ?? fallback[key] ?? key;
        return interpolate(template, params);
      },
    };
    // messagesVersion is the whole point: a language landing has to produce a
    // new `t`, or memoised consumers keep rendering the fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLanguage, messagesVersion]);
};
