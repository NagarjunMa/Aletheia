-- ALE-43 Phase 1: establish a private resume quarantine and an atomic upload
-- reservation perimeter. This migration does not cut the application over to
-- direct uploads; it only creates the database/storage contracts used by the
-- later API and browser phases.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resume-quarantine',
  'resume-quarantine',
  false,
  5242880,
  ARRAY['application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'text/plain'];

CREATE TABLE public.resume_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  declared_mime TEXT NOT NULL,
  declared_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'reserved',
  failure_code TEXT,
  retry_count SMALLINT NOT NULL DEFAULT 0,
  detected_mime TEXT,
  detected_size INTEGER,
  content_sha256 TEXT,
  page_count INTEGER,
  parsed_character_count INTEGER,
  quality_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  resume_id UUID UNIQUE REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  uploaded_at TIMESTAMPTZ,
  validation_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resume_uploads_file_name_length CHECK (
    char_length(file_name) BETWEEN 1 AND 255
    AND file_name !~ '[[:cntrl:]]'
  ),
  CONSTRAINT resume_uploads_declared_mime_allowed CHECK (
    declared_mime IN ('application/pdf', 'text/plain')
  ),
  CONSTRAINT resume_uploads_declared_size_limit CHECK (
    declared_size BETWEEN 1 AND 5242880
  ),
  CONSTRAINT resume_uploads_storage_path_length CHECK (
    char_length(storage_path) BETWEEN 1 AND 160
  ),
  CONSTRAINT resume_uploads_state_allowed CHECK (
    state IN (
      'reserved',
      'uploaded',
      'validating',
      'ready',
      'rejected',
      'failed',
      'canceled',
      'expired'
    )
  ),
  CONSTRAINT resume_uploads_failure_code_safe CHECK (
    failure_code IS NULL OR failure_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
  ),
  CONSTRAINT resume_uploads_retry_count_limit CHECK (
    retry_count BETWEEN 0 AND 3
  ),
  CONSTRAINT resume_uploads_detected_mime_allowed CHECK (
    detected_mime IS NULL OR detected_mime IN ('application/pdf', 'text/plain')
  ),
  CONSTRAINT resume_uploads_detected_size_limit CHECK (
    detected_size IS NULL OR detected_size BETWEEN 1 AND 5242880
  ),
  CONSTRAINT resume_uploads_sha256_format CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT resume_uploads_page_count_limit CHECK (
    page_count IS NULL OR page_count BETWEEN 1 AND 20
  ),
  CONSTRAINT resume_uploads_parsed_character_count_limit CHECK (
    parsed_character_count IS NULL OR parsed_character_count BETWEEN 1 AND 50000
  ),
  CONSTRAINT resume_uploads_quality_code_count_limit CHECK (
    cardinality(quality_codes) <= 16
  ),
  CONSTRAINT resume_uploads_expiry_after_creation CHECK (
    expires_at > created_at
  ),
  CONSTRAINT resume_uploads_terminal_timestamp CHECK (
    (state IN ('ready', 'rejected', 'canceled', 'expired') AND completed_at IS NOT NULL)
    OR (state NOT IN ('ready', 'rejected', 'canceled', 'expired') AND completed_at IS NULL)
  ),
  CONSTRAINT resume_uploads_ready_metadata CHECK (
    state <> 'ready'
    OR (
      resume_id IS NOT NULL
      AND detected_mime IS NOT NULL
      AND detected_size IS NOT NULL
      AND content_sha256 IS NOT NULL
      AND parsed_character_count IS NOT NULL
    )
  ),
  CONSTRAINT resume_uploads_failure_state_code CHECK (
    (state IN ('rejected', 'failed') AND failure_code IS NOT NULL)
    OR (state NOT IN ('rejected', 'failed') AND failure_code IS NULL)
  )
);

CREATE INDEX resume_uploads_user_created_idx
  ON public.resume_uploads (user_id, created_at DESC);

CREATE INDEX resume_uploads_user_active_idx
  ON public.resume_uploads (user_id, expires_at)
  WHERE state IN ('reserved', 'uploaded', 'validating', 'failed');

