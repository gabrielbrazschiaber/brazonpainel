-- Restringe a leitura da chave da API do Asaas via Data API (PostgREST).
-- A chave permanece acessível apenas ao service_role (usado pelas server functions).
-- Administradores deixam de conseguir ler a coluna asaas_api_key em texto puro
-- diretamente pela API, mantendo o acesso às demais colunas de configuração.

REVOKE SELECT ON public.configuracoes FROM authenticated;

GRANT SELECT (
  id,
  nome_app,
  dominio,
  dias_aviso_vencimento,
  percentual_comissao_padrao,
  asaas_webhook_url,
  asaas_ambiente,
  asaas_webhook_url,
  created_at,
  updated_at
) ON public.configuracoes TO authenticated;

GRANT ALL ON public.configuracoes TO service_role;