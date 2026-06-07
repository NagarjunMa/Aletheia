-- Phase 1 security hardening for privileged RPCs.
--
-- These functions intentionally use SECURITY DEFINER so server-side extension
-- routes can perform atomic updates against RLS-protected tables. Because
-- SECURITY DEFINER bypasses caller RLS, they must be callable only through the
-- service-role server path, never directly by anon/authenticated clients.

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id UUID,
  p_daily_limit INT DEFAULT 30
)
RETURNS TABLE(allowed BOOLEAN, remaining INT, reset_time TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.extension_rate_limits%ROWTYPE;
  v_window_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
BEGIN
  SELECT * INTO v_row
  FROM public.extension_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.extension_rate_limits (user_id, request_count, window_start)
    VALUES (p_user_id, 1, NOW());
    RETURN QUERY SELECT TRUE, p_daily_limit - 1, NOW() + INTERVAL '24 hours';
    RETURN;
  END IF;

  IF v_row.window_start < v_window_cutoff THEN
    UPDATE public.extension_rate_limits
    SET request_count = 1, window_start = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT TRUE, p_daily_limit - 1, NOW() + INTERVAL '24 hours';
    RETURN;
  END IF;

  IF v_row.request_count >= p_daily_limit THEN
    RETURN QUERY SELECT FALSE, 0, v_row.window_start + INTERVAL '24 hours';
    RETURN;
  END IF;

  UPDATE public.extension_rate_limits
  SET request_count = request_count + 1, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT TRUE, p_daily_limit - v_row.request_count - 1,
    v_row.window_start + INTERVAL '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_rate_limit_reservation(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.extension_rate_limits%ROWTYPE;
  v_window_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
BEGIN
  SELECT * INTO v_row
  FROM public.extension_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.window_start < v_window_cutoff THEN
    RETURN;
  END IF;

  IF v_row.request_count <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.extension_rate_limits
  SET request_count = request_count - 1, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_approved_count(
  p_user_id UUID,
  p_style_patterns JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_preferences (
    user_id,
    style_patterns,
    approved_message_count
  )
  VALUES (p_user_id, p_style_patterns, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    style_patterns = p_style_patterns,
    approved_message_count = COALESCE(user_preferences.approved_message_count, 0) + 1,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_rejected_count(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, rejected_message_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET
    rejected_message_count = COALESCE(user_preferences.rejected_message_count, 0) + 1,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(UUID, INT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_rate_limit_reservation(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_approved_count(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_rejected_count(UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(UUID, INT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_approved_count(UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_rejected_count(UUID)
  TO service_role;
