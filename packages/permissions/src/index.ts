export {
  platformRoles,
  isPlatformRole,
  permissions,
  isCapability,
  assertCapabilities,
  UnknownCapabilityError,
  type PlatformRole,
  type Capability,
} from "./capabilities.js";
export { defaultRoleCapabilities } from "./roles.js";
export {
  resolveCapabilities,
  canAll,
  canAny,
  authorise,
  requireCapabilities,
  AuthorisationError,
  type CapabilityGrants,
  type AuthorisationDecision,
  type AuthorisationDenialReason,
} from "./policy.js";
