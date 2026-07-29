-- 1) Remover privilégios do papel anônimo (defesa em profundidade)
REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.pagamentos FROM anon;
REVOKE ALL ON public.vendedores FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.configuracoes FROM anon;
REVOKE ALL ON public.auditoria FROM anon;
REVOKE ALL ON public.asaas_webhook_logs FROM anon;
REVOKE ALL ON public.novidades FROM anon;
REVOKE ALL ON public.planos FROM anon;
GRANT SELECT ON public.planos TO anon;

-- Garantir grants corretos para os papéis usados pelo app
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores TO authenticated;
GRANT ALL ON public.clientes TO service_role;
GRANT ALL ON public.pagamentos TO service_role;
GRANT ALL ON public.vendedores TO service_role;

-- 2) Clientes: vendedor só lê e edita a própria carteira (sem INSERT/DELETE direto)
DROP POLICY IF EXISTS clientes_vendedor_manage ON public.clientes;

CREATE POLICY clientes_admin_all ON public.clientes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY clientes_vendedor_update ON public.clientes
  FOR UPDATE TO authenticated
  USING (vendedor_id = current_vendedor_id())
  WITH CHECK (vendedor_id = current_vendedor_id());

-- 3) Impedir troca do dono (user_id) de um cliente por não-admins
CREATE OR REPLACE FUNCTION public.clientes_bloqueia_troca_dono()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND auth.uid() IS NOT NULL
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Não é permitido alterar o usuário vinculado ao cliente.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_bloqueia_troca_dono ON public.clientes;
CREATE TRIGGER trg_clientes_bloqueia_troca_dono
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_bloqueia_troca_dono();

-- 4) Perfis: impedir que a atualização mova o registro para outra conta
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
