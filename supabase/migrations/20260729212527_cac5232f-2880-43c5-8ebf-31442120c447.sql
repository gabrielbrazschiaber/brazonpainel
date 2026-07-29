CREATE TABLE public.cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'valor_fixo',
  valor_desconto numeric NOT NULL DEFAULT 0 CHECK (valor_desconto >= 0),
  apenas_primeira_mensalidade boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  validade timestamptz,
  max_usos integer,
  usos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cupons_codigo_uniq ON public.cupons (upper(codigo));

GRANT SELECT ON public.cupons TO anon;
GRANT SELECT ON public.cupons TO authenticated;
GRANT ALL ON public.cupons TO service_role;

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY cupons_select_publico ON public.cupons
  FOR SELECT TO anon, authenticated
  USING (ativo = true AND (validade IS NULL OR validade > now()));

CREATE POLICY cupons_admin_all ON public.cupons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER cupons_updated_at BEFORE UPDATE ON public.cupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cupom_usos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupom_id uuid NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid,
  valor_desconto numeric NOT NULL DEFAULT 0,
  pagamento_id uuid,
  asaas_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cupom_usos_cliente_uniq ON public.cupom_usos (cliente_id);
CREATE INDEX cupom_usos_cupom_idx ON public.cupom_usos (cupom_id);

GRANT SELECT ON public.cupom_usos TO authenticated;
GRANT ALL ON public.cupom_usos TO service_role;

ALTER TABLE public.cupom_usos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cupom_usos_select_scope ON public.cupom_usos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
    OR cliente_id IN (SELECT id FROM public.clientes WHERE vendedor_id = current_vendedor_id())
  );

ALTER TABLE public.clientes ADD COLUMN cupom_pendente_id uuid REFERENCES public.cupons(id) ON DELETE SET NULL;

INSERT INTO public.cupons (codigo, descricao, tipo, valor_desconto, apenas_primeira_mensalidade, ativo)
VALUES ('100OFF', 'R$ 100,00 de desconto na primeira mensalidade', 'valor_fixo', 100, true, true);