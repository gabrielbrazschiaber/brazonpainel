CREATE TABLE public.tarefa_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  corpo text NOT NULL CHECK (char_length(trim(corpo)) BETWEEN 1 AND 4000),
  interno boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tarefa_comentarios_tarefa_idx ON public.tarefa_comentarios (tarefa_id, created_at);
CREATE INDEX tarefa_comentarios_autor_idx ON public.tarefa_comentarios (autor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_comentarios TO authenticated;
GRANT ALL ON public.tarefa_comentarios TO service_role;

ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY tarefa_comentarios_select_scope
  ON public.tarefa_comentarios FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tarefas t WHERE t.id = tarefa_id)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tarefas t
        WHERE t.id = tarefa_id
          AND (
            t.responsavel_id = auth.uid()
            OR t.criado_por_id = auth.uid()
            OR t.vendedor_id = current_vendedor_id()
            OR (t.cliente_user_id = auth.uid() AND interno = false)
          )
      )
    )
  );

CREATE POLICY tarefa_comentarios_insert_scope
  ON public.tarefa_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tarefas t
        WHERE t.id = tarefa_id
          AND (
            t.responsavel_id = auth.uid()
            OR t.criado_por_id = auth.uid()
            OR t.vendedor_id = current_vendedor_id()
            OR (t.cliente_user_id = auth.uid() AND interno = false)
          )
      )
    )
  );

CREATE POLICY tarefa_comentarios_update_own
  ON public.tarefa_comentarios FOR UPDATE TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY tarefa_comentarios_delete_own
  ON public.tarefa_comentarios FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tarefa_comentarios_set_updated_at
  BEFORE UPDATE ON public.tarefa_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();