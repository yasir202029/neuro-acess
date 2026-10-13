import { isCapability, isPlatformRole, type Capability, type PlatformRole } from "./capabilities.js";
import { defaultRoleCapabilities } from "./roles.js";

/**
 * The effective grant of capabilities for a subject after applying:
 *   default role capabilities → organisation overrides → user overrides.
 *
 * Overrides can both GRANT and REVOKE capabilities. Revocations win over grants
 * so a least-privilege organisation can remove a default capability from a role.
 */
export interface CapabilityGrants {
  readonly roles: readonly PlatformRole[];
  readonly organisationGrant?: readonly Capability[];
  readonly organisationRevoke?: readonly Capability[];
  readonly userGrant?: readonly Capability[];
  readonly userRevoke?: readonly Capability[];
}

/**
 * Compute the effective capability set for a subject.
 * Deterministic order: role defaults, then org grant, then user grant, then
 * org revoke, then user revoke (revocations always applied last).
 */
export function resolveCapabilities(grants: CapabilityGrants): ReadonlySet<Capability> {
  const effective = new Set<Capability>();

  for (const role of grants.roles) {
    if (!isPlatformRole(role)) continue;
    for (const capability of defaultRoleCapabilities[role]) effective.add(capability);
  }

  for (const capability of grants.organisationGrant ?? []) {
    if (isCapability(capability)) effective.add(capability);
  }
  for (const capability of grants.userGrant ?? []) {
    if (isCapability(capability)) effective.add(capability);
  }

  // Revocations last, so an org/user can always remove a default grant.
  for (const capability of grants.organisationRevoke ?? []) effective.delete(capability);
  for (const capability of grants.userRevoke ?? []) effective.delete(capability);

  return effective;
}

/** Whether a subject may perform every one of the required capabilities. */
export function canAll(grants: CapabilityGrants, required: readonly Capability[]): boolean {
  const effective = resolveCapabilities(grants);
  return required.every((capability) => effective.has(capability));
}

/** Whether a subject may perform any one of the required capabilities. */
export function canAny(grants: CapabilityGrants, required: readonly Capability[]): boolean {
  const effective = resolveCapabilities(grants);
  return required.some((capability) => effective.has(capability));
}

/**
 * Authorisation decision with a stable, loggable reason. The `reason` is used by
 * the observability layer (permission-denial tracking) and never contains PHI.
 */
export type AuthorisationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AuthorisationDenialReason; readonly missing: readonly Capability[] };

export type AuthorisationDenialReason =
  | "MISSING_CAPABILITY"
  | "NO_ROLES"
  | "UNKNOWN_ROLE";

export function authorise(
  grants: CapabilityGrants,
  required: readonly Capability[],
): AuthorisationDecision {
  if (grants.roles.length === 0) {
    return { allowed: false, reason: "NO_ROLES", missing: [...required] };
  }
  const unknownRoles = grants.roles.filter((role) => !isPlatformRole(role));
  if (unknownRoles.length === grants.roles.length) {
    return { allowed: false, reason: "UNKNOWN_ROLE", missing: [...required] };
  }
  if (canAll(grants, required)) return { allowed: true };
  const effective = resolveCapabilities(grants);
  return {
    allowed: false,
    reason: "MISSING_CAPABILITY",
    missing: required.filter((capability) => !effective.has(capability)),
  };
}

/** Imperative guard for server route handlers; throws on denial. */
export class AuthorisationError extends Error {
  readonly decision: AuthorisationDecision & { allowed: false };
  constructor(decision: AuthorisationDecision & { allowed: false }) {
    super(`Authorisation denied: ${decision.reason}`);
    this.name = "AuthorisationError";
    this.decision = decision;
  }
}

export function requireCapabilities(
  grants: CapabilityGrants,
  required: readonly Capability[],
): void {
  const decision = authorise(grants, required);
  if (!decision.allowed) throw new AuthorisationError(decision);
}
