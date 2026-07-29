CREATE TABLE IF NOT EXISTS public.asaas_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'assinatura',
  status text NOT NULL DEFAULT 'pendente',
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 6,
  proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS asaas_sync_queue_cliente_pendente_idx
  ON public.asaas_sync_queue (cliente_id, tipo)
  WHERE status IN ('pendente', 'processando');

CREATE INDEX IF NOT EXISTS asaas_sync_queue_proxima_idx
  ON public.asaas_sync_queue (status, proxima_tentativa_em);

GRANT ALL ON public.asaas_sync_queue TO service_role;
GRANT SELECT ON public.asaas_sync_queue TO authenticated;

ALTER TABLE public.asaas_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asaas_sync_queue_admin_select" ON public.asaas_sync_queue;
CREATE POLICY "asaas_sync_queue_admin_select"
  ON public.asaas_sync_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS asaas_sync_queue_updated_at ON public.asaas_sync_queue;
CREATE TRIGGER asaas_sync_queue_updated_at
  BEFORE UPDATE ON public.asaas_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();