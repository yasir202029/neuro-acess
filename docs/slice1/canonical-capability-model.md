# Branch: feat/canonical-capability-model

## Problem
The repository defines **three** different role vocabularies for one product:
Prisma `Role` (`backend/`), `PlatformRole` + `permissions` (`artifacts/api-server/src/security/roles.ts`),
and `packages/access` `portalAccess`. Any workspace built today would invent a fourth.

Who experiences it: every engineer, on every feature.

## Impact if unresolved
Authorization logic is duplicated and diverges per surface. A permission granted in one
workspace can be silently missing in another — a patient-safety and data-protection risk in a
clinical system. It also blocks the "one role model" decision in ADR 0001.

## Users affected
All four workspaces (Patient, Clinician, Admin, Finance) and the API that serves them.

## Solution
A single, typed, deny-by-default **capability catalogue** derived from the canonical
`artifacts/api-server` role/permission model. One package (`@neurocare/permissions`) that:
- defines the canonical roles and capabilities as `const` tuples + TS types;
- maps each role to its default capabilities (least privilege);
- resolves effective capabilities through organisation and user overrides (revoke wins);
- exposes `authorise`/`canAll` with a stable, loggable denial reason (no PHI).

Every workspace and route imports this one model. Prisma `Role`, `packages/access`, and
`requirePortal` are retired against it.

## Feature flag
`unifiedConsole` (server-enforced). The new model is additive and flag-guarded; existing
`requirePortal` checks remain until each surface migrates, preserving rollback.

## Acceptance criteria
- [ ] `PlatformRole` and capability names match `artifacts/api-server/src/security/roles.ts` exactly.
- [ ] Deny-by-default: an unknown role or capability is refused.
- [ ] Organisation/user overrides can grant and revoke; revoke always wins.
- [ ] `authorise` returns a stable denial reason with no personal data.
- [ ] Unit tests prove: patient cannot read organisation-wide data; finance is scoped to
      billing; clinician cannot `ai:manage`; a revoked default capability is denied.
- [ ] `tsc` (strict) and tests pass.

## Rollback
Delete the package; no runtime consumer is wired in this branch. Existing auth is untouched.