CREATE INDEX resume_uploads_expiry_idx
  ON public.resume_uploads (expires_at, id)
  WHERE state IN ('reserved', 'uploaded', 'validating', 'failed');

CREATE UNIQUE INDEX resume_uploads_user_ready_sha256_idx
  ON public.resume_uploads (user_id, content_sha256)
  WHERE state = 'ready' AND content_sha256 IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_resume_upload_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.state = 'reserved' AND NEW.state IN ('uploaded', 'canceled', 'expired'))
    OR (OLD.state = 'uploaded' AND NEW.state IN ('validating', 'canceled', 'expired'))
    OR (OLD.state = 'validating' AND NEW.state IN ('ready', 'rejected', 'failed', 'expired'))
    OR (OLD.state = 'failed' AND NEW.state IN ('validating', 'canceled', 'expired'))
  ) THEN
    RAISE EXCEPTION 'invalid resume upload state transition'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_resume_upload_transition()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_resume_upload_transition
  BEFORE UPDATE OF state ON public.resume_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_resume_upload_transition();

CREATE TRIGGER set_resume_uploads_updated_at
  BEFORE UPDATE ON public.resume_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.resume_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resume uploads"
  ON public.resume_uploads
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.resume_uploads FROM anon, authenticated;
GRANT SELECT ON TABLE public.resume_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.resume_uploads TO service_role;

-- Authenticated clients may create a new object only at the exact path of
-- their own live reservation. There are intentionally no authenticated
-- SELECT, UPDATE, or DELETE policies for the quarantine bucket.
CREATE POLICY "Users can upload exact reserved resume object"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resume-quarantine'
    AND (SELECT auth.uid()) IS NOT NULL
    AND owner_id = (SELECT auth.uid())::TEXT
    AND EXISTS (
      SELECT 1
      FROM public.resume_uploads AS upload
      WHERE upload.user_id = (SELECT auth.uid())
        AND upload.storage_path = name
        AND upload.state = 'reserved'
        AND upload.expires_at > NOW()
    )
  );

-- Final objects can now be written only by trusted server-side code. Existing
-- owner-scoped SELECT and DELETE behavior is preserved for the current UI.
DROP POLICY IF EXISTS "Users can upload own resume files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resume files" ON storage.objects;

