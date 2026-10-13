import { useMemo } from "react";
import {
  resolveAllFlags,
  type FeatureFlag,
  type FlagResolution,
} from "@neurocare/feature-flags";

/**
 * Client feature flags.
 *
 * Resolution mirrors the server (kill switch > env > org > user > default) so
 * the UI never disagrees with enforcement. The browser copy is for *rendering
 * only* — the server independently enforces every flag. This hook reads the
 * same `NEUROCARE_FLAG_*` env convention baked at build time plus an optional
 * runtime override map (for the authorised dev panel).
 */
export interface FlagsValue {
  readonly all: Readonly<Record<FeatureFlag, FlagResolution>>;
  isEnabled: (flag: FeatureFlag) => boolean;
}

// Build-time environment snapshot (vite `define` replaces process.env.*).
const buildEnv: Record<string, string | undefined> = {
  NEUROCARE_ENV: import.meta.env.MODE as string | undefined,
};

export function useFlags(
  overrides?: Partial<Record<FeatureFlag, boolean>>,
): FlagsValue {
  const all = useMemo(
    () =>
      resolveAllFlags({
        environment:
          (import.meta.env.MODE as string | undefined) === "production"
            ? "production"
            : "development",
        env: buildEnv,
        overrides: overrides ? { user: overrides } : undefined,
      }),
    [overrides],
  );
  return useMemo(
    () => ({
      all,
      isEnabled: (flag: FeatureFlag) => all[flag]?.enabled ?? false,
    }),
    [all],
  );
}
