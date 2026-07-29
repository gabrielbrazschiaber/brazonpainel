ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS cron_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

REVOKE SELECT (cron_token) ON public.configuracoes FROM anon;

SELECT cron.unschedule('asaas-sync-queue-retry');

SELECT cron.schedule(
  'asaas-sync-queue-retry',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--09984e97-7ab6-4830-b5d3-51aa0ce0f064.lovable.app/api/public/hooks/asaas-sync-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (SELECT cron_token FROM public.configuracoes LIMIT 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);