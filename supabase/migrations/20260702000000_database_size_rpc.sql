-- Migration: Add database_size_bytes() RPC to power the CI DB-size guard (quick 260702-dpv)
-- Exposes ONLY an aggregate byte count for the current database (no row/user data).
-- Guards against Pitfall 8: Supabase free-tier 500MB limit silently flips the DB to
-- read-only mode. The supabase-keepalive workflow calls this RPC via the anon key and
-- fails (GitHub failure email) when usage approaches ~400MB, surfacing the risk early.

CREATE OR REPLACE FUNCTION public.database_size_bytes()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pg_database_size(current_database());
$$;

-- Allow the CI anon-key REST call (POST /rest/v1/rpc/database_size_bytes) to invoke it.
-- Takes no arguments and contains no dynamic SQL — no injection surface (T-dpv-02).
GRANT EXECUTE ON FUNCTION public.database_size_bytes() TO anon, authenticated;
