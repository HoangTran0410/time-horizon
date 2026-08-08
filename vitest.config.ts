import { defineConfig } from "vitest/config";

// Standalone on purpose: vite.config.ts sets root: "src" for the build, which
// would make every include pattern here resolve against src/ and drag the
// react/tailwind plugins into a plain unit-test run.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
  },
});
