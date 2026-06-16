-- 2026-06-15 — Supabase-backed resume source of truth
-- Stores original uploaded files in a private Storage bucket and parsed
-- generation text in Postgres. Existing profiles.resume values are imported
-- once as text-only legacy records to avoid breaking existing users.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-resumes',
  'user-resumes',
  false,
  5242880,
  ARRAY['application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'text/plain'];

CREATE TABLE IF NOT EXISTS public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT,
  parsed_text TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_resumes_label_len CHECK (char_length(label) BETWEEN 1 AND 120),
  CONSTRAINT user_resumes_file_name_len CHECK (char_length(file_name) BETWEEN 1 AND 255),
  CONSTRAINT user_resumes_file_mime_allowed CHECK (file_mime IN ('application/pdf', 'text/plain')),
  CONSTRAINT user_resumes_file_size_limit CHECK (file_size >= 0 AND file_size <= 5242880),
  CONSTRAINT user_resumes_parsed_text_limit CHECK (char_length(parsed_text) BETWEEN 1 AND 50000),
  CONSTRAINT user_resumes_storage_path_required_for_uploads CHECK (
    storage_path IS NOT NULL OR file_name = 'Imported profile resume'
  )
);

CREATE INDEX IF NOT EXISTS user_resumes_user_id_created_at_idx
  ON public.user_resumes(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS user_resumes_one_primary_per_user_idx
  ON public.user_resumes(user_id)
  WHERE is_primary;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS set_user_resumes_updated_at ON public.user_resumes;
CREATE TRIGGER set_user_resumes_updated_at
  BEFORE UPDATE ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_user_resume_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO active_count
    FROM public.user_resumes
   WHERE user_id = NEW.user_id
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF active_count >= 5 THEN
    RAISE EXCEPTION 'resume limit exceeded'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_user_resume_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_user_resume_limit ON public.user_resumes;
CREATE TRIGGER enforce_user_resume_limit
  BEFORE INSERT ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_resume_limit();

ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own resumes" ON public.user_resumes;
CREATE POLICY "Users can view own resumes"
  ON public.user_resumes
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own resumes" ON public.user_resumes;
CREATE POLICY "Users can insert own resumes"
  ON public.user_resumes
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own resumes" ON public.user_resumes;
CREATE POLICY "Users can update own resumes"
  ON public.user_resumes
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own resumes" ON public.user_resumes;
CREATE POLICY "Users can delete own resumes"
  ON public.user_resumes
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resumes TO authenticated;

DROP POLICY IF EXISTS "Users can view own resume files" ON storage.objects;
CREATE POLICY "Users can view own resume files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-resumes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can upload own resume files" ON storage.objects;
CREATE POLICY "Users can upload own resume files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-resumes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update own resume files" ON storage.objects;
CREATE POLICY "Users can update own resume files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-resumes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'user-resumes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can delete own resume files" ON storage.objects;
CREATE POLICY "Users can delete own resume files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-resumes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Tighten the older profiles UPDATE policy while touching resume ownership.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

INSERT INTO public.user_resumes (
  user_id,
  label,
  file_name,
  file_mime,
  file_size,
  storage_path,
  parsed_text,
  is_primary,
  created_at,
  updated_at
)
SELECT
  p.id,
  'Imported profile resume',
  'Imported profile resume',
  'text/plain',
  LEAST(octet_length(p.resume), 5242880),
  NULL,
  LEFT(p.resume, 50000),
  TRUE,
  COALESCE(p.resume_updated_at, NOW()),
  COALESCE(p.resume_updated_at, NOW())
FROM public.profiles p
WHERE p.resume IS NOT NULL
  AND btrim(p.resume) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_resumes ur
    WHERE ur.user_id = p.id
  );

COMMENT ON TABLE public.user_resumes IS 'User-owned resume records. Original upload lives in private Supabase Storage; parsed_text is the generation source of truth.';
COMMENT ON COLUMN public.user_resumes.storage_path IS 'Private storage.objects path in user-resumes. NULL only for legacy text imported from profiles.resume.';
COMMENT ON COLUMN public.profiles.resume IS 'Deprecated legacy resume text. New generation uses public.user_resumes.parsed_text.';
