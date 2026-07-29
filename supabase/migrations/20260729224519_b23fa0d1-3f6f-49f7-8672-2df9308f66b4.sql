ALTER TABLE public.cupons ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cupons_vendedor ON public.cupons(vendedor_id);
DROP POLICY IF EXISTS cupons_vendedor_select_own ON public.cupons;
CREATE POLICY cupons_vendedor_select_own ON public.cupons FOR SELECT TO authenticated USING (vendedor_id = public.current_vendedor_id());