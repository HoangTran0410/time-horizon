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
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules/react")) return "vendor-react";
            if (id.includes("node_modules/zustand")) return "vendor-zustand";
            if (id.includes("node_modules/motion")) return "vendor-motion";
            if (id.includes("node_modules/lucide-react")) return "vendor-icons";
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
