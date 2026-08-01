-- 1) Menor privilégio: tabelas usadas apenas pelo servidor saem da API do navegador
REVOKE ALL ON public.configuracoes FROM authenticated, anon;
REVOKE ALL ON public.auditoria FROM authenticated, anon;
REVOKE ALL ON public.asaas_webhook_logs FROM authenticated, anon;
REVOKE ALL ON public.asaas_sync_queue FROM authenticated, anon;
REVOKE ALL ON public.referral_visitas FROM authenticated, anon;
REVOKE ALL ON public.cupom_usos FROM authenticated, anon;
REVOKE ALL ON public.mfa_codigos_recuperacao FROM authenticated, anon;

GRANT ALL ON public.configuracoes TO service_role;
GRANT ALL ON public.auditoria TO service_role;
GRANT ALL ON public.asaas_webhook_logs TO service_role;
GRANT ALL ON public.asaas_sync_queue TO service_role;
GRANT ALL ON public.referral_visitas TO service_role;
GRANT ALL ON public.cupom_usos TO service_role;
GRANT ALL ON public.mfa_codigos_recuperacao TO service_role;

-- 2) Página pública de cadastro precisa listar planos ativos (política já existe)
GRANT SELECT ON public.planos TO anon;

-- 3) Integridade dos dados (validado no banco, não só no frontend)
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_cpf_cnpj_tamanho CHECK (cpf_cnpj IS NULL OR char_length(cpf_cnpj) <= 20) NOT VALID,
  ADD CONSTRAINT clientes_telefone_tamanho CHECK (telefone IS NULL OR char_length(telefone) <= 30) NOT VALID;

ALTER TABLE public.cupons
  ADD CONSTRAINT cupons_max_usos_positivo CHECK (max_usos IS NULL OR max_usos > 0) NOT VALID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_telefone_tamanho CHECK (telefone IS NULL OR char_length(telefone) <= 30) NOT VALID;

-- Telemetria é inserível por visitante não autenticado: limita tamanho dos campos
ALTER TABLE public.auth_telemetria
  ADD CONSTRAINT auth_telemetria_tamanhos CHECK (
    char_length(tipo) <= 40
    AND (motivo IS NULL OR char_length(motivo) <= 120)
    AND (rota IS NULL OR char_length(rota) <= 200)
    AND (papel IS NULL OR char_length(papel) <= 40)
    AND (erro IS NULL OR char_length(erro) <= 500)
    AND char_length(app_version) <= 60
    AND (user_agent IS NULL OR char_length(user_agent) <= 400)
    AND (trace_id IS NULL OR char_length(trace_id) <= 80)
    AND (duracao_ms IS NULL OR (duracao_ms >= 0 AND duracao_ms <= 600000))
  ) NOT VALID;

-- 4) Índices: chaves estrangeiras sem índice (junções e deleções em cascata)
CREATE INDEX IF NOT EXISTS idx_leads_cliente_id ON public.leads (cliente_id);
CREATE INDEX IF NOT EXISTS idx_banco_leads_lead_id ON public.banco_leads (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_importacoes_vendedor_id ON public.lead_importacoes (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_lead_reunioes_remarcada_de ON public.lead_reunioes (remarcada_de);

-- 5) Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON public.auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_telemetria_created_at ON public.auth_telemetria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_telemetria_trace ON public.auth_telemetria (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asaas_sync_queue_pendentes ON public.asaas_sync_queue (proxima_tentativa_em) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_cupom_usos_cupom_id ON public.cupom_usos (cupom_id);
CREATE INDEX IF NOT EXISTS idx_referral_visitas_vendedor ON public.referral_visitas (vendedor_id, created_at DESC);