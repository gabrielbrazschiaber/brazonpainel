-- Roles enum
CREATE TYPE public.app_role AS ENUM ('cliente', 'vendedor', 'admin');
CREATE TYPE public.cliente_status AS ENUM ('ativo', 'vencido', 'inadimplente', 'cancelado');
CREATE TYPE public.pagamento_status AS ENUM ('pago', 'pendente', 'vencido');
CREATE TYPE public.asaas_ambiente AS ENUM ('producao', 'sandbox');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PLANOS
CREATE TABLE public.planos (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  asaas_subscription_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos TO authenticated;
GRANT SELECT ON public.planos TO anon;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_planos_updated BEFORE UPDATE ON public.planos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VENDEDORES
CREATE TABLE public.vendedores (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_indicacao TEXT NOT NULL UNIQUE,
  percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores TO authenticated;
GRANT SELECT ON public.vendedores TO anon;
GRANT ALL ON public.vendedores TO service_role;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_vendedores_updated BEFORE UPDATE ON public.vendedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper: current user's vendedor id
CREATE OR REPLACE FUNCTION public.current_vendedor_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.vendedores WHERE user_id = auth.uid() LIMIT 1
$$;

-- CLIENTES
CREATE TABLE public.clientes (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  data_vencimento DATE,
  asaas_customer_id TEXT,
  status cliente_status NOT NULL DEFAULT 'ativo',
  mensagem_vendedor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAGAMENTOS
CREATE TABLE public.pagamentos (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  status pagamento_status NOT NULL DEFAULT 'pendente',
  data_pagamento DATE,
  asaas_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pagamentos_updated BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CONFIGURACOES
CREATE TABLE public.configuracoes (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_app TEXT NOT NULL DEFAULT 'SaaS Manager',
  dominio TEXT,
  dias_aviso_vencimento INTEGER NOT NULL DEFAULT 15,
  percentual_comissao_padrao NUMERIC(5,2) NOT NULL DEFAULT 10,
  asaas_api_key TEXT,
  asaas_webhook_url TEXT,
  asaas_ambiente asaas_ambiente NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_configuracoes_updated BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =================== RLS POLICIES ===================

-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'vendedor'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- planos
CREATE POLICY "planos_select_all" ON public.planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_select_anon" ON public.planos FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "planos_admin_all" ON public.planos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- vendedores
CREATE POLICY "vendedores_select_own" ON public.vendedores FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "vendedores_admin_all" ON public.vendedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- clientes
CREATE POLICY "clientes_select_own" ON public.clientes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR vendedor_id = public.current_vendedor_id()
  );
CREATE POLICY "clientes_vendedor_manage" ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR vendedor_id = public.current_vendedor_id())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR vendedor_id = public.current_vendedor_id());

-- pagamentos
CREATE POLICY "pagamentos_select_scope" ON public.pagamentos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
    OR cliente_id IN (SELECT id FROM public.clientes WHERE vendedor_id = public.current_vendedor_id())
  );
CREATE POLICY "pagamentos_admin_manage" ON public.pagamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- configuracoes (admin only)
CREATE POLICY "configuracoes_admin_all" ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- handle new user -> create profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();