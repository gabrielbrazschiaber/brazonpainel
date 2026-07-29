-- 1. Lista fixa de permissões
CREATE TYPE public.app_permission AS ENUM (
  'clientes.ler',
  'clientes.criar',
  'clientes.editar',
  'clientes.excluir',
  'vendedores.ler',
  'vendedores.criar',
  'vendedores.editar',
  'vendedores.excluir',
  'planos.gerenciar',
  'pagamentos.ler',
  'pagamentos.editar_status',
  'configuracoes.gerenciar',
  'asaas.sincronizar',
  'novidades.gerenciar',
  'auditoria.ler'
);

-- 2. Tabela papel -> permissão
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY role_permissions_admin_insert
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY role_permissions_admin_update
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY role_permissions_admin_delete
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_role_permissions_role ON public.role_permissions (role);

-- 3. Função de verificação (evita recursão nas policies)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission public.app_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.permission = _permission
  )
$$;

-- 4. Trava de segurança: admin nunca pode perder configuracoes.gerenciar
CREATE OR REPLACE FUNCTION public.role_permissions_protege_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin'::public.app_role
     AND OLD.permission = 'configuracoes.gerenciar'::public.app_permission THEN
    RAISE EXCEPTION 'Não é permitido remover a permissão de configurações do papel admin.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER role_permissions_protege_admin_del
  BEFORE DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.role_permissions_protege_admin();

-- 5. Carga inicial (espelha o comportamento atual)
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::public.app_role, p
FROM unnest(enum_range(NULL::public.app_permission)) AS p
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission) VALUES
  ('vendedor', 'clientes.ler'),
  ('vendedor', 'clientes.criar'),
  ('vendedor', 'clientes.editar'),
  ('vendedor', 'pagamentos.ler'),
  ('vendedor', 'asaas.sincronizar')
ON CONFLICT DO NOTHING;

-- 6. Policies existentes passam a usar has_permission (admin já tem todas)
DROP POLICY IF EXISTS planos_admin_all ON public.planos;
CREATE POLICY planos_admin_all ON public.planos FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'planos.gerenciar'::public.app_permission))
  WITH CHECK (public.has_permission(auth.uid(), 'planos.gerenciar'::public.app_permission));

DROP POLICY IF EXISTS "Admin acesso total novidades" ON public.novidades;
CREATE POLICY "Admin acesso total novidades" ON public.novidades FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'novidades.gerenciar'::public.app_permission))
  WITH CHECK (public.has_permission(auth.uid(), 'novidades.gerenciar'::public.app_permission));

DROP POLICY IF EXISTS configuracoes_admin_all ON public.configuracoes;
CREATE POLICY configuracoes_admin_all ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracoes.gerenciar'::public.app_permission))
  WITH CHECK (public.has_permission(auth.uid(), 'configuracoes.gerenciar'::public.app_permission));

DROP POLICY IF EXISTS auditoria_admin_select ON public.auditoria;
CREATE POLICY auditoria_admin_select ON public.auditoria FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'auditoria.ler'::public.app_permission));