CREATE OR REPLACE FUNCTION public.debug_policies()
 RETURNS TABLE(tabela text, rls_ativo boolean, perm_admin text[], perm_vendedor text[], perm_cliente text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem consultar o diagnóstico de políticas.';
  END IF;

  RETURN QUERY
  WITH tabelas_public AS (
    SELECT tablename AS nome
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('spatial_ref_sys')
  ),
  rls_info AS (
    SELECT relname AS nome, relrowsecurity AS ativo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  ),
  permissoes AS (
    SELECT t.nome,
      ARRAY(
        SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p
        WHERE has_table_privilege('authenticated', 'public.' || quote_ident(t.nome), p)
      ) AS auth_perms
    FROM tabelas_public t
  )
  SELECT t.nome, COALESCE(r.ativo, false), p.auth_perms, p.auth_perms, p.auth_perms
  FROM tabelas_public t
  LEFT JOIN rls_info r ON r.nome = t.nome
  LEFT JOIN permissoes p ON p.nome = t.nome
  ORDER BY t.nome;
END;
$function$;

REVOKE ALL ON FUNCTION public.debug_policies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_policies() TO authenticated, service_role;