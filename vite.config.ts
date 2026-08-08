import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    root: "src",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Deliberately no rule for lucide-react: forcing the icons into one
          // shared chunk put every icon the timeline uses on the landing page's
          // critical path. Left alone, Rollup files each icon into the chunk
          // that imports it.
          manualChunks: (id) => {
            if (id.includes("node_modules/react")) return "vendor-react";
            if (id.includes("node_modules/zustand")) return "vendor-zustand";
            if (id.includes("node_modules/motion")) return "vendor-motion";
          },
        },
      },
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
  };
});
