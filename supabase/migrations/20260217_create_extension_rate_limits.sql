-- Extension rate limits table for persistent per-user rate limiting
-- Run this in Supabase SQL editor or via supabase db push

CREATE TABLE IF NOT EXISTS extension_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_extension_rate_limits_window
  ON extension_rate_limits (user_id, window_start);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_extension_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_extension_rate_limits_updated_at ON extension_rate_limits;
CREATE TRIGGER trigger_extension_rate_limits_updated_at
  BEFORE UPDATE ON extension_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_extension_rate_limits_updated_at();

-- RLS: Only service role can access this table (no client-side access)
ALTER TABLE extension_rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role key can read/write
-- This is intentional since rate limiting is server-side only
