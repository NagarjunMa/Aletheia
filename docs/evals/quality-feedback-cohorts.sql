-- Read-only exploratory aggregate. No private comment, style, source or draft is selected.
-- Client-echoed metrics are unverified. This query never activates a feature.
WITH eligible AS (
  SELECT f.user_id, f.created_at, f.feedback_type,
    f.metadata->>'category' AS category,
    f.metadata->>'promptVersion' AS prompt_version,
    f.metadata->>'model' AS model,
    f.metadata->'quality'->>'archetype' AS archetype,
    row_number() OVER (
      PARTITION BY f.user_id, f.metadata->>'category', f.metadata->>'promptVersion',
        f.metadata->>'model', f.metadata->'quality'->>'archetype'
      ORDER BY f.created_at, f.id
    ) AS contribution
  FROM public.user_feedback f
  JOIN public.user_preferences p ON p.user_id=f.user_id AND p.share_analytics IS TRUE
  WHERE f.metadata->>'quality_version'='1'
    AND f.metadata->>'generationId'=f.id::text
    AND jsonb_typeof(f.metadata->'quality')='object'
    AND f.metadata->'quality'->'version'='1'::jsonb
    AND f.metadata->'quality'->'groundingPassed'='true'::jsonb
    AND jsonb_typeof(f.metadata->'quality'->'selectedSourceCount')='number'
    AND f.metadata->'quality'->>'selectedSourceCount' ~ '^(0|[1-5]?[0-9]|6[0-4])$'
    AND jsonb_typeof(f.metadata->'quality'->'finalizationPatternCount')='number'
    AND f.metadata->'quality'->>'finalizationPatternCount' ~ '^(0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-6])$'
    AND CASE WHEN jsonb_typeof(f.metadata->'quality'->'selectedSourceKinds')='array'
      THEN jsonb_array_length(f.metadata->'quality'->'selectedSourceKinds')<=9 ELSE false END
    AND f.metadata->'quality'->'selectedSourceKinds' <@ '["role","company","technology","action","outcome","metric","preference","target_observation","cta_rationale"]'::jsonb
    AND (f.metadata->'quality')-ARRAY['version','archetype','selectedSourceCount','selectedSourceKinds','groundingPassed','finalizationPatternCount']='{}'::jsonb
    AND f.metadata->>'metrics_trust'='client_reported_unverified'
    AND f.feedback_type IN ('approved','rejected')
    AND f.created_at >= now()-interval '90 days'
    AND f.metadata->>'category' IN ('linkedin_connection','cold_email','linkedin_inmail','yc_application')
    AND f.metadata->'quality'->>'archetype' IN ('legacy','mixed','target_led','evidence_led','outcome_led','target_only','concise_direct')
    AND f.metadata->>'promptVersion' ~ '^(yc-)?[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
    AND f.metadata->>'model' ~ '^claude-([0-9]-[0-9]-)?(sonnet|haiku|opus)(-[0-9]{1,8}){1,3}$'
)
SELECT category,prompt_version,model,archetype,
  count(*) AS outcomes,count(DISTINCT user_id) AS users,
  count(*) FILTER (WHERE feedback_type='approved') AS approvals,
  count(*) >= 200 AND count(DISTINCT user_id) >= 30
    AND max(created_at)-min(created_at) >= interval '14 days' AS exploratory_floor_met
FROM eligible WHERE contribution<=10
GROUP BY category,prompt_version,model,archetype;
-- Approval rates remain conditional on responders, not all generation requests.
-- The floor is not proof of power, causality or rollout readiness. Phase 6 owns those decisions.
