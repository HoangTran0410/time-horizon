export type ThemeMode = "dark" | "light";

// Kept for one-time migration into the unified Zustand persist store.
export const THEME_STORAGE_KEY = "time-horizon:theme";

export const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
};

export const getInitialTheme = (): ThemeMode => {
  return getSystemTheme();
};

export const applyThemeToDocument = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.body.dataset.theme = theme;
};
