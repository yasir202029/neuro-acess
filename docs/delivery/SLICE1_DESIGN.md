# Slice 1 — referral → assessment: vertical-slice design

> The single end-to-end workflow from Part 26. Synthetic data only: no real microphone,
> no live model, no real patients.

## Problem statements

1. **P1** Nothing works end-to-end: API endpoints return `503 CLINICAL_STORAGE_UNAVAILABLE`
   while the SPA masks this with demo data. No user can complete a real job; clinical safety
   cannot be evaluated.
2. **P2** No single demonstrated journey spans patient, admin and clinician with permissions,
   flags, timeline and audit. The "one platform" claim is unverified.

## User flows

- **Patient:** "I think I have ADHD — I want an assessment." Requests it once, sees
  plain-language status, completes intake questionnaires, uploads documents, later sees outcome.
- **Admin:** "A referral arrived — validate it, book the first appointment, assign a clinician."
  Queue view, request missing information, every action audited.
- **Clinician:** "A case is ready." Starts intake → assessment, records synthetic consent, runs
  the synthetic consultation, reviews the AI draft against evidence, signs it, records outcome.
  Cannot sign anything unsupported.

## Slice sequence (system steps)

1. Patient `POST /api/slice/referrals` → REQUEST_ASSESSMENT → LEAD + task + timeline + audit.
2. Admin `GET /api/slice/referrals` queue; `POST .../validate` → VALIDATED (or `/request-info`).
3. Admin `POST .../book` → BOOK_APPOINTMENT → BOOKED.
4. Admin `POST .../assign` → TRIAGE_CASE (assignedClinicianId) → TRIAGE.
5. Clinician `POST .../start-intake` → START_INTAKE → INTAKE.
6. Patient `POST .../intake` (answers + questionnaire scores + documents) → intake completed.
7. Clinician `POST .../start-assessment` → START_ASSESSMENT → ASSESSMENT (blockers enforced).
8. Clinician `POST .../consent` → consent record (wording version, purpose, who, when).
9. Clinician `POST .../transcript` → synthetic speaker-labelled timestamped segments
   (LISTENING→STOPPED→PROCESSING→DRAFT_READY); `POST .../bookmarks` for key moments.
10. Clinician `POST .../draft` → engine returns `AI_DRAFT_REQUIRES_CLINICIAN_REVIEW` with
    per-statement provenance, missing information, contradictions.
11. `POST /slice/drafts/:id/amend` then `/approve` → 422 if any UNSUPPORTED statement or
    unreviewed conflict; otherwise versioned signed note + `CLINICAL` audit.
12. Clinician `POST .../outcome` → RECORD_ASSESSMENT_OUTCOME → DIAGNOSIS_REVIEW (signed note
    required first).
13. Patient `GET /api/slice/patient/:id/status` → plain-language status (own record only).
14. Admin `GET /api/slice/audit` (`audit:read`) → full history.
## API contracts (all under `/api`, all authenticated)

