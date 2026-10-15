# Existing Repository Forensic Review — Index & Method

Inspection date: 2026-10-15. Method: direct source inspection (routes, schemas, fetch calls, git history, runtime verification over HTTP), never filename inference.

## Repositories in scope
1. **neuro-acess** — `~/CodeGPT/neuro-acess` → `github.com/yasir202029/neuro-acess` (canonical candidate; local DB-backed runtime verified)
2. **NeuroCare-Platform** — `~/CodeGPT/neuro-assess` → `github.com/yasir202029/NeuroCare-Platform` (Next.js multi-portal generation)

## Documents
| Document | Purpose |
|---|---|
| [REPOSITORY-INVENTORY.md](REPOSITORY-INVENTORY.md) | Structure, branches, stacks, apps per repo |
| [STATIC-PAGE-AUDIT.md](STATIC-PAGE-AUDIT.md) | Static Page Detector output: screen-by-screen classification |
| [API-INTEGRATION-AUDIT.md](API-INTEGRATION-AUDIT.md) | Which UI calls which API; dead buttons; mock data map |
| [DATABASE-AUDIT.md](DATABASE-AUDIT.md) | Schema, migrations, drift, duplicate entities |
| [AUTHENTICATION-AUDIT.md](AUTHENTICATION-AUDIT.md) | AuthN/AuthZ reality per repo |
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) | Findings incl. the leaked PAT, CORS, flags |
| [REUSABLE-CODE-MAP.md](REUSABLE-CODE-MAP.md) | What migrates where |
| [CONSOLIDATION-PLAN.md](CONSOLIDATION-PLAN.md) | Ordered conversion plan with acceptance criteria |

## Main-branch protection
No changes were made to either repository's `main` during review. All work lives on
`release/azure-platform-hardening` (neuro-acess) or is documentation-only.

## Verified runtime facts at review time
- neuro-acess: local PostgreSQL `neurocare_dev`, 85 tables migrated; real login (JWT) verified; ADHD screening submit (201 persisted), assessment create, workflow advance, patient→workflow 403 RBAC, audit rows written — all over live HTTP.
- NeuroCare-Platform: portals render but are UI-prototype driven (see STATIC-PAGE-AUDIT).
- Deployment: **BLOCKED** — the PAT in NCP's `.git/config` is invalid/revoked (GitHub API 401; git push auth failed). Local recovery artifacts created: `~/Desktop/neuro-acess-release-bundle.bundle` + `~/Desktop/release-hardening-4b47f10.patch`.
