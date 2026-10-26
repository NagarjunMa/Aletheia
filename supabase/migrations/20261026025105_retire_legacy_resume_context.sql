-- The 20260615190912 migration already copied legacy resumes into user_resumes.
-- Surviving text here is an obsolete duplicate, including copies of records
-- the user has since deleted. Never recreate those deleted records on upgrade.
UPDATE public.profiles SET resume = NULL, resume_updated_at = NULL
WHERE resume IS NOT NULL OR resume_updated_at IS NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_legacy_resume_retired CHECK (resume IS NULL);
COMMENT ON COLUMN public.profiles.resume IS 'Retired: must be NULL. User-owned resume context lives only in user_resumes.';
