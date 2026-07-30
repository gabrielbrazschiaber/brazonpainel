CREATE TABLE public.tarefa_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id uuid NOT NULL REFERENCES public.tarefa_comentarios(id) ON DELETE CASCADE,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  path text NOT NULL UNIQUE,
  nome text NOT NULL CHECK (char_length(trim(nome)) BETWEEN 1 AND 255),
  tamanho bigint NOT NULL CHECK (tamanho > 0 AND tamanho <= 10485760),
  mime text NOT NULL DEFAULT 'application/octet-stream',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tarefa_anexos_comentario_idx ON public.tarefa_anexos (comentario_id);
CREATE INDEX tarefa_anexos_tarefa_idx ON public.tarefa_anexos (tarefa_id);

GRANT SELECT, INSERT, DELETE ON public.tarefa_anexos TO authenticated;
GRANT ALL ON public.tarefa_anexos TO service_role;

ALTER TABLE public.tarefa_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tarefa_anexos_select_scope
  ON public.tarefa_anexos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tarefa_comentarios c
      WHERE c.id = comentario_id
    )
  );

CREATE POLICY tarefa_anexos_insert_own
  ON public.tarefa_anexos FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tarefa_comentarios c
      WHERE c.id = comentario_id
        AND c.autor_id = auth.uid()
        AND c.tarefa_id = tarefa_anexos.tarefa_id
    )
  );

CREATE POLICY tarefa_anexos_delete_own
  ON public.tarefa_anexos FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Storage: upload/remoção apenas por quem participa da tarefa. Sem SELECT:
-- o download é feito por URL assinada gerada no servidor.
CREATE POLICY "tarefa anexos upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tarefa-anexos'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tarefas t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (
          has_role(auth.uid(), 'admin'::app_role)
          OR t.responsavel_id = auth.uid()
          OR t.criado_por_id = auth.uid()
          OR t.cliente_user_id = auth.uid()
          OR t.vendedor_id = public.current_vendedor_id()
        )
    )
  );

CREATE POLICY "tarefa anexos delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tarefa-anexos'
    AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  );