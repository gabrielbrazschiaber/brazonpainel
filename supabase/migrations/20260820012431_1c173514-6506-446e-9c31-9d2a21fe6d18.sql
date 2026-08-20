CREATE OR REPLACE FUNCTION public.debug_policies()
 RETURNS TABLE(tabela text, rls_ativo boolean, perm_admin text[], perm_vendedor text[], perm_cliente text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o diagnóstico de segurança.';
  END IF;

  RETURN QUERY
  WITH tabelas_public AS (
    SELECT t.tablename::text AS nome
    FROM pg_catalog.pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename <> 'spatial_ref_sys'
  ),
  rls_info AS (
    SELECT c.relname::text AS nome, c.relrowsecurity AS ativo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  permissoes AS (
    SELECT tp.nome,
           ARRAY(
             SELECT p
             FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS p
             WHERE has_table_privilege('authenticated', ('public.' || quote_ident(tp.nome))::regclass, p)
           )::text[] AS auth_perms
    FROM tabelas_public tp
  )
  SELECT tp.nome,
         COALESCE(r.ativo, false),
         p.auth_perms,
         p.auth_perms,
         p.auth_perms
  FROM tabelas_public tp
  LEFT JOIN rls_info r ON r.nome = tp.nome
  LEFT JOIN permissoes p ON p.nome = tp.nome
  ORDER BY tp.nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.debug_policies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_policies() TO authenticated;