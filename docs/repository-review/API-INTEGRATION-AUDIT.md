# API Integration Audit

## NA backend (`backend/`, port 4001, verified live this session)

Base path `/api/v1`. Auth: `Authorization: Bearer <JWT>` (15-min access, refresh rotation).
Verified endpoints (HTTP status + persistence confirmed):

| Endpoint | Method | Verified behaviour |
|---|---|---|
| `/api/v1/auth/register` | POST | Creates user (email verification enforced at login) |
| `/api/v1/auth/login` | POST | Returns `{user, tokens{accessToken,refreshToken}}`; blocks unverified emails |
| `/api/v1/auth/refresh` / `logout` / `logout-all` | POST | Token rotation / revocation |
| `/api/v1/auth/verification/*`, `password-reset/*` | POST | Full flows implemented |
| `/api/v1/auth/mfa/totp/*`, `mfa/email/*`, `sessions`, `login-history`, `security-alerts` | — | MFA + session inventory present |
| `/api/v1/adhd/screening` | POST | **201 persisted**; instrument auto-mapped; audited |
| `/api/v1/adhd/assessments` | POST | **201 persisted** (RBAC: clinician/admin; patient → 403 verified) |
| `/api/v1/adhd/assessments/:id/workflow` | PATCH | Status+formulation persisted; audit row written |
| `/api/v1/adhd/assessments/:id/medication-reviews` | POST | Titration review creation |
| `/api/v1/autism/*` | — | Mirror of ADHD module |
| `/api/v1/booking/*`, `clinical-notes/*`, `messaging/*`, `patients/*`, `billing/*`, `admin/*`, `ai/*` | — | Implemented against 85-table schema |
| Health | `/api/v1/health` | Live check ✅ |

Error contract: `{ error: { code, message } }`; Zod validation at boundaries; `asyncHandler` wraps routes.

## NA artifacts API server (`artifacts/api-server`, port 4001 single-origin with SPA)

`/api` (referral/intake engine, `@neurocare/*` spine). Serves SPA static + SPA fallback. `/api/healthz` ✅.
CORS: same-origin allowed + `ALLOWED_ORIGINS` list. Verified assets served with Origin header.

## NCP portals — API integration reality

| Portal | Fetch calls found | Reality |
|---|---|---|
| clinician-portal | ~0 in section screens | Dashboards/queues from in-component constants → **no API integration** |
| patient-portal | ~0 | Same |
| admin-portal / super-admin-portal | ~0 | Same |
| mobile (NCP) | none wired | No API client |

→ All NCP screens are UI-only; any "integration" is visual. Confirmed by grep for `fetch(`/`axios`/`NEXT_PUBLIC_API` across apps.

## NA web → API integration

- Web SPA currently does **not** call `/api/v1` yet (session is client-mirror; server session via Supabase or backend JWT pending) — the integration layer is the active work item (Clarity + TanStack Query wiring), tracked in CONSOLIDATION-PLAN.
- Supabase magic-link client is implemented (`lib/supabase-auth.ts`) and degrades gracefully when env absent.

## Dead buttons / placeholder calls register

- NCP: all navigation buttons route between static screens (functional navigation, zero data actions). Register in STATIC-PAGE-AUDIT.
- NA web: demo-session actions functional; live-data actions pending API client wiring (tracked, not hidden).
