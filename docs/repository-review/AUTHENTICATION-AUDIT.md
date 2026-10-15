# Authentication & Security Audit

## Authentication reality

| Control | NA backend | NCP portals |
|---|---|---|
| Password hashing | bcrypt(12) + complexity policy | unclear/basic |
| Tokens | JWT access(15m)/refresh(30d) rotation, revocable sessions | session cookies |
| MFA | TOTP + email challenge, recovery, enrolment endpoints | ❌ |
| Brute force | lockout + login history + security alerts | ❌ |
| Email verification | enforced at login (verified live: 401 until verified) | partial |
| Password reset | tokenised, TTL | partial |
| Session mgmt | list/revoke/all-revoke endpoints | ❌ |
| Web session | Supabase magic-link client implemented + synthetic dev fallback (labelled) | role selector on some screens (**UNSAFE**) |

**Verified live this session:** register → login blocked (unverified) → verify in DB → login returns JWT → protected call 200; unauthenticated call 401; patient attempting clinician action 403.

## Authorisation
- Server-side `requireRole` on every protected route (deny-by-default). Patient-scoped queries (e.g. screening keyed to session's patient). Capability spine `@neurocare/permissions` drives workspace visibility; **enforcement never client-side**.
- Admin does not implicitly get clinical powers (separate role sets).

## Security findings & status

| # | Severity | Finding | Status |
|---|---|
| 1 | 🔴 High | **GitHub PAT embedded in NCP `.git/config` remote URL**; token is dead (GitHub API 401; push auth fails) but must still be treated as exposed-then-revoked | **ROTATE + scrub** (user action; documented) |
| 2 | 🟠 Med | NCP staff portals lack MFA + server-side RBAC depth | Blocked from any reuse until NA auth service wired |
| 3 | 🟠 Med | CORS on artifacts server previously rejected same-origin Origin header (broke assets) | ✅ Fixed + verified |
| 4 | 🟡 Low | Demo accounts seeded in local DB (`seed-demo.ts`) | Guarded: LOCAL ONLY, labelled; excluded from prod deploy path |
| 5 | 🟡 Low | Feature flags gate staff shell at build time | Env-driven, documented; server authz unaffected |
| 6 | 🟡 Low | Dev secrets in `backend/.env` | Git-ignored; `.env.example` holds templates only |

## Hardening checklist (target state)
- [ ] Secrets manager (Azure KV / Render env) before prod deploy
- [ ] Rate limiting per-IP+account on auth routes (partially present) — verify config
- [ ] CSP/HSTS headers on portals
- [ ] Dependency + container scan in CI
- [ ] MFA required for staff roles at login (config flag) — schema/routes exist
- [ ] Break-glass workflow (model + routes to build) — spec'd in CONSOLIDATION-PLAN
