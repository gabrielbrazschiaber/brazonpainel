
-- 1. Enum lead_situacao_contato
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_situacao_contato') THEN
    CREATE TYPE public.lead_situacao_contato AS ENUM (
      'nao_contatado',
      'mensagem_enviada',
      'respondeu',
      'nao_respondeu',
      'sem_whatsapp',
      'lead_inexistente'
    );
  END IF;
END $$;

-- 2. Adicionar colunas na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS situacao_contato public.lead_situacao_contato NOT NULL DEFAULT 'nao_contatado',
ADD COLUMN IF NOT EXISTS mensagem_enviada_em timestamptz NULL,
ADD COLUMN IF NOT EXISTS aguardando_resposta_ate date NULL,
ADD COLUMN IF NOT EXISTS motivo_descarte text NULL;

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_leads_situacao_contato ON public.leads (situacao_contato);
CREATE INDEX IF NOT EXISTS idx_leads_aguardando_resposta_ate ON public.leads (aguardando_resposta_ate);
CREATE INDEX IF NOT EXISTS idx_leads_vendedor_situacao ON public.leads (vendedor_id, situacao_contato);

-- 4. Backfill
-- Leads com follow_ups_feitos > 0 viram mensagem_enviada
UPDATE public.leads 
SET situacao_contato = 'mensagem_enviada'
WHERE follow_ups_feitos > 0 
AND situacao_contato = 'nao_contatado';

-- Leads em estágio interessado/em_negociacao/ganho viram respondeu
UPDATE public.leads 
SET situacao_contato = 'respondeu'
WHERE estagio IN ('interessado', 'em_negociacao', 'ganho')
AND situacao_contato IN ('nao_contatado', 'mensagem_enviada');