| Method/Path | Permission | Flag | Success | Key errors |
|---|---|---|---|---|
| `POST /slice/referrals` | `patient:write` | `referralWorkflow` | 201 `{referral, patientId, journey}` | 403, 400 |
| `GET /slice/referrals` | `assessment:read` | `referralWorkflow` | 200 `{referrals[]}` | 403 |
| `POST /slice/referrals/:id/validate` | `patient:write` | `referralWorkflow` | 200 `{referral}` VALIDATED \| MISSING_INFORMATION | 404, 409 |
| `POST /slice/referrals/:id/book` | `appointment:manage` | `referralWorkflow` | 200 `{journey}` | 409 stage conflict |
| `POST /slice/referrals/:id/assign` | `user:manage` | `referralWorkflow` | 200 `{journey}` | 400 unknown clinician |
| `POST /slice/referrals/:id/start-intake` | `clinical:write` | `intakeWorkflow` | 200 `{journey}` | 409 blocked |
| `POST /slice/referrals/:id/intake` | `patient:write`, own record | `intakeWorkflow` | 200 `{intake}` | 403 cross-patient |
| `POST /slice/referrals/:id/start-assessment` | `clinical:write` | `adhdAssessmentWorkflow` | 200 `{journey}` | 409 blockers listed |
| `POST /slice/referrals/:id/consent` | `clinical:write` | `consultationTranscription` | 201 `{consent}` | 409 duplicate |
| `POST /slice/referrals/:id/transcript` | `clinical:write` | `consultationTranscription` | 201 `{segments,state}` | 409 consent missing |
| `POST /slice/referrals/:id/bookmarks` | `clinical:write` | `consultationTranscription` | 201 `{bookmark}` | 404 |
| `POST /slice/referrals/:id/draft` | `ai:use` | `clinicalAiEnabled`+`clinicalNoteDrafting` | 201 `{draft}` | 403, 409 consent |
| `POST /slice/drafts/:id/amend` | `clinical:write` | `clinicalNoteDrafting` | 200 `{draft}` | 409 signed |
| `POST /slice/drafts/:id/approve` | `clinical:write` | `clinicalNoteDrafting` | 201 `{note}` | **422** unsupported/conflict |
| `POST /slice/referrals/:id/outcome` | `clinical:write` | `careJourneyEngine` | 200 `{journey}` | 409 no signed note |
| `GET /slice/patient/:id/status` | own record or `patient:read` | – | 200 `{stage, plainStatus, nextAction}` | 403 cross-patient |
| `GET /slice/timeline/:patientId` | `patient:read` + clearance | `unifiedPatientTimeline` | 200 `{events[]}` filtered | 403 |
| `GET /slice/audit` | `audit:read` | – | 200 `{events[]}` | 403 |

Error envelope `{error, code?}`; codes: `FEATURE_DISABLED`, `JOURNEY_REJECTED`,
`UNSUPPORTED_STATEMENTS`, `CROSS_PATIENT_DENIED`.

## Database changes (additive migration)

Tables (Drizzle in `lib/db/src/schema/neuroassess.ts`; SQL in
`lib/db/migrations/0001_slice1_referral_to_assessment.sql`): `referrals`, `journey_states`,
`journey_transitions`, `timeline_events`, `consultation_consents`, `transcript_segments`,
`ai_drafts` (signed notes reuse existing `clinical_notes`).

Command: `pnpm --filter @workspace/db push` — **not run here (no database reachable)**; the SQL
file is the reviewed artefact (gap register).

**Runtime persistence in this branch:** in-memory `SliceStore` behind a narrow port (synthetic,
single process). Drizzle-backed implementation is the first follow-up — documented, not claimed.

## AI data flow

```
consent verified → transcript segments + intake record (minimum necessary context)
  → deterministic drafting engine (stands in for the model gateway seam)
  → statements[{classification, sources[]}] + missing[] + conflicts[]
  → grounding check: every statement must cite existing sources, else UNSUPPORTED
  → safety layer: no medication/diagnosis conclusions; embedded instructions are data only
  → stored AI_DRAFT_REQUIRES_CLINICIAN_REVIEW → clinician review → approve/sign
```

Evidence classes: `DIRECT_TRANSCRIPT`, `STRUCTURED_RECORD`, `CLINICIAN_ENTERED`, `CALCULATED`,
`TEMPLATE_LANGUAGE`, `AI_SYNTHESIS` (≥1 source required), `UNSUPPORTED` (blocks approval).

## Failure behaviour

- Store failure → 503 `CLINICAL_STORAGE_UNAVAILABLE` (existing convention); no partial writes.
- Journey rejection → 409 typed rejection kind; nothing persisted (runTransition atomic).
- Flag disabled mid-flow → 403 `FEATURE_DISABLED`; already-completed records remain valid.

