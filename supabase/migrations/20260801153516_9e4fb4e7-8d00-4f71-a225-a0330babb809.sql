-- ============================================================
-- 1) Catálogo de CNAEs (autocadastrado a partir das planilhas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cnaes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[0-9]{7}$'),
  descricao text,
  segmento_sugerido text,
  total_leads integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cnaes TO authenticated;
GRANT ALL ON public.cnaes TO service_role;

ALTER TABLE public.cnaes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cnaes_admin_all ON public.cnaes;
CREATE POLICY cnaes_admin_all ON public.cnaes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS cnaes_select_autenticado ON public.cnaes;
CREATE POLICY cnaes_select_autenticado ON public.cnaes FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS cnaes_updated_at ON public.cnaes;
CREATE TRIGGER cnaes_updated_at BEFORE UPDATE ON public.cnaes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS cnaes_segmento_idx ON public.cnaes (segmento_sugerido);

-- ============================================================
-- 2) Dados reais da planilha no banco de leads
-- ============================================================
ALTER TABLE public.banco_leads
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS socios text,
  ADD COLUMN IF NOT EXISTS data_abertura date,
  ADD COLUMN IF NOT EXISTS porte text,
  ADD COLUMN IF NOT EXISTS cnae_codigo text,
  ADD COLUMN IF NOT EXISTS cnae_descricao text,
  ADD COLUMN IF NOT EXISTS reservado_cnae text;

ALTER TABLE public.banco_leads
  DROP CONSTRAINT IF EXISTS banco_leads_cnpj_len,
  ADD CONSTRAINT banco_leads_cnpj_len CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$');

ALTER TABLE public.banco_leads
  DROP CONSTRAINT IF EXISTS banco_leads_cnae_len,
  ADD CONSTRAINT banco_leads_cnae_len CHECK (cnae_codigo IS NULL OR cnae_codigo ~ '^[0-9]{7}$');

CREATE INDEX IF NOT EXISTS banco_leads_cnae_idx ON public.banco_leads (cnae_codigo);
CREATE INDEX IF NOT EXISTS banco_leads_cnpj_idx ON public.banco_leads (cnpj);
CREATE INDEX IF NOT EXISTS banco_leads_reservado_cnae_idx ON public.banco_leads (reservado_cnae);

ALTER TABLE public.banco_leads_lotes
  ADD COLUMN IF NOT EXISTS reservado_cnae text,
  ADD COLUMN IF NOT EXISTS horas_reserva smallint;

-- ============================================================
-- 3) Escopo do vendedor ganha a dimensão CNAE
-- ============================================================
ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS cnaes text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- 4) Prazo de reserva configurável
-- ============================================================
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS horas_reserva_lote smallint NOT NULL DEFAULT 48;

ALTER TABLE public.configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_horas_reserva_range,
  ADD CONSTRAINT configuracoes_horas_reserva_range
    CHECK (horas_reserva_lote >= 1 AND horas_reserva_lote <= 720);

-- Vendedor precisa ler apenas estes dois números operacionais.
DROP POLICY IF EXISTS configuracoes_select_operacional ON public.configuracoes;
CREATE POLICY configuracoes_select_operacional ON public.configuracoes FOR SELECT TO authenticated
  USING (true);
GRANT SELECT (dias_devolver_lead, horas_reserva_lote) ON public.configuracoes TO authenticated;

-- ============================================================
-- 5) Reserva por segmento + estado + CNAE
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_ver_banco_lead(
  _reservado_segmento text,
  _reservado_estado text,
  _reservado_cnae text
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.vendedores v
     WHERE v.id = public.current_vendedor_id()
       AND (_reservado_segmento IS NULL
            OR cardinality(v.segmentos) = 0
            OR _reservado_segmento = ANY(v.segmentos))
       AND (_reservado_estado IS NULL
            OR cardinality(v.estados) = 0
            OR _reservado_estado = ANY(v.estados))
       AND (_reservado_cnae IS NULL
            OR cardinality(v.cnaes) = 0
            OR _reservado_cnae = ANY(v.cnaes))
  )
$function$;

