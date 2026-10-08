-- Additive private review storage. Existing candidate_evidence owner RLS and
-- authenticated grants apply; no new table, public policy or privileged RPC.
ALTER TABLE public.candidate_evidence
  ADD COLUMN fact_review JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT candidate_evidence_fact_review_bound
    CHECK (jsonb_typeof(fact_review) = 'object' AND octet_length(fact_review::text) <= 131072);

-- Editing a source always requires a separate review of the saved revision.
-- Covers direct Data API writes as well as application server actions.
CREATE FUNCTION public.invalidate_candidate_fact_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fact_review := '{}'::jsonb;
  ELSIF ROW(NEW.kind, NEW.title, NEW.context, NEW.actions, NEW.outcome,
            NEW.metrics, NEW.skills, NEW.links, NEW.user_id)
    IS DISTINCT FROM
        ROW(OLD.kind, OLD.title, OLD.context, OLD.actions, OLD.outcome,
            OLD.metrics, OLD.skills, OLD.links, OLD.user_id)
    OR NEW.confirmed_at IS NULL THEN
    NEW.fact_review := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_candidate_fact_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER invalidate_candidate_fact_review
  BEFORE INSERT OR UPDATE ON public.candidate_evidence
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_candidate_fact_review();
