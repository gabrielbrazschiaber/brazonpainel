DROP POLICY IF EXISTS configuracoes_select_operacional ON public.configuracoes;

CREATE POLICY configuracoes_select_admin
ON public.configuracoes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'configuracoes.gerenciar')
);

DROP POLICY IF EXISTS banco_leads_lotes_select_autenticado ON public.banco_leads_lotes;

CREATE POLICY banco_leads_lotes_select_admin
ON public.banco_leads_lotes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));