ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
CREATE INDEX IF NOT EXISTS idx_clientes_asaas_subscription_id ON public.clientes (asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_subscription_id ON public.pagamentos (asaas_subscription_id);