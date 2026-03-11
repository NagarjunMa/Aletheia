CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_user_id UUID,
  p_daily_limit INT DEFAULT 30
)
RETURNS TABLE(allowed BOOLEAN, remaining INT, reset_time TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row extension_rate_limits%ROWTYPE;
  v_window_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
BEGIN
  -- Lock the row exclusively to prevent concurrent races
  SELECT * INTO v_row
  FROM extension_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First ever request — insert and allow
    INSERT INTO extension_rate_limits (user_id, request_count, window_start)
    VALUES (p_user_id, 1, NOW());
    RETURN QUERY SELECT TRUE, p_daily_limit - 1, NOW() + INTERVAL '24 hours';
    RETURN;
  END IF;

  IF v_row.window_start < v_window_cutoff THEN
    -- Window expired — reset
    UPDATE extension_rate_limits
    SET request_count = 1, window_start = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT TRUE, p_daily_limit - 1, NOW() + INTERVAL '24 hours';
    RETURN;
  END IF;

  IF v_row.request_count >= p_daily_limit THEN
    -- Limit hit
    RETURN QUERY SELECT FALSE, 0, v_row.window_start + INTERVAL '24 hours';
    RETURN;
  END IF;

  -- Increment
  UPDATE extension_rate_limits
  SET request_count = request_count + 1, updated_at = NOW()
  WHERE user_id = p_user_id;
  RETURN QUERY SELECT TRUE, p_daily_limit - v_row.request_count - 1,
    v_row.window_start + INTERVAL '24 hours';
END;
$$;
