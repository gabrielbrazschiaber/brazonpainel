-- Função para diagnosticar RLS e permissões de tabelas.
-- Executa como SECURITY DEFINER para ler metadados do sistema que o usuário comum não pode.
CREATE OR REPLACE FUNCTION public.debug_policies()
RETURNS TABLE (
  tabela text,
  rls_ativo boolean,
  perm_admin text[],
  perm_vendedor text[],
  perm_cliente text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH tabelas_public AS (
    SELECT tablename AS nome
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('spatial_ref_sys') -- ignora tabelas internas comuns
  ),
  rls_info AS (
    SELECT 
      relname AS nome,
      relrowsecurity AS ativo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  ),
  permissoes AS (
    SELECT 
      t.nome,
      -- Simplificação: verifica se o papel tem permissão de SELECT, INSERT, UPDATE, DELETE
      -- Note que isso verifica permissões de TABELA (GRANT), não RLS (POLICY).
      -- RLS bloqueia LINHAS, GRANT bloqueia a TABELA inteira.
      ARRAY(
        SELECT p 
        FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
        WHERE has_table_privilege('authenticated', t.nome, p)
      ) as auth_perms
    FROM tabelas_public t
  )
  SELECT 
    t.nome,
    COALESCE(r.ativo, false),
    p.auth_perms, -- Por enquanto listamos o que o 'authenticated' (base de todos) pode fazer
    p.auth_perms, -- Futuramente podemos detalhar por papel específico se necessário
    p.auth_perms
  FROM tabelas_public t
  LEFT JOIN rls_info r ON r.nome = t.nome
  LEFT JOIN permissoes p ON p.nome = t.nome
  ORDER BY t.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_policies() TO service_role;
