import { startTransition, useEffect } from "react";
import { Timeline } from "./components/Timeline";
import { applyThemeToDocument, resolveThemeMode } from "./constants/theme";
import { useTimelineStore } from "./stores";

export default function App() {
  const theme = useTimelineStore((state) => state.theme);
  const setTheme = useTimelineStore((state) => state.setTheme);
  const resolvedTheme = resolveThemeMode(theme);

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <div className="app-shell w-full h-screen">
      <Timeline
        theme={resolvedTheme}
        onToggleTheme={() => {
          startTransition(() => {
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          });
        }}
      />
    </div>
  );
}
