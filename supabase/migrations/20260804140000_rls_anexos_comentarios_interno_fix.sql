-- Auditoria e Padronização de RLS para tarefa_comentarios e tarefa_anexos
-- Garante que o filtro 'interno = false' seja aplicado consistentemente para clientes.

-- 1. TAREFA_COMENTARIOS

-- SELECT
DROP POLICY IF EXISTS tarefa_comentarios_select_scope ON public.tarefa_comentarios;
CREATE POLICY tarefa_comentarios_select_scope
  ON public.tarefa_comentarios FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_comentarios.tarefa_id
        AND (
          t.responsavel_id = auth.uid()
          OR t.criado_por_id = auth.uid()
          OR t.vendedor_id = current_vendedor_id()
          OR (t.cliente_user_id = auth.uid() AND tarefa_comentarios.interno = false)
        )
    )
  );

-- INSERT (Já tinha filtro, reforçando)
DROP POLICY IF EXISTS tarefa_comentarios_insert_scope ON public.tarefa_comentarios;
CREATE POLICY tarefa_comentarios_insert_scope
  ON public.tarefa_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.tarefas t
        WHERE t.id = tarefa_comentarios.tarefa_id
          AND (
            t.responsavel_id = auth.uid()
            OR t.criado_por_id = auth.uid()
            OR t.vendedor_id = current_vendedor_id()
            OR (t.cliente_user_id = auth.uid() AND interno = false)
          )
      )
    )
  );

-- UPDATE (Apenas autor pode editar, mas clientes só editam se não for interno)
DROP POLICY IF EXISTS tarefa_comentarios_update_own ON public.tarefa_comentarios;
CREATE POLICY tarefa_comentarios_update_own
  ON public.tarefa_comentarios FOR UPDATE TO authenticated
  USING (
    autor_id = auth.uid() 
    AND (
        NOT (public.has_role(auth.uid(), 'cliente'::app_role))
        OR interno = false
    )
  )
  WITH CHECK (
    autor_id = auth.uid()
    AND (
        NOT (public.has_role(auth.uid(), 'cliente'::app_role))
        OR interno = false
    )
  );

-- DELETE (Apenas autor ou admin, clientes só deletam se não for interno)
DROP POLICY IF EXISTS tarefa_comentarios_delete_own ON public.tarefa_comentarios;
CREATE POLICY tarefa_comentarios_delete_own
  ON public.tarefa_comentarios FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
        autor_id = auth.uid()
        AND (
            NOT (public.has_role(auth.uid(), 'cliente'::app_role))
            OR interno = false
        )
    )
  );


-- 2. TAREFA_ANEXOS

-- SELECT
DROP POLICY IF EXISTS tarefa_anexos_select_scope ON public.tarefa_anexos;
CREATE POLICY tarefa_anexos_select_scope
  ON public.tarefa_anexos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tarefa_comentarios c
      JOIN public.tarefas t ON t.id = c.tarefa_id
      WHERE c.id = tarefa_anexos.comentario_id
        AND (
          t.responsavel_id = auth.uid()
          OR t.criado_por_id = auth.uid()
          OR t.vendedor_id = current_vendedor_id()
          OR (t.cliente_user_id = auth.uid() AND c.interno = false)
        )
    )
  );

-- INSERT (Garante que cliente não anexe em comentário interno)
DROP POLICY IF EXISTS tarefa_anexos_insert_own ON public.tarefa_anexos;
CREATE POLICY tarefa_anexos_insert_own
  ON public.tarefa_anexos FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tarefa_comentarios c
      WHERE c.id = comentario_id
        AND c.autor_id = auth.uid()
        AND c.tarefa_id = tarefa_anexos.tarefa_id
        AND (
            NOT (public.has_role(auth.uid(), 'cliente'::app_role))
            OR c.interno = false
        )
    )
  );

-- DELETE (Apenas autor ou admin, clientes só deletam se comentário não for interno)
DROP POLICY IF EXISTS tarefa_anexos_delete_own ON public.tarefa_anexos;
CREATE POLICY tarefa_anexos_delete_own
  ON public.tarefa_anexos FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
        autor_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tarefa_comentarios c
            WHERE c.id = tarefa_anexos.comentario_id
            AND (
                NOT (public.has_role(auth.uid(), 'cliente'::app_role))
                OR c.interno = false
            )
        )
    )
  );
