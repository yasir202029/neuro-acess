# Delivery plan — branches, commits, flags, permissions, journey, rollback

## 1. Branch status

| Branch | Status |
|---|---|
| `chore/neuroassess-repository-lock` | done (identity + ADR 0001, on `main` history) |
| `feat/capability-permissions` | done (`ba96aea`) |
| `feat/care-journey-engine` | done (`9774f65`, `a478ac2`) |
| `feat/unified-application-shell` | done (`283b902`, `f5fda81`, `a46d133`) |
| `feat/slice1-referral-to-assessment` | **current** — first vertical slice (server spine) |
| `feat/patient-workspace` … `hardening/*` | planned, one at a time (Part 5 sequence) |

## 2. Commit plan for `feat/slice1-referral-to-assessment`

1. `docs(delivery): slice-1 artefacts — audit, plans, gaps`
2. `feat(flags): canonical flag catalogue + server flag enforcement`
3. `feat(db): slice-1 schema — referrals, journey, timeline, consent, transcript, AI drafts`
4. `feat(slice): referral-to-assessment domain — store, workflow ports, services` + domain tests
5. `feat(slice): clinical AI drafting engine — provenance, missing info, contradictions` + tests
6. `feat(slice): HTTP routes — referral, intake, consultation, draft review, outcome` + tests
7. `test(slice): end-to-end vertical slice scenario` (synthetic, all three personas)

## 3. Feature-flag plan

Resolution (implemented in `@neurocare/feature-flags`, enforced server-side by
`api-server/src/security/flags.ts`): kill switch → env → org → capability → user → rollout →
default. `NEUROCARE_KILL_SWITCH=on` forces **every** flag OFF. `NEUROCARE_FLAG_<UPPER_SNAKE>=on|off`
sets the env layer. Privileged flag changes require capability + reason + audit (admin control
surface is a later branch — gap register).

Catalogue changes in this branch (no external consumers existed; verified by grep):

- renames to canonical Part 6 names: `workflowAutomation→careJourneyEngine`,
  `mdtEscalation→mdtWorkflow`, `titrationSafetyBranching→titrationWorkflow`,
  `advancedMonitoring→physicalHealthMonitoring`, `complaintManagement→complaintsWorkflow`.
- additions: `referralWorkflow`, `intakeWorkflow`, `adhdAssessmentWorkflow`,
  `autismAssessmentWorkflow`, `diagnosisWorkflow`, `prescribingWorkflow`, `courierTracking`,
  `videoConsultations`, `clinicalAiEnabled`, `consultationTranscription`,
  `liveConsultationAssistant`, `clinicalNoteDrafting`, `adhdReportDrafting`,
  `autismReportDrafting`, `messageReplyDrafting`, `titrationNoteDrafting`,
  `clinicalLetterDrafting`, `transcriptEvidenceReview`, `contradictionDetection`,
  `missingInformationDetection`, `aiSafetyLayer`, `localModelProvider`,
  `approvedCloudModelProvider`, `aiAuditReview`.

Slice flags enforced server-side on their endpoints: `referralWorkflow`, `intakeWorkflow`,
`adhdAssessmentWorkflow`, `careJourneyEngine`, `consultationTranscription`,
`clinicalNoteDrafting`, `clinicalAiEnabled`. Production defaults are OFF for every
development-default flag (resolver behaviour, tested).

## 4. Permission matrix (slice scope)

| Action | PATIENT | ADMIN | CLINICIAN | FINANCE | RECEPTIONIST |
|---|---|---|---|---|---|
| Request assessment (own record) | ✔ `patient:write` | ✔ | ✔ | ✗ | ✗ |
| Read referral queue | ✗ | ✔ `assessment:read` | own caseload only | ✗ | ✗ |
| Validate registration / request info | ✗ | ✔ `patient:write` | ✗ | ✗ | ✗ |
| Book first appointment | own | ✔ `appointment:manage` | ✔ | ✗ | ✔ |
| Assign clinician (TRIAGE_CASE) | ✗ | ✔ `user:manage` | ✗ | ✗ | ✗ |
| START_INTAKE / START_ASSESSMENT | ✗ | ✗ | ✔ `clinical:write` | ✗ | ✗ |
| Submit intake/questionnaires/docs | own ✔ | ✗ | ✗ | ✗ | ✗ |
| Record consent, ingest transcript | ✗ | ✗ | ✔ `clinical:write` | ✗ | ✗ |
| Generate AI draft | ✗ | ✗ | ✔ `ai:use` + flags | ✗ | ✗ |
| Edit/approve/sign draft | ✗ | ✗ | ✔ `clinical:write` | ✗ | ✗ |
| Record assessment outcome | ✗ | ✗ | ✔ `clinical:write` (clinical auth) | ✗ | ✗ |
| Read patient plain-language status | own ✔ | ✔ `patient:read` | ✔ `patient:read` | ✗ | ✔ |
| Read audit history | ✗ | ✔ `audit:read` | ✗ | ✗ | ✗ |

All checks run server-side (`requirePermission` + service-layer record scoping); UI hiding is
never the control. Cross-patient access is denied in the service layer, not only by role.
## 5. Journey-transition table (slice path)

| # | Command | From → To | Capability | Blocking | Clinical auth | Actor in slice |
|---|---|---|---|---|---|---|
| 1 | REQUEST_ASSESSMENT | – → LEAD | `patient:write` | – | no | patient |
| 2 | BOOK_APPOINTMENT | LEAD → BOOKED | `appointment:manage` | – | no | admin |
| 3 | TRIAGE_CASE | BOOKED → TRIAGE | `user:manage` | – | no | admin (assigns clinician) |
| 4 | START_INTAKE | TRIAGE → INTAKE | `clinical:write` | assigned clinician | no | clinician |
| 5 | (intake data) | stage unchanged; `hasIntakeCompleted` set by patient submissions | – | – | – | patient |
| 6 | START_ASSESSMENT | INTAKE → ASSESSMENT | `clinical:write` | assigned + intake completed | no | clinician |
| 7 | RECORD_ASSESSMENT_OUTCOME | ASSESSMENT → DIAGNOSIS_REVIEW | `clinical:write` | signed note required first (service layer) | **yes** | clinician |

All transitions execute through `runTransition` (port-based, optimistic concurrency, immutable
transition record, generated tasks, timeline event, audit event, notifications queued). UI never
sets a stage directly.

## 6. Rollback plan (branch-level)

- **Flag rollback:** `NEUROCARE_KILL_SWITCH=on` (or per-flag `NEUROCARE_FLAG_*=off`) disables
  slice endpoints immediately (403 `FEATURE_DISABLED`) — no deploy required.
- **Code rollback:** `git revert` of the branch commits. Schema change is additive-only
  (`CREATE TABLE IF NOT EXISTS`); rollback SQL drops only the slice-1 tables, see
  `docs/delivery/ROLLBACK_PLAN.md`.
- **Legacy behaviour:** pre-existing `503 CLINICAL_STORAGE_UNAVAILABLE` endpoints are untouched
  by this branch, so rollback restores exactly the pre-slice behaviour.

