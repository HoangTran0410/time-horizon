import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    root: "src",
    build: {
      outDir: "../",
      emptyOutDir: false,
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
  };
});
