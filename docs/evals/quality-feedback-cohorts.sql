-- Read-only exploratory aggregate. No private comment, style, source or draft is selected.
-- Client-echoed metrics are unverified. This query never activates a feature.
-- Set by_grounding to true for the outreach breakdown. The default retains all cohorts.
WITH settings AS (SELECT false AS by_grounding),
eligible AS (
  SELECT f.user_id, f.created_at, f.feedback_type,
    f.metadata->>'category' AS category,
    f.metadata->>'promptVersion' AS prompt_version,
    f.metadata->>'model' AS model,
    f.metadata->'quality'->>'archetype' AS archetype,
    CASE WHEN by_grounding THEN summary->>'groundingLevel' END AS grounding_level,
    CASE WHEN by_grounding THEN summary->>'fallbackReason' END AS grounding_fallback,
    CASE WHEN by_grounding THEN source_kinds END AS grounding_source_kinds,
    row_number() OVER (
      PARTITION BY f.user_id, f.metadata->>'category', f.metadata->>'promptVersion',
        f.metadata->>'model', f.metadata->'quality'->>'archetype'
      ORDER BY f.created_at, f.id
    ) AS contribution
  FROM public.user_feedback f
  JOIN public.user_preferences p ON p.user_id=f.user_id AND p.share_analytics IS TRUE
  CROSS JOIN settings
  CROSS JOIN LATERAL (SELECT f.metadata->'grounding' AS summary) grounding
  CROSS JOIN LATERAL (
    SELECT ARRAY(
      SELECT kind FROM unnest(ARRAY['evidence','profile','resume']) AS allowed(kind)
      WHERE summary->'selectedSourceKinds' ? kind ORDER BY kind
    ) AS source_kinds,
    CASE WHEN jsonb_typeof(summary->'selectedSourceCount')='number'
      AND summary->>'selectedSourceCount' ~ '^(0|[1-5]?[0-9]|6[0-4])$'
      THEN (summary->>'selectedSourceCount')::int END AS source_count,
    CASE WHEN jsonb_typeof(summary->'selectedEvidenceCount')='number'
      AND summary->>'selectedEvidenceCount' ~ '^(0|[1-5]?[0-9]|6[0-4])$'
      THEN (summary->>'selectedEvidenceCount')::int END AS evidence_count
  ) source_summary
  CROSS JOIN LATERAL (
    SELECT CASE WHEN 'evidence'=ANY(source_kinds) THEN 'verified_evidence'
      WHEN 'profile'=ANY(source_kinds) THEN 'profile_grounded'
      WHEN 'resume'=ANY(source_kinds) THEN 'resume_fallback'
      ELSE 'target_only' END AS expected_level
  ) classification
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
    AND CASE WHEN NOT by_grounding THEN true
      WHEN jsonb_typeof(summary)='object' AND jsonb_typeof(summary->'selectedSourceKinds')='array'
      THEN f.metadata->>'category'<>'yc_application'
        AND summary->'provenanceValidated'='true'::jsonb
        AND jsonb_typeof(summary->'injectionSafeMode')='boolean'
        AND summary-ARRAY['groundingLevel','fallbackReason','selectedSourceCount','selectedEvidenceCount',
          'selectedSourceKinds','injectionSafeMode','provenanceValidated']='{}'::jsonb
        AND jsonb_array_length(summary->'selectedSourceKinds')=cardinality(source_kinds)
        AND summary->'selectedSourceKinds' <@ '["evidence","profile","resume"]'::jsonb
        AND ('evidence'=ANY(source_kinds))=(evidence_count>0)
        AND source_count-evidence_count>=cardinality(array_remove(source_kinds,'evidence'))
        AND (source_count>evidence_count)=(cardinality(array_remove(source_kinds,'evidence'))>0)
        AND summary->>'groundingLevel'=expected_level
        AND CASE WHEN summary->'injectionSafeMode'='true'::jsonb
          THEN summary->>'fallbackReason'='target_injection_detected'
          WHEN expected_level='verified_evidence' THEN summary->>'fallbackReason'='none'
          WHEN expected_level='profile_grounded' THEN summary->>'fallbackReason'='no_confirmed_evidence'
          WHEN expected_level='resume_fallback' THEN summary->>'fallbackReason'='no_profile_context'
          ELSE summary->>'fallbackReason' IN ('no_resume_context','candidate_context_not_used')
        END
      ELSE false END
    AND f.metadata->'quality'->>'archetype' IN ('legacy','mixed','target_led','evidence_led','outcome_led','target_only','concise_direct')
    AND f.metadata->>'promptVersion' ~ '^(yc-)?[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
    AND f.metadata->>'model' ~ '^claude-([0-9]-[0-9]-)?(sonnet|haiku|opus)(-[0-9]{1,8}){1,3}$'
)
SELECT category,prompt_version,model,archetype,
  count(*) AS outcomes,count(DISTINCT user_id) AS users,
  count(*) FILTER (WHERE feedback_type='approved') AS approvals,
  count(*) >= 200 AND count(DISTINCT user_id) >= 30
    AND max(created_at)-min(created_at) >= interval '14 days' AS exploratory_floor_met,
  grounding_level,grounding_fallback,grounding_source_kinds
FROM eligible WHERE contribution<=10
GROUP BY category,prompt_version,model,archetype,
  grounding_level,grounding_fallback,grounding_source_kinds;
-- Approval rates remain conditional on responders, not all generation requests.
-- The floor is not proof of power, causality or rollout readiness. Phase 6 owns those decisions.
