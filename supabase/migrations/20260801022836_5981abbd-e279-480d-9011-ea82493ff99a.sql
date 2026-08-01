
REVOKE ALL ON FUNCTION public.tarefas_bloqueia_troca_escopo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clientes_bloqueia_troca_dono() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversa_registra_atividade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifica_responsavel_tarefa() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.role_permissions_protege_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tarefas_do_plano() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_vendedor_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_ver_conversa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_vendedor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_conversa(uuid) TO authenticated;
