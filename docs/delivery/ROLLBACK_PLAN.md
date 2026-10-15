# Rollback plan — slice 1

## 1. Immediate kill (no deploy)

```
NEUROCARE_KILL_SWITCH=on        # disables ALL feature flags server-side
# or per-capability:
NEUROCARE_FLAG_REFERRAL_WORKFLOW=off
NEUROCARE_FLAG_CONSULTATION_TRANSCRIPTION=off
NEUROCARE_FLAG_CLINICAL_NOTE_DRAFTING=off
```

Every slice endpoint returns 403 `FEATURE_DISABLED` once its flag resolves off. Existing records
remain readable by authorised staff (kill switch never destroys or hides completed clinical work
from its owners — read paths for signed notes stay available to clinicians).

## 2. Code rollback

```bash
git revert <slice-branch-sha-range>   # branch contains only additive changes
pnpm install && pnpm run typecheck && <test command>
```

No legacy endpoint was modified by this branch (verified: pre-existing 503 routes untouched),
so a plain revert restores exact prior behaviour.

## 3. Schema rollback (only if the migration was applied)

The migration is additive (`CREATE TABLE IF NOT EXISTS`). To roll back:

```sql
DROP TABLE IF EXISTS ai_drafts;
DROP TABLE IF EXISTS transcript_segments;
DROP TABLE IF EXISTS consultation_consents;
DROP TABLE IF EXISTS timeline_events;
DROP TABLE IF EXISTS journey_transitions;
DROP TABLE IF EXISTS journey_states;
DROP TABLE IF EXISTS referrals;
```

**Warning:** drops clinical data (consents, transcripts, signed-draft provenance). Only run after
clinical governance sign-off and export of affected records. Default advice: keep the tables and
disable via flags instead.

## 4. Data-recovery note

`journey_transitions` and `timeline_events` are append-only; `clinical_notes` versions are
immutable once signed. Recovery = re-disable flags, restore process, no data repair required for
in-memory store (synthetic only; resets on restart by design in this branch).
