-- ALE-56: Daily slots are identified and released exactly once. Model attempts
-- have separate, non-refundable short-window and weighted-work budgets.
CREATE TABLE public.generation_daily_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  released_at timestamptz
);
CREATE INDEX generation_daily_reservations_user_idx
  ON public.generation_daily_reservations (user_id, created_at);
ALTER TABLE public.generation_daily_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_daily_reservations FROM PUBLIC, anon, authenticated;

CREATE TABLE public.generation_admission_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  short_window_start timestamptz NOT NULL DEFAULT now(),
  short_attempts integer NOT NULL DEFAULT 0 CHECK (short_attempts >= 0),
  work_window_start timestamptz NOT NULL DEFAULT now(),
  work_units integer NOT NULL DEFAULT 0 CHECK (work_units >= 0),
  active_attempt_id uuid,
  active_until timestamptz
);
ALTER TABLE public.generation_admission_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.generation_admission_state FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.reserve_generation_daily_slot(
  p_user_id uuid, p_daily_limit integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_time timestamptz, reservation_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row public.extension_rate_limits%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_reservation uuid;
BEGIN
  IF p_daily_limit < 1 OR p_daily_limit > 100 THEN
    RAISE EXCEPTION 'Invalid daily limit';
  END IF;
  INSERT INTO public.extension_rate_limits (user_id, request_count, window_start)
    VALUES (p_user_id, 0, v_now) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_row FROM public.extension_rate_limits
    WHERE user_id = p_user_id FOR UPDATE;
  IF v_row.window_start <= v_now - interval '24 hours' THEN
    UPDATE public.extension_rate_limits SET request_count = 0,
      window_start = v_now WHERE user_id = p_user_id;
    v_row.request_count := 0;
    v_row.window_start := v_now;
  END IF;
  IF v_row.request_count >= p_daily_limit THEN
    RETURN QUERY SELECT false, 0, v_row.window_start + interval '24 hours', NULL::uuid;
    RETURN;
  END IF;
  -- An old reservation can no longer affect a current window; prune only
  -- after both the daily window and active lease have necessarily expired.
  DELETE FROM public.generation_daily_reservations
    WHERE user_id = p_user_id AND created_at < v_now - interval '48 hours';
  UPDATE public.extension_rate_limits SET request_count = request_count + 1
    WHERE user_id = p_user_id;
  INSERT INTO public.generation_daily_reservations (user_id, window_start)
    VALUES (p_user_id, v_row.window_start) RETURNING id INTO v_reservation;
  RETURN QUERY SELECT true, p_daily_limit - v_row.request_count - 1,
    v_row.window_start + interval '24 hours', v_reservation;
END;
$$;

CREATE FUNCTION public.release_generation_daily_slot(
  p_user_id uuid, p_reservation_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_reservation public.generation_daily_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_reservation FROM public.generation_daily_reservations
    WHERE id = p_reservation_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.released_at IS NOT NULL THEN
    RETURN false;
  END IF;
  UPDATE public.generation_daily_reservations SET released_at = clock_timestamp()
    WHERE id = p_reservation_id;
  UPDATE public.extension_rate_limits SET request_count = request_count - 1
    WHERE user_id = p_user_id AND window_start = v_reservation.window_start
      AND request_count > 0;
  RETURN true;
END;
$$;

CREATE FUNCTION public.start_generation_attempt(
  p_user_id uuid, p_reservation_id uuid, p_work_units integer,
  p_short_limit integer, p_work_limit integer
)
RETURNS TABLE(allowed boolean, denial_code text, retry_time timestamptz, attempt_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_state public.generation_admission_state%ROWTYPE;
  v_reservation public.generation_daily_reservations%ROWTYPE;
  v_daily_window timestamptz;
  v_now timestamptz := clock_timestamp();
  v_id uuid;
BEGIN
  IF p_work_units < 1 OR p_work_units > 8 OR
     p_short_limit < 1 OR p_short_limit > 100 OR
     p_work_limit < 1 OR p_work_limit > 1000 THEN
    RAISE EXCEPTION 'Invalid admission policy';
  END IF;
  SELECT * INTO v_reservation FROM public.generation_daily_reservations
    WHERE id = p_reservation_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.released_at IS NOT NULL OR v_reservation.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid daily reservation';
  END IF;
  SELECT window_start INTO v_daily_window FROM public.extension_rate_limits
    WHERE user_id = p_user_id FOR SHARE;
  IF v_daily_window IS DISTINCT FROM v_reservation.window_start OR
     v_daily_window + interval '24 hours' <= v_now THEN
    RAISE EXCEPTION 'Expired daily reservation';
  END IF;
  INSERT INTO public.generation_admission_state (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_state FROM public.generation_admission_state
    WHERE user_id = p_user_id FOR UPDATE;
  IF v_state.short_window_start <= v_now - interval '10 minutes' THEN
    v_state.short_window_start := v_now;
    v_state.short_attempts := 0;
  END IF;
  IF v_state.work_window_start <= v_now - interval '24 hours' THEN
    v_state.work_window_start := v_now;
    v_state.work_units := 0;
  END IF;
  -- Persist window rollovers even on denial so retry timestamps are truthful.
  UPDATE public.generation_admission_state SET
    short_window_start = v_state.short_window_start,
    short_attempts = v_state.short_attempts,
    work_window_start = v_state.work_window_start,
    work_units = v_state.work_units WHERE user_id = p_user_id;
  IF v_state.active_attempt_id IS NOT NULL AND v_state.active_until > v_now THEN
    RETURN QUERY SELECT false, 'GENERATION_IN_PROGRESS'::text, v_state.active_until, NULL::uuid;
    RETURN;
  END IF;
  IF v_state.short_attempts >= p_short_limit THEN
    RETURN QUERY SELECT false, 'SHORT_WINDOW_LIMIT_REACHED'::text,
      v_state.short_window_start + interval '10 minutes', NULL::uuid;
    RETURN;
  END IF;
  IF v_state.work_units + p_work_units > p_work_limit THEN
    RETURN QUERY SELECT false, 'WORK_BUDGET_REACHED'::text,
      v_state.work_window_start + interval '24 hours', NULL::uuid;
    RETURN;
  END IF;
  v_id := gen_random_uuid();
  UPDATE public.generation_admission_state SET
    short_attempts = v_state.short_attempts + 1,
    work_units = v_state.work_units + p_work_units,
    active_attempt_id = v_id,
    active_until = v_now + interval '3 minutes'
    WHERE user_id = p_user_id;
  UPDATE public.generation_daily_reservations SET used_at = v_now
    WHERE id = p_reservation_id;
  RETURN QUERY SELECT true, NULL::text, NULL::timestamptz, v_id;
END;
$$;

CREATE FUNCTION public.finish_generation_attempt(p_user_id uuid, p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.generation_admission_state SET active_attempt_id = NULL,
    active_until = NULL
    WHERE user_id = p_user_id AND active_attempt_id = p_attempt_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_generation_daily_slot(uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_generation_daily_slot(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_generation_attempt(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_generation_attempt(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_generation_daily_slot(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_generation_daily_slot(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_generation_attempt(uuid, uuid, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_generation_attempt(uuid, uuid) TO service_role;

-- Mixed-version callers must fail closed rather than alter identified slots
-- through an obsolete user-ID-only release during a rolling deployment.
DO $$ BEGIN
  IF to_regprocedure('public.check_and_increment_rate_limit(uuid,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid,integer) FROM service_role;
  END IF;
  IF to_regprocedure('public.release_rate_limit_reservation(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(uuid) FROM service_role;
  END IF;
END $$;
