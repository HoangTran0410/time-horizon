import { startTransition, useEffect, useState } from "react";
import { Timeline } from "./components/Timeline";
import {
  applyThemeToDocument,
  getInitialTheme,
  THEME_STORAGE_KEY,
} from "./theme";

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="app-shell w-full h-screen">
      <Timeline
        theme={theme}
        onToggleTheme={() => {
          startTransition(() => {
            setTheme((currentTheme) =>
              currentTheme === "dark" ? "light" : "dark",
            );
          });
        }}
      />
    </div>
  );
}
