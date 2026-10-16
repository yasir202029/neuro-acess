# NeuroCare APEX — Architectural Plan

## Current State (verified)
- **API**: Express + Drizzle + PostgreSQL at `artifacts/api-server`, routes mounted at `/api`
- **Auth**: Supabase JWT, deny-by-default, `authenticate` + `requirePermission` middleware
- **Web**: React 19 + Vite + TanStack Query + Wouter + Tailwind at `artifacts/neuroassess-web`
- **Store**: `DrizzleSliceStore` implemented in `lib/db/src/repository/slice-store.ts` (ts-nocheck, needs wiring)
- **RBAC**: `PlatformRole` + `Permission` in `packages/permissions`, granted per role
- **DB**: 28 Drizzle tables already defined in `lib/db/src/schema/neuroassess.ts`

## Guiding Principles
1. Every visual element connects to a real function/route/API/workflow/persisted state — no demo data
2. Clinical safety independent of commercial incentives
3. AI is assistant, not autonomous clinician — SOURCE → AI PROCESS → DRAFT → HUMAN REVIEW → ACCEPT/EDIT/REJECT → AUTHORITATIVE RECORD
4. Never auto-reject or auto-diagnose from screening — safety-sensitive answers → REVIEW REQUIRED state
5. Never mark invoice PAID from browser state — server-side payment verification
6. Build in functional branches, integrate after each — branch completion gate before merge
7. Synthetic data only for tests — no real patient data
## Domain Layer Plan (new Drizzle tables)

| Table | Purpose |
|-------|---------|
| `patient_onboarding` | Onboarding funnel state (stage, progress, completedAt) |
| `safety_screening` | Safety/suitability screening (answers, status: PASS/REVIEW_REQUIRED) |
| `screening_questionnaire` | Structured screening forms (questionnaireType, version, answers, status) |
| `appointment_booking` | Appointment booking (patientId, clinicianId, slot, mode, status, price) |
| `payment_record` | Payments & invoices (amount, currency, status: PENDING/PAID/FAILED/REFUNDED, stripeIntentId) |
| `patient_vitals` | Patient-entered vitals (recordedBy: PATIENT/CLINICIAN/IMPORTED) |
| `prescription` | APEX RX (medication, dosage, status: DRAFT/REVIEW_REQUIRED/AUTHORISED/ISSUED) |
| `clinical_note_ai_draft` | AI note polishing (originalBody, aiDraft, finalBody, status) |
| `transcription_session` | APEX Listen (status: NOT_RECORDING/CONSENT_REQUIRED/RECORDING/PROCESSING/TRANSCRIPT_AVAILABLE/TRANSCRIPTION_FAILED) |
| `notification` | Notifications (type, channel, status, deliveredAt, readAt) |
| `clinician_earnings` | APEX EARNINGS (clinicianId, appointmentId, amount, status, paidAt) |
| `clinician_star` | APEX STARS (clinicianId, eventType, eventId, starsAwarded, awardedAt) |

## API Route Plan (all under `/api`)

### Public (no auth)
- `GET /api/healthz` — public health (existing)
- `POST /api/auth/register` — patient registration
- `POST /api/auth/login` — patient login (Supabase)
- `GET /api/auth/me` — current user

### Patient (auth: PATIENT role)
- `GET /api/patient/onboarding` — onboarding state + progress
- `POST /api/patient/onboarding` — advance onboarding stage
- `POST /api/patient/safety-screening` — submit screening
- `GET /api/patient/safety-screening` — get screening result
- `POST /api/patient/questionnaires` — submit questionnaire
- `GET /api/patient/questionnaires` — list questionnaires
- `POST /api/patient/appointments` — book appointment
- `GET /api/patient/appointments` — list appointments
- `GET /api/patient/payments` — list payments/invoices
- `GET /api/patient/dashboard` — dashboard data
- `GET /api/patient/titration` — titration hub data
- `POST /api/patient/vitals` — submit vitals
- `GET /api/patient/vitals` — list vitals
- `GET /api/patient/prescriptions` — list prescriptions
- `GET /api/patient/notifications` — list notifications

### Clinician (auth: CLINICIAN role)
- `GET /api/clinician/patients` — patient list
- `GET /api/clinician/patients/:id` — patient 360
- `POST /api/clinician/patients/:id/clinical-notes` — create note
- `POST /api/clinician/patients/:id/assessments` — submit assessment
- `POST /api/clinician/patients/:id/care-plan` — create care plan item
- `GET /api/clinician/queue` — work queue
- `GET /api/clinician/earnings` — earnings panel
- `GET /api/clinician/stars` — stars panel

### Prescriber (auth: CLINICIAN + prescribing scope)
- `POST /api/prescriber/prescriptions` — create prescription
- `PATCH /api/prescriber/prescriptions/:id/authorise` — authorise

### Admin (auth: ADMIN role)
- `GET /api/admin/queue` — operational queue
- `GET /api/admin/earnings` — all clinician earnings

## Web Page Plan

### Public website (`/`)
- Hero, pathways, how it works, treatment, clinicians, pricing, FAQs, security, CTA

### Patient onboarding (`/onboarding`)
- Progressive funnel with progress indicator, safety screening, booking, payment

### Patient portal (`/patient/*`)
- Dashboard, appointments, questionnaires, vitals, prescriptions, reports, messages, documents, payments, profile

### Titration hub (`/patient/titration`)
- Medication, dose, stage, next review, vitals, prescription status

### APEX Live (`/patient/:id/live`)
- Consultation/video, live clinical context, live note, AI assist

### Clinician workstation (`/clinician/*`)
- Overview, patients, queue, earnings, stars

## Implementation Order (feature branches)

1. `feature/apex-db-schema` — Add new Drizzle tables + migrate DB
2. `feature/apex-auth-onboarding` — Public website + patient registration + onboarding funnel
3. `feature/apex-safety-screening` — Safety/suitability screening + questionnaire
4. `feature/apex-booking-payment` — Appointment booking + payment flow
5. `feature/apex-patient-dashboard` — Patient dashboard + titration hub + vitals
6. `feature/apex-clinical-ai` — APEX Listen, Scribe, DIVA, Report Studio, Reply
7. `feature/apex-prescribing` — APEX RX prescription centre
8. `feature/apex-clinician-workstation` — Clinician home screen, earnings, stars
9. `feature/apex-notifications` — Notification system
10. `feature/apex-e2e-test` — End-to-end synthetic patient journey test

## Integration Gates (each branch must pass before merge)
1. Typecheck clean (`pnpm run typecheck:libs`)
2. API tests pass
3. Web tests pass
4. Production build successful
5. Localhost routes verified
6. No regression on existing 63+ tests

