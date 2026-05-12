-- Add unique constraint on user_preferences.user_id (required for ON CONFLICT upsert)
-- and atomic increment RPCs for style merge to prevent race conditions.

-- 1. Unique constraint on user_id
ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);

-- 2. Atomic increment for approved messages with style pattern merge
CREATE OR REPLACE FUNCTION public.increment_approved_count(
  p_user_id UUID,
  p_style_patterns JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_preferences (user_id, style_patterns, approved_message_count)
  VALUES (p_user_id, p_style_patterns, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    style_patterns = p_style_patterns,
    approved_message_count = COALESCE(user_preferences.approved_message_count, 0) + 1,
    updated_at = NOW();
END;
$$;

-- 3. Atomic increment for rejected messages
CREATE OR REPLACE FUNCTION public.increment_rejected_count(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_preferences (user_id, rejected_message_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    rejected_message_count = COALESCE(user_preferences.rejected_message_count, 0) + 1,
    updated_at = NOW();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_approved_count(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_rejected_count(UUID) TO authenticated, service_role;
