# NeuroAssess — Repository Identity (LOCKED)

> Status: **Canonical**. This file is the authority for which repository, application,
> backend, database and deployment target NeuroAssess work must use. Confirmed with the
> product owner on 2026-10-13.

## Canonical repository

| Attribute | Value |
|---|---|
| Canonical name | **neuro-acess** |
| Canonical GitHub remote | `https://github.com/yasir202029/neuro-acess.git` |
| Canonical application | NeuroAssess — unified ADHD & Autism Clinical OS (single authenticated SPA) |
| Framework | Vite 7 + React 19 + TypeScript (strict) + Tailwind CSS v4 + wouter + TanStack Query |
| Primary UI path | `artifacts/neuroassess-web/` |
| API (canonical) | `artifacts/api-server/` (Express 5) — the backend the UI targets |
| Database source of truth | Managed Postgres via Supabase (Drizzle schema in `lib/db`) |
| Deployment targets | Vercel (approved foundation); self-hosted Node/Postgres behind a reverse proxy for non-Vercel |
| Branch of record | `feat/foundation-care-journey` (this work); `main` is the integration baseline |

## Directories that belong to NeuroAssess (canonical)

- `artifacts/neuroassess-web/` — the product UI (preserve design, IA, components, branding).
- `artifacts/api-server/` — the API the UI calls (roles/permissions/audit live here).
- `lib/` — shared, generated, single-source-of-truth packages: `api-client-react`, `api-spec`,
  `api-zod`, `db` (Drizzle), `psychometrics`.
- `packages/` — NeuroAssess-owned platform spine: `permissions`, `journey`, `feature-flags`,
  `audit`, `notifications`, `timeline`, `workflow-engine`.
- `docs/` — ADRs, slice specs, this file.
- `scripts/`, config files (`tsconfig*.json`, `pnpm-workspace.yaml`, `vite.config.ts`).

## Repositories explicitly EXCLUDED from decision-making

The following are **not** authoritative and must not supply requirements or code to
NeuroAssess without a documented, reviewed comparison (per §0):

- **`backend/` (Express + Prisma monolith)** — a parallel/duplicate backend with its own role
  enum and a large clinical schema. Retained read-only as a *schema reference*; not the
  canonical API. See `docs/adr/0001-canonical-backend-and-single-record.md`.
- **`apps/*` (Next.js portals) and `apps/mobile` (Expo)** — role-split portal duplicates of the
  single SPA. Retired behind flags as the unified console reaches parity.
- **Nested empty `neuro-acess/` scaffold** — a content-free Replit upload (no `src/`). Folded
  into this canonical repo; its identity (name + remote) is adopted here.
- Any similarly named projects (NeuroCare, NeuroCare-Platform, NeuroAI, launch-it, Remote ADHD,
  NeuroAssess copies).

## Identity conflict resolved

Two git repos previously coexisted (outer `NeuroCare-Platform` with the real product; nested
empty `neuro-acess`). Decision: consolidate under **`neuro-acess`**. The outer repo's history and
the platform spine are preserved; the empty nested scaffold is not carried forward.

## Rules

1. All NeuroAssess work happens in this repository.
2. Do not create a second application, backend, database, or portal.
3. Do not import code from similarly named repositories automatically.
