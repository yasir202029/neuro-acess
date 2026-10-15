# Reusable Code Map & Consolidation Plan (incl. Functional Conversion Tracker)

## Reusable code map (source → target)

| Source (path) | What it is | Reuse decision | Target |
|---|---|---|---|
| NA `backend/` (Express+Prisma, 18 modules) | Clinical API: auth+MFA, RBAC, audit, ADHD/ASD, booking, notes, messaging, billing, admin, AI | **KEEP — canonical backend** | unchanged |
| NA `artifacts/api-server` | Intake/referral engine + SPA single-origin host | **KEEP** as gateway module | unify route map |
| NA `packages/clarity` | Clarity Health Design System (tokens, 40 components, a11y tests) | **KEEP — canonical DS** | all workstations |
| NA `packages/{permissions,journey,workflow-engine,timeline,audit,feature-flags,notifications}` | Typed spine | **KEEP** | everywhere |
| NA `artifacts/neuroassess-web` | Public site + unified workspaces (flag-gated) | **KEEP** as launch surface; convert screens to live data | workstations |
| NA `apps/mobile` | Expo patient app skeleton (consent demo) | **EXTEND** into “NeuroCare Patient” | patient app |
| NCP `apps/mobile` screens | Richer patient screens | **PORT** onto NA API + Clarity tokens | patient app |
| NCP `apps/marketing-site` | Next.js public site | **REFERENCE** (optional post-launch split) | — |
| NCP portal *separation pattern* | 7 apps, separate logins/URLs | **ADOPT PATTERN**, never NCP auth | workstation origins |
| NCP `packages/design-system/engine.ts` | Workspace-engine concepts | **PORT IDEAS** w/ tests | Clarity Adaptive Workspace Engine |
| NCP clinical UI screens | Static prototypes | **SPEC ONLY** — never copy (mock data, no authz) | referenced in tracker |
| NCP auth/session code | Cookie sessions, no MFA | **DELETE AFTER REPLACEMENT** | NA auth service |

## Consolidation plan (ordered, each step gated by tests + verification)

1. **Canonical backend hardening** (DONE core): DB live, migrations, auth flows verified, RBAC negative tests, audit rows. Remaining: rate-limit config check, staff-MFA enforcement flag, break-glass model+routes, prescription state-machine routes complete.
2. **Workstation data layer**: API client (`/api/v1`) + TanStack Query + Zod contracts in NA web; Clarity shell (AppShell/Sidebar/TopBar/CommandCentre); Patient Identity Banner; Patient 360 modules fed by real endpoints. *In progress.*
3. **Clinical Command Dashboard + Clinical Work Queue**: every widget = authorised backend query (no hard-coded numbers); work queue over booking/assessments/notes/prescriptions queries.
4. **Assessment Studios (ADHD, Autism)**: section-based composers over existing assessment endpoints + provenance panel; sign-and-lock via notes routes + guardrail.
5. **Titration Control Centre + Observation Trend Explorer + Side-Effect Matrix**: MedicationReview/Observation-backed; thresholds org-configurable.
6. **Admin Workstation**: ops centre widgets from admin/reports endpoints; waiting-list/allocation consoles over booking+teams; finance ops over billing; no clinical powers for admin roles.
7. **Patient app “NeuroCare Patient”**: port NCP screens; API client to `/api/v1` patient scope; check-ins, documents wallet, prescription status tracker; calm mode from Clarity tokens.
8. **Public website split (optional)**: NCP-style Next.js site post-launch; SPA remains SEO baseline.
9. **Deployment**: fix PAT → push `release/azure-platform-hardening` → Render blueprint → live URL; then Azure target per release branch name. Local recovery artifacts exist (`~/Desktop/neuro-acess-release-bundle.bundle`).

## Blocker register (continuous-execution mode)

| Blocker | Impact | Safe adapter / workaround |
|---|---|---|
| Dead GitHub PAT (auth 401; push impossible) | Cannot push/deploy; CI idle | Bundles+patch on Desktop; continue local dev; **user rotates token** |
| No live Supabase project creds | Magic-link login inactive; dev session fallback works | Backend JWT auth fully functional locally |
| Render/Azure creds not available | No live URL yet | All verification via local HTTP + browser automation |

## Functional Conversion Tracker (baseline — honest)

| Screen | Repo/File | Status now | Target | Gates to COMPLETE |
|---|---|---|
| Clinician workspace | NA web workspaces/clinician* | PARTIALLY FUNCTIONAL | Clinical Workstation | API client+Query, work queue live, banner, tests |
| Patient workspace | NA web workspaces/patient* | PARTIALLY FUNCTIONAL | Patient portal surface | same |
| Admin workspace | NA web workspaces/admin* | PARTIALLY FUNCTIONAL | Admin workstation | same |
| NCP clinician/admin/patient/super-admin screens | NCP apps | STATIC | spec reference | n/a (not migrated wholesale) |
| Mobile consent screen | NA apps/mobile | PARTIALLY FUNCTIONAL | NeuroCare Patient | API client, screens port |
| Public pages | NA web pages | PRODUCTION CANDIDATE (content) | Public website | SEO/cookie controls pass |

COMPLETE count: **0** — nothing is claimed complete without the full gate list; progress is tracked per step above.
