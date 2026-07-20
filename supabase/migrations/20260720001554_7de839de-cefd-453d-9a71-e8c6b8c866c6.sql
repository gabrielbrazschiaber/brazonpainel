
-- 1) Tabela novidades
CREATE TABLE public.novidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL CHECK (char_length(titulo) >= 3),
  conteudo text NOT NULL CHECK (char_length(conteudo) >= 1),
  versao text NULL,
  tipo text NOT NULL DEFAULT 'novidade' CHECK (tipo IN ('novidade','comunicado')),
  publico_cliente boolean NOT NULL DEFAULT false,
  publico_vendedor boolean NOT NULL DEFAULT false,
  publico_admin boolean NOT NULL DEFAULT true,
  publicado boolean NOT NULL DEFAULT false,
  data_publicacao timestamptz NULL,
  criado_por_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novidades TO authenticated;
GRANT ALL ON public.novidades TO service_role;

-- 3) RLS
ALTER TABLE public.novidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acesso total novidades"
  ON public.novidades FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendedor le novidades publicadas"
  ON public.novidades FOR SELECT
  TO authenticated
  USING (
    publicado = true
    AND publico_vendedor = true
    AND public.has_role(auth.uid(), 'vendedor')
  );

CREATE POLICY "Cliente le novidades publicadas"
  ON public.novidades FOR SELECT
  TO authenticated
  USING (
    publicado = true
    AND publico_cliente = true
    AND public.has_role(auth.uid(), 'cliente')
  );

-- 4) Índice
CREATE INDEX idx_novidades_publicado_data ON public.novidades (publicado, data_publicacao DESC);

-- 5) Trigger updated_at (reutiliza função existente)
CREATE TRIGGER update_novidades_updated_at
  BEFORE UPDATE ON public.novidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Coluna novidades_vistas_em em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS novidades_vistas_em timestamptz NULL;
