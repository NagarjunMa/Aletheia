-- Harden release_rate_limit_reservation per security advisor:
--  1. Pin search_path to prevent schema-resolution attacks
--  2. Revoke EXECUTE from anon + authenticated (default Supabase grants)
--     so only service_role can call this. Next.js route uses
--     createBearerServiceClient() — the anon/auth grants are unused
--     attack surface.

ALTER FUNCTION public.release_rate_limit_reservation(UUID)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) FROM authenticated;
-- Re-grant to service_role (idempotent — already granted in initial migration)
GRANT EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) TO service_role;
