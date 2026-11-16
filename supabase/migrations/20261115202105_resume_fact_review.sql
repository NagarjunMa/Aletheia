-- Reviews live on the owner-scoped source row so deletion also removes them.
ALTER TABLE public.user_resumes
  ADD COLUMN fact_review jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN review_source_verified boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT user_resumes_fact_review_bound CHECK (
    CASE WHEN jsonb_typeof(fact_review) = 'array'
      THEN jsonb_array_length(fact_review) <= 8 AND octet_length(fact_review::text) <= 25000
      ELSE false
    END
  );

-- Existing parsed text was owner-writable and has no immutable parser binding.
-- Leave historical rows as background until the owner uploads a verified copy.
ALTER TABLE public.user_resumes ALTER COLUMN review_source_verified SET DEFAULT true;

CREATE FUNCTION public.invalidate_resume_fact_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fact_review := '[]'::jsonb;
    NEW.review_source_verified := NEW.review_source_verified AND NEW.storage_path IS NOT NULL
      AND current_user NOT IN ('authenticated', 'anon');
  ELSE
    NEW.review_source_verified := OLD.review_source_verified AND
      (NEW.review_source_verified OR current_user IN ('authenticated', 'anon')) AND
      ROW(NEW.id, NEW.user_id, NEW.parsed_text, NEW.storage_path)
      IS NOT DISTINCT FROM ROW(OLD.id, OLD.user_id, OLD.parsed_text, OLD.storage_path);
    IF NOT NEW.review_source_verified OR NOT NEW.is_primary
      OR NEW.is_primary IS DISTINCT FROM OLD.is_primary
    THEN
      NEW.fact_review := '[]'::jsonb;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_resume_fact_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER invalidate_resume_fact_review
  BEFORE INSERT OR UPDATE ON public.user_resumes
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_resume_fact_review();

GRANT SELECT, INSERT ON TABLE public.user_resumes TO service_role;

-- Direct upload completion and verification commit in the same transaction.
CREATE FUNCTION public.revoke_truncated_resume_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.state = 'ready' AND 'TEXT_TRUNCATED' = ANY(NEW.quality_codes) THEN
    UPDATE public.user_resumes SET review_source_verified = false
    WHERE id = NEW.resume_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_truncated_resume_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER revoke_truncated_resume_review
  AFTER UPDATE OF state ON public.resume_uploads
  FOR EACH ROW EXECUTE FUNCTION public.revoke_truncated_resume_review();

-- An orphaned database row must not keep approvals usable after file removal.
CREATE VIEW public.user_resume_review_sources WITH (security_invoker = true) AS
SELECT resume.id, resume.user_id, resume.is_primary, resume.parsed_text,
       resume.updated_at, resume.fact_review,
       resume.review_source_verified AND EXISTS (
         SELECT 1 FROM storage.objects AS object
         WHERE object.bucket_id = 'user-resumes' AND object.name = resume.storage_path
       ) AS review_source_verified
FROM public.user_resumes AS resume;
REVOKE ALL ON public.user_resume_review_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_resume_review_sources TO authenticated;

CREATE FUNCTION public.set_primary_user_resume(p_resume_id uuid)
RETURNS SETOF public.user_resumes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid := auth.uid();
  target public.user_resumes;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('resume-user:' || owner_id::text, 0));
  SELECT * INTO target FROM public.user_resumes
  WHERE id = p_resume_id AND user_id = owner_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resume not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT target.is_primary THEN
    UPDATE public.user_resumes SET is_primary = false
    WHERE user_id = owner_id AND is_primary;
    UPDATE public.user_resumes SET is_primary = true
    WHERE id = p_resume_id AND user_id = owner_id
    RETURNING * INTO target;
  END IF;
  RETURN NEXT target;
END;
$$;
REVOKE ALL ON FUNCTION public.set_primary_user_resume(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_user_resume(uuid) TO authenticated;
