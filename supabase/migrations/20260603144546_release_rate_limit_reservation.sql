-- Release-on-failure for rate-limit reservation.
--
-- check_and_increment_rate_limit() reserves a slot atomically before the
-- expensive Anthropic call. If that call fails (502 / 504 / network outage),
-- the user has burned 1/30 daily quota with zero output. This RPC refunds
-- the slot.
--
-- Semantics: decrement request_count by 1 floor 0. Only decrements within
-- the current 24h window (if window has rotated, no-op — the counter is
-- already at the new window's value and refunding would undercount).
--
-- Safe to call on a non-existent row (no-op).

CREATE OR REPLACE FUNCTION release_rate_limit_reservation(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row extension_rate_limits%ROWTYPE;
  v_window_cutoff TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
BEGIN
  -- Lock the row exclusively to prevent racing with check_and_increment
  SELECT * INTO v_row
  FROM extension_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Nothing to refund (no reservation existed)
    RETURN;
  END IF;

  IF v_row.window_start < v_window_cutoff THEN
    -- Window rotated since reservation — count belongs to new window,
    -- refunding would undercount. No-op.
    RETURN;
  END IF;

  IF v_row.request_count <= 0 THEN
    -- Defensive: never go negative.
    RETURN;
  END IF;

  UPDATE extension_rate_limits
  SET request_count = request_count - 1, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION release_rate_limit_reservation(UUID) TO service_role;
