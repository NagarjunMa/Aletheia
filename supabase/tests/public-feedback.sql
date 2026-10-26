BEGIN;
DO $$
DECLARE
  accepted boolean;
  reset_at timestamptz;
  subject text := repeat('a', 64);
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.reserve_public_feedback_slot(text)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.reserve_public_feedback_slot(text)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.reserve_public_feedback_slot(text)', 'EXECUTE');
  ASSERT NOT has_table_privilege('authenticated', 'public.public_feedback_limits', 'SELECT');
  ASSERT NOT has_table_privilege('anon', 'public.public_feedback_limits', 'INSERT');
  FOR i IN 1..5 LOOP
    SELECT allowed INTO accepted FROM public.reserve_public_feedback_slot(subject);
    ASSERT accepted;
  END LOOP;
  SELECT allowed, retry_time INTO accepted, reset_at FROM public.reserve_public_feedback_slot(subject);
  ASSERT NOT accepted AND reset_at > clock_timestamp();
  ASSERT (SELECT request_count=5 FROM public.public_feedback_limits WHERE subject_hash=subject);
  UPDATE public.public_feedback_limits SET window_start=clock_timestamp()-interval '11 minutes' WHERE subject_hash=subject;
  SELECT allowed INTO accepted FROM public.reserve_public_feedback_slot(subject);
  ASSERT accepted;
  ASSERT (SELECT request_count=1 FROM public.public_feedback_limits WHERE subject_hash=subject);
  BEGIN
    PERFORM public.reserve_public_feedback_slot('raw-address-not-allowed');
    RAISE EXCEPTION 'Malformed subject was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid feedback subject' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
