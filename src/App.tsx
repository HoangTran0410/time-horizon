import { startTransition, useEffect } from "react";
import { Timeline } from "./components/Timeline";
import { applyThemeToDocument } from "./constants/theme";
import { useTimelineStore } from "./stores";

export default function App() {
  const theme = useTimelineStore((state) => state.theme);
  const setTheme = useTimelineStore((state) => state.setTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  return (
    <div className="app-shell w-full h-screen">
      <Timeline
        theme={theme}
        onToggleTheme={() => {
          startTransition(() => {
            setTheme(theme === "dark" ? "light" : "dark");
          });
        }}
      />
    </div>
  );
}
