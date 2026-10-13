import { defineConfig } from "vitest/config";
import path from "node:path";

const pkg = (name: string) =>
  path.resolve(__dirname, "packages", name, "src", "index.ts");

/**
 * Root test runner for the NeuroCare OS spine packages.
 * Uses source aliases so tests run without a pnpm install step (the workspace
 * packages are dependency-free apart from each other).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@neurocare/permissions": pkg("permissions"),
      "@neurocare/journey": pkg("journey"),
      "@neurocare/feature-flags": pkg("feature-flags"),
      "@neurocare/audit": pkg("audit"),
      "@neurocare/notifications": pkg("notifications"),
      "@neurocare/timeline": pkg("timeline"),
      "@neurocare/workflow-engine": pkg("workflow-engine"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "artifacts/neuroassess-web/src/**/*.test.{ts,tsx}",
    ],
    globals: false,
  },
});
