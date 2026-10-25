-- 2026-05-21 — add resume + target JD columns to profiles
-- additive, nullable, no backfill required
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS resume TEXT,
  ADD COLUMN IF NOT EXISTS target_job_description TEXT,
  ADD COLUMN IF NOT EXISTS resume_updated_at TIMESTAMPTZ;

-- Comments for future readers
COMMENT ON COLUMN profiles.resume IS 'User-pasted resume text used to ground generated outreach drafts. Max 50000 chars enforced at API layer.';
COMMENT ON COLUMN profiles.target_job_description IS 'Optional JD the user is targeting. Max 20000 chars enforced at API layer.';
COMMENT ON COLUMN profiles.resume_updated_at IS 'Wall-clock of the most recent resume edit. Used by extension to invalidate caches.';
