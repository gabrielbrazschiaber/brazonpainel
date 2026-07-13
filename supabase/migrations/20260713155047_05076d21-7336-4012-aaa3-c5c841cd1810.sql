-- ============================================================
-- Auditoria de banco: índices de performance + integridade
-- ============================================================

-- 1. Índices em colunas de FK e de lookup (Postgres NÃO indexa FKs automaticamente).
--    Aceleram as subqueries de RLS (vendedor_id/cliente_id) e o webhook do Asaas.
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor_id ON public.clientes (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_clientes_plano_id ON public.clientes (plano_id);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON public.clientes (status);
CREATE INDEX IF NOT EXISTS idx_clientes_data_vencimento ON public.clientes (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_clientes_asaas_customer_id ON public.clientes (asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente_id ON public.pagamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos (status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_payment_id ON public.pagamentos (asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_actor_id ON public.auditoria (actor_id);
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_logs_payment_id ON public.asaas_webhook_logs (payment_id);

-- 2. Constraints de integridade (valores monetários e percentuais válidos).
ALTER TABLE public.planos
  ADD CONSTRAINT planos_valor_nao_negativo CHECK (valor >= 0) NOT VALID;
ALTER TABLE public.planos VALIDATE CONSTRAINT planos_valor_nao_negativo;

ALTER TABLE public.pagamentos
  ADD CONSTRAINT pagamentos_valor_nao_negativo CHECK (valor >= 0) NOT VALID;
ALTER TABLE public.pagamentos VALIDATE CONSTRAINT pagamentos_valor_nao_negativo;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_servico_extra_nao_negativo CHECK (servico_extra_valor >= 0) NOT VALID;
ALTER TABLE public.clientes VALIDATE CONSTRAINT clientes_servico_extra_nao_negativo;

ALTER TABLE public.vendedores
  ADD CONSTRAINT vendedores_comissao_valida CHECK (percentual_comissao >= 0 AND percentual_comissao <= 100) NOT VALID;
ALTER TABLE public.vendedores VALIDATE CONSTRAINT vendedores_comissao_valida;

ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_comissao_valida CHECK (percentual_comissao_padrao >= 0 AND percentual_comissao_padrao <= 100) NOT VALID;
ALTER TABLE public.configuracoes VALIDATE CONSTRAINT configuracoes_comissao_valida;

ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_dias_aviso_valido CHECK (dias_aviso_vencimento >= 0 AND dias_aviso_vencimento <= 365) NOT VALID;
ALTER TABLE public.configuracoes VALIDATE CONSTRAINT configuracoes_dias_aviso_valido;

-- 3. Garante no máximo UMA linha de configurações (tabela singleton) para evitar
--    divergência de chave/ambiente do Asaas.
CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_singleton ON public.configuracoes ((true));