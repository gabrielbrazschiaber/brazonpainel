DROP POLICY IF EXISTS tarefa_anexos_select_scope ON public.tarefa_anexos;

CREATE POLICY tarefa_anexos_select_scope ON public.tarefa_anexos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.tarefa_comentarios c
    JOIN public.tarefas t ON t.id = c.tarefa_id
    WHERE c.id = tarefa_anexos.comentario_id
      AND c.tarefa_id = tarefa_anexos.tarefa_id
      AND (
        t.responsavel_id = auth.uid()
        OR t.criado_por_id = auth.uid()
        OR t.vendedor_id = public.current_vendedor_id()
        OR (t.cliente_user_id = auth.uid() AND c.interno = false)
      )
  )
);