# Performance budget

## Budgets (p95 unless stated)

| Interaction | Budget | Measurement in this branch |
|---|---|---|
| API slice mutation (in-memory store) | < 50 ms server time | measured by test-suite wall time (see below) |
| Journey transition (plan + apply + effects) | < 20 ms | included in domain tests |
| Draft generation (synthetic engine) | < 100 ms | timed in AI tests |
| Timeline query (≤1k events, filtered) | < 30 ms | timed in timeline tests |
| SPA initial JS | ≤ 550 kB raw / ≤ 160 kB gzip | **525.31 kB raw / 147.82 kB gzip** (vite build, measured) |
| Full test suite (all layers) | < 10 s | **measured each run; see test evidence** |

## Rules that hold under budget pressure

- No clinical data cached client-side beyond the request lifecycle without explicit policy.
- Authorisation is never skipped for speed; every read path filters visibility server-side.
- Future lists (queues, timeline) use cursor pagination + virtualisation when >200 rows —
  interface is ready (events are cursor-ordered by `occurredAt, recordedAt, id`).

## Honest statement

Only build size and test-suite duration are measured on real hardware in this environment.
Server latency against a real database is **not yet measurable** (no database reachable) —
recorded as a production-readiness gap rather than claimed.
