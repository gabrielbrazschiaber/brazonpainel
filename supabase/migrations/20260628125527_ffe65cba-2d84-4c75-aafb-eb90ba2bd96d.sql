-- 1. Fix profiles RLS: vendedor só vê profiles dos próprios clientes
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'vendedor'::app_role)
      AND id IN (
        SELECT user_id FROM public.clientes WHERE vendedor_id = current_vendedor_id()
      )
    )
  );

-- 2. Serviço extra no cliente (descrição livre + valor manual que soma ao plano)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS servico_extra text,
  ADD COLUMN IF NOT EXISTS servico_extra_valor numeric(10,2) NOT NULL DEFAULT 0;

-- 3. Auditoria de alterações
CREATE TABLE public.auditoria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  actor_email text,
  actor_role text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  detalhes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler a auditoria
CREATE POLICY "auditoria_admin_select" ON public.auditoria
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_auditoria_created_at ON public.auditoria (created_at DESC);
CREATE INDEX idx_auditoria_entidade ON public.auditoria (entidade, entidade_id);