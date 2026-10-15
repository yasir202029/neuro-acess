# Branch: feat/unified-application-shell

## Problem

The SPA renders every role portal to anyone who navigates to its URL. There is
no session concept, no route guard, and no feature-flag gate on workspaces, so:

- patients, clinicians, admins and finance users all reach the same screens;
- the flag system exists (`@neurocare/feature-flags`) but nothing consumes it
  in the UI, so rollout states cannot be expressed;
- there is no place to hang server-verified sessions once real auth lands.

Who experiences it: every user (data exposure by navigation), and every engineer
(unable to roll workstations out gradually).

## Solution

One authenticated application shell inside the existing SPA (no new app):

1. **Session model** (`src/platform/session.tsx`) — a client-side mirror of the
   server principal: roles → effective capabilities (single
   `@neurocare/permissions` model) → workspaces. SECURITY NOTE: this is a UX
   gate only; the server remains the enforcement boundary for every API call.
2. **Workspace guard** (`src/platform/require-workspace.tsx`) — flag →
   authentication → capability, each failure rendering an explicit, accessible
   state (never a blank screen, never the underlying workspace).
3. **Workspace visibility** — role AND capability gate (deny-by-default). A
   clinician's `billing:read` does not open Finance; a revoked gate capability
   denies even though the role remains.
4. **Synthetic sign-in** (`src/components/sign-in.tsx`) — clearly labelled
   development-only identity picker behind the shell flag. No credentials, no
   network calls. Tracked in the production-readiness gap register as
   pre-auth work.
5. **Flag vocabulary** — catalogue aligned to the canonical spec names:
   `unifiedApplicationShell`, `patientWorkspace` (renamed from
   `unifiedConsole`, `patientMyCare`); no other consumer existed (verified).

## Feature flag

`unifiedApplicationShell` (kill-switch capable, privileged) gates sign-in;
`patientWorkspace`, `clinicianWorkstation`, `adminControlCentre`,
`financeWorkspace` gate each workstation independently. Flags are resolved
client-side for rendering only — server enforcement is a later branch; with the
shell flag OFF the previous behaviour (unguarded routes) is not preserved
deliberately: routes now render an explicit unavailable state instead of the
workspace.

## Acceptance criteria

- [x] All workspace routes render flag → session → capability guard states.
- [x] Deny-by-default: no roles → no workspaces; role without gate capability → denied.
- [x] Clinician/finance/patient cross-visibility cases covered by unit tests.
- [x] Sign-in page exists, is labelled synthetic, and is flag-gated.
- [x] Flag catalogue uses the canonical spec names for the shell.
- [x] `tsc --strict` (libs + web app) passes; `vite build` passes.
- [x] No frontend-only "security": guard docs and code state server boundary.

## Test evidence (2026-10-13)

- `vitest run`: **8 files, 50/50 tests pass** (10 new in
  `src/platform/session.test.ts`).
- `tsc -p artifacts/neuroassess-web --noEmit`: exit 0.
- `tsc --build` (libs): exit 0.
- `vite build`: exit 0 — 525 kB JS / 148 kB gzip (chunk-size warning logged as
  a hardening-branch item, not a regression: +0.8 kB).
- Formatter (prettier --write) applied to all changed files.

## Rollback

Revert the branch commits; no schema, API or data changes. The flag catalogue
rename has no server consumer (verified by grep across `artifacts/api-server`).
