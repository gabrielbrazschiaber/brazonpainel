CREATE TABLE public.referral_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX referral_visitas_unica ON public.referral_visitas (vendedor_id, session_id);
CREATE INDEX referral_visitas_vendedor_idx ON public.referral_visitas (vendedor_id, created_at DESC);

GRANT SELECT ON public.referral_visitas TO authenticated;
GRANT ALL ON public.referral_visitas TO service_role;

ALTER TABLE public.referral_visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_visitas_select_scope ON public.referral_visitas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR vendedor_id = current_vendedor_id());

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS via_link boolean NOT NULL DEFAULT false;