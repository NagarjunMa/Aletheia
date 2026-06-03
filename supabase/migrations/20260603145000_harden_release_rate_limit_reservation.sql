-- Harden release_rate_limit_reservation per Supabase security advisor:
--  1. Pin search_path to prevent schema-resolution attacks
--     (lint 0011_function_search_path_mutable)
--  2. Revoke EXECUTE from anon + authenticated (default Supabase grants
--     expose every public function via /rest/v1/rpc). Next.js route only
--     ever invokes this via createBearerServiceClient() — anon/auth grants
--     are unused attack surface.
--     (lint 0028 + 0029 security_definer_function_executable)

ALTER FUNCTION public.release_rate_limit_reservation(UUID)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) FROM authenticated;
-- Re-grant to service_role (idempotent — already granted in initial migration)
GRANT EXECUTE ON FUNCTION public.release_rate_limit_reservation(UUID) TO service_role;
