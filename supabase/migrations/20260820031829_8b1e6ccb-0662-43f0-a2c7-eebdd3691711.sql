-- 1. Tabela deploys
CREATE TABLE public.deploys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sha text NOT NULL UNIQUE,
    versao text NOT NULL,
    commits jsonb NOT NULL,
    arquivos_alterados text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'pendente',
    erro text,
    novidade_id uuid REFERENCES public.novidades(id) ON DELETE SET NULL,
    resumo_ia jsonb,
    criado_em timestamptz NOT NULL DEFAULT now(),
    processado_em timestamptz,
    CONSTRAINT deploys_status_check CHECK (status IN ('pendente', 'processado', 'ignorado', 'erro'))
);

-- Índices e permissões para deploys
CREATE INDEX idx_deploys_status ON public.deploys(status);
CREATE INDEX idx_deploys_criado_em ON public.deploys(criado_em DESC);
CREATE INDEX idx_deploys_versao ON public.deploys(versao);

GRANT SELECT ON public.deploys TO authenticated;
GRANT ALL ON public.deploys TO service_role;

ALTER TABLE public.deploys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar deploys" 
ON public.deploys FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Novas colunas em configuracoes
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS changelog_ativo boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS changelog_token text,
ADD COLUMN IF NOT EXISTS changelog_versao_atual text NOT NULL DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS ia_provedor text NOT NULL DEFAULT 'openrouter',
ADD COLUMN IF NOT EXISTS ia_modelo text NOT NULL DEFAULT 'deepseek/deepseek-chat:free',
ADD COLUMN IF NOT EXISTS ia_api_key text,
ADD COLUMN IF NOT EXISTS ia_key_ultimos4 text,
ADD COLUMN IF NOT EXISTS ia_testada_em timestamptz,
ADD COLUMN IF NOT EXISTS ia_teste_ok boolean;

-- Trigger para ia_api_key
CREATE OR REPLACE FUNCTION public.trg_config_ia_key_handler()
RETURNS trigger AS $$
BEGIN
    IF NEW.ia_api_key IS DISTINCT FROM OLD.ia_api_key AND NEW.ia_api_key IS NOT NULL THEN
        NEW.ia_key_ultimos4 := right(NEW.ia_api_key, 4);
        NEW.ia_testada_em := NULL;
        NEW.ia_teste_ok := NULL;
    ELSIF NEW.ia_api_key IS NULL THEN
        NEW.ia_key_ultimos4 := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS config_ia_key_handler ON public.configuracoes;
CREATE TRIGGER config_ia_key_handler
BEFORE INSERT OR UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.trg_config_ia_key_handler();

-- 3. View configuracoes_publica
DROP VIEW IF EXISTS public.configuracoes_publica;
CREATE VIEW public.configuracoes_publica AS
SELECT 
    id, nome_app, dominio, dias_aviso_vencimento, dias_devolver_lead, 
    horas_reserva_lote, percentual_comissao_padrao, asaas_ambiente, 
    asaas_webhook_url, mfa_obrigatorio_admin, mfa_obrigatorio_vendedor,
    changelog_ativo, changelog_versao_atual, ia_provedor, ia_modelo,
    ia_key_ultimos4, ia_testada_em, ia_teste_ok, created_at, updated_at
FROM public.configuracoes;

GRANT SELECT ON public.configuracoes_publica TO authenticated;
GRANT SELECT ON public.configuracoes_publica TO anon;

-- Garante que configuracoes só pode ser lida por service_role e admin
REVOKE SELECT ON public.configuracoes FROM authenticated;
REVOKE SELECT ON public.configuracoes FROM anon;
GRANT SELECT ON public.configuracoes TO service_role;

-- Adicionar políticas para permitir acesso admin controlado
DROP POLICY IF EXISTS "Admins podem ler tudo em configuracoes" ON public.configuracoes;
CREATE POLICY "Admins podem ler tudo em configuracoes" 
ON public.configuracoes FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem atualizar configuracoes" ON public.configuracoes;
CREATE POLICY "Admins podem atualizar configuracoes" 
ON public.configuracoes FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
