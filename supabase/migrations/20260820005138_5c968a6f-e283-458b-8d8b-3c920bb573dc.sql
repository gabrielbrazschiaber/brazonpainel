-- Tabela para armazenar as mensagens rápidas configuráveis
CREATE TABLE public.mensagens_rapidas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    texto text NOT NULL,
    ordem integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Adicionar coluna para rastrear mensagens enviadas no lead
ALTER TABLE public.leads ADD COLUMN mensagens_enviadas jsonb DEFAULT '[]'::jsonb;

-- Segurança RLS
ALTER TABLE public.mensagens_rapidas ENABLE ROW LEVEL SECURITY;

-- Permissões para mensagens rápidas
GRANT SELECT ON public.mensagens_rapidas TO authenticated;
GRANT ALL ON public.mensagens_rapidas TO service_role;

-- Políticas para mensagens rápidas (Apenas Admin pode editar, Vendedor e Admin podem ler)
CREATE POLICY "Mensagens rápidas visíveis para todos autenticados"
ON public.mensagens_rapidas FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Apenas admins podem gerenciar mensagens rápidas"
ON public.mensagens_rapidas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir algumas mensagens iniciais
INSERT INTO public.mensagens_rapidas (texto, ordem) VALUES
('Olá! Tudo bem? Vi que você tem interesse no Brazon. Como podemos ajudar?', 1),
('Oi, estou passando para saber se você conseguiu analisar a nossa proposta.', 2),
('Temos uma condição especial para fecharmos hoje! Topa conversarmos rapidinho?', 3);
