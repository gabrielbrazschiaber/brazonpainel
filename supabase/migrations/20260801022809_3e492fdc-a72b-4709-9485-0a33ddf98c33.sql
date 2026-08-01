
-- 1) Least privilege: anon has no business touching app tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT SELECT ON public.planos TO anon;

-- 2) Public coupon policy no longer needs anon (validation runs server-side)
DROP POLICY IF EXISTS cupons_select_publico ON public.cupons;
CREATE POLICY cupons_select_publico ON public.cupons
  FOR SELECT TO authenticated
  USING (ativo = true AND (validade IS NULL OR validade > now()) AND vendedor_id IS NULL);

-- 3) Drop write privileges with no matching policy (server-only tables)
REVOKE INSERT, UPDATE, DELETE ON public.auditoria FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.asaas_webhook_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.asaas_sync_queue FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cupom_usos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.referral_visitas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.termos_aceites FROM authenticated;
REVOKE INSERT, DELETE ON public.lembretes_vencimento FROM authenticated;
REVOKE INSERT, DELETE ON public.notificacoes FROM authenticated;
REVOKE DELETE ON public.profiles FROM authenticated;

-- 4) Role/permission matrix: only own role rows, admin sees all
DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_select_scope ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role
    )
  );

-- 5) Notifications are strictly personal
DROP POLICY IF EXISTS notificacoes_select_own ON public.notificacoes;
CREATE POLICY notificacoes_select_own ON public.notificacoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6) Storage: explicit read policy for task attachments
DROP POLICY IF EXISTS "tarefa anexos select" ON storage.objects;
CREATE POLICY "tarefa anexos select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tarefa-anexos'
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id::text = split_part(objects.name, '/', 1)
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR t.responsavel_id = auth.uid()
          OR t.criado_por_id = auth.uid()
          OR t.cliente_user_id = auth.uid()
          OR t.vendedor_id = public.current_vendedor_id()
        )
    )
  );

-- 7) Prevent task ownership hijacking on UPDATE by non-admins
CREATE OR REPLACE FUNCTION public.tarefas_bloqueia_troca_escopo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (
       NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
       OR NEW.cliente_user_id IS DISTINCT FROM OLD.cliente_user_id
       OR NEW.vendedor_id IS DISTINCT FROM OLD.vendedor_id
       OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id
     ) THEN
    RAISE EXCEPTION 'Não é permitido alterar o vínculo (cliente/vendedor) da tarefa.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarefas_bloqueia_troca_escopo_trg ON public.tarefas;
CREATE TRIGGER tarefas_bloqueia_troca_escopo_trg
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefas_bloqueia_troca_escopo();

-- 8) Missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_id ON public.tarefas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_plano_id ON public.tarefas(plano_id);
CREATE INDEX IF NOT EXISTS idx_cupom_usos_plano_id ON public.cupom_usos(plano_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tarefa_id ON public.notificacoes(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cupom_pendente_id ON public.clientes(cupom_pendente_id);
CREATE INDEX IF NOT EXISTS idx_novidades_criado_por_id ON public.novidades(criado_por_id);
