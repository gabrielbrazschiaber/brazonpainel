CREATE TABLE IF NOT EXISTS public.asaas_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text,
  payment_id text,
  status text,
  payload jsonb,
  processing_result text NOT NULL DEFAULT 'OK',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_logs_created_at
  ON public.asaas_webhook_logs (created_at DESC);

GRANT SELECT ON public.asaas_webhook_logs TO authenticated;
GRANT ALL ON public.asaas_webhook_logs TO service_role;

ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asaas_webhook_logs_admin_select"
  ON public.asaas_webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));