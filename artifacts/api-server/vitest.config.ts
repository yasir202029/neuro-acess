import { defineConfig } from "vitest/config";
import path from "node:path";

const artifactDir = path.dirname(__filename);
const pkg = (name: string) =>
  path.resolve(artifactDir, "..", "..", "packages", name, "src", "index.ts");

/**
 * Mirrors the esbuild alias map in build.mjs: the @neurocare/* spine ships as
 * TypeScript sources, so tests must resolve them from source too.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@neurocare/permissions": pkg("permissions"),
      "@neurocare/journey": pkg("journey"),
      "@neurocare/workflow-engine": pkg("workflow-engine"),
      "@neurocare/timeline": pkg("timeline"),
      "@neurocare/audit": pkg("audit"),
      "@neurocare/feature-flags": pkg("feature-flags"),
      "@neurocare/notifications": pkg("notifications"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
