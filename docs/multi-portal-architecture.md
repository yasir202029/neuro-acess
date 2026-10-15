# Multi-portal architecture

Each app in `apps/` is a role-split portal retained behind feature flags as the unified NeuroAssess SPA at `artifacts/neuroassess-web/` reaches parity. All deployment targets are Render web services. `main` is Production, `develop` is Staging, feature branches produce Preview deployments, and UAT is a Render custom environment. Environment values are managed per Render service, not committed.

| App | Intended domain | Role boundary | Deploy target |
|---|---|---|---|
| marketing-site | neuroassess.co.uk | public | Render |
| patient-portal | portal.neuroassess.co.uk | PATIENT | Render |
| clinician-portal | clinician.neuroassess.co.uk | CLINICIAN | Render |
| admin-portal | admin.neuroassess.co.uk | ADMIN, FINANCE, RECEPTIONIST, SUPPORT | Render |
| super-admin-portal | system.neuroassess.co.uk | SUPER_ADMIN | Render |

Domain assignment happens only after the domain is added and verified in Render.
