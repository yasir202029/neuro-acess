/**
 * Canonical capability model for NeuroAssess.
 *
 * Derived from `artifacts/api-server/src/security/roles.ts` — the single source of
 * truth (ADR 0001). Do not invent new names here; extend the canonical model there
 * and mirror it. Access is deny-by-default.
 */

export const platformRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "CLINICIAN",
  "PATIENT",
  "RECEPTIONIST",
  "FINANCE",
  "REFERRER",
  "CORPORATE_CLIENT",
  "SUPPORT_AGENT",
] as const;

export type PlatformRole = (typeof platformRoles)[number];

const roleSet: ReadonlySet<string> = new Set(platformRoles);

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && roleSet.has(value);
}

export const permissions = [
  "platform:manage",
  "clinic:manage",
  "user:manage",
  "patient:read",
  "patient:write",
  "assessment:read",
  "assessment:write",
  "clinical:write",
  "appointment:manage",
  "billing:read",
  "billing:write",
  "document:read",
  "document:write",
  "message:write",
  "audit:read",
  "ai:use",
  "ai:manage",
] as const;

/** A capability is a permission in the canonical model. */
export type Capability = (typeof permissions)[number];

const permissionSet: ReadonlySet<string> = new Set(permissions);

export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && permissionSet.has(value);
}

export function assertCapabilities(values: readonly unknown[]): Capability[] {
  const invalid = values.filter((value) => !isCapability(value));
  if (invalid.length > 0) throw new UnknownCapabilityError(invalid.map(String));
  return values as Capability[];
}

export class UnknownCapabilityError extends Error {
  readonly invalid: readonly string[];
  constructor(invalid: readonly string[]) {
    super(`Unknown capabilities: ${invalid.join(", ")}`);
    this.name = "UnknownCapabilityError";
    this.invalid = invalid;
  }
}
