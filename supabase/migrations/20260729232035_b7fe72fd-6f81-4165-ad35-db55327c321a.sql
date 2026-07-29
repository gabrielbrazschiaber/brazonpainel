CREATE TYPE public.tarefa_status AS ENUM ('aberta','em_andamento','concluida','cancelada');
CREATE TYPE public.tarefa_prioridade AS ENUM ('baixa','media','alta');
CREATE TYPE public.tarefa_origem AS ENUM ('plano','solicitacao_cliente','manual');

CREATE TABLE public.tarefas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  status public.tarefa_status NOT NULL DEFAULT 'aberta',
  prioridade public.tarefa_prioridade NOT NULL DEFAULT 'media',
  origem public.tarefa_origem NOT NULL DEFAULT 'manual',
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_user_id uuid,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  responsavel_id uuid,
  plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  criado_por_id uuid,
  prazo date,
  concluida_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX tarefas_responsavel_idx ON public.tarefas (responsavel_id);
CREATE INDEX tarefas_vendedor_idx ON public.tarefas (vendedor_id);
CREATE INDEX tarefas_cliente_user_idx ON public.tarefas (cliente_user_id);
CREATE INDEX tarefas_status_idx ON public.tarefas (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tarefas_admin_all ON public.tarefas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY tarefas_select_scope ON public.tarefas FOR SELECT TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR criado_por_id = auth.uid()
    OR cliente_user_id = auth.uid()
    OR vendedor_id = current_vendedor_id()
  );

CREATE POLICY tarefas_insert_scope ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (
    criado_por_id = auth.uid()
    AND (
      cliente_user_id = auth.uid()
      OR vendedor_id = current_vendedor_id()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY tarefas_update_scope ON public.tarefas FOR UPDATE TO authenticated
  USING (vendedor_id = current_vendedor_id() OR responsavel_id = auth.uid())
  WITH CHECK (vendedor_id = current_vendedor_id() OR responsavel_id = auth.uid());

CREATE TRIGGER tarefas_set_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.tarefas_do_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  v_plano text;
BEGIN
  IF NEW.plano_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user FROM public.vendedores WHERE id = NEW.vendedor_id;
  SELECT nome INTO v_plano FROM public.planos WHERE id = NEW.plano_id;

  INSERT INTO public.tarefas (
    titulo, descricao, status, prioridade, origem,
    cliente_id, cliente_user_id, vendedor_id, responsavel_id, plano_id, criado_por_id
  ) VALUES (
    'Ativar plano ' || COALESCE(v_plano, 'contratado'),
    'Tarefa gerada automaticamente na contratação do plano. Confirme a cobrança e faça a ativação do cliente.',
    'aberta', 'alta', 'plano',
    NEW.id, NEW.user_id, NEW.vendedor_id, v_user, NEW.plano_id, COALESCE(auth.uid(), v_user)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER clientes_gera_tarefa_plano
  AFTER INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.tarefas_do_plano();