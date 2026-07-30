CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'tarefa',
  titulo text NOT NULL,
  mensagem text,
  link text,
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notificacoes_user_idx ON public.notificacoes (user_id, created_at DESC);
CREATE INDEX notificacoes_nao_lidas_idx ON public.notificacoes (user_id) WHERE lida_em IS NULL;

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificacoes_select_own
  ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY notificacoes_update_own
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER notificacoes_set_updated_at
  BEFORE UPDATE ON public.notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notifica_responsavel_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_titulo text;
BEGIN
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.responsavel_id IS NOT DISTINCT FROM OLD.responsavel_id THEN
    RETURN NEW;
  END IF;

  IF NEW.responsavel_id = COALESCE(NEW.criado_por_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_titulo := CASE
    WHEN TG_OP = 'INSERT' THEN 'Nova tarefa atribuída a você'
    ELSE 'Você é o novo responsável por uma tarefa'
  END;

  INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link, tarefa_id)
  VALUES (NEW.responsavel_id, 'tarefa', v_titulo, NEW.titulo, '/tarefas', NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER tarefas_notifica_responsavel
  AFTER INSERT OR UPDATE OF responsavel_id ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.notifica_responsavel_tarefa();