-- Run only in the disposable local database created by scripts/test-refund-review-db.mjs.
BEGIN;
INSERT INTO public.profiles(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
SELECT public.grant_trial_credits_once('11111111-1111-4111-8111-111111111111',40);
CREATE TEMP TABLE refs AS SELECT reservation_id debit FROM public.reserve_generation_credits('11111111-1111-4111-8111-111111111111','cold_email',4);
DO $$ DECLARE c uuid; again uuid; d uuid; a uuid := gen_random_uuid(); result jsonb; BEGIN
 SELECT debit INTO d FROM refs;
 c:=public.capture_generation_failure(jsonb_build_object('attemptId',a,'userId','11111111-1111-4111-8111-111111111111','category','cold_email','debitId',d,'code','MODEL_TIMEOUT'));
 again:=public.capture_generation_failure(jsonb_build_object('attemptId',a,'userId','11111111-1111-4111-8111-111111111111','category','cold_email','debitId',d,'code','MODEL_TIMEOUT'));
 ASSERT c=again, 'capture must deduplicate';
 BEGIN
 PERFORM public.capture_generation_failure(jsonb_build_object('attemptId',gen_random_uuid(),'userId','22222222-2222-4222-8222-222222222222','category','cold_email','debitId',d,'code','MODEL_TIMEOUT'));
 RAISE EXCEPTION 'cross-user debit accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='cross-user debit accepted' THEN RAISE; END IF; END;
 result:=public.get_refund_case(c); ASSERT result->'case'->>'credit_status'='pending'; ASSERT (result->'case'->>'amount')::int=4;
 PERFORM public.review_refund_case(c,'22222222-2222-4222-8222-222222222222','comment','Investigating',gen_random_uuid());
 ASSERT (SELECT balance FROM public.user_credit_accounts WHERE user_id='11111111-1111-4111-8111-111111111111')=36;
 PERFORM public.review_refund_case(c,'22222222-2222-4222-8222-222222222222','approve','Confirmed failure',a);
 PERFORM public.review_refund_case(c,'22222222-2222-4222-8222-222222222222','approve','Confirmed failure',a);
 ASSERT (SELECT count(*) FROM public.refund_review_events WHERE case_id=c)=2, 'repeated action duplicated event';
 ASSERT public.get_refund_case(c)->'case'->>'credit_status'='pending', 'approval is not payment';
 PERFORM public.execute_reviewed_refund(c);
 PERFORM public.execute_reviewed_refund(c);
 PERFORM public.refund_generation_credits('11111111-1111-4111-8111-111111111111',4,d,'{}');
 ASSERT (SELECT balance FROM public.user_credit_accounts WHERE user_id='11111111-1111-4111-8111-111111111111')=40, 'duplicate credit';
 ASSERT (SELECT count(*) FROM public.credit_ledger WHERE related_ledger_id=d AND reason='generation_refund')=1;
 ASSERT public.get_refund_case(c)->'case'->>'credit_status'='credited';
 c:=public.capture_generation_failure(jsonb_build_object('attemptId',gen_random_uuid(),'userId','11111111-1111-4111-8111-111111111111','category','cold_email','debitId',NULL,'code','MODEL_TIMEOUT'));
 ASSERT public.get_refund_case(c)->'case'->>'credit_status'='uncharged';
 BEGIN
 PERFORM public.review_refund_case(c,'22222222-2222-4222-8222-222222222222','approve','No debit',gen_random_uuid());
 RAISE EXCEPTION 'uncharged approval accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='uncharged approval accepted' THEN RAISE; END IF; END;
END $$;
DO $$ DECLARE start_at timestamptz:=date_trunc('day',now())-interval '14 days'; end_at timestamptz:=date_trunc('day',now())-interval '7 days'; result jsonb; BEGIN
 UPDATE public.credit_ledger SET created_at=start_at+interval '1 day' WHERE reason='generation_refund';
 result:=public.prepare_refund_receipts(start_at,end_at); ASSERT (result->>'prepared')::int=1;
 result:=public.prepare_refund_receipts(start_at,end_at); ASSERT (result->>'prepared')::int=0;
 ASSERT (SELECT count(*) FROM public.refund_receipts)=1;
 ASSERT (SELECT credits FROM public.refund_receipts)=4;
 ASSERT (SELECT delivery_status FROM public.refund_receipts)='prepared';
 ASSERT (SELECT count(*) FROM public.refund_receipt_items)=1;
 ASSERT (SELECT balance FROM public.user_credit_accounts WHERE user_id='11111111-1111-4111-8111-111111111111')=40;
END $$;
DO $$ DECLARE claim jsonb; second jsonb; receipt uuid; lease uuid; payload jsonb:=jsonb_build_object('from','receipts@example.com','to',jsonb_build_array('verified@example.com'),'subject','Credits restored','text','4 application credits restored.'); BEGIN
 claim:=public.claim_refund_receipt(); receipt:=(claim->'receipt'->>'id')::uuid; lease:=(claim->>'leaseId')::uuid;
 ASSERT receipt IS NOT NULL; ASSERT public.claim_refund_receipt() IS NULL, 'active lease claimed twice';
 ASSERT public.freeze_refund_receipt_payload(receipt,lease,payload)=payload;
 ASSERT public.finish_refund_receipt(receipt,lease,NULL,'EMAIL_UNCONFIRMED');
 ASSERT public.claim_refund_receipt() IS NULL, 'retry backoff ignored';
 UPDATE public.refund_receipt_delivery SET next_attempt_at=now()-interval '1 second' WHERE receipt_id=receipt;
 second:=public.claim_refund_receipt();
 ASSERT second->'payload'=payload, 'frozen recipient/content lost';
 ASSERT public.freeze_refund_receipt_payload(receipt,(second->>'leaseId')::uuid,payload||jsonb_build_object('to',jsonb_build_array('changed@example.com')))=payload;
 ASSERT NOT public.finish_refund_receipt(receipt,lease,gen_random_uuid(),NULL), 'stale lease changed delivery';
 ASSERT public.finish_refund_receipt(receipt,(second->>'leaseId')::uuid,gen_random_uuid(),NULL);
 ASSERT public.claim_refund_receipt() IS NULL, 'sent receipt reclaimed';
 ASSERT (SELECT x.payload IS NULL FROM public.refund_receipt_delivery x WHERE receipt_id=receipt), 'recipient not removed after acceptance';
 -- Simulate an uncertain expired provider deduplication window; never resend.
 UPDATE public.refund_receipts SET delivery_status='uncertain' WHERE id=receipt;
 UPDATE public.refund_receipt_delivery SET first_attempt_at=now()-interval '24 hours',next_attempt_at=now()-interval '1 minute' WHERE receipt_id=receipt;
 ASSERT public.claim_refund_receipt() IS NULL, 'expired idempotency window resent';
 ASSERT (SELECT balance FROM public.user_credit_accounts WHERE user_id='11111111-1111-4111-8111-111111111111')=40, 'email changed credit balance';
END $$;
-- Reconciliation also detects late refunds for users with no prior receipt,
-- caps the operator count, and clears naturally after explicit preparation.
DO $$ DECLARE anchor timestamptz:=date_trunc('day',now())-interval '14 days'; d uuid; result jsonb; BEGIN
 PERFORM public.prepare_next_refund_week(anchor);
 PERFORM public.grant_trial_credits_once('22222222-2222-4222-8222-222222222222',40);
 FOR n IN 1..101 LOOP
  SELECT reservation_id INTO d FROM public.reserve_generation_credits('22222222-2222-4222-8222-222222222222','cold_email',4);
  PERFORM public.refund_generation_credits('22222222-2222-4222-8222-222222222222',4,d,'{}');
  UPDATE public.credit_ledger SET created_at=anchor+interval '1 day' WHERE related_ledger_id=d AND reason='generation_refund';
 END LOOP;
 result:=public.prepare_next_refund_week(anchor);
 ASSERT (result->>'lateRefunds')::int=100 AND (result->>'lateRefundsMore')::boolean, 'reconciliation must cap count and signal overflow';
 ASSERT (result->>'caughtUp')::boolean, 'forward preparation should be caught up';
 result:=public.prepare_next_refund_week(anchor);
 ASSERT (result->>'lateRefunds')::int=100, 'caught-up runs must still reconcile';
 ASSERT (SELECT count(*) FROM public.refund_receipts)=1, 'automatic reconciliation must not rewrite receipts';
 PERFORM public.prepare_refund_receipts(anchor,anchor+interval '7 days');
 result:=public.prepare_next_refund_week(anchor);
 ASSERT (result->>'lateRefunds')::int=0 AND NOT (result->>'lateRefundsMore')::boolean;
 ASSERT (SELECT balance FROM public.user_credit_accounts WHERE user_id='22222222-2222-4222-8222-222222222222')=40, 'reconciliation changed balance';
END $$;
-- Scheduled periods use elapsed weeks even when the caller crosses DST.
SET LOCAL TIME ZONE 'America/New_York';
DO $$ DECLARE dst_anchor timestamptz:='2026-10-26T00:00:00Z'; result jsonb; BEGIN
 UPDATE public.refund_receipt_schedule SET anchor=dst_anchor, next_start=dst_anchor WHERE singleton;
 result:=public.prepare_next_refund_week(dst_anchor);
 ASSERT (SELECT next_start FROM public.refund_receipt_schedule WHERE singleton)='2026-11-02T00:00:00Z'::timestamptz, 'scheduled period shifted at DST';
 ASSERT (result->>'prepared')::int=0;
END $$;
SET LOCAL TIME ZONE 'UTC';
-- Retire expired private payloads without erasing leases, outcomes or receipt links.
DO $$
DECLARE sample uuid; retained uuid; active uuid; aged uuid; kept uuid; claimed jsonb; late_lease uuid:=gen_random_uuid();
 item_count integer; ledger_count integer; refund_count integer;
BEGIN
 SELECT count(*) INTO item_count FROM public.refund_receipt_items;
 SELECT count(*) INTO ledger_count FROM public.credit_ledger;
 SELECT count(*) INTO refund_count FROM public.refund_review_cases;
 INSERT INTO public.refund_receipts(user_id,period_start,period_end,credits,generation_count,delivery_status)
 SELECT '11111111-1111-4111-8111-111111111111', now()-make_interval(days => n+7),
   now()-make_interval(days => n), 4, 1, 'uncertain' FROM generate_series(30,234) n;
 INSERT INTO public.refund_receipt_delivery(receipt_id,first_attempt_at,attempts,payload,last_code)
 SELECT id, now()-interval '25 hours', 1, jsonb_build_object('to',jsonb_build_array('private@example.test')), 'EMAIL_UNCONFIRMED'
 FROM public.refund_receipts WHERE period_end<=now()-interval '30 days';
 SELECT id INTO sample FROM public.refund_receipts WHERE period_end=now()-interval '30 days';
 SELECT id INTO retained FROM public.refund_receipts WHERE period_end=now()-interval '31 days';
 SELECT id INTO active FROM public.refund_receipts WHERE period_end=now()-interval '32 days';
 SELECT id INTO aged FROM public.refund_receipts WHERE period_end=now()-interval '33 days';
 SELECT id INTO kept FROM public.refund_receipts WHERE period_end=now()-interval '34 days';
 UPDATE public.refund_receipt_delivery SET first_attempt_at=now()-interval '2 hours', attempts=3 WHERE receipt_id=sample;
 UPDATE public.refund_receipt_delivery SET first_attempt_at=now()-interval '22 hours' WHERE receipt_id=retained;
 UPDATE public.refund_receipt_delivery SET lease_id=gen_random_uuid(),lease_until=now()+interval '1 minute' WHERE receipt_id=active;
 UPDATE public.refund_receipt_delivery SET first_attempt_at=now()-interval '23 hours',lease_until=now(),lease_id=late_lease WHERE receipt_id=aged;
 UPDATE public.refund_receipt_delivery SET first_attempt_at=now()-interval '2 hours', attempts=2 WHERE receipt_id=kept;
 ASSERT public.clear_expired_refund_receipt_payloads()=200, 'retention did not cap first pass';
 ASSERT public.clear_expired_refund_receipt_payloads()=2, 'retention did not drain eligible rows';
 ASSERT public.clear_expired_refund_receipt_payloads()=0, 'retention did not converge';
 ASSERT (SELECT count(*) FROM public.refund_receipt_delivery WHERE receipt_id IN(retained,active,kept) AND payload IS NOT NULL)=3, 'lost active or retryable payload';
 ASSERT (SELECT count(*) FROM public.refund_receipt_delivery WHERE receipt_id IN(sample,aged) AND payload IS NULL AND last_code='EMAIL_UNCONFIRMED')=2, 'terminal state or payload not preserved correctly';
 ASSERT (SELECT count(*) FROM public.refund_receipt_items)=item_count, 'retention removed a receipt association';
 ASSERT (SELECT count(*) FROM public.credit_ledger)=ledger_count, 'retention changed ledger rows';
 ASSERT (SELECT count(*) FROM public.refund_review_cases)=refund_count, 'retention changed review cases';
 ASSERT EXISTS (SELECT 1 FROM public.refund_receipts WHERE id=sample AND delivery_status='uncertain');
 claimed:=public.claim_refund_receipt();
 ASSERT claimed IS NULL OR (claimed->'receipt'->>'id')::uuid NOT IN(sample,aged), 'expired receipt reclaimed after redaction';
 ASSERT public.finish_refund_receipt(aged,late_lease,gen_random_uuid(),NULL), 'retention lost the provider acknowledgement lease';
 ASSERT EXISTS (SELECT 1 FROM public.refund_receipts WHERE id=aged AND delivery_status='sent');
 ASSERT EXISTS (SELECT 1 FROM public.refund_receipt_delivery WHERE receipt_id=aged AND provider_id IS NOT NULL AND payload IS NULL);

END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.clear_expired_refund_receipt_payloads(); RAISE EXCEPTION 'unauthorized cleanup'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.clear_expired_refund_receipt_payloads(); RAISE EXCEPTION 'unauthorized cleanup'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.prepare_refund_receipts(now()-interval '14 days',now()-interval '7 days'); RAISE EXCEPTION 'unauthorized receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.refund_review_cases; RAISE EXCEPTION 'unauthorized read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.list_refund_cases('{}'); RAISE EXCEPTION 'unauthorized RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.execute_reviewed_refund(gen_random_uuid()); RAISE EXCEPTION 'unauthorized credit'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
