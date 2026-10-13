# Repository audit — NeuroAssess (canonical)

> Produced 2026-10-13 as the pre-edit audit required by the Master Implementation
> Directive (Part 28). Companion to `docs/REPOSITORY_IDENTITY.md`.

## 1. Verification (all confirmed)

| Check | Result |
|---|---|
| Working directory / git root | `/Users/iramarshad/Downloads/neuro-acess` (single git root) |
| Remote origin | `https://github.com/yasir202029/neuro-acess.git` (+ `gitsafe-backup`) |
| Repository name | `neuro-acess` — matches canonical identity file |
| Branch at audit | `feat/slice1-referral-to-assessment` (off `feat/unified-application-shell`) |
| Lock file / workspace | `pnpm-lock.yaml`, `pnpm-workspace.yaml`, pnpm 12.4.2 enforced by preinstall |
| Framework | Vite 7 + React 19 + strict TS 5.9 + Tailwind v4 + wouter + TanStack Query (UI); Express 5 (API) |
| Database | Drizzle ORM over Postgres/Supabase (`lib/db`), `drizzle-kit push` scripts, migrations dir present |
| ORM | drizzle-orm + drizzle-zod |
| Authentication | Supabase JWT verified server-side (`api-server/src/security/auth.ts` → `Bearer` token → role from `app_metadata`); client demo sign-in behind `unifiedApplicationShell` flag only |
| Deployment | Vercel-approved SPA; ENVIRONMENT.md documents env/secrets; API is a Node service |
| Existing tests | 50 vitest tests across `packages/*` and `artifacts/neuroassess-web/src/platform` — all passing at audit |

## 2. Existing strengths to preserve

- `artifacts/neuroassess-web` — the complete designed SPA: public marketing pages, booking flow,
  patient/clinician/admin/finance portal layouts, responsive design, branding, test-ids everywhere.
- `artifacts/api-server` — Express 5 API with Supabase auth, `requirePermission` deny-by-default
  middleware, pino structured logging, audit helper, zod-validated health contract.
- Platform spine packages: `@neurocare/permissions` (capability model mirrored from the API's
  canonical role table), `@neurocare/journey` (18-stage typed state machine with transition table,
  blockers, optimistic concurrency), `@neurocare/workflow-engine` (port-based atomic transition
  orchestration), `@neurocare/timeline` (normalised events + query-layer visibility),
  `@neurocare/audit` (append-only, redacting), `@neurocare/feature-flags` (7-layer resolver),
  `@neurocare/notifications`.
- Generated API client (`lib/api-client-react`, orval) targeting `artifacts/api-server`.

## 3. Current architecture map

```
artifacts/neuroassess-web (SPA)  ──HTTP──▶  artifacts/api-server (Express 5)
      │  wouter routes, TanStack Query,        │  authenticate (Supabase JWT)
      │  platform/{session,flags,guards}       │  requirePermission (deny-by-default)
      │                                        │  routes/* (platform, ehr, intake, …)
      │                                        ▼
      │                                 lib/db (Drizzle schema, Supabase Postgres)
      ▼
packages/* — pure domain spine (permissions, journey, workflow-engine,
            timeline, audit, feature-flags, notifications)
             shared source-of-truth for UI rendering AND server enforcement
```

## 4. Duplicate / obsolete areas (disposition per ADR 0001)

- `backend/` (Express + Prisma): parallel backend, schema reference only, never a second runtime.
- `apps/*` + `apps/mobile`: role-split portal duplicates of the SPA; retired behind flags as the
  unified shell reaches parity. NOT deleted yet (rollback rule).
- `artifacts/mockup-sandbox`: design sandbox; no product logic.
- API routes currently return `503 CLINICAL_STORAGE_UNAVAILABLE` (tenant storage not connected) —
  the SPA's `data ?? demo*` fallback masked this (removal tracked in gap register).

## 5. Conservative assumptions (documented per directive)

1. No Postgres is reachable in this development environment, so the slice ships with an in-memory
   store behind a narrow `SliceStore` port plus a Drizzle schema + SQL migration for the real
   database; the DB-backed implementation is a tracked gap, not a claim.
2. AI in the slice is a **deterministic synthetic drafting engine** (no live model call). This
   exercises provenance/missing-information/contradiction/safety behaviour end-to-end and is
   replaced behind the model-gateway seam later.
3. Real auth for slice routes = existing Supabase `authenticate`; route tests inject a synthetic
   principal via a documented test harness (never bypasses `requirePermission` logic).
4. Flag names are aligned to the directive's canonical list (Part 6); synonyms introduced in
   earlier branches are renamed now while there are no external consumers (verified by grep).
