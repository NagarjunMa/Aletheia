# Aletheia Eval Log

Weekly ritual: every Monday morning, run all 6 queries in
`.claude/eval-queries.sql` against production Supabase, paste numbers below.
One-line entries. No commentary unless decision required.

## Cadence

| When | Action |
|------|--------|
| Every Monday | Run Q1–Q6, log numbers below |
| After any prompt change | Bump `PROMPT_VERSION` in `lib/ai/prompts/linkedin-connection.ts` BEFORE merging |
| 1 week after prompt change | Run Q4, compare new version vs previous |

## Decision Rules

- **Q1/Q5 weekly approval drop >= 10% for 3 days** → revert latest prompt change. Investigate.
- **Q4 new prompt version approval_pct < previous - 10%** → revert prompt before further iteration.
- **Q3 user with < 30% approval over >= 5 events** → outreach for interview.
- **Q6 p95 latency > 8000ms** → check Claude API status + retry/timeout behaviour.

## Entries

### 2026-MM-DD — Week N
- Q1 overall approval: __% (linkedin_connection __%, cold_email __%, linkedin_inmail __%)
- Q2 top rejection reason: ___ (___ count)
- Q4 prompt versions seen: 1.0.0 (__%), ...
- Q5 weekly trend: ___ events, __% approval
- Q6 p50/p95 generation latency: ___/___ ms
- Decision: _hold / tune prompt for X / outreach user Y_

---

*Backfill template — copy this block each Monday.*
