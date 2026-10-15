import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors the alias map in vite.config.ts so vitest resolves the same way.
const dir = path.dirname(__filename);
const pkg = (name: string) =>
  path.resolve(dir, "..", "..", "packages", name, "src", "index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dir, "src"),
      "@neurocare/permissions": pkg("permissions"),
      "@neurocare/journey": pkg("journey"),
      "@neurocare/feature-flags": pkg("feature-flags"),
      "@neurocare/audit": pkg("audit"),
      "@neurocare/notifications": pkg("notifications"),
      "@neurocare/timeline": pkg("timeline"),
    },
  },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_PORTAL_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_CLINICIAN_PORTAL_URL": JSON.stringify(""),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
