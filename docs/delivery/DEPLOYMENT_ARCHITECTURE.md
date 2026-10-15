# NeuroAssess — Deployment Architecture (Lead Architecture)

> Status: Canonical. Owner: Platform Engineering. Applies to the `neuro-acess` monorepo.
> This document defines how the NeuroAssess clinical OS is built, promoted, and deployed across environments.

---

## 1. Product surface (what gets deployed)

| Face / Workstation | Canonical path | Framework | Role boundary | Deploy target |
|---|---|---|---|---|
| Public website (face) | `artifacts/neuroassess-web/` (public routes + marketing shell) | Vite 7 + React 19 + Tailwind v4 | Public / unauthenticated | Render SPA + Vercel marketing |
| Patient portal (web + app) | `artifacts/neuroassess-web/` (patient workspace) + `apps/mobile` (Expo, behind flag) | Vite web / Expo mobile | PATIENT | Render SPA (web) ; EAS / app stores (mobile) |
| Clinician workstation | `artifacts/neuroassess-web/` (clinician workspace) | Vite 7 + React 19 | CLINICIAN | Render SPA |
| Admin console | `artifacts/neuroassess-web/` (admin/finance/prescriber/nurse workspaces) + `apps/admin-portal` + `apps/super-admin-portal` (legacy, behind flag) | Vite 7 + React 19 | ADMIN / FINANCE / PRESCRIBER / NURSE / SUPER_ADMIN | Render SPA |
| API (clinical OS backend) | `artifacts/api-server/` | Express 5 + Node 24 | Server-only (RBAC, audit, flags) | Render web service (single origin) |
| Shared lib / spine | `lib/`, `packages/` | TypeScript (workspace) | Build-time only | Published internally via workspace |

**Canonical rule (per `docs/REPOSITORY_IDENTITY.md`)**: one application, one backend, one database. Do not create a second API or portal. `apps/*` Next.js portals and `backend/` Prisma monolith are retired schema references, served only behind feature flags.


## 2. Branch & environment strategy

| Branch | Purpose | Environment | Trigger | Auto-deploy |
|---|---|---|---|---|
| `main` | Production release | Production | PR merge / tag | Yes (Render prod) |
| `staging` | Pre-production UAT | Staging | PR merge / manual | Yes (Render staging) |
| `develop` | Integration baseline | Development | PR merge | Yes (Render dev) |
| `feat/*` | Feature work | Feature preview (Vercel) | Push | Preview only |
| `hotfix/*` | Production emergency | Production | PR merge | Yes (Render prod) |
| `release/*` | Release candidate | Staging | Push | Yes (Render staging) |


## 3. CI pipeline (`.github/workflows/ci.yml`)

1. **Checkout** + pnpm setup (cache via `pnpm-store`).
2. **Typecheck** — `pnpm run typecheck:libs` + per-app/typecheck.
3. **Unit tests** — `pnpm -r run test --if-present` (vitest).
4. **Build** — `pnpm run build` (builds `artifacts/api-server` bundle + `artifacts/neuroassess-web` dist).
5. **Security** — secret scan (no `.env`, no PATs, no `NEXT_PUBLIC_*` secrets in browser code).
6. **Publish** (develop+) — workspace packages to internal registry (optional).

**Gates**: merge blocked unless all jobs pass. Production (`main`) additionally requires a manual approval gate in the CD workflow.

## 4. CD pipeline (`.github/workflows/cd-deploy.yml`)

Render is the canonical single-service host (API + SPA from one origin, no CORS surface between web and API).

| Environment | Render service | Build command | Start command | Env vars source |
|---|---|---|---|---|
| Development | `neuroassess-dev` | `pnpm install --frozen-lockfile && pnpm run build` | `pnpm --filter @workspace/api-server start` | `.env.development` |
| Staging | `neuroassess-staging` | same | same | `.env.staging` |
| Production | `neuroassess` | same | same | Render dashboard encrypted secrets |

**Deploy steps**:
1. Verify `NODE_VERSION=24.21.0`, `NODE_ENV=production`, `PORT=10000`.
2. Run migrations against managed Postgres (Supabase) when `DATABASE_URL` present; otherwise API falls back to the synthetic in-memory `SliceStore` (safe for preview/dev, NOT for production patient data).
3. Deploy static SPA (`artifacts/neuroassess-web/dist`) served by Express with SPA fallback for wouter routes.
4. Health check `GET /api/healthz` must return 200 before traffic shift.
5. Rollback: Render auto-saves previous deploy; `docs/delivery/ROLLBACK_PLAN.md` governs manual rollback.

**Vercel (approved foundation for portals)**: `apps/*` Next.js portals deploy as independent Vercel projects per `docs/multi-portal-architecture.md` (marketing-site, patient-portal, clinician-portal, admin-portal, super-admin-portal). Environments: `main`=Production, `develop`=Staging, feature branches=Preview. UAT = Vercel custom environment. Domain assignment only after Vercel verification.


## 5. Environment variables

**Browser-safe (`NEXT_PUBLIC_*`)**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PORTAL_URL`, `NEXT_PUBLIC_CLINICIAN_PORTAL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, analytics IDs.

**Server-only secrets** (never in repo, never in browser builds): `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `AWS_REGION`, `DATABASE_URL`.

**Deployment rule**: set secrets in the provider's encrypted secret manager (Render dashboard env vars / Vercel project settings). Never commit `.env`. Rotate any accidentally exposed credential.

## 6. Database & data

- Source of truth: managed Postgres via Supabase. Drizzle schema in `lib/db/src/schema/neuroassess.ts`; migrations in `lib/db/migrations`.
- Prisma schema in `backend/prisma/schema.prisma` is the retired reference only.
- Apply Supabase Row Level Security before enabling production patient data.
- `DATABASE_URL` unset → API uses in-memory `SliceStore` (preview/dev only).

## 7. Observability & safety

- Structured logging (pino) with request IDs; graceful shutdown on SIGTERM (drain in-flight clinical writes).
- Feature flags (`packages/feature-flags`) resolved server-side; emergency kill switch `NEUROCARE_KILL_SWITCH=on`.
- Role/permission grants in `artifacts/api-server/src/security/roles.ts`; `requireFlag` middleware returns 403 `FEATURE_DISABLED`.
- Audit package (`packages/audit`) records access to clinical records.
- Error boundary in React (`@/components/error-boundary`) keeps caught errors off `reportError()`.

## 8. Rollback

See `docs/delivery/ROLLBACK_PLAN.md`. Render retains the previous deploy; promote it back via the Render dashboard or `render cli`. Database migrations are forward-only; data rollback requires point-in-time restore from Supabase backups.

## 9. Sync with GitHub

- All work branches pushed to `origin` (`https://github.com/yasir202029/neuro-acess.git`).
- Protected branches: `main`, `staging`, `develop` require PR + CI pass.
- Repository secrets to configure in GitHub: `RENDER_API_KEY` (or `RENDER_SERVICE_ID`), `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, plus per-environment secret names mirroring §5.
- Backup remote: `gitsafe-backup` (`git://gitsafe:5418/backup.git`).

**Promotion flow**: `feat/*` → `develop` (PR) → `staging` (PR) → `main` (PR + tag). Every promotion re-runs the full CI pipeline (typecheck → unit → build → e2e smoke) before deployment.
