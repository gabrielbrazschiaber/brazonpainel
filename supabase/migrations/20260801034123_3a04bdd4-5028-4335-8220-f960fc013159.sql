CREATE TABLE IF NOT EXISTS public.lead_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  arquivo_nome text NOT NULL,
  total_linhas integer NOT NULL DEFAULT 0,
  importados integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_importacoes TO authenticated;
GRANT ALL ON public.lead_importacoes TO service_role;

ALTER TABLE public.lead_importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_importacoes_admin_all" ON public.lead_importacoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "lead_importacoes_select_own" ON public.lead_importacoes
  FOR SELECT TO authenticated
  USING (vendedor_id = public.current_vendedor_id());

CREATE POLICY "lead_importacoes_insert_own" ON public.lead_importacoes
  FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = public.current_vendedor_id() AND autor_id = auth.uid());

CREATE POLICY "lead_importacoes_update_own" ON public.lead_importacoes
  FOR UPDATE TO authenticated
  USING (vendedor_id = public.current_vendedor_id())
  WITH CHECK (vendedor_id = public.current_vendedor_id());

CREATE POLICY "lead_importacoes_delete_own" ON public.lead_importacoes
  FOR DELETE TO authenticated
  USING (vendedor_id = public.current_vendedor_id());

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS importacao_id uuid REFERENCES public.lead_importacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_importacao_idx ON public.leads (importacao_id);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS completude smallint
  GENERATED ALWAYS AS (
    (CASE WHEN nullif(btrim(coalesce(empresa,'')),'')  IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN nullif(btrim(coalesce(cargo,'')),'')    IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN nullif(btrim(coalesce(email,'')),'')    IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN nullif(btrim(coalesce(segmento,'')),'') IS NOT NULL THEN 1 ELSE 0 END)
  ) STORED;

CREATE INDEX IF NOT EXISTS leads_completude_idx ON public.leads (vendedor_id, completude);