ALTER TABLE public.cupom_usos
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_original numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_final numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'desconhecida',
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS pago_em timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_cupom_usos_pagamento ON public.cupom_usos(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_cupom_usos_asaas_payment ON public.cupom_usos(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_cupom_usos_vendedor ON public.cupom_usos(vendedor_id);