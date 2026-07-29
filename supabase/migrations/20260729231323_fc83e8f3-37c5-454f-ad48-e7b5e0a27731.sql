CREATE TABLE public.lembretes_vencimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid,
  vencimento date NOT NULL,
  dias_restantes integer NOT NULL DEFAULT 0,
  mensagem text NOT NULL DEFAULT '',
  lido_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, vencimento)
);

CREATE INDEX idx_lembretes_vencimento_cliente ON public.lembretes_vencimento (cliente_id, created_at DESC);
CREATE INDEX idx_lembretes_vencimento_user ON public.lembretes_vencimento (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.lembretes_vencimento TO authenticated;
GRANT ALL ON public.lembretes_vencimento TO service_role;

ALTER TABLE public.lembretes_vencimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY lembretes_select_scope ON public.lembretes_vencimento
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR cliente_id IN (SELECT c.id FROM public.clientes c WHERE c.vendedor_id = current_vendedor_id())
);

CREATE POLICY lembretes_update_own ON public.lembretes_vencimento
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_lembretes_vencimento_updated_at
BEFORE UPDATE ON public.lembretes_vencimento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();