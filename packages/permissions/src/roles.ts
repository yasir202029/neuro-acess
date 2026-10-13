import type { Capability, PlatformRole } from "./capabilities.js";

/**
 * Default role-to-capability grants, mirrored from the canonical
 * `artifacts/api-server/src/security/roles.ts` grants table (ADR 0001).
 *
 * A role is a bundle of capabilities, never a portal. Least privilege:
 * SUPER_ADMIN receives every capability (break-glass governance role);
 * PATIENT holds only the capabilities needed to act on its own record, and the
 * server additionally enforces record ownership for `*.self`-style actions.
 */
export const defaultRoleCapabilities: Readonly<Record<PlatformRole, readonly Capability[]>> = {
  SUPER_ADMIN: [
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
  ],
  ADMIN: [
    "clinic:manage",
    "user:manage",
    "patient:read",
    "patient:write",
    "assessment:read",
    "assessment:write",
    "appointment:manage",
    "billing:read",
    "billing:write",
    "document:read",
    "document:write",
    "message:write",
    "audit:read",
  ],
  CLINICIAN: [
    "patient:read",
    "patient:write",
    "assessment:read",
    "assessment:write",
    "clinical:write",
    "appointment:manage",
    "billing:read",
    "document:read",
    "document:write",
    "message:write",
    "ai:use",
  ],
  PATIENT: [
    "patient:read",
    "patient:write",
    "appointment:manage",
    "document:read",
    "document:write",
    "message:write",
  ],
  RECEPTIONIST: [
    "patient:read",
    "patient:write",
    "appointment:manage",
    "document:read",
    "message:write",
  ],
  FINANCE: ["patient:read", "billing:read", "billing:write"],
  REFERRER: ["assessment:read", "document:read", "message:write"],
  CORPORATE_CLIENT: ["assessment:read", "document:read", "message:write"],
  SUPPORT_AGENT: ["patient:read", "appointment:manage", "document:read", "message:write"],
};