-- Use the same per-user lock for legacy inserts and the new completion RPC so
-- concurrent paths cannot race past the five-resume limit.
CREATE OR REPLACE FUNCTION public.enforce_user_resume_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('resume-user:' || NEW.user_id::TEXT, 0)
  );

  SELECT COUNT(*)
    INTO active_count
    FROM public.user_resumes
   WHERE user_id = NEW.user_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

  IF active_count >= 5 THEN
    RAISE EXCEPTION 'resume limit exceeded'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_user_resume_limit()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_resume_upload(
  p_file_name TEXT,
  p_declared_mime TEXT,
  p_declared_size INTEGER
)
RETURNS TABLE (
  upload_id UUID,
  bucket_id TEXT,
  storage_path TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_upload_id UUID := gen_random_uuid();
  v_storage_path TEXT;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '15 minutes';
  v_extension TEXT;
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_file_name IS NULL
    OR char_length(btrim(p_file_name)) NOT BETWEEN 1 AND 255
    OR p_file_name ~ '[[:cntrl:]]'
  THEN
    RAISE EXCEPTION 'invalid resume file name' USING ERRCODE = '22023';
  END IF;

  IF p_declared_mime NOT IN ('application/pdf', 'text/plain') THEN
    RAISE EXCEPTION 'invalid resume mime type' USING ERRCODE = '22023';
  END IF;

  IF p_declared_size IS NULL OR p_declared_size NOT BETWEEN 1 AND 5242880 THEN
    RAISE EXCEPTION 'invalid resume file size' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('resume-user:' || v_user_id::TEXT, 0)
  );

  UPDATE public.resume_uploads AS upload
  SET state = 'expired', failure_code = NULL, completed_at = NOW()
  WHERE upload.user_id = v_user_id
    AND upload.state IN ('reserved', 'uploaded', 'validating', 'failed')
    AND upload.expires_at <= NOW();

  SELECT COUNT(*) INTO v_count
  FROM public.user_resumes
  WHERE user_id = v_user_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'resume limit exceeded' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.resume_uploads AS upload
  WHERE upload.user_id = v_user_id
    AND upload.state IN ('reserved', 'uploaded', 'validating', 'failed')
    AND upload.expires_at > NOW();

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'active resume upload limit exceeded' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.resume_uploads AS upload
  WHERE upload.user_id = v_user_id
    AND upload.created_at >= NOW() - INTERVAL '1 hour';

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'hourly resume upload limit exceeded' USING ERRCODE = '23514';
  END IF;

  v_extension := CASE p_declared_mime
    WHEN 'application/pdf' THEN 'pdf'
    ELSE 'txt'
  END;
  v_storage_path := v_user_id::TEXT || '/' || v_upload_id::TEXT || '.' || v_extension;

  INSERT INTO public.resume_uploads (
    id,
    user_id,
    file_name,
    declared_mime,
    declared_size,
    storage_path,
    expires_at
  )
  VALUES (
    v_upload_id,
    v_user_id,
    btrim(p_file_name),
    p_declared_mime,
    p_declared_size,
    v_storage_path,
    v_expires_at
  );

  RETURN QUERY
  SELECT v_upload_id, 'resume-quarantine'::TEXT, v_storage_path, v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_resume_upload(TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_resume_upload(TEXT, TEXT, INTEGER)
  TO authenticated;

-- Service callers must pass the user authenticated at the API boundary. Keeping
-- that identity in every privileged transition prevents a service-role client
-- from turning a user-controlled upload UUID into a cross-account mutation.
CREATE OR REPLACE FUNCTION public.mark_resume_upload_uploaded(
  p_upload_id UUID,
  p_user_id UUID
)
RETURNS TABLE (upload_state TEXT, changed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_upload public.resume_uploads%ROWTYPE;
BEGIN
  SELECT * INTO v_upload
  FROM public.resume_uploads
  WHERE id = p_upload_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume upload not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_upload.state = 'uploaded' THEN
    RETURN QUERY SELECT v_upload.state, FALSE;
    RETURN;
  END IF;

  IF v_upload.state <> 'reserved' OR v_upload.expires_at <= NOW() THEN
    RAISE EXCEPTION 'resume upload cannot be acknowledged' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'resume-quarantine'
      AND object.name = v_upload.storage_path
  ) THEN
    RAISE EXCEPTION 'quarantine resume object not found' USING ERRCODE = '23514';
  END IF;

  UPDATE public.resume_uploads
  SET state = 'uploaded', uploaded_at = NOW()
  WHERE id = p_upload_id
    AND user_id = p_user_id
  RETURNING * INTO v_upload;

  RETURN QUERY SELECT v_upload.state, TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_resume_upload(
  p_upload_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  upload_id UUID,
  user_id UUID,
  file_name TEXT,
  declared_mime TEXT,
  declared_size INTEGER,
  storage_path TEXT,
  retry_count SMALLINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_upload public.resume_uploads%ROWTYPE;
BEGIN
  SELECT * INTO v_upload
  FROM public.resume_uploads AS upload
  WHERE upload.id = p_upload_id
    AND upload.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume upload not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_upload.state NOT IN ('uploaded', 'failed')
    OR v_upload.expires_at <= NOW()
    OR v_upload.retry_count >= 3
  THEN
    RAISE EXCEPTION 'resume upload cannot be claimed' USING ERRCODE = '23514';
  END IF;

  UPDATE public.resume_uploads AS upload
  SET
    state = 'validating',
    failure_code = NULL,
    retry_count = upload.retry_count + 1,
    validation_started_at = NOW(),
    -- Validation owns a fresh lease rather than inheriting whatever little
    -- time remains on the browser's original upload reservation.
    expires_at = GREATEST(upload.expires_at, NOW() + INTERVAL '15 minutes')
  WHERE upload.id = p_upload_id
    AND upload.user_id = p_user_id
  RETURNING * INTO v_upload;

  RETURN QUERY
  SELECT
    v_upload.id,
    v_upload.user_id,
    v_upload.file_name,
    v_upload.declared_mime,
    v_upload.declared_size,
    v_upload.storage_path,
    v_upload.retry_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_resume_upload(
  p_upload_id UUID,
  p_user_id UUID,
  p_label TEXT,
  p_detected_mime TEXT,
  p_detected_size INTEGER,
  p_parsed_text TEXT,
  p_content_sha256 TEXT,
  p_page_count INTEGER DEFAULT NULL,
  p_quality_codes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (completed_resume_id UUID, already_completed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_upload public.resume_uploads%ROWTYPE;
  v_user_id UUID;
  v_resume_id UUID;
  v_is_primary BOOLEAN;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.resume_uploads
  WHERE id = p_upload_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume upload not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('resume-user:' || v_user_id::TEXT, 0)
  );

  SELECT * INTO v_upload
  FROM public.resume_uploads
  WHERE id = p_upload_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume upload not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_upload.state = 'ready' AND v_upload.resume_id IS NOT NULL THEN
    RETURN QUERY SELECT v_upload.resume_id, TRUE;
    RETURN;
  END IF;

  IF v_upload.state <> 'validating' THEN
    RAISE EXCEPTION 'resume upload is not validating' USING ERRCODE = '23514';
  END IF;

  IF p_label IS NULL OR char_length(btrim(p_label)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid resume label' USING ERRCODE = '22023';
  END IF;

  IF p_detected_mime IS DISTINCT FROM v_upload.declared_mime THEN
    RAISE EXCEPTION 'resume mime mismatch' USING ERRCODE = '22023';
  END IF;

  IF p_detected_size IS DISTINCT FROM v_upload.declared_size
    OR p_detected_size NOT BETWEEN 1 AND 5242880
  THEN
    RAISE EXCEPTION 'resume size mismatch' USING ERRCODE = '22023';
  END IF;

  IF p_parsed_text IS NULL OR char_length(p_parsed_text) NOT BETWEEN 1 AND 50000 THEN
    RAISE EXCEPTION 'invalid parsed resume text' USING ERRCODE = '22023';
  END IF;

  IF p_content_sha256 IS NULL OR p_content_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid resume content hash' USING ERRCODE = '22023';
  END IF;

  IF p_detected_mime = 'application/pdf'
    AND (p_page_count IS NULL OR p_page_count NOT BETWEEN 1 AND 20)
  THEN
    RAISE EXCEPTION 'invalid resume page count' USING ERRCODE = '22023';
  END IF;

  IF p_detected_mime = 'text/plain' AND p_page_count IS NOT NULL THEN
    RAISE EXCEPTION 'text resume cannot have a page count' USING ERRCODE = '22023';
  END IF;

  IF cardinality(COALESCE(p_quality_codes, ARRAY[]::TEXT[])) > 16
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_quality_codes, ARRAY[]::TEXT[])) AS code
      WHERE code IS NULL OR code !~ '^[A-Z][A-Z0-9_]{0,63}$'
    )
  THEN
    RAISE EXCEPTION 'invalid resume quality code' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'user-resumes'
      AND object.name = v_upload.storage_path
  ) THEN
    RAISE EXCEPTION 'final resume object not found' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.resume_uploads AS existing
    WHERE existing.user_id = v_upload.user_id
      AND existing.state = 'ready'
      AND existing.content_sha256 = p_content_sha256
      AND existing.id <> p_upload_id
  ) THEN
    RAISE EXCEPTION 'duplicate resume upload' USING ERRCODE = '23505';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.user_resumes
    WHERE user_id = v_upload.user_id
  ) INTO v_is_primary;

  INSERT INTO public.user_resumes (
    user_id,
    label,
    file_name,
    file_mime,
    file_size,
    storage_path,
    parsed_text,
    is_primary
  )
  VALUES (
    v_upload.user_id,
    btrim(p_label),
    v_upload.file_name,
    p_detected_mime,
    p_detected_size,
    v_upload.storage_path,
    p_parsed_text,
    v_is_primary
  )
  RETURNING id INTO v_resume_id;

  UPDATE public.resume_uploads
  SET
    state = 'ready',
    failure_code = NULL,
    detected_mime = p_detected_mime,
    detected_size = p_detected_size,
    content_sha256 = p_content_sha256,
    page_count = p_page_count,
    parsed_character_count = char_length(p_parsed_text),
    quality_codes = COALESCE(p_quality_codes, ARRAY[]::TEXT[]),
    resume_id = v_resume_id,
    completed_at = NOW()
  WHERE id = p_upload_id
    AND user_id = p_user_id;

  RETURN QUERY SELECT v_resume_id, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_resume_upload(
  p_upload_id UUID,
  p_user_id UUID,
  p_failure_code TEXT,
  p_retryable BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (upload_state TEXT, changed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_upload public.resume_uploads%ROWTYPE;
  v_target_state TEXT;
BEGIN
  IF p_failure_code IS NULL OR p_failure_code !~ '^[A-Z][A-Z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'invalid resume failure code' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_upload
  FROM public.resume_uploads
  WHERE id = p_upload_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume upload not found' USING ERRCODE = 'P0002';
  END IF;

  v_target_state := CASE WHEN p_retryable THEN 'failed' ELSE 'rejected' END;

  IF v_upload.state = v_target_state AND v_upload.failure_code = p_failure_code THEN
    RETURN QUERY SELECT v_upload.state, FALSE;
    RETURN;
  END IF;

  IF v_upload.state <> 'validating' THEN
    RAISE EXCEPTION 'resume upload cannot be rejected' USING ERRCODE = '23514';
  END IF;

  UPDATE public.resume_uploads
  SET
    state = v_target_state,
    failure_code = p_failure_code,
    completed_at = CASE WHEN p_retryable THEN NULL ELSE NOW() END
  WHERE id = p_upload_id
    AND user_id = p_user_id
  RETURNING * INTO v_upload;

  RETURN QUERY SELECT v_upload.state, TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_resume_upload(
  p_upload_id UUID
)
RETURNS TABLE (upload_state TEXT, storage_path TEXT, changed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_upload public.resume_uploads%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_upload
  FROM public.resume_uploads
  WHERE id = p_upload_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resume upload not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_upload.state = 'canceled' THEN
    RETURN QUERY SELECT v_upload.state, v_upload.storage_path, FALSE;
    RETURN;
  END IF;

  IF v_upload.state NOT IN ('reserved', 'uploaded', 'failed') THEN
    RAISE EXCEPTION 'resume upload cannot be canceled' USING ERRCODE = '23514';
  END IF;

  UPDATE public.resume_uploads
  SET state = 'canceled', failure_code = NULL, completed_at = NOW()
  WHERE id = p_upload_id
  RETURNING * INTO v_upload;

  RETURN QUERY SELECT v_upload.state, v_upload.storage_path, TRUE;
END;
$$;

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

  RETURN QUERY
  WITH candidates AS (
    SELECT upload.id
    FROM public.resume_uploads AS upload
    WHERE upload.state IN ('reserved', 'uploaded', 'validating', 'failed')
      AND upload.expires_at <= NOW()
    ORDER BY upload.expires_at, upload.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ), expired AS (
    UPDATE public.resume_uploads AS upload
    SET state = 'expired', failure_code = NULL, completed_at = NOW()
    FROM candidates
    WHERE upload.id = candidates.id
    RETURNING upload.id, upload.user_id, upload.storage_path
  )
  SELECT expired.id, expired.user_id, expired.storage_path
  FROM expired;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_resume_upload_uploaded(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_resume_upload(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_resume_upload(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[])
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reject_resume_upload(UUID, UUID, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_resume_upload(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.expire_resume_uploads(INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mark_resume_upload_uploaded(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_resume_upload(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_resume_upload(UUID, UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_resume_upload(UUID, UUID, TEXT, BOOLEAN)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_resume_upload(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_resume_uploads(INTEGER)
  TO service_role;

COMMENT ON TABLE public.resume_uploads IS
  'Owner-scoped resume upload reservations. Quarantine objects remain unavailable to clients until trusted validation completes.';
COMMENT ON COLUMN public.resume_uploads.storage_path IS
  'Server-generated exact object path shared by the private quarantine and final resume buckets.';
COMMENT ON COLUMN public.resume_uploads.failure_code IS
  'Bounded stable failure code only; never parser errors or document content.';
COMMENT ON COLUMN public.resume_uploads.quality_codes IS
  'Bounded stable quality codes only; never extracted resume content.';

COMMIT;
