-- Only privileged server code can reserve anonymous feedback capacity.
CREATE TABLE public.public_feedback_limits (
  subject_hash text PRIMARY KEY CHECK (subject_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 5)
);
CREATE INDEX public_feedback_limits_expiry_idx ON public.public_feedback_limits(window_start);
ALTER TABLE public.public_feedback_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_feedback_limits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.reserve_public_feedback_slot(p_subject_hash text)
RETURNS TABLE(allowed boolean, retry_time timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.public_feedback_limits%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_subject_hash IS NULL OR p_subject_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid feedback subject';
  END IF;
  -- Bound reclamation work per submission; no permanent raw-IP or email store.
  DELETE FROM public.public_feedback_limits WHERE subject_hash IN (
    SELECT subject_hash FROM public.public_feedback_limits
    WHERE window_start < v_now - interval '1 day' ORDER BY window_start LIMIT 100
    FOR UPDATE SKIP LOCKED
  );
  INSERT INTO public.public_feedback_limits VALUES(p_subject_hash, v_now, 1)
    ON CONFLICT (subject_hash) DO NOTHING;
  IF FOUND THEN
    RETURN QUERY SELECT true, v_now + interval '10 minutes';
    RETURN;
  END IF;
  SELECT * INTO v_row FROM public.public_feedback_limits
    WHERE subject_hash = p_subject_hash FOR UPDATE;
  IF v_row.window_start <= v_now - interval '10 minutes' THEN
    UPDATE public.public_feedback_limits SET window_start = v_now, request_count = 1
      WHERE subject_hash = p_subject_hash;
    RETURN QUERY SELECT true, v_now + interval '10 minutes';
  ELSIF v_row.request_count < 5 THEN
    UPDATE public.public_feedback_limits SET request_count = request_count + 1
      WHERE subject_hash = p_subject_hash;
    RETURN QUERY SELECT true, v_row.window_start + interval '10 minutes';
  ELSE
    RETURN QUERY SELECT false, v_row.window_start + interval '10 minutes';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_public_feedback_slot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_public_feedback_slot(text) TO service_role;
