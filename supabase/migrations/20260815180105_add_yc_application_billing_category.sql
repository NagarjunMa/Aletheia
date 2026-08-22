-- Extend the existing four-credit generation tier to YC application answers.
-- The API reserves credits through service_role only; authenticated clients
-- retain read-only access to their own ledger rows through RLS.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_category_check;

ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_category_check
  CHECK (
    category IS NULL OR category IN (
      'linkedin_connection',
      'cold_email',
      'linkedin_inmail',
      'yc_application'
    )
  ) NOT VALID;

ALTER TABLE public.credit_ledger
  VALIDATE CONSTRAINT credit_ledger_category_check;

CREATE OR REPLACE FUNCTION public.reserve_generation_credits(
  p_user_id UUID,
  p_category TEXT,
  p_cost INTEGER
)
RETURNS TABLE(
  allowed BOOLEAN,
  reservation_id UUID,
  balance_after INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.user_credit_accounts%ROWTYPE;
  v_ledger_id UUID;
BEGIN
  IF p_cost <= 0 THEN
    RAISE EXCEPTION 'Generation credit cost must be positive';
  END IF;

  IF p_category NOT IN (
    'linkedin_connection',
    'cold_email',
    'linkedin_inmail',
    'yc_application'
  ) THEN
    RAISE EXCEPTION 'Invalid generation category';
  END IF;

  PERFORM public.ensure_credit_account(p_user_id);

  SELECT * INTO v_account
  FROM public.user_credit_accounts AS account
  WHERE account.user_id = p_user_id
  FOR UPDATE;

  IF v_account.balance < p_cost THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, v_account.balance;
    RETURN;
  END IF;

  UPDATE public.user_credit_accounts AS account
  SET
    balance = account.balance - p_cost,
    lifetime_credits_used = account.lifetime_credits_used + p_cost
  WHERE account.user_id = p_user_id
  RETURNING * INTO v_account;

  INSERT INTO public.credit_ledger (
    user_id,
    delta,
    balance_after,
    reason,
    category,
    metadata
  )
  VALUES (
    p_user_id,
    -p_cost,
    v_account.balance,
    'generation_debit',
    p_category,
    jsonb_build_object('reserved', TRUE)
  )
  RETURNING id INTO v_ledger_id;

  RETURN QUERY SELECT TRUE, v_ledger_id, v_account.balance;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_generation_credits(UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_generation_credits(UUID, TEXT, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.reserve_generation_credits(UUID, TEXT, INTEGER) IS
  'Atomically reserves generation credits for outreach and YC application answers. Returns allowed=false instead of overdrawing.';

COMMIT;
