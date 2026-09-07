BEGIN;

ALTER TABLE public.resume_uploads
  ADD COLUMN quarantine_cleanup_claimed_at TIMESTAMPTZ,
  ADD COLUMN quarantine_cleaned_at TIMESTAMPTZ;

CREATE INDEX resume_uploads_pending_quarantine_cleanup_idx
  ON public.resume_uploads (completed_at, id)
  WHERE state IN ('expired', 'rejected', 'canceled', 'ready')
    AND quarantine_cleaned_at IS NULL;

CREATE OR REPLACE FUNCTION public.expire_resume_uploads(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (upload_id UUID, user_id UUID, storage_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid expiry batch limit' USING ERRCODE = '22023';
  END IF;

  WITH stale_candidates AS (
    SELECT upload.id
    FROM public.resume_uploads AS upload
    WHERE upload.state IN ('reserved', 'uploaded', 'validating', 'failed')
      AND upload.expires_at <= NOW()
    ORDER BY upload.expires_at, upload.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.resume_uploads AS upload
  SET state = 'expired',
      failure_code = NULL,
      completed_at = NOW(),
      quarantine_cleanup_claimed_at = NULL
  FROM stale_candidates
  WHERE upload.id = stale_candidates.id;

  RETURN QUERY
  WITH cleanup_candidates AS (
    SELECT upload.id
    FROM public.resume_uploads AS upload
    WHERE upload.state IN ('expired', 'rejected', 'canceled', 'ready')
      AND upload.quarantine_cleaned_at IS NULL
      AND (
        upload.quarantine_cleanup_claimed_at IS NULL
        OR upload.quarantine_cleanup_claimed_at <= NOW() - INTERVAL '15 minutes'
      )
    ORDER BY upload.completed_at, upload.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.resume_uploads AS upload
    SET quarantine_cleanup_claimed_at = NOW()
    FROM cleanup_candidates
    WHERE upload.id = cleanup_candidates.id
    RETURNING upload.id, upload.user_id, upload.storage_path
  )
  SELECT claimed.id, claimed.user_id, claimed.storage_path
  FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_resume_uploads_cleaned(
  p_upload_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_upload_ids IS NULL
    OR CARDINALITY(p_upload_ids) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid cleanup batch' USING ERRCODE = '22023';
  END IF;

  UPDATE public.resume_uploads
  SET quarantine_cleaned_at = NOW(),
      quarantine_cleanup_claimed_at = NULL
  WHERE id = ANY(p_upload_ids)
    AND state IN ('expired', 'rejected', 'canceled', 'ready')
    AND quarantine_cleanup_claimed_at IS NOT NULL
    AND quarantine_cleaned_at IS NULL;

  SELECT COUNT(*)::INTEGER INTO v_updated
  FROM public.resume_uploads
  WHERE id = ANY(p_upload_ids)
    AND state IN ('expired', 'rejected', 'canceled', 'ready')
    AND quarantine_cleaned_at IS NOT NULL;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_resume_uploads(INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_resume_uploads_cleaned(UUID[])
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.expire_resume_uploads(INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_resume_uploads_cleaned(UUID[])
  TO service_role;

COMMENT ON COLUMN public.resume_uploads.quarantine_cleanup_claimed_at IS
  'Short service-only lease for retry-safe quarantine cleanup.';
COMMENT ON COLUMN public.resume_uploads.quarantine_cleaned_at IS
  'Timestamp confirming the private quarantine object was removed or absent.';

COMMIT;
