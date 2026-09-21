-- ALE-53: additive service-only queue. Financial truth remains credit_ledger.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE public.refund_review_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 attempt_id uuid NOT NULL UNIQUE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 debit_id uuid UNIQUE REFERENCES public.credit_ledger(id) ON DELETE RESTRICT,
 debit_uncertain boolean NOT NULL DEFAULT false,
 category text NOT NULL CHECK (category IN ('yc_application','linkedin_connection','cold_email','linkedin_inmail')),
 failure_code text NOT NULL CHECK (failure_code IN ('GENERATION_FAILED','MODEL_TIMEOUT','MODEL_ABORTED','MODEL_REQUEST_FAILED','OUTPUT_VALIDATION_FAILED','INPUT_VALIDATION_FAILED','GROUNDING_CONTEXT_UNAVAILABLE','FETCH_ABORTED','PROVIDER_FETCH_FAILED','CREDIT_REFUND_FAILED','RATE_LIMIT_RELEASE_FAILED')),
 decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.refund_review_cases (created_at DESC, id);
CREATE INDEX ON public.refund_review_cases (user_id, created_at DESC);
CREATE TABLE public.refund_review_events (
 id uuid PRIMARY KEY,
 case_id uuid NOT NULL REFERENCES public.refund_review_cases(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 action text NOT NULL CHECK (action IN ('approve','reject','comment')),
 note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.refund_review_events (case_id, created_at, id);
ALTER TABLE public.refund_review_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_review_cases, public.refund_review_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.refund_review_cases TO service_role;
GRANT SELECT, INSERT ON public.refund_review_events TO service_role;

-- Invoker functions are callable only by service_role. No browser RLS bypass.
CREATE FUNCTION public.capture_generation_failure(p_failure jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE d public.credit_ledger%ROWTYPE; c public.refund_review_cases%ROWTYPE; result uuid;
BEGIN
 IF p_failure - ARRAY['attemptId','userId','category','debitId','code','debitUncertain'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid failure'; END IF;
 IF p_failure->>'debitId' IS NOT NULL THEN
  SELECT * INTO d FROM public.credit_ledger WHERE id=(p_failure->>'debitId')::uuid AND user_id=(p_failure->>'userId')::uuid AND reason='generation_debit' AND delta<0 AND category=p_failure->>'category';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid debit'; END IF;
 END IF;
 INSERT INTO public.refund_review_cases(attempt_id,user_id,debit_id,category,failure_code,debit_uncertain)
 VALUES((p_failure->>'attemptId')::uuid,(p_failure->>'userId')::uuid,(p_failure->>'debitId')::uuid,p_failure->>'category',p_failure->>'code',coalesce((p_failure->>'debitUncertain')::boolean,false))
 ON CONFLICT DO NOTHING RETURNING id INTO result;
 IF result IS NULL THEN
  SELECT * INTO c FROM public.refund_review_cases WHERE attempt_id=(p_failure->>'attemptId')::uuid OR debit_id=(p_failure->>'debitId')::uuid ORDER BY created_at LIMIT 1;
  IF c.user_id IS DISTINCT FROM (p_failure->>'userId')::uuid OR c.category IS DISTINCT FROM p_failure->>'category' OR c.debit_id IS DISTINCT FROM (p_failure->>'debitId')::uuid THEN RAISE EXCEPTION 'Conflicting failure'; END IF;
  result := c.id;
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.refund_case_json(p_case public.refund_review_cases) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
 SELECT to_jsonb(p_case) || jsonb_build_object('amount',coalesce(-d.delta,0), 'credit_status',
 CASE WHEN p_case.debit_id IS NULL AND p_case.debit_uncertain THEN 'unknown' WHEN p_case.debit_id IS NULL THEN 'uncharged'
 WHEN EXISTS(SELECT 1 FROM public.credit_ledger r WHERE r.related_ledger_id=p_case.debit_id AND r.reason='generation_refund') THEN 'credited' ELSE 'pending' END)
 FROM (SELECT 1) x LEFT JOIN public.credit_ledger d ON d.id=p_case.debit_id;
$$;
CREATE FUNCTION public.list_refund_cases(p_query jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE rows jsonb; n integer := coalesce((p_query->>'offset')::integer,0);
BEGIN
 IF n<0 OR n>10000 THEN RAISE EXCEPTION 'Invalid offset'; END IF;
 SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id),'[]'::jsonb) INTO rows FROM (
 SELECT public.refund_case_json(c) item,c.created_at,c.id FROM public.refund_review_cases c
 WHERE (p_query->>'userId' IS NULL OR c.user_id=(p_query->>'userId')::uuid)
 AND (p_query->>'category' IS NULL OR c.category=p_query->>'category')
 AND (p_query->>'since' IS NULL OR c.created_at>=(p_query->>'since')::timestamptz)
 AND (p_query->>'until' IS NULL OR c.created_at<(p_query->>'until')::timestamptz)
 AND (p_query->>'status' IS NULL OR
  CASE WHEN p_query->>'status' IN ('credited','uncharged','unknown') THEN public.refund_case_json(c)->>'credit_status'=p_query->>'status'
  ELSE c.decision=p_query->>'status' AND public.refund_case_json(c)->>'credit_status'='pending' END)
 ORDER BY c.created_at DESC,c.id OFFSET n LIMIT 51) selected;
 RETURN jsonb_build_object('items',CASE WHEN jsonb_array_length(rows)>50 THEN rows-50 ELSE rows END,'hasMore',jsonb_array_length(rows)>50);
END $$;
CREATE FUNCTION public.get_refund_case(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE c public.refund_review_cases%ROWTYPE; events jsonb;
BEGIN
 SELECT * INTO c FROM public.refund_review_cases WHERE id=p_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at,e.id),'[]'::jsonb) INTO events FROM
 (SELECT id,actor_id,action,note,created_at FROM public.refund_review_events WHERE case_id=p_id ORDER BY created_at DESC,id DESC LIMIT 101) e;
 RETURN jsonb_build_object('case',public.refund_case_json(c),'events',CASE WHEN jsonb_array_length(events)>100 THEN events-0 ELSE events END,'hasMoreEvents',jsonb_array_length(events)>100);
END $$;
CREATE FUNCTION public.review_refund_case(p_id uuid,p_actor uuid,p_action text,p_note text,p_action_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE c public.refund_review_cases%ROWTYPE; e public.refund_review_events%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR p_action_id IS NULL OR p_action NOT IN ('approve','reject','comment') OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 OR p_note IS NULL THEN RAISE EXCEPTION 'Invalid action'; END IF;
 SELECT * INTO c FROM public.refund_review_cases WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
 SELECT * INTO e FROM public.refund_review_events WHERE id=p_action_id;
 IF FOUND THEN
  IF e.case_id<>p_id OR e.actor_id<>p_actor OR e.action<>p_action OR e.note<>btrim(p_note) THEN RAISE EXCEPTION 'Conflicting action'; END IF;
  RETURN public.get_refund_case(p_id);
 END IF;
 IF p_action <> 'comment' THEN
  IF public.refund_case_json(c)->>'credit_status' <> 'pending' OR c.decision <> 'pending' THEN RAISE EXCEPTION 'Case not eligible'; END IF;
  UPDATE public.refund_review_cases SET decision=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END WHERE id=p_id;
 END IF;
 INSERT INTO public.refund_review_events(id,case_id,actor_id,action,note) VALUES(p_action_id,p_id,p_actor,p_action,btrim(p_note));
 RETURN public.get_refund_case(p_id);
END $$;
-- Approval commits separately; execution errors leave an approved/pending case.
-- Existing refund RPC locks the debit and has a unique refund index, also used
-- by automatic restoration. Amount and owner are derived, never supplied by UI.
CREATE FUNCTION public.execute_reviewed_refund(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE c public.refund_review_cases%ROWTYPE; d public.credit_ledger%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.refund_review_cases WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.decision<>'approved' OR c.debit_id IS NULL THEN RAISE EXCEPTION 'Case not approved'; END IF;
 SELECT * INTO d FROM public.credit_ledger WHERE id=c.debit_id AND user_id=c.user_id AND reason='generation_debit' AND delta<0;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid debit'; END IF;
 PERFORM public.refund_generation_credits(d.user_id,-d.delta,d.id,jsonb_build_object('reason','manual_review','case_id',c.id));
 RETURN public.get_refund_case(p_id);
END $$;

REVOKE ALL ON FUNCTION public.capture_generation_failure(jsonb),public.refund_case_json(public.refund_review_cases),public.list_refund_cases(jsonb),public.get_refund_case(uuid),public.review_refund_case(uuid,uuid,text,text,uuid),public.execute_reviewed_refund(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_generation_failure(jsonb),public.refund_case_json(public.refund_review_cases),public.list_refund_cases(jsonb),public.get_refund_case(uuid),public.review_refund_case(uuid,uuid,text,text,uuid),public.execute_reviewed_refund(uuid) TO service_role;

-- Frozen weekly receipt records; preparation never sends mail or changes credit.
CREATE TABLE public.refund_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
 credits integer NOT NULL CHECK(credits>0), generation_count integer NOT NULL CHECK(generation_count>0),
 delivery_status text NOT NULL DEFAULT 'prepared' CHECK(delivery_status IN ('prepared','sending','sent','uncertain','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,period_start,period_end),
 CHECK(period_end-period_start=interval '7 days')
);
CREATE TABLE public.refund_receipt_items (
 refund_id uuid PRIMARY KEY REFERENCES public.credit_ledger(id) ON DELETE RESTRICT,
 receipt_id uuid NOT NULL REFERENCES public.refund_receipts(id) ON DELETE CASCADE
);
ALTER TABLE public.refund_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_receipt_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_receipts,public.refund_receipt_items FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.refund_receipts TO service_role;
GRANT SELECT,INSERT ON public.refund_receipt_items TO service_role;
CREATE INDEX ON public.refund_receipts(created_at DESC,id);
CREATE FUNCTION public.prepare_refund_receipts(p_start timestamptz,p_end timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE row record; receipt uuid; prepared integer:=0; late_count integer;
BEGIN
 IF p_start IS NULL OR p_end IS NULL OR p_end-p_start<>interval '7 days' OR p_end>now() THEN RAISE EXCEPTION 'Invalid closed weekly period'; END IF;
 -- Serialize preparation only, not credit mutations. SKIP LOCKED is unnecessary
 -- for this bounded operator invocation; timeout is controlled by the caller.
 PERFORM pg_advisory_xact_lock(530053);
 FOR row IN
 SELECT r.user_id,sum(r.delta)::int credits,count(*)::int count,array_agg(r.id) ids
 FROM public.credit_ledger r
 JOIN public.credit_ledger d ON d.id=r.related_ledger_id AND d.user_id=r.user_id AND d.reason='generation_debit' AND -d.delta=r.delta
 WHERE r.reason='generation_refund' AND r.created_at>=p_start AND r.created_at<p_end
 AND NOT EXISTS(SELECT 1 FROM public.refund_receipt_items i WHERE i.refund_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM public.refund_receipts e WHERE e.user_id=r.user_id AND e.period_start=p_start AND e.period_end=p_end)
 GROUP BY r.user_id ORDER BY r.user_id LIMIT 100
 LOOP
 INSERT INTO public.refund_receipts(user_id,period_start,period_end,credits,generation_count)
 VALUES(row.user_id,p_start,p_end,row.credits,row.count) RETURNING id INTO receipt;
 INSERT INTO public.refund_receipt_items(refund_id,receipt_id) SELECT unnest(row.ids),receipt;
 prepared:=prepared+1;
 END LOOP;
 -- Surface late-committing refunds rather than mutating a possibly sent receipt.
 SELECT count(*) INTO late_count FROM public.credit_ledger r
 WHERE r.reason='generation_refund' AND r.created_at>=p_start AND r.created_at<p_end
 AND NOT EXISTS(SELECT 1 FROM public.refund_receipt_items i WHERE i.refund_id=r.id)
 AND EXISTS(SELECT 1 FROM public.refund_receipts e WHERE e.user_id=r.user_id AND e.period_start=p_start AND e.period_end=p_end);
 RETURN jsonb_build_object('prepared',prepared,'possiblyMore',prepared=100,'lateRefunds',late_count);
END $$;
CREATE FUNCTION public.list_refund_receipts(p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE rows jsonb;
BEGIN
 IF p_offset<0 OR p_offset>10000 THEN RAISE EXCEPTION 'Invalid offset'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY created_at DESC,id),'[]'::jsonb) INTO rows FROM
 (SELECT * FROM public.refund_receipts ORDER BY created_at DESC,id OFFSET p_offset LIMIT 51) r;
 RETURN jsonb_build_object('items',CASE WHEN jsonb_array_length(rows)>50 THEN rows-50 ELSE rows END,'hasMore',jsonb_array_length(rows)>50);
END $$;
REVOKE ALL ON FUNCTION public.prepare_refund_receipts(timestamptz,timestamptz),public.list_refund_receipts(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_refund_receipts(timestamptz,timestamptz),public.list_refund_receipts(integer) TO service_role;

CREATE TABLE public.refund_receipt_delivery (
 receipt_id uuid PRIMARY KEY REFERENCES public.refund_receipts(id) ON DELETE CASCADE,
 lease_id uuid, lease_until timestamptz, first_attempt_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 payload jsonb, provider_id uuid, last_code text CHECK(last_code IN ('EMAIL_UNCONFIRMED','RECIPIENT_UNAVAILABLE','RETRY_WINDOW_EXPIRED')),
 CHECK(payload IS NULL OR jsonb_typeof(payload)='object')
);
CREATE TABLE public.refund_receipt_schedule (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), anchor timestamptz NOT NULL, next_start timestamptz NOT NULL
);
ALTER TABLE public.refund_receipt_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_receipt_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_receipt_delivery,public.refund_receipt_schedule FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.refund_receipt_delivery,public.refund_receipt_schedule TO service_role;
CREATE INDEX ON public.credit_ledger(created_at,id) WHERE reason='generation_refund';
CREATE FUNCTION public.prepare_next_refund_week(p_anchor timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE state public.refund_receipt_schedule%ROWTYPE; result jsonb := '{}'::jsonb; late_count integer;
BEGIN
 IF p_anchor IS NULL OR p_anchor>now() OR (p_anchor<now()-interval '2 years' AND NOT EXISTS(SELECT 1 FROM public.refund_receipt_schedule)) THEN RAISE EXCEPTION 'Invalid receipt anchor'; END IF;
 INSERT INTO public.refund_receipt_schedule(singleton,anchor,next_start) VALUES(true,p_anchor,p_anchor) ON CONFLICT DO NOTHING;
 SELECT * INTO state FROM public.refund_receipt_schedule WHERE singleton FOR UPDATE;
 IF state.anchor<>p_anchor THEN RAISE EXCEPTION 'Receipt anchor cannot change'; END IF;
 IF state.next_start+interval '7 days'<=now() THEN
  result:=public.prepare_refund_receipts(state.next_start,state.next_start+interval '7 days');
  IF NOT (result->>'possiblyMore')::boolean THEN
   UPDATE public.refund_receipt_schedule SET next_start=state.next_start+interval '7 days' WHERE singleton RETURNING * INTO state;
  END IF;
 END IF;
 -- Reconcile independently of the forward cursor, including on caught-up runs.
 -- A transaction may commit an old NOW()-timestamped refund after its week was
 -- frozen. Never mutate that receipt or re-credit; surface the orphan for review.
 -- Cap the result at 100 (+ one overflow sentinel); caller's DB deadline applies.
 SELECT count(*) INTO late_count FROM (
  SELECT r.id FROM public.credit_ledger r
  JOIN public.credit_ledger d ON d.id=r.related_ledger_id AND d.user_id=r.user_id AND d.reason='generation_debit' AND -d.delta=r.delta
  WHERE r.reason='generation_refund' AND r.created_at>=state.anchor AND r.created_at<state.next_start
  AND NOT EXISTS(SELECT 1 FROM public.refund_receipt_items i WHERE i.refund_id=r.id)
  LIMIT 101
 ) orphaned;
 RETURN result||jsonb_build_object('caughtUp',state.next_start+interval '7 days'>now(),
  'lateRefunds',least(late_count,100),'lateRefundsMore',late_count>100);
END $$;

CREATE FUNCTION public.claim_refund_receipt() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r public.refund_receipts%ROWTYPE; d public.refund_receipt_delivery%ROWTYPE; lease uuid:=gen_random_uuid();
BEGIN
 SELECT e.* INTO r FROM public.refund_receipts e LEFT JOIN public.refund_receipt_delivery x ON x.receipt_id=e.id
 WHERE e.delivery_status IN ('prepared','sending','uncertain') AND coalesce(x.attempts,0)<3
 AND (x.lease_until IS NULL OR x.lease_until<now()) AND coalesce(x.next_attempt_at,now())<=now()
 AND (x.first_attempt_at IS NULL OR x.first_attempt_at>now()-interval '23 hours')
 ORDER BY e.created_at,e.id LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 INSERT INTO public.refund_receipt_delivery(receipt_id) VALUES(r.id) ON CONFLICT DO NOTHING;
 UPDATE public.refund_receipt_delivery SET lease_id=lease,lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 WHERE receipt_id=r.id RETURNING * INTO d;
 UPDATE public.refund_receipts SET delivery_status='sending' WHERE id=r.id;
 RETURN jsonb_build_object('receipt',to_jsonb(r),'leaseId',lease,'payload',d.payload);
END $$;
CREATE FUNCTION public.freeze_refund_receipt_payload(p_id uuid,p_lease uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.refund_receipt_delivery%ROWTYPE;
BEGIN
 IF p_payload IS NULL OR p_payload-ARRAY['from','to','subject','text']<>'{}'::jsonb OR
 jsonb_typeof(p_payload->'to') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'to')<>1 OR
 length(p_payload->>'from') NOT BETWEEN 3 AND 254 OR length(p_payload->'to'->>0) NOT BETWEEN 3 AND 254 OR
 length(p_payload->>'subject') NOT BETWEEN 1 AND 100 OR length(p_payload->>'text') NOT BETWEEN 1 AND 2000 OR
 NOT(p_payload ?& ARRAY['from','to','subject','text']) THEN RAISE EXCEPTION 'Invalid receipt payload'; END IF;
 SELECT * INTO d FROM public.refund_receipt_delivery WHERE receipt_id=p_id AND lease_id=p_lease AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Receipt lease expired'; END IF;
 IF d.payload IS NULL THEN UPDATE public.refund_receipt_delivery SET payload=p_payload WHERE receipt_id=p_id; RETURN p_payload; END IF;
 RETURN d.payload;
END $$;
CREATE FUNCTION public.finish_refund_receipt(p_id uuid,p_lease uuid,p_provider uuid,p_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.refund_receipt_delivery%ROWTYPE;
BEGIN
 IF p_provider IS NULL AND (p_code IS NULL OR p_code NOT IN ('EMAIL_UNCONFIRMED','RECIPIENT_UNAVAILABLE')) THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 -- Match the same lock order as claim: receipt then delivery.
 PERFORM 1 FROM public.refund_receipts WHERE id=p_id FOR UPDATE;
 SELECT * INTO d FROM public.refund_receipt_delivery WHERE receipt_id=p_id AND lease_id=p_lease FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.refund_receipt_delivery SET provider_id=p_provider,last_code=CASE WHEN p_provider IS NULL THEN p_code ELSE NULL END,
 payload=CASE WHEN p_provider IS NOT NULL THEN NULL ELSE payload END, lease_id=NULL,lease_until=NULL,next_attempt_at=now()+interval '1 minute' WHERE receipt_id=p_id;
 UPDATE public.refund_receipts SET delivery_status=CASE WHEN p_provider IS NOT NULL THEN 'sent' WHEN p_code='RECIPIENT_UNAVAILABLE' THEN 'failed' ELSE 'uncertain' END WHERE id=p_id;
 RETURN true;
END $$;
-- Expired provider deduplication windows must never be blindly retried.
CREATE FUNCTION public.expire_refund_receipt_leases() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE changed integer;
BEGIN
 WITH expired AS (SELECT e.id FROM public.refund_receipts e JOIN public.refund_receipt_delivery d ON d.receipt_id=e.id
 WHERE e.delivery_status='sending' AND d.lease_until<now() ORDER BY e.created_at LIMIT 100 FOR UPDATE OF e SKIP LOCKED)
 UPDATE public.refund_receipts SET delivery_status='uncertain' WHERE id IN(SELECT id FROM expired);
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.prepare_next_refund_week(timestamptz),public.claim_refund_receipt(),public.freeze_refund_receipt_payload(uuid,uuid,jsonb),public.finish_refund_receipt(uuid,uuid,uuid,text),public.expire_refund_receipt_leases() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_next_refund_week(timestamptz),public.claim_refund_receipt(),public.freeze_refund_receipt_payload(uuid,uuid,jsonb),public.finish_refund_receipt(uuid,uuid,uuid,text),public.expire_refund_receipt_leases() TO service_role;

COMMIT;
