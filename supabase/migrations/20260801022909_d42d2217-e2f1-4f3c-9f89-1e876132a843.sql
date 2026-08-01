
DROP POLICY IF EXISTS role_permissions_select_scope ON public.role_permissions;
CREATE POLICY role_permissions_select_scope ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_permission(auth.uid(), 'configuracoes.gerenciar'::public.app_permission)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role
    )
  );
