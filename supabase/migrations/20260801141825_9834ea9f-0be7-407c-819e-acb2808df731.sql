ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS mfa_obrigatorio_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_obrigatorio_vendedor boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.mfa_codigos_recuperacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL,
  usado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mfa_codigos_recuperacao TO service_role;

ALTER TABLE public.mfa_codigos_recuperacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mfa_codigos_sem_acesso_direto"
  ON public.mfa_codigos_recuperacao
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_mfa_codigos_user ON public.mfa_codigos_recuperacao (user_id, usado_em);

CREATE TRIGGER update_mfa_codigos_updated_at
  BEFORE UPDATE ON public.mfa_codigos_recuperacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();