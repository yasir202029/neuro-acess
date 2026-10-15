# Database Audit

## Canonical database — NA `backend/prisma/schema.prisma`

- PostgreSQL, Prisma ORM, **85 tables**, initial migration applied to local `neurocare_dev` (user `neurocare`, scoped privileges).
- Verified live: `User`, `Patient`, `Clinician`, `PatientAssignment`, `Team`, `Assessment`(+`AdhdAssessment`/`AutismAssessment`), `ScreeningResponse`, `MedicationReview`, `Appointment`, `MessageThread`/`Message`, `AuditEvent`, `Role`/`RoleAssignment`/`Permission`/`RolePermission`, `Consent`, `Invoice`, `MfaMethod`/`MfaChallenge`, `UserSession`, `ClinicalNote`, `PrescriptionRequest`, `Observation`, `RiskAssessment`, `SafeguardingRecord`, `Task`, `MdtReview`, `Notification`.
- Conventions: UUID/cuid ids, createdAt/updatedAt, enum state machines (`AssessmentStatus`, `AppointmentStatus`, `MessageStatus`, prescription lifecycle), append-only `AuditEvent`.
- Seed: org permissions/teams (`seed.ts`) + clearly-synthetic demo accounts (`seed-demo.ts`, LOCAL ONLY).

## NCP database

- Prisma schema, fewer models, **no migrations directory** → schema drift risk; entity names overlap NA (User, Patient, Clinician, Assessment…) but shapes differ.
- **Decision (FEATURE-MATRIX):** never apply NCP schema to canonical DB. Map overlapping entities to NA migrations before any data migration; NA schema wins.

## Duplicate-entity mapping (NA ← NCP)

| Entity | NCP equivalent | Mapping note |
|---|---|---|
| `User` | `User` | Merge on email; NA fields superset (MFA, status, sessions) |
| `Patient` | `Patient` | NA carries assignments/consent — keep NA |
| `Assessment`+type tables | single `Assessment` variants | NA typed tables win |
| `MessageThread/Message` | similar | Keep NA; migrate NCP content only if real data exists (none observed) |

## Data findings
- No real patient data present in either local checkout (verified: demo seeds only).
- Local DB credentials are dev-only, in git-ignored `backend/.env`.
