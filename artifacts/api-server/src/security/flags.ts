import type { NextFunction, Request, Response } from "express";
import {
  featureFlags,
  resolveFlag,
  type FeatureFlag,
} from "@neurocare/feature-flags";

/**
 * Server-side feature-flag enforcement (Part 6).
 *
 * Frontend hiding is never a control: every slice endpoint resolves its flags
 * here before any domain work. Resolution order is the canonical one:
 * emergency kill switch > env > (org/capability/user layers, wired when the
 * config store lands) > catalogue default.
 *
 * `NEUROCARE_KILL_SWITCH=on` forces EVERY flag off immediately — the emergency
 * global kill switch, operable without a deploy.
 */

function isOn(value: string | undefined): boolean {
  const normalised = value?.trim().toLowerCase();
  return normalised === "on" || normalised === "true" || normalised === "1";
}

export function serverEnvironment(): "development" | "test" | "production" {
  const node = process.env.NODE_ENV;
  return node === "production"
    ? "production"
    : node === "test"
      ? "test"
      : "development";
}

/** Resolve one flag against the live process environment. */
export function isServerFlagEnabled(
  flag: FeatureFlag,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const killed = isOn(env.NEUROCARE_KILL_SWITCH);
  return resolveFlag({
    flag,
    environment: serverEnvironment(),
    env: env as Record<string, string | undefined>,
    overrides: killed ? { killSwitch: { [flag]: true } } : undefined,
  }).enabled;
}

/**
 * Express middleware: 403 FEATURE_DISABLED when any required flag resolves off.
 * The flag name is included outside production only (no internal controls
 * exposed to patients or to production clients).
 */
export function requireFlag(...flags: readonly FeatureFlag[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const disabled = flags.find((flag) => !isServerFlagEnabled(flag));
    if (!disabled) return next();
    return res.status(403).json({
      error: "This capability is not currently available.",
      code: "FEATURE_DISABLED",
      ...(serverEnvironment() === "production" ? {} : { flag: disabled }),
    });
  };
}

/** Exported for tests and the future admin control surface. */
export const allFeatureFlags: readonly FeatureFlag[] = featureFlags;
