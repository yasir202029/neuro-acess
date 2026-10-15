# Security Audit

(Full findings in AUTHENTICATION-AUDIT.md §Security findings — combined here for the review index.)

## Critical / high

1. 🔴 **Exposed credential material**: GitHub PAT embedded in `~/CodeGPT/neuro-assess/.git/config` remote URL (NeuroCare-Platform). Token is dead (GitHub API 401 for all auth schemes) but policy requires rotation + history scrub. **Owner action required.** Redacted everywhere in this repo's docs; never written to files.

## Medium

2. 🟠 NCP staff portals: no MFA, shallow server-side RBAC, session-cookie auth → **blocked from reuse** until canonical NA auth service is wired.
3. 🟠 NCP: no CI, no dependency scanning, near-zero tests → supply-chain risk if ever deployed as-is.
4. 🟠 NA artifacts API: CORS hardening applied (same-origin allow + env allow-list) after same-origin asset rejection was found and fixed.

## Low / hygiene

5. 🟡 Demo accounts in local dev DB — clearly labelled, LOCAL ONLY, not in deploy path.
6. 🟡 Build-time feature flags (`NEUROCARE_FLAG_*`) — rendering only; server authz independent and enforced per request.
7. 🟡 Local dev secrets in git-ignored `backend/.env`; templates only in `.env.example`.

## Verified positive controls (NA backend)

- JWT access/refresh rotation + revocable sessions; email-verification gate on login (live-verified)
- bcrypt(12) + password complexity policy
- TOTP/email MFA enrolment + challenges; lockout; login history; security alerts
- Deny-by-default `requireRole` on protected routes; patient-scoped queries; patient→clinician action = 403 (live-verified)
- Append-only `AuditEvent` with middleware on sensitive routes (live-verified rows)
- Zod validation at API boundaries; central error contract
- Rate limiting present on auth surface (verify per-route config in hardening pass)

## Pre-production gate checklist
- [ ] PAT rotated & scrubbed (owner)
- [ ] Secrets via env manager; none in Git (currently satisfied locally)
- [ ] Staff MFA enforcement enabled (flag)
- [ ] Rate-limit review on all auth routes
- [ ] CSP/HSTS on served origins
- [ ] Dependency/container scanning wired in CI
- [ ] Break-glass emergency access workflow (build; spec'd)
- [ ] Backup/restore drill documented
