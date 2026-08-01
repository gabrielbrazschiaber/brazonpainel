-- 1) Exclusão de comentário exige acesso à tarefa pai
DROP POLICY IF EXISTS tarefa_comentarios_delete_own ON public.tarefa_comentarios;
CREATE POLICY tarefa_comentarios_delete_own ON public.tarefa_comentarios
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id = tarefa_comentarios.tarefa_id
        AND (
          t.responsavel_id = auth.uid()
          OR t.criado_por_id = auth.uid()
          OR t.vendedor_id = current_vendedor_id()
          OR (t.cliente_user_id = auth.uid() AND tarefa_comentarios.interno = false)
        )
    )
  )
);

-- 2) Vendedores podem ler os lotes (somente leitura)
DROP POLICY IF EXISTS banco_leads_lotes_select_autenticado ON public.banco_leads_lotes;
CREATE POLICY banco_leads_lotes_select_autenticado ON public.banco_leads_lotes
FOR SELECT TO authenticated
USING (true);

-- 3) Funções SECURITY DEFINER não devem ser executáveis por anônimos
REVOKE ALL ON FUNCTION public.pode_ver_banco_lead(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.banco_leads_registrar_cnae() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_banco_lead(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.banco_leads_registrar_cnae() TO service_role;