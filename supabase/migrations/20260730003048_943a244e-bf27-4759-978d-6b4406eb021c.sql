-- Lembretes de vencimento: agendamento diário
SELECT cron.unschedule('lembretes-vencimento-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lembretes-vencimento-diario');

SELECT cron.schedule(
  'lembretes-vencimento-diario',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--09984e97-7ab6-4830-b5d3-51aa0ce0f064.lovable.app/api/public/hooks/lembretes-vencimento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (SELECT cron_token FROM public.configuracoes LIMIT 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Correção: reagenda o retry do Asaas com unschedule protegido
SELECT cron.unschedule('asaas-sync-queue-retry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'asaas-sync-queue-retry');

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