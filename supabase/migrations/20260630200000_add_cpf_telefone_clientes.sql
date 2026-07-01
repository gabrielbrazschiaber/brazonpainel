-- Adiciona CPF/CNPJ e telefone à tabela de clientes (obrigatórios para o Asaas)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Tabela de logs de webhook do Asaas para depuração
CREATE TABLE IF NOT EXISTS public.asaas_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT,
  payment_id TEXT,
  status TEXT,
  payload JSONB,
  processing_result TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.asaas_webhook_logs TO service_role;
ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver os logs de webhook
CREATE POLICY "webhook_logs_admin_select" ON public.asaas_webhook_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_webhook_logs_created ON public.asaas_webhook_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_payment ON public.asaas_webhook_logs (payment_id);
