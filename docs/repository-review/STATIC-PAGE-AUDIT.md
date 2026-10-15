# Static Page Detector — Screen Audit

Detector criteria: hard-coded patient/clinician/medication data, mock dashboards, buttons without
actions, forms that don't persist, tables without API, fixed-value charts, local-only filters,
role selectors instead of auth, localStorage-as-database, missing validation/loading/error/audit.

## NeuroCare-Platform (NCP) — screen classifications

| Screen | File (representative) | Hard-coded data found | Classification |
|---|---|---|---|
| Clinician dashboard | `apps/clinician-portal/app/page.tsx` | Caseload/KPIs as local constants; no fetch | **STATIC** |
| Clinician patient list/record screens | `apps/clinician-portal/app/[section]/*.tsx` | Mock appointments/medication arrays in-component | **STATIC** |
| Admin operations screens | `apps/admin-portal/app/[section]/*.tsx` | Mock queues/metrics | **STATIC** |
| Patient portal screens | `apps/patient-portal/app/[section]/*.tsx` | Mock appointments/documents | **STATIC** |
| Super-admin screens | `apps/super-admin-portal` | Mock user/role tables | **STATIC** |
| Marketing site | `apps/marketing-site` | Content-only by design | **PRODUCTION CANDIDATE (content)** |
| Mobile app screens | `apps/mobile/app/*` | Local state only; no API client wired | **PARTIALLY FUNCTIONAL** (UI real, data layer absent) |
| Auth screens (portals) | `*/login` pages | Role selector without server auth on some | **FUNCTIONAL BUT UNSAFE** where role picked client-side |

Net: NCP portals are predominantly **STATIC UI PROTOTYPES** — visually complete, functionally disconnected. This matches the tasking's premise and is now documented with per-screen evidence rather than assumption.

## neuro-acess (NA) — screen classifications

| Screen | File | Data source | Classification |
|---|---|
| Public website pages | `artifacts/neuroassess-web/src/pages/*` | Static content (correct for marketing) | **PRODUCTION CANDIDATE (content)** |
| Sign-in (`/signin`) | `src/platform/*` | Synthetic dev session; Supabase wiring complete; server auth via backend JWT verified | **FUNCTIONAL WITH LIMITATIONS** (demo session until Supabase env is set) |
| Clinician workspace | `src/workspaces/clinician*` | Flag-gated shell; work queue UI; **conversion to Clarity+live API in progress** | **PARTIALLY FUNCTIONAL** |
| Patient workspace | `src/workspaces/patient*` | Flag-gated; appointments/messages UI | **PARTIALLY FUNCTIONAL** |
| Admin workspace | `src/workspaces/admin*` | Shell + capability gating | **PARTIALLY FUNCTIONAL** |
| Mobile (Expo) | `apps/mobile/app/index.tsx` | Consent demo with `@neuroassess/clinical-consent` logic; no API client | **PARTIALLY FUNCTIONAL** |
| API servers | `backend/` (18 modules) + `artifacts/api-server` | **Real**: 85-table DB, JWT, RBAC, audit — verified over HTTP this session | **PRODUCTION CANDIDATE** |

## Hard-coded data inventory (detector hits)
- NCP: clinician/patient names, appointment times, medication regimens, dashboard counts — all in-component constants (~40+ files).
- NA web: only synthetic demo *session identity* (clearly labelled), no fake clinical records.
- NA backend: seed data only (`prisma/seed*.ts`), clearly marked synthetic.

## Functional Conversion Tracker — established

Tracker lives in [CONSOLIDATION-PLAN.md](CONSOLIDATION-PLAN.md) §Conversion Tracker with columns:
repository · source file · screen · current status · target workstation · required API · required DB entities ·
required permissions · required validation · required audit · required workflow states · required tests ·
migration status · completion evidence.

A screen moves to COMPLETE only when: frontend behaviour + backend endpoint + persistence + authN/authZ +
validation + loading/empty/error states + audit + tests + documentation are all verified (per Continuous
Execution Mode definition). Current COMPLETE count: **0 screens** (honest baseline); backend endpoints
feeding them are verified PRODUCTION CANDIDATE.
