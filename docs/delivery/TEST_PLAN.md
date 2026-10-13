# Test plan — Slice 1 and release gates

## Layers implemented in this branch

| Layer | Location | Scope |
|---|---|---|
| Unit / state-machine | existing `packages/*` tests (40) | journey, permissions, flags, timeline, audit, workflow-engine |
| Domain / service | `artifacts/api-server/src/slice/*.test.ts` | full slice flow, permissions, isolation, flags, AI grounding |
| API contract | `artifacts/api-server/src/routes/slice.test.ts` | HTTP contracts, status codes, permission denial, flag kill switch |
| End-to-end (synthetic) | `artifacts/api-server/src/slice/slice-e2e.test.ts` | Part 26 single-scenario, all three personas |
| Accessibility / performance | see `PERFORMANCE_BUDGET.md`; a11y UI checks on workspace branches | |

## Critical scenarios (Part 24) — coverage status

Covered now: 1 referral→intake, 2 intake→assessment, 3 admin assignment, 4 questionnaire intake,
5 document upload (recorded), 6 clinician assessment consultation, 7 assessment outcome,
16 patient message (messaging untouched — not in slice), 17 transcript→approved note,
19 permission denial, 20 feature kill switch, 24 cross-patient access attempt,
25 prompt injection contained in transcript, 21 interrupted-work recovery (version conflicts).

Planned on later branches: 8 diagnosis→titration, 9 monitoring, 10 MDT, 11–13 prescriptions,
14–15 shared care/annual review, 18 complaints, 22 model-provider failure (gateway branch),
23 transcription failure (real transcription branch).

## Release-blocking rule

Failed safety, permission or cross-patient-isolation tests block release. Synthetic data only —
fixtures contain no real patient information (validated by review; enforced by policy).

## Commands

```
./node_modules/.pnpm/node_modules/.bin/vitest run        # all unit+domain+api tests
npx tsc --build                                          # libs strict type-check
npx tsc -p artifacts/neuroassess-web/tsconfig.json --noEmit
npx tsc -p artifacts/api-server/tsconfig.json --noEmit
npx prettier --check docs packages artifacts/**/src      # format gate
```
