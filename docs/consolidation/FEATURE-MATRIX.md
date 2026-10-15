# Cross-Repository Feature Matrix & Best-of-Breed Selections

Legend: ✅ COMPLETE · 🟨 PARTIAL · 🧪 PROTOTYPE · ❌ MISSING · 💥 BROKEN · ♻ DUPLICATE · 🕰 LEGACY · 🔍 NEEDS_REVIEW
Columns: **NA** = neuro-acess (canonical candidate) · **NCP** = NeuroCare-Platform

## Feature matrix (verified by inspection, not file counts)

| Feature | NA (neuro-acess) | NCP (NeuroCare-Platform) | Canonical decision |
|---|---|---|---|
| Authentication | ✅ bcrypt+JWT rotation+TOTP/email MFA+lockout+session mgmt+login history | 🟨 session cookies, no MFA | **KEEP NA** — port to any Next.js apps as shared service |
| Patient registration | ✅ register+verify+password-reset API | 🟨 UI present, backend thinner | KEEP NA |
| Patient dashboard | ✅ SPA workspace (flag-gated) | ✅ dedicated patient-portal app | MERGE: NA logic + NCP app shell pattern |
| ADHD assessment | ✅ backend module + screening persistence + workflow states | 🟨 module present, less depth | KEEP NA |
| ASD assessment | ✅ backend module | 🟨 | KEEP NA |
| Questionnaires | ✅ ScreeningResponse persistence | 🟨 | KEEP NA |
| Appointments | ✅ booking module + status machine | 🟨 | KEEP NA |
| Clinician dashboard | ✅ SPA work queue | ✅ dedicated clinician-portal app | MERGE (as above) |
| Admin dashboard | 🟨 admin routes only | ✅ dedicated admin-portal app | MERGE |
| Super admin | ❌ | ✅ super-admin-portal app | KEEP NCP shell, wire to NA auth/RBAC |
| Patient record / 360 | 🟨 data model complete, UI partial | 🟨 | BUILD on NA data + Clarity DS |
| Clinical notes | ✅ create/sign/audit routes | 🟨 | KEEP NA |
| Titration | ✅ MedicationReview + workflow routes | 🟨 | KEEP NA |
| Medication | ✅ schema + routes | 🟨 | KEEP NA |
| Physical monitoring | 🟨 Observation model present | 🟨 | NEEDS_REVIEW (both) |
| Prescriptions | ✅ PrescriptionRequest model + routes | 🟨 | KEEP NA |
| Risk / safeguarding | 🟨 model present | ❌ | BUILD on NA |
| Messaging | ✅ MessageThread/Message + routes | ✅ | ♻ duplicate → KEEP NA, retire NCP messaging UI |
| Documents | 🟨 schema present | 🟨 | NEEDS_REVIEW |
| Letters | ❌ | ❌ | BUILD (Secure Document Studio) |
| MDT | ✅ MDTReview model | ❌ | KEEP NA, build UI |
| Tasks | ✅ Task model | 🟨 | KEEP NA |
| Finance/payments | ✅ Stripe integration + invoices + plans + failed-payments | 🟨 similar but thinner | ♻ → KEEP NA |
| Reports | ✅ reports module + AI drafts | 🟨 | KEEP NA |
| Audit logging | ✅ AuditEvent + middleware, append-only | 🟨 basic | KEEP NA |
| Permissions/RBAC | ✅ capability spine (@neurocare/permissions) + role middleware | 🟨 role middleware only | KEEP NA |
| Notifications | ✅ service + package | 🟨 | KEEP NA |
| Mobile app | 🟨 Expo single-screen (consent demo) | ✅ Expo multi-screen | KEEP NCP screens, port onto NA conventions |
| Public website | ✅ marketing pages in SPA | ✅ marketing-site app | MERGE: keep NA SEO-consolidated SPA for launch; NCP site optional split later |
| Responsive UI | ✅ | ✅ | equal |
| Accessibility | ✅ Clarity DS (WCAG 2.2 AA patterns, tested) | 🟨 primitives, untested | KEEP NA (Clarity) |
| Database | ✅ 85-table schema + migrations applied | 🟨 fewer models, no migrations dir | KEEP NA |
| API | ✅ 2 API generations documented | ✅ 101 routes | KEEP NA clinical API; keep artifacts intake engine as gateway module |
| Testing | ✅ vitest suites passing (49 tests) | 💥 almost none | KEEP NA |
| Deployment | ✅ render.yaml + CI | ❌ | KEEP NA |
| Workflow engine | ✅ typed packages (journey/workflow-engine/timeline) | ✅ engine.ts in design-system | ♻ → KEEP NA packages; port NCP engine ideas |

## Best-of-Breed module selections (with required work)

| Module | Source | Target | Reason | Required work |
|---|---|---|---|---|
| AuthN/AuthZ | NA `backend/src/modules/auth` + `@neurocare/permissions` | canonical | MFA, rotation, lockout, capability spine | Expose as service to any Next.js portals |
| Clinical backend | NA `backend/` (18 modules, 85 tables) | canonical | depth, tests, migrations | None — already live locally |
| Marketing/public | NA SPA pages | canonical (launch) | single deploy, already styled | SEO pass |
| Portal separation pattern | NCP `apps/{clinician,admin,super-admin}-portal` | reference | clean URL/role separation | Re-create as NA-hosted routes or subdomains serving NA API; **no NCP auth** |
| Mobile screens | NCP `apps/mobile` | NA `apps/mobile` | richer screens | Port components; align to NA API + Clarity tokens |
| Workflow engine ideas | NCP `packages/design-system/engine.ts` | NA `@neurocare/workflow-engine` | ideas only | Compare APIs; port missing concepts with tests |
| Design system | NA `packages/clarity` (Clarity) | canonical | tokens, 40 named components, a11y tests | Continue integration into workspaces |
| AI drafting | NA `backend/src/modules/ai` | canonical | human-review gating | Add provenance panel UI |

## Duplicate / legacy register (delete after verified replacement)

| Item | Where | Replacement | Evidence required before deletion |
|---|---|---|---|
| NCP messaging UI + routes | NCP repo | NA messaging module | NA messaging E2E on portals |
| NCP billing routes | NCP repo | NA billing (Stripe) | Payment E2E |
| NCP auth/session code | NCP repo | NA auth service | Portal login via NA JWT |
| artifacts/api-server vs backend duplication | NA repo (both kept intentionally) | gateway unification | Route map doc + smoke tests |

## Security actions (blocking for any merge)

1. **Rotate the GitHub PAT** found in NCP's `.git/config`; re-clone using credential helper. Never store tokens in remote URLs.
2. Add MFA enforcement to any portal reused from NCP before it touches NA backend.
3. NCP has no migrations — never apply its schema to the canonical DB; map entities to NA migrations instead.

## Canonical architecture (post-consolidation)

```
                 CLARITY / NEUROCARE PLATFORM (canonical = neuro-acess)
                                Secure Backend (Express + Prisma + RBAC + Audit)
                    ┌───────────────────────┼───────────────────────┐
        Patient Experience        Clinician Workspace      Admin Workspace
        (mobile + web)            (clarity UI + API)       (clarity UI + API)
                              Shared API (/api/v1)
                        PostgreSQL · Documents · Audit · Jobs
```

Portal separation (clinician./admin./patient. subdomains) is an **application-routing** concern served by the canonical backend; changing a URL never changes authorisation, which is enforced server-side per request.
