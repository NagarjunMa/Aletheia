BEGIN;

-- Keep the reporting anchor on fixed elapsed weeks across session time zones.
ALTER FUNCTION public.prepare_next_refund_week(timestamptz) SET TimeZone TO 'UTC';

-- Select the bounded batch from frozen payloads instead of scanning receipt history.
CREATE INDEX refund_receipt_delivery_payload_expiry_idx
    ON public.refund_receipt_delivery (first_attempt_at, receipt_id)
    WHERE payload IS NOT NULL;

CREATE FUNCTION public.clear_expired_refund_receipt_payloads() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
    WITH expired AS (
        SELECT receipt_id
        FROM public.refund_receipt_delivery
        WHERE payload IS NOT NULL
          AND (lease_until IS NULL OR lease_until <= now())
          AND (attempts >= 3 OR first_attempt_at <= now() - interval '23 hours')
        ORDER BY first_attempt_at, receipt_id
        LIMIT 200
        FOR UPDATE SKIP LOCKED
    ), cleared AS (
        UPDATE public.refund_receipt_delivery AS delivery
        SET payload = NULL
        FROM expired
        WHERE delivery.receipt_id = expired.receipt_id
        RETURNING delivery.receipt_id
    )
    SELECT count(*)::integer FROM cleared;
$$;

REVOKE ALL ON FUNCTION public.clear_expired_refund_receipt_payloads() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_expired_refund_receipt_payloads() TO service_role;

-- A joined delivery row can be stale in the first statement after a concurrent
-- worker commits. Recheck the lease and attempt budget in the write statement.
CREATE OR REPLACE FUNCTION public.claim_refund_receipt() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE receipt public.refund_receipts%ROWTYPE;
        delivery public.refund_receipt_delivery%ROWTYPE;
        claimed_at timestamptz;
BEGIN
    FOR candidate IN 1..3 LOOP
        claimed_at := clock_timestamp();
        SELECT r.* INTO receipt
        FROM public.refund_receipts AS r
        LEFT JOIN public.refund_receipt_delivery AS d ON d.receipt_id = r.id
        WHERE r.delivery_status IN ('prepared', 'sending', 'uncertain')
          AND coalesce(d.attempts, 0) < 3
          AND (d.lease_until IS NULL OR d.lease_until <= claimed_at)
          AND coalesce(d.next_attempt_at, claimed_at) <= claimed_at
          AND (d.first_attempt_at IS NULL OR d.first_attempt_at > claimed_at - interval '23 hours')
        ORDER BY r.created_at, r.id
        LIMIT 1 FOR UPDATE OF r SKIP LOCKED;
        IF NOT FOUND THEN RETURN NULL; END IF;

        INSERT INTO public.refund_receipt_delivery (receipt_id) VALUES (receipt.id)
        ON CONFLICT DO NOTHING;
        SELECT * INTO delivery
        FROM public.refund_receipt_delivery
        WHERE receipt_id = receipt.id
        FOR UPDATE;

        -- Retention may have committed while the claim waited for this row.
        -- The retry cutoff is elapsed wall time, even inside an older transaction.
        claimed_at := clock_timestamp();
        IF delivery.attempts >= 3
            OR delivery.lease_until > claimed_at
            OR delivery.next_attempt_at > claimed_at
            OR delivery.first_attempt_at <= claimed_at - interval '23 hours'
        THEN
            CONTINUE;
        END IF;

        UPDATE public.refund_receipt_delivery
        SET lease_id = gen_random_uuid(), lease_until = claimed_at + interval '2 minutes',
            first_attempt_at = coalesce(first_attempt_at, claimed_at), attempts = attempts + 1
        WHERE receipt_id = receipt.id
        RETURNING * INTO delivery;

        UPDATE public.refund_receipts SET delivery_status = 'sending' WHERE id = receipt.id;
        RETURN jsonb_build_object('receipt', to_jsonb(receipt), 'leaseId', delivery.lease_id, 'payload', delivery.payload);
    END LOOP;
    -- Busy candidates are an unconfirmed backlog rather than an empty queue.
    RAISE EXCEPTION 'Receipt claim contention' USING ERRCODE = '55P03';
END;
$$;

-- Validate the live lease after any cleanup lock wait before freezing PII.
CREATE OR REPLACE FUNCTION public.freeze_refund_receipt_payload(p_id uuid,p_lease uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.refund_receipt_delivery%ROWTYPE;
BEGIN
 IF p_payload IS NULL OR p_payload-ARRAY['from','to','subject','text']<>'{}'::jsonb OR
 jsonb_typeof(p_payload->'to') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'to')<>1 OR
 length(p_payload->>'from') NOT BETWEEN 3 AND 254 OR length(p_payload->'to'->>0) NOT BETWEEN 3 AND 254 OR
 length(p_payload->>'subject') NOT BETWEEN 1 AND 100 OR length(p_payload->>'text') NOT BETWEEN 1 AND 2000 OR
 NOT(p_payload ?& ARRAY['from','to','subject','text']) THEN RAISE EXCEPTION 'Invalid receipt payload'; END IF;
 SELECT * INTO d FROM public.refund_receipt_delivery WHERE receipt_id=p_id AND lease_id=p_lease FOR UPDATE;
 IF NOT FOUND OR d.lease_until IS NULL OR d.lease_until <= clock_timestamp() THEN
  RAISE EXCEPTION 'Receipt lease expired';
 END IF;
 IF d.payload IS NULL THEN UPDATE public.refund_receipt_delivery SET payload=p_payload WHERE receipt_id=p_id; RETURN p_payload; END IF;
 RETURN d.payload;
END $$;

COMMIT;
