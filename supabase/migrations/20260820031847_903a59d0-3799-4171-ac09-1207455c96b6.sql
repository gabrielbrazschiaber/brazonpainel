-- Fix for SECURITY DEFINER view (ensure search_path is secure or use INVOKER)
-- View is already default SECURITY INVOKER unless specified, but let's be explicit if needed.
-- In Supabase, views are usually invoker.

-- Fix for Function Search Path Mutable
ALTER FUNCTION public.trg_config_ia_key_handler() SET search_path = public;

-- Revoke execute on trg_config_ia_key_handler from public to prevent manual calls
REVOKE EXECUTE ON FUNCTION public.trg_config_ia_key_handler() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_config_ia_key_handler() TO service_role;
