-- Candidate application profile foundation.
-- Stable targeting/logistics live in candidate_profiles; repeatable,
-- user-confirmed proof stories live in candidate_evidence.

CREATE TABLE public.candidate_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_role TEXT NOT NULL DEFAULT '',
  current_responsibilities TEXT NOT NULL DEFAULT '',
  startup_motivation TEXT NOT NULL DEFAULT '',
  career_goals TEXT NOT NULL DEFAULT '',
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  target_company_stages TEXT[] NOT NULL DEFAULT '{}',
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  github_url TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  work_authorization TEXT NOT NULL DEFAULT '',
  relocation_preference TEXT NOT NULL DEFAULT 'open',
  availability TEXT NOT NULL DEFAULT '',
  excluded_claims TEXT[] NOT NULL DEFAULT '{}',
  schema_version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT candidate_profiles_current_role_length_check
    CHECK (char_length(current_role) <= 160),
  CONSTRAINT candidate_profiles_responsibilities_length_check
    CHECK (char_length(current_responsibilities) <= 3000),
  CONSTRAINT candidate_profiles_startup_motivation_length_check
    CHECK (char_length(startup_motivation) <= 2000),
  CONSTRAINT candidate_profiles_career_goals_length_check
    CHECK (char_length(career_goals) <= 2000),
  CONSTRAINT candidate_profiles_target_roles_count_check
    CHECK (cardinality(target_roles) <= 10),
  CONSTRAINT candidate_profiles_target_roles_payload_check
    CHECK (char_length(array_to_string(target_roles, '')) <= 1200),
  CONSTRAINT candidate_profiles_target_stages_count_check
    CHECK (cardinality(target_company_stages) <= 5),
  CONSTRAINT candidate_profiles_target_stages_values_check
    CHECK (
      target_company_stages <@ ARRAY[
        'pre_seed',
        'seed',
        'series_a_b',
        'growth',
        'any'
      ]::TEXT[]
    ),
  CONSTRAINT candidate_profiles_target_industries_count_check
    CHECK (cardinality(target_industries) <= 10),
  CONSTRAINT candidate_profiles_target_industries_payload_check
    CHECK (char_length(array_to_string(target_industries, '')) <= 1200),
  CONSTRAINT candidate_profiles_url_length_check
    CHECK (
      char_length(github_url) <= 2048
      AND char_length(linkedin_url) <= 2048
      AND char_length(portfolio_url) <= 2048
    ),
  CONSTRAINT candidate_profiles_location_length_check
    CHECK (char_length(location) <= 160),
  CONSTRAINT candidate_profiles_work_authorization_length_check
    CHECK (char_length(work_authorization) <= 500),
  CONSTRAINT candidate_profiles_relocation_preference_check
    CHECK (relocation_preference IN ('yes', 'no', 'open')),
  CONSTRAINT candidate_profiles_availability_length_check
    CHECK (char_length(availability) <= 500),
  CONSTRAINT candidate_profiles_excluded_claims_count_check
    CHECK (cardinality(excluded_claims) <= 20),
  CONSTRAINT candidate_profiles_excluded_claims_payload_check
    CHECK (char_length(array_to_string(excluded_claims, '')) <= 6000),
  CONSTRAINT candidate_profiles_schema_version_check
    CHECK (schema_version > 0)
);

CREATE TABLE public.candidate_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  actions TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT '',
  metrics TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  links TEXT[] NOT NULL DEFAULT '{}',
  confirmed_at TIMESTAMPTZ,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT candidate_evidence_kind_check CHECK (
    kind IN (
      'achievement',
      'technical_project',
      'ambiguity',
      'speed_to_production',
      'leadership',
      'cross_functional',
      'ai_usage',
      'production_scale'
    )
  ),
  CONSTRAINT candidate_evidence_title_length_check
    CHECK (char_length(title) BETWEEN 2 AND 160),
  CONSTRAINT candidate_evidence_context_length_check
    CHECK (char_length(context) <= 1000),
  CONSTRAINT candidate_evidence_actions_length_check
    CHECK (char_length(actions) BETWEEN 12 AND 2000),
  CONSTRAINT candidate_evidence_outcome_length_check
    CHECK (char_length(outcome) <= 1200),
  CONSTRAINT candidate_evidence_metrics_count_check
    CHECK (cardinality(metrics) <= 8),
  CONSTRAINT candidate_evidence_metrics_payload_check
    CHECK (char_length(array_to_string(metrics, '')) <= 1920),
  CONSTRAINT candidate_evidence_skills_count_check
    CHECK (cardinality(skills) <= 20),
  CONSTRAINT candidate_evidence_skills_payload_check
    CHECK (char_length(array_to_string(skills, '')) <= 2400),
  CONSTRAINT candidate_evidence_links_count_check
    CHECK (cardinality(links) <= 5),
  CONSTRAINT candidate_evidence_links_payload_check
    CHECK (char_length(array_to_string(links, '')) <= 10240),
  CONSTRAINT candidate_evidence_sort_order_check
    CHECK (sort_order BETWEEN 0 AND 99)
);

CREATE INDEX candidate_evidence_user_order_idx
  ON public.candidate_evidence (user_id, sort_order, created_at);

CREATE FUNCTION public.enforce_candidate_evidence_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  evidence_count INTEGER;
BEGIN
  -- Serialize inserts for a single user so concurrent requests cannot both
  -- observe the same pre-insert count and exceed the per-user cap.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::TEXT, 0));

  SELECT COUNT(*)
    INTO evidence_count
    FROM public.candidate_evidence
   WHERE user_id = NEW.user_id;

  IF evidence_count >= 25 THEN
    RAISE EXCEPTION 'candidate evidence limit exceeded'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_candidate_evidence_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_candidate_evidence_limit
  BEFORE INSERT ON public.candidate_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_candidate_evidence_limit();

CREATE TRIGGER set_candidate_profiles_updated_at
  BEFORE UPDATE ON public.candidate_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_candidate_evidence_updated_at
  BEFORE UPDATE ON public.candidate_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_profiles_select_own"
  ON public.candidate_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_profiles_insert_own"
  ON public.candidate_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_profiles_update_own"
  ON public.candidate_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_profiles_delete_own"
  ON public.candidate_profiles
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_evidence_select_own"
  ON public.candidate_evidence
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_evidence_insert_own"
  ON public.candidate_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_evidence_update_own"
  ON public.candidate_evidence
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "candidate_evidence_delete_own"
  ON public.candidate_evidence
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.candidate_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.candidate_profiles FROM anon;
REVOKE ALL ON TABLE public.candidate_evidence FROM PUBLIC;
REVOKE ALL ON TABLE public.candidate_evidence FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidate_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidate_evidence TO authenticated;

COMMENT ON TABLE public.candidate_profiles IS
  'User-owned application preferences, goals, logistics, links, and excluded claims.';
COMMENT ON TABLE public.candidate_evidence IS
  'User-confirmed achievement and project stories used to ground application answers.';
