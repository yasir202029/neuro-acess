# ADR 0001 — Canonical backend, single role model, one patient record

- Status: Accepted
- Date: 2026-10-13
- Deciders: Chief Architect
- Supersedes: n/a

## Context

The NeuroAssess repository currently contains **multiple overlapping foundations** for one
product. The audit established the following facts:

1. The canonical product UI is the single SPA at `artifacts/neuroassess-web`.
2. That SPA's generated API client (`lib/api-client-react`, orval) targets
   `artifacts/api-server` (Express 5). Its endpoints (`/platform/summary`, `/appointments`,
   `/patients`, `/assessments`, `/reports`, `/messages`, `/documents`, `/payments`) all return
   `503 CLINICAL_STORAGE_UNAVAILABLE` today.
3. The SPA **never** calls `setBaseUrl`/`setAuthTokenGetter` and silently falls back to
   hardcoded `demo*` arrays, so the prototype appears to work while nothing is real.
4. A **second, larger backend** exists at `backend/` (Express + Prisma, rich clinical schema,
   JWT auth, `requirePortal`). The SPA does **not** talk to it.
5. **Three** role vocabularies coexist: Prisma `Role` (`backend/`), `PlatformRole`
   (`artifacts/api-server/src/security/roles.ts`), and `packages/access` `portalAccess`.
6. Five Next.js `apps/*` portals and an Expo `mobile` app re-implement the portal idea the SPA
   already covers, and a nested foreign repo `neuro-acess/` sits in the tree.

This directly violates Development Philosophy #3 (duplicated logic, databases, APIs) and
Patient Record Principle #9 (one patient, one record, one timeline).

## Decision

**NeuroAssess has exactly one API, one role model, and one patient record.**

1. **Canonical API = `artifacts/api-server`.** It is the only backend the product UI talks to.
   It becomes the single source of truth for all workspaces. `backend/` (Prisma) is retained
   read-only as a *schema reference* and is scheduled for reconciliation/retirement; it is not
   a second runtime.
2. **Canonical role model = `PlatformRole` + capability permissions.** `security/roles.ts`
   evolves into the single capability catalogue (deny-by-default). Prisma `Role`, `packages/access`,
   and `requirePortal` are retired in favour of capability checks. A role is a bundle of
   capabilities, never a portal.
3. **One patient record + one timeline.** All domains (assessment, diagnosis, reports, messages,
   prescriptions, titration, monitoring, shared care, complaints) reference a single patient
   timeline. Nothing exists in isolation.
4. **The SPA stops lying.** The `data ?? demo*` fallback is removed behind the first feature
   flag; unconfigured endpoints surface real empty/error states, never fabricated data.
5. **Delete the multi-portal duplication** (`apps/*`, `neuro-acess/`) once the unified console
   reaches parity. Marketing content moves into the SPA (already present) or a single static site.

## Consequences

- Positive: one API to secure/observe; one role model to reason about; one timeline; the
  "clinical OS" becomes buildable without reconciling three vocabularies per feature.
- Negative / cost: `backend/`'s rich Prisma schema must be migrated onto the canonical store;
  the `apps/*` portals must be retired after parity; the demo-data seam is a visible behaviour
  change for early testers.
- Risks: `artifacts/api-server` currently has open CORS and no rate limiting — addressed in the
  hardening branch, not here.

## Disposition of uncommitted `packages/*` scaffolds

Earlier exploratory scaffolds (`journey`, `permissions`, `feature-flags`, `audit`,
`notifications`, `timeline`, `workflow-engine`) were built against an assumed Prisma backend and
an ad-hoc capability model. Under this ADR they are **reconciled, not carried forward as-is**:
the pure engine concepts (care-stage state machine, timeline visibility, flag resolver) are kept
and re-pointed at the canonical `PlatformRole`/capability model and the canonical API. Nothing
from them reaches production until reconciled on the branch that needs it.

## Alternatives considered

- **Adopt `backend/` (Prisma) as canonical.** Rejected: the live UI already targets
  `artifacts/api-server`; switching backends would be a larger, riskier change and would not
  remove the role-model duplication by itself.
- **Keep multiple portals.** Rejected: violates #3 and #9; multiplies every future change.
