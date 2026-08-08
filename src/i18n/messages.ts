import type { SupportedLanguage } from "../constants/types";
import viMessages from "./vi.json";

export type Messages = Record<string, string>;

/**
 * The language that ships inside the entry chunk.
 *
 * Must stay `DEFAULT_LANGUAGE`: it is both what a first-time visitor sees and
 * the map `t()` reads from for any key the active language has not delivered
 * yet — including the whole of it, for the moment before a fetched language
 * lands.
 */
const EAGER_LANGUAGE = "vi";

/**
 * Every other language, fetched on first use.
 *
 * Bundling all of them cost ~48kB of the landing page's critical path to ship
 * two copies of every string when a visitor only ever reads one. The `Exclude`
 * makes the map exhaustive, so adding a language to `SUPPORTED_LANGUAGES`
 * fails the build until it is registered here.
 */
const loaders: Record<
  Exclude<SupportedLanguage, typeof EAGER_LANGUAGE>,
  () => Promise<{ default: Messages }>
> = {
  en: () => import("./en.json"),
};

const loaded: Partial<Record<SupportedLanguage, Messages>> = {
  [EAGER_LANGUAGE]: viMessages as Messages,
};

const inFlight = new Map<SupportedLanguage, Promise<void>>();
const listeners = new Set<() => void>();

/**
 * Bumped whenever a language arrives. Components read it through
 * `useSyncExternalStore`, so a fetched map re-renders the tree that is already
 * showing the fallback.
 */
let version = 0;

export const getMessages = (language: SupportedLanguage): Messages | undefined =>
  loaded[language];

export const getFallbackMessages = (): Messages =>
  loaded[EAGER_LANGUAGE] as Messages;

export const getMessagesVersion = (): number => version;

export const subscribeToMessages = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Fetch a language's strings if they are not already here. Safe to call on
 * every render or effect — a language is only ever requested once.
 */
export const ensureMessagesLoaded = (language: SupportedLanguage): void => {
  if (loaded[language] || inFlight.has(language)) return;

  const load = loaders[language as Exclude<SupportedLanguage, typeof EAGER_LANGUAGE>];
  if (!load) return;

  const request = load()
    .then((module) => {
      loaded[language] = module.default;
      version += 1;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Nothing to do but keep showing the fallback language. Drop the record
      // so a later language switch can retry.
    })
    .finally(() => {
      inFlight.delete(language);
    });

  inFlight.set(language, request);
};
