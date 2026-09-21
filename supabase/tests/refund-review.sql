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
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.prepare_refund_receipts(now()-interval '14 days',now()-interval '7 days'); RAISE EXCEPTION 'unauthorized receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.refund_review_cases; RAISE EXCEPTION 'unauthorized read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.list_refund_cases('{}'); RAISE EXCEPTION 'unauthorized RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.execute_reviewed_refund(gen_random_uuid()); RAISE EXCEPTION 'unauthorized credit'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
