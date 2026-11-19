-- Server-written, content-free generation outcomes. Clients receive aggregates.
CREATE TABLE public.dashboard_generation_activity (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('linkedin_connection','linkedin_inmail','cold_email','yc_application')),
  status integer NOT NULL CHECK (status BETWEEN 200 AND 599),
  requested_answers integer NOT NULL CHECK (requested_answers BETWEEN 1 AND 5),
  successful_outputs integer NOT NULL,
  provider_attempts integer CHECK (provider_attempts BETWEEN 0 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (category = 'yc_application' OR requested_answers = 1),
  CHECK (successful_outputs = CASE WHEN status < 400 THEN requested_answers ELSE 0 END)
);
CREATE INDEX dashboard_activity_owner_time ON public.dashboard_generation_activity(user_id, created_at);
CREATE INDEX dashboard_activity_retention ON public.dashboard_generation_activity(created_at);
CREATE INDEX dashboard_feedback_owner_time ON public.user_feedback(user_id, created_at);
ALTER TABLE public.dashboard_generation_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dashboard_generation_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_generation_activity TO service_role;

CREATE TABLE public.dashboard_activity_coverage (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.dashboard_activity_coverage DEFAULT VALUES;
ALTER TABLE public.dashboard_activity_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dashboard_activity_coverage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dashboard_activity_coverage TO service_role;

-- Definer access is needed for service-only activity/quota rows. No user-id input:
-- every user-data query is restricted to the authenticated caller.
CREATE FUNCTION public.get_dashboard_metrics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' SET timezone = 'UTC'
AS $$
DECLARE
  caller uuid := auth.uid();
  ending timestamptz := now();
  starting timestamptz;
  coverage timestamptz;
  result jsonb;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'Invalid dashboard period' USING ERRCODE = '22023';
  END IF;
  starting := date_trunc('day', ending AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    - ((p_days - 1) * interval '1 day');
  SELECT started_at INTO STRICT coverage FROM public.dashboard_activity_coverage WHERE singleton;
  WITH activity AS MATERIALIZED (
    SELECT * FROM public.dashboard_generation_activity
    WHERE user_id = caller AND created_at >= starting AND created_at < ending
      AND created_at >= greatest(coverage, ending - interval '90 days')
  ), categories(category) AS (
    VALUES ('linkedin_connection'),('linkedin_inmail'),('cold_email'),('yc_application')
  ), category_totals AS (
    SELECT c.category, count(a.id) AS requests,
      count(a.id) FILTER (WHERE a.status < 400) AS successes,
      count(a.id) FILTER (WHERE a.status >= 400) AS failures,
      coalesce(sum(a.successful_outputs),0) AS outputs
    FROM categories c LEFT JOIN activity a ON a.category = c.category GROUP BY c.category
  ), days(day) AS (
    SELECT generate_series(starting, date_trunc('day', ending AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', interval '1 day')
  ), daily AS (
    SELECT to_char(d.day AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
      count(a.id) AS requests, coalesce(sum(a.successful_outputs),0) AS outputs
    FROM days d LEFT JOIN activity a ON a.created_at >= d.day AND a.created_at < d.day + interval '1 day'
    GROUP BY d.day
  ), reviews AS MATERIALIZED (
    SELECT DISTINCT ON (coalesce(nullif(metadata->>'generationId',''), id::text))
      feedback_type, metadata
    FROM public.user_feedback
    WHERE user_id = caller AND created_at >= starting AND created_at < ending
      AND feedback_type IN ('approved','rejected')
    ORDER BY coalesce(nullif(metadata->>'generationId',''), id::text), created_at DESC, id
  ), review_totals AS (
    SELECT count(*) FILTER (WHERE feedback_type = 'approved') AS approved,
      count(*) FILTER (WHERE feedback_type = 'rejected') AS rejected FROM reviews
  ), reasons AS (
    SELECT CASE
      WHEN coalesce(metadata->>'quality_reason',metadata->>'issue_category',metadata->>'rejection_reason') IN
        ('too_generic','too_formal','too_repetitive','weak_target_relevance','unsupported_feeling','wrong_ask','wrong_tone',
         'unsupported_claim','missed_question','formatting','other')
      THEN coalesce(metadata->>'quality_reason',metadata->>'issue_category',metadata->>'rejection_reason')
      ELSE 'unspecified' END AS reason
    FROM reviews WHERE feedback_type = 'rejected'
  ), quota AS (
    SELECT request_count, window_start FROM public.extension_rate_limits
    WHERE user_id = caller AND window_start + interval '24 hours' > ending
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('days',p_days,'from',starting,'to',ending,'timeZone','UTC'),
    'coverage',jsonb_build_object('recordingStartedAt',coverage,
      'availableFrom',greatest(coverage,ending - interval '90 days'),'capture','best_effort'),
    'activity',jsonb_build_object(
      'requests',(SELECT count(*) FROM activity),
      'successfulRequests',(SELECT count(*) FROM activity WHERE status < 400),
      'failedRequests',(SELECT count(*) FROM activity WHERE status >= 400),
      'outputs',(SELECT coalesce(sum(successful_outputs),0) FROM activity),
      'providerAttempts',(SELECT CASE WHEN count(*) FILTER (WHERE provider_attempts IS NULL) > 0
        THEN NULL ELSE coalesce(sum(provider_attempts),0) END FROM activity),
      'unknownProviderRequests',(SELECT count(*) FROM activity WHERE provider_attempts IS NULL),
      'successRate',(SELECT round(100.0 * count(*) FILTER (WHERE status < 400) / nullif(count(*),0),2) FROM activity),
      'byCategory',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.category) FROM category_totals c),
      'daily',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM daily d)),
    'reviews',jsonb_build_object(
      'approved',(SELECT approved FROM review_totals),
      'rejected',(SELECT rejected FROM review_totals),
      'approvalRate',(SELECT round(100.0*approved/nullif(approved+rejected,0),2) FROM review_totals),
      'rejectionReasons',(SELECT coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'count',r.total)
        ORDER BY r.total DESC,r.reason),'[]'::jsonb) FROM
        (SELECT reason,count(*) total FROM reasons GROUP BY reason) r)),
    'quota',jsonb_build_object('used',coalesce((SELECT request_count FROM quota),0),
      'resetAt',(SELECT window_start + interval '24 hours' FROM quota))
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_dashboard_metrics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(integer) TO authenticated;

CREATE FUNCTION public.cleanup_dashboard_activity()
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  WITH expired AS (
    SELECT id FROM public.dashboard_generation_activity
    WHERE created_at < now() - interval '90 days'
    ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED
  ), removed AS (
    DELETE FROM public.dashboard_generation_activity a USING expired e WHERE a.id = e.id RETURNING a.id
  ) SELECT count(*)::integer FROM removed;
$$;
REVOKE ALL ON FUNCTION public.cleanup_dashboard_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_dashboard_activity() TO service_role;
