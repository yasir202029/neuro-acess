# Clinical platform foundation

This change creates the security boundary required before storing clinical records.

- Roles are defined in `artifacts/api-server/src/security/roles.ts`.
- API routes except `/api/healthz` require a valid Supabase access token and an assigned role in token app metadata.
- The migration adds clinics and memberships, clinic isolation indexes, and Supabase RLS policies. Apply it from an environment that can reach the database; this repository does not run live migrations.
- `SUPABASE_SERVICE_ROLE_KEY`, database URLs, provider keys, and payment credentials remain server-only and must be set in the Render service environment settings. Never set their values in source control.

Before enabling clinician or patient data entry, add role-specific RLS write policies, replace the prototype route arrays with database-backed repositories, and test tenant-isolation using two clinics.

## EHR workflow boundary

`0002_ehr_records.sql` adds empty clinical-note and diagnosis tables with tenant isolation. The API defines authenticated, audited EHR endpoints but deliberately returns `501` until a database-backed repository is implemented and tested against the configured Supabase database. This prevents accidental storage of clinical content in prototype in-memory routes.
