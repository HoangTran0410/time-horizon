import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import App from "./App.tsx";
import "./styles/index.css";
import { applyThemeToDocument } from "./constants/theme.ts";
import { useStore } from "./stores";

applyThemeToDocument(useStore.getState().theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
