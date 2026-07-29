REVOKE ALL ON FUNCTION public.role_permissions_protege_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_bloqueia_troca_dono() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;