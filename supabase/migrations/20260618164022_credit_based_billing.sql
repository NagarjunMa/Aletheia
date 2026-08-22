-- Credit-based billing foundation.
--
-- Credits are the primary public-launch usage unit:
--   linkedin_connection = 2 credits
--   cold_email / linkedin_inmail = 4 credits
-- Credits do not expire. The existing daily generation limit remains as a
-- separate abuse throttle.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.user_credit_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_credits_purchased INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_credits_purchased >= 0),
  lifetime_credits_used INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_credits_used >= 0),
  trial_credits_granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'trial_grant',
      'generation_debit',
      'generation_refund',
      'purchase'
    )
  ),
  category TEXT CHECK (
    category IS NULL OR category IN (
      'linkedin_connection',
      'cold_email',
      'linkedin_inmail'
    )
  ),
  generation_id UUID,
  related_ledger_id UUID REFERENCES public.credit_ledger(id) ON DELETE SET NULL,
  stripe_checkout_session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON public.credit_ledger (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_trial_once
  ON public.credit_ledger (user_id)
  WHERE reason = 'trial_grant';

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_purchase_session_once
  ON public.credit_ledger (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_refund_once
  ON public.credit_ledger (related_ledger_id)
  WHERE reason = 'generation_refund' AND related_ledger_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_user_credit_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_user_credit_accounts_updated_at
  ON public.user_credit_accounts;

CREATE TRIGGER trigger_user_credit_accounts_updated_at
  BEFORE UPDATE ON public.user_credit_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_credit_accounts_updated_at();

ALTER TABLE public.user_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit account"
  ON public.user_credit_accounts;
CREATE POLICY "Users can view own credit account"
  ON public.user_credit_accounts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own credit ledger"
  ON public.credit_ledger;
CREATE POLICY "Users can view own credit ledger"
  ON public.credit_ledger
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_credit_accounts, public.credit_ledger
  FROM anon, authenticated;

GRANT SELECT ON public.user_credit_accounts TO authenticated;
GRANT SELECT ON public.credit_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_credit_account(
  p_user_id UUID
)
RETURNS TABLE(
  balance INTEGER,
  lifetime_credits_purchased INTEGER,
  lifetime_credits_used INTEGER,
  trial_credits_granted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_credit_accounts (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    account.balance,
    account.lifetime_credits_purchased,
    account.lifetime_credits_used,
    account.trial_credits_granted_at
  FROM public.user_credit_accounts AS account
  WHERE account.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_trial_credits_once(
  p_user_id UUID,
  p_amount INTEGER DEFAULT 40
)
RETURNS TABLE(granted BOOLEAN, balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.user_credit_accounts%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Trial credit amount must be positive';
  END IF;

  PERFORM public.ensure_credit_account(p_user_id);

  SELECT * INTO v_account
  FROM public.user_credit_accounts AS account
  WHERE account.user_id = p_user_id
  FOR UPDATE;

  IF v_account.trial_credits_granted_at IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_account.balance;
    RETURN;
  END IF;

  UPDATE public.user_credit_accounts AS account
  SET
    balance = account.balance + p_amount,
    trial_credits_granted_at = NOW()
  WHERE account.user_id = p_user_id
  RETURNING * INTO v_account;

  INSERT INTO public.credit_ledger (
    user_id,
    delta,
    balance_after,
    reason,
    metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    v_account.balance,
    'trial_grant',
    jsonb_build_object('no_expiry', TRUE)
  );

  RETURN QUERY SELECT TRUE, v_account.balance;
END;
$$;

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

  IF p_category NOT IN ('linkedin_connection', 'cold_email', 'linkedin_inmail') THEN
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

CREATE OR REPLACE FUNCTION public.refund_generation_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reservation_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(refunded BOOLEAN, balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.user_credit_accounts%ROWTYPE;
  v_reservation public.credit_ledger%ROWTYPE;
  v_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund credit amount must be positive';
  END IF;

  SELECT * INTO v_reservation
  FROM public.credit_ledger
  WHERE id = p_reservation_id
    AND user_id = p_user_id
    AND reason = 'generation_debit'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit reservation not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.credit_ledger
    WHERE related_ledger_id = p_reservation_id
      AND reason = 'generation_refund'
  ) THEN
    SELECT account.balance INTO v_balance
    FROM public.user_credit_accounts AS account
    WHERE account.user_id = p_user_id;
    RETURN QUERY SELECT FALSE, v_balance;
    RETURN;
  END IF;

  UPDATE public.user_credit_accounts AS account
  SET
    balance = account.balance + p_amount,
    lifetime_credits_used = GREATEST(account.lifetime_credits_used - p_amount, 0)
  WHERE account.user_id = p_user_id
  RETURNING * INTO v_account;

  INSERT INTO public.credit_ledger (
    user_id,
    delta,
    balance_after,
    reason,
    category,
    related_ledger_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    v_account.balance,
    'generation_refund',
    v_reservation.category,
    p_reservation_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY SELECT TRUE, v_account.balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_credit_purchase(
  p_user_id UUID,
  p_credits INTEGER,
  p_stripe_checkout_session_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(applied BOOLEAN, balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.user_credit_accounts%ROWTYPE;
  v_existing public.credit_ledger%ROWTYPE;
BEGIN
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Purchased credits must be positive';
  END IF;

  IF p_stripe_checkout_session_id IS NULL OR LENGTH(TRIM(p_stripe_checkout_session_id)) = 0 THEN
    RAISE EXCEPTION 'Stripe checkout session id is required';
  END IF;

  PERFORM public.ensure_credit_account(p_user_id);

  SELECT * INTO v_existing
  FROM public.credit_ledger
  WHERE stripe_checkout_session_id = p_stripe_checkout_session_id
  LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_account
    FROM public.user_credit_accounts
    WHERE user_id = p_user_id;
    RETURN QUERY SELECT FALSE, v_account.balance;
    RETURN;
  END IF;

  SELECT * INTO v_account
  FROM public.user_credit_accounts AS account
  WHERE account.user_id = p_user_id
  FOR UPDATE;

  UPDATE public.user_credit_accounts AS account
  SET
    balance = account.balance + p_credits,
    lifetime_credits_purchased = account.lifetime_credits_purchased + p_credits
  WHERE account.user_id = p_user_id
  RETURNING * INTO v_account;

  INSERT INTO public.credit_ledger (
    user_id,
    delta,
    balance_after,
    reason,
    stripe_checkout_session_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_credits,
    v_account.balance,
    'purchase',
    p_stripe_checkout_session_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN QUERY SELECT TRUE, v_account.balance;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_credit_account(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_trial_credits_once(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_generation_credits(UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_generation_credits(UUID, INTEGER, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_credit_purchase(UUID, INTEGER, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_credit_account(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_trial_credits_once(UUID, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_generation_credits(UUID, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_generation_credits(UUID, INTEGER, UUID, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_credit_purchase(UUID, INTEGER, TEXT, JSONB)
  TO service_role;

COMMENT ON TABLE public.user_credit_accounts IS
  'Server-owned credit wallet for Aletheia usage. Credits do not expire.';
COMMENT ON TABLE public.credit_ledger IS
  'Immutable audit ledger for trial grants, generation debits/refunds, and purchases.';
COMMENT ON FUNCTION public.reserve_generation_credits(UUID, TEXT, INTEGER) IS
  'Atomically reserves generation credits before Claude calls. Returns allowed=false instead of overdrawing.';

COMMIT;
