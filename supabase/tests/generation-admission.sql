-- Run only against a disposable database with the new migration applied.
BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('99999999-9999-4999-8999-999999999999');
DO $$
DECLARE
  u uuid := '11111111-1111-4111-8111-111111111111';
  first_slot uuid;
  second_slot uuid;
  fresh_slot uuid;
  work_slot uuid;
  burst_slot uuid;
  first_attempt uuid;
  second_attempt uuid;
  admitted boolean;
  reason text;
  retry_at timestamptz;
BEGIN
  ASSERT NOT has_function_privilege('authenticated', 'public.reserve_generation_daily_slot(uuid,integer)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.release_generation_daily_slot(uuid,uuid)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.start_generation_attempt(uuid,uuid,integer,integer,integer)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.finish_generation_attempt(uuid,uuid)', 'EXECUTE');
  ASSERT NOT has_table_privilege('authenticated', 'public.generation_admission_state', 'SELECT');
  ASSERT NOT has_table_privilege('authenticated', 'public.generation_daily_reservations', 'SELECT');

  SELECT reservation_id INTO first_slot FROM public.reserve_generation_daily_slot(u,30);
  SELECT reservation_id INTO second_slot FROM public.reserve_generation_daily_slot(u,30);
  ASSERT first_slot IS NOT NULL AND second_slot IS NOT NULL AND first_slot <> second_slot;
  ASSERT NOT public.release_generation_daily_slot('99999999-9999-4999-8999-999999999999',first_slot);
  ASSERT (SELECT request_count FROM public.extension_rate_limits WHERE user_id=u)=2;
  ASSERT NOT has_function_privilege('service_role', 'public.check_and_increment_rate_limit(uuid,integer)', 'EXECUTE');
  ASSERT NOT has_function_privilege('service_role', 'public.release_rate_limit_reservation(uuid)', 'EXECUTE');
  SELECT x.allowed,x.attempt_id INTO admitted,first_attempt
    FROM public.start_generation_attempt(u,first_slot,8,6,60) x;
  ASSERT admitted AND first_attempt IS NOT NULL;
  SELECT x.allowed,x.denial_code,x.retry_time INTO admitted,reason,retry_at
    FROM public.start_generation_attempt(u,second_slot,8,6,60) x;
  ASSERT NOT admitted AND reason='GENERATION_IN_PROGRESS' AND retry_at > now();
  ASSERT NOT public.finish_generation_attempt(u,gen_random_uuid());
  ASSERT public.finish_generation_attempt(u,first_attempt);
  ASSERT NOT public.finish_generation_attempt(u,first_attempt);
  SELECT x.allowed,x.attempt_id INTO admitted,second_attempt
    FROM public.start_generation_attempt(u,second_slot,8,6,60) x;
  ASSERT admitted AND second_attempt IS NOT NULL;
  ASSERT public.finish_generation_attempt(u,second_attempt);
  ASSERT (SELECT work_units FROM public.generation_admission_state WHERE user_id=u)=16;

  ASSERT public.release_generation_daily_slot(u,first_slot);
  ASSERT NOT public.release_generation_daily_slot(u,first_slot);
  ASSERT (SELECT work_units=16 AND short_attempts=2 FROM public.generation_admission_state WHERE user_id=u),
    'Refunding a daily slot erased consumed provider work';
  ASSERT (SELECT request_count FROM public.extension_rate_limits WHERE user_id=u)=1;
  UPDATE public.extension_rate_limits SET window_start=now()-interval '25 hours' WHERE user_id=u;
  SELECT reservation_id INTO fresh_slot FROM public.reserve_generation_daily_slot(u,30);
  ASSERT fresh_slot IS NOT NULL;
  ASSERT public.release_generation_daily_slot(u,second_slot);
  ASSERT (SELECT request_count FROM public.extension_rate_limits WHERE user_id=u)=1,
    'Late release changed a new window';

  UPDATE public.generation_admission_state SET work_units=59, short_attempts=0,
    active_attempt_id=NULL,active_until=NULL WHERE user_id=u;
  SELECT reservation_id INTO work_slot FROM public.reserve_generation_daily_slot(u,30);
  SELECT x.allowed,x.denial_code INTO admitted,reason
    FROM public.start_generation_attempt(u,work_slot,2,6,60) x;
  ASSERT NOT admitted AND reason='WORK_BUDGET_REACHED';
  ASSERT (SELECT work_units FROM public.generation_admission_state WHERE user_id=u)=59;
  UPDATE public.generation_admission_state SET work_units=0,short_attempts=6 WHERE user_id=u;
  SELECT reservation_id INTO burst_slot FROM public.reserve_generation_daily_slot(u,30);
  SELECT x.allowed,x.denial_code INTO admitted,reason
    FROM public.start_generation_attempt(u,burst_slot,1,6,60) x;
  ASSERT NOT admitted AND reason='SHORT_WINDOW_LIMIT_REACHED';
END;
$$;
ROLLBACK;
