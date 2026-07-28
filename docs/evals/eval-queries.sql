-- Aletheia evaluation queries
-- ============================================================================
-- ALETHEIA EVAL QUERIES
-- ============================================================================
-- Run in Supabase SQL Editor. Bookmark each as a saved query for the weekly
-- Monday ritual. See docs/evals/eval-log.md for the cadence and decision rules.
--
-- Schema: user_feedback table has columns user_id, feedback_type
-- ('approved'/'rejected'), rating (1-5), comment (rejectionReason),
-- metadata JSONB { category, message_length, has_subject, promptVersion,
-- model, temperature, intent, generationTimeMs, inputTokens, outputTokens }
-- ============================================================================


-- ─── Q1. Daily approval rate by category (last 30 days) ────────────────────
-- USE: north-star regression detector. Run after every prompt change.
-- WATCH: drop >=10% in approval_pct for 3 consecutive days = regression.
SELECT
  COALESCE(metadata->>'category', 'unknown')          AS category,
  DATE_TRUNC('day', created_at)::date                 AS day,
  COUNT(*) FILTER (WHERE feedback_type = 'approved')  AS approved,
  COUNT(*)                                            AS total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE feedback_type = 'approved')
    / NULLIF(COUNT(*), 0), 1
  ) AS approval_pct
FROM user_feedback
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category, day
ORDER BY day DESC, category;


-- ─── Q2. Rejection reason breakdown (last 14 days) ─────────────────────────
-- USE: pick the next prompt-tuning lever.
-- ACTIONS:
--   too_formal dominant  → lower formality lexicon in system prompt
--   too_generic dominant → tighten grounding rules, force profile reference
--   wrong_tone dominant  → re-examine category-specific tone guidance
SELECT
  COALESCE(metadata->>'category', 'unknown') AS category,
  comment                                    AS rejection_reason,
  COUNT(*)                                   AS n
FROM user_feedback
WHERE feedback_type = 'rejected'
  AND created_at > NOW() - INTERVAL '14 days'
GROUP BY category, comment
ORDER BY n DESC;


-- ─── Q3. Per-user approval rate (retention proxy) ──────────────────────────
-- USE: identify users likely to churn. Outreach / interview them.
-- THRESHOLD: < 30% approval over >= 5 feedback events = churn risk.
SELECT
  user_id,
  COUNT(*)                                              AS feedback_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE feedback_type = 'approved')
    / COUNT(*), 1
  )                                                     AS approval_pct,
  MAX(created_at)                                       AS last_feedback
FROM user_feedback
GROUP BY user_id
HAVING COUNT(*) >= 5
ORDER BY approval_pct ASC
LIMIT 20;


-- ─── Q4. Approval rate by prompt version (REGRESSION DETECTOR) ─────────────
-- USE: validate every prompt change. Compare new version vs previous.
-- DECISION RULE:
--   new approval_pct < old approval_pct - 10%  → revert prompt
--   new approval_pct >= old approval_pct       → keep + ship
SELECT
  COALESCE(metadata->>'promptVersion', 'unversioned') AS prompt_version,
  COALESCE(metadata->>'category', 'unknown')          AS category,
  COUNT(*)                                            AS samples,
  COUNT(*) FILTER (WHERE feedback_type = 'approved')  AS approved,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE feedback_type = 'approved')
    / NULLIF(COUNT(*), 0), 1
  ) AS approval_pct,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM user_feedback
WHERE metadata->>'promptVersion' IS NOT NULL
GROUP BY prompt_version, category
ORDER BY first_seen DESC, category;


-- ─── Q5. Weekly trend (single-number sanity check) ─────────────────────────
-- USE: look Monday morning. One row per week. The number.
SELECT
  DATE_TRUNC('week', created_at)::date                 AS week,
  COUNT(*)                                             AS total_feedback,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE feedback_type = 'approved')
    / COUNT(*), 1
  ) AS overall_approval_pct
FROM user_feedback
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY week
ORDER BY week DESC;


-- ─── Q6. Generation latency p50 / p95 by category (last 7 days) ────────────
-- USE: spot upstream Claude slowdowns. Drift > 30% = investigate.
SELECT
  COALESCE(metadata->>'category', 'unknown') AS category,
  COUNT(*)                                   AS samples,
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY (metadata->>'generationTimeMs')::int) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (metadata->>'generationTimeMs')::int) AS p95_ms,
  MAX((metadata->>'generationTimeMs')::int)  AS max_ms
FROM user_feedback
WHERE metadata->>'generationTimeMs' IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY category;
