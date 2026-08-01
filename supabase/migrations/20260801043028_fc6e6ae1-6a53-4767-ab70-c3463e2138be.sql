CREATE TABLE public.onboarding_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chave text NOT NULL,
  status text NOT NULL DEFAULT 'concluido',
  passo_parou smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chave)
);

CREATE INDEX onboarding_progresso_user_idx ON public.onboarding_progresso (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progresso TO authenticated;
GRANT ALL ON public.onboarding_progresso TO service_role;

ALTER TABLE public.onboarding_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_select_own" ON public.onboarding_progresso
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "onboarding_insert_own" ON public.onboarding_progresso
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "onboarding_update_own" ON public.onboarding_progresso
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "onboarding_delete_own" ON public.onboarding_progresso
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());