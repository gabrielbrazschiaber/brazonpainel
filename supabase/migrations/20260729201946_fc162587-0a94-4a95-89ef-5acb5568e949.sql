CREATE TABLE public.termos_aceites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  versao text NOT NULL,
  texto text NOT NULL,
  origem text NOT NULL DEFAULT 'cadastro_publico',
  aceito_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_termos_aceites_user_id ON public.termos_aceites (user_id);
CREATE INDEX idx_termos_aceites_aceito_em ON public.termos_aceites (aceito_em DESC);

GRANT SELECT ON public.termos_aceites TO authenticated;
GRANT ALL ON public.termos_aceites TO service_role;

ALTER TABLE public.termos_aceites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "termos_aceites_select_own" ON public.termos_aceites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));