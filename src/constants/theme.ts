export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "time-horizon:theme";

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "dark" || value === "light";

export const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
};

export const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(storedTheme) ? storedTheme : getSystemTheme();
};

export const applyThemeToDocument = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.body.dataset.theme = theme;
};
