import { flagCatalogue, isFeatureFlag, type FeatureFlag } from "./catalogue.js";

/** Layers that can override a flag, in increasing precedence. */
export interface FlagOverrides {
  readonly env?: Readonly<Partial<Record<FeatureFlag, boolean>>>;
  readonly organisation?: Readonly<Partial<Record<FeatureFlag, boolean>>>;
  readonly user?: Readonly<Partial<Record<FeatureFlag, boolean>>>;
  /** Emergency kill switch. Any `true` forces the flag OFF regardless of other layers. */
  readonly killSwitch?: Readonly<Partial<Record<FeatureFlag, boolean>>>;
}

function normaliseEnv(env: Record<string, string | undefined>): Partial<Record<FeatureFlag, boolean>> {
  const result: Partial<Record<FeatureFlag, boolean>> = {};
  for (const flag of Object.keys(env)) {
    // Convention: NEUROCARE_FLAG_<UPPER_SNAKE>
    const prefix = "NEUROCARE_FLAG_";
    if (!flag.startsWith(prefix)) continue;
    const snake = flag.slice(prefix.length);
    const camel = snake.toLowerCase().replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
    if (!isFeatureFlag(camel)) continue;
    const raw = env[flag]?.trim().toLowerCase();
    if (raw === "on" || raw === "true" || raw === "1") result[camel] = true;
    else if (raw === "off" || raw === "false" || raw === "0") result[camel] = false;
  }
  return result;
}

export interface ResolveFlagInput {
  readonly flag: FeatureFlag;
  readonly environment?: "development" | "test" | "production";
  readonly env?: Record<string, string | undefined>;
  readonly overrides?: FlagOverrides;
}

/** Where the effective value came from — used for debugging and audit trails. */
export type FlagSource = "KILL_SWITCH" | "USER" | "ORG" | "ENV" | "DEFAULT";

export interface FlagResolution {
  readonly flag: FeatureFlag;
  readonly enabled: boolean;
  readonly source: FlagSource;
}

export function resolveFlag(input: ResolveFlagInput): FlagResolution {
  const descriptor = flagCatalogue.find((entry) => entry.key === input.flag);
  const envLayer = input.overrides?.env ?? normaliseEnv(input.env ?? {});
  const orgLayer = input.overrides?.organisation ?? {};
  const userLayer = input.overrides?.user ?? {};
  const kill = input.overrides?.killSwitch?.[input.flag] ?? false;

  if (kill) return { flag: input.flag, enabled: false, source: "KILL_SWITCH" };
  if (input.flag in userLayer) return { flag: input.flag, enabled: userLayer[input.flag] === true, source: "USER" };
  if (input.flag in orgLayer) return { flag: input.flag, enabled: orgLayer[input.flag] === true, source: "ORG" };
  if (input.flag in envLayer) return { flag: input.flag, enabled: envLayer[input.flag] === true, source: "ENV" };

  const developmentDefault = descriptor?.developmentDefault ?? false;
  const enabled = input.environment === "production" ? false : developmentDefault;
  return { flag: input.flag, enabled, source: "DEFAULT" };
}

export function resolveAllFlags(
  input: Omit<ResolveFlagInput, "flag">,
): Readonly<Record<FeatureFlag, FlagResolution>> {
  const out = {} as Record<FeatureFlag, FlagResolution>;
  for (const descriptor of flagCatalogue) {
    out[descriptor.key] = resolveFlag({ ...input, flag: descriptor.key });
  }
  return out;
}

/** Convenience boolean check for server guards. */
export function isFlagEnabled(input: ResolveFlagInput): boolean {
  return resolveFlag(input).enabled;
}