DROP POLICY IF EXISTS banco_leads_vendedor_select ON public.banco_leads;
CREATE POLICY banco_leads_vendedor_select ON public.banco_leads FOR SELECT TO authenticated
  USING (
    current_vendedor_id() IS NOT NULL
    AND (
      puxado_por = current_vendedor_id()
      OR (
        status = 'disponivel'
        AND (bloqueado_ate IS NULL OR bloqueado_ate <= now())
        AND public.pode_ver_banco_lead(reservado_segmento, reservado_estado, reservado_cnae)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.puxar_banco_leads(_ids uuid[])
RETURNS TABLE(banco_lead_id uuid, lead_id uuid, resultado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendedor uuid;
  v_limite constant integer := 20;
  v_janela constant interval := '1 hour';
  v_usados integer;
  v_disponivel integer;
  v_id uuid;
  r record;
  v_novo uuid;
BEGIN
  v_vendedor := public.current_vendedor_id();
  IF v_vendedor IS NULL THEN
    RAISE EXCEPTION 'Apenas vendedores podem puxar leads do banco.';
  END IF;

  SELECT count(*) INTO v_usados
    FROM public.banco_leads
   WHERE puxado_por = v_vendedor AND puxado_em > now() - v_janela;

  v_disponivel := v_limite - v_usados;
  IF v_disponivel <= 0 THEN
    RAISE EXCEPTION 'Limite de % leads por hora atingido. Tente novamente mais tarde.', v_limite;
  END IF;
  IF COALESCE(array_length(_ids, 1), 0) > v_disponivel THEN
    RAISE EXCEPTION 'Você pode puxar no máximo % lead(s) agora.', v_disponivel;
  END IF;

  FOREACH v_id IN ARRAY _ids LOOP
    banco_lead_id := v_id;

    UPDATE public.banco_leads b
       SET status = 'puxado', puxado_por = v_vendedor, puxado_em = now()
     WHERE b.id = v_id
       AND b.status = 'disponivel'
       AND (b.bloqueado_ate IS NULL OR b.bloqueado_ate <= now())
       AND public.pode_ver_banco_lead(b.reservado_segmento, b.reservado_estado, b.reservado_cnae)
     RETURNING b.* INTO r;

    IF r.id IS NULL THEN
      lead_id := NULL; resultado := 'indisponivel';
      RETURN NEXT; CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.leads l
       WHERE l.vendedor_id = v_vendedor
         AND regexp_replace(l.telefone,'\D','','g') = regexp_replace(r.telefone,'\D','','g')
    ) THEN
      UPDATE public.banco_leads
         SET status = 'disponivel', puxado_por = NULL, puxado_em = NULL
       WHERE id = v_id;
      lead_id := NULL; resultado := 'ja_na_carteira';
      RETURN NEXT; r := NULL; CONTINUE;
    END IF;

    INSERT INTO public.leads (
      vendedor_id, nome_contato, empresa, cargo, telefone, email, segmento,
      origem, observacoes, estagio, contatado_em, banco_lead_id
    ) VALUES (
      v_vendedor, r.nome_contato, COALESCE(r.empresa, r.razao_social), r.cargo, r.telefone, r.email,
      r.segmento, r.origem, r.observacoes, 'contatado', CURRENT_DATE, r.id
    ) RETURNING id INTO v_novo;

    UPDATE public.banco_leads SET lead_id = v_novo WHERE id = v_id;
    lead_id := v_novo; resultado := 'ok';
    RETURN NEXT;
    r := NULL;
  END LOOP;
END;
$function$;

DROP FUNCTION IF EXISTS public.pode_ver_banco_lead(text, text);

-- ============================================================
-- 6) Autocadastro do CNAE ao inserir lead no banco
-- ============================================================
CREATE OR REPLACE FUNCTION public.banco_leads_registrar_cnae()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cnae_codigo IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.cnaes (codigo, descricao, segmento_sugerido, total_leads)
  VALUES (NEW.cnae_codigo, NULLIF(btrim(COALESCE(NEW.cnae_descricao, '')), ''), NEW.segmento, 1)
  ON CONFLICT (codigo) DO UPDATE
    SET descricao = COALESCE(public.cnaes.descricao, EXCLUDED.descricao),
        segmento_sugerido = COALESCE(public.cnaes.segmento_sugerido, EXCLUDED.segmento_sugerido),
        total_leads = public.cnaes.total_leads + 1,
        updated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS banco_leads_registrar_cnae_trg ON public.banco_leads;
CREATE TRIGGER banco_leads_registrar_cnae_trg AFTER INSERT ON public.banco_leads
  FOR EACH ROW EXECUTE FUNCTION public.banco_leads_registrar_cnae();