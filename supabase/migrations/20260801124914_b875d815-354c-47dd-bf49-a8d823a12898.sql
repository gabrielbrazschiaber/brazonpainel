-- =====================================================================
-- BANCO DE LEADS
-- =====================================================================

CREATE TYPE public.banco_lead_status AS ENUM ('disponivel','puxado','arquivado');

CREATE TABLE public.banco_leads_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id uuid NOT NULL,
  arquivo_nome text NOT NULL,
  fonte text,
  reservado_segmento text,
  reservado_estado text,
  total_linhas integer NOT NULL DEFAULT 0,
  importados integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.banco_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_contato text NOT NULL CHECK (char_length(btrim(nome_contato)) BETWEEN 2 AND 120),
  empresa text,
  cargo text,
  telefone text NOT NULL,
  email text,
  segmento text,
  cidade text,
  estado text,
  origem public.lead_origem NOT NULL DEFAULT 'prospeccao_ativa',
  observacoes text,
  status public.banco_lead_status NOT NULL DEFAULT 'disponivel',
  puxado_por uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  puxado_em timestamptz,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  lote_id uuid REFERENCES public.banco_leads_lotes(id) ON DELETE SET NULL,
  reservado_segmento text,
  reservado_estado text,
  bloqueado_ate timestamptz,
  vezes_devolvido smallint NOT NULL DEFAULT 0,
  criado_por_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX banco_leads_telefone_uniq
  ON public.banco_leads (regexp_replace(telefone, '\D', '', 'g'));
CREATE INDEX banco_leads_status_idx ON public.banco_leads (status, created_at DESC);
CREATE INDEX banco_leads_segmento_idx ON public.banco_leads (segmento);
CREATE INDEX banco_leads_puxado_idx ON public.banco_leads (puxado_por, puxado_em DESC);
CREATE INDEX banco_leads_disponivel_idx ON public.banco_leads (status, bloqueado_ate)
  WHERE status = 'disponivel';
CREATE INDEX banco_leads_lote_idx ON public.banco_leads (lote_id);

CREATE TRIGGER banco_leads_updated_at
  BEFORE UPDATE ON public.banco_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS banco_lead_id uuid
    REFERENCES public.banco_leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_banco_lead_idx ON public.leads (banco_lead_id);

ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS segmentos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estados text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS dias_devolver_lead smallint NOT NULL DEFAULT 7;

-- =====================================================================
-- GRANTS + RLS
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banco_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banco_leads_lotes TO authenticated;
GRANT ALL ON public.banco_leads TO service_role;
GRANT ALL ON public.banco_leads_lotes TO service_role;

ALTER TABLE public.banco_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_leads_lotes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_ver_banco_lead(
  _reservado_segmento text, _reservado_estado text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendedores v
     WHERE v.id = public.current_vendedor_id()
       AND (_reservado_segmento IS NULL
            OR cardinality(v.segmentos) = 0
            OR _reservado_segmento = ANY(v.segmentos))
       AND (_reservado_estado IS NULL
            OR cardinality(v.estados) = 0
            OR _reservado_estado = ANY(v.estados))
  )
$$;
REVOKE ALL ON FUNCTION public.pode_ver_banco_lead(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_ver_banco_lead(text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_banco_lead(text,text) TO authenticated;

CREATE POLICY banco_leads_admin_all ON public.banco_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY banco_leads_vendedor_select ON public.banco_leads
  FOR SELECT TO authenticated
  USING (
    public.current_vendedor_id() IS NOT NULL
    AND (
      puxado_por = public.current_vendedor_id()
      OR (status = 'disponivel'
          AND (bloqueado_ate IS NULL OR bloqueado_ate <= now())
          AND public.pode_ver_banco_lead(reservado_segmento, reservado_estado))
    )
  );

CREATE POLICY banco_leads_lotes_admin_all ON public.banco_leads_lotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =====================================================================
-- PUXAR
-- =====================================================================

CREATE OR REPLACE FUNCTION public.puxar_banco_leads(_ids uuid[])
RETURNS TABLE (banco_lead_id uuid, lead_id uuid, resultado text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
       AND public.pode_ver_banco_lead(b.reservado_segmento, b.reservado_estado)
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
      v_vendedor, r.nome_contato, r.empresa, r.cargo, r.telefone, r.email,
      r.segmento, r.origem, r.observacoes, 'contatado', CURRENT_DATE, r.id
    ) RETURNING id INTO v_novo;

    UPDATE public.banco_leads SET lead_id = v_novo WHERE id = v_id;
    lead_id := v_novo; resultado := 'ok';
    RETURN NEXT;
    r := NULL;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.puxar_banco_leads(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puxar_banco_leads(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.puxar_banco_leads(uuid[]) TO authenticated;

-- =====================================================================
-- SALDO
-- =====================================================================

CREATE OR REPLACE FUNCTION public.saldo_puxadas()
RETURNS TABLE (restante integer, limite integer, renova_em timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendedor uuid;
  v_limite constant integer := 20;
BEGIN
  v_vendedor := public.current_vendedor_id();
  IF v_vendedor IS NULL THEN
    RAISE EXCEPTION 'Apenas vendedores possuem cota de puxadas.';
  END IF;

  SELECT GREATEST(v_limite - count(*), 0)::integer,
         v_limite,
         min(b.puxado_em) + interval '1 hour'
    INTO restante, limite, renova_em
    FROM public.banco_leads b
   WHERE b.puxado_por = v_vendedor
     AND b.puxado_em > now() - interval '1 hour';

  limite := v_limite;
  restante := COALESCE(restante, v_limite);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.saldo_puxadas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.saldo_puxadas() FROM anon;
GRANT EXECUTE ON FUNCTION public.saldo_puxadas() TO authenticated;

-- =====================================================================
-- DEVOLVER
-- =====================================================================

CREATE OR REPLACE FUNCTION public.devolver_banco_lead(_id uuid, _automatico boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b record;
  l record;
  v_vendedor uuid;
  v_novo_status public.banco_lead_status;
  v_autor uuid;
BEGIN
  SELECT * INTO b FROM public.banco_leads WHERE id = _id;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado no banco de leads.';
  END IF;

  IF NOT _automatico THEN
    v_vendedor := public.current_vendedor_id();
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
       AND (v_vendedor IS NULL OR b.puxado_por IS DISTINCT FROM v_vendedor) THEN
      RAISE EXCEPTION 'Você só pode devolver leads que puxou.';
    END IF;
  END IF;

  IF b.status <> 'puxado' THEN
    RAISE EXCEPTION 'Este lead não está puxado.';
  END IF;

  IF b.lead_id IS NOT NULL THEN
    SELECT * INTO l FROM public.leads WHERE id = b.lead_id;
    IF l.id IS NOT NULL THEN
      IF l.estagio <> 'contatado'
         OR l.follow_ups_feitos > 0
         OR EXISTS (SELECT 1 FROM public.lead_reunioes r WHERE r.lead_id = l.id) THEN
        RAISE EXCEPTION 'Este lead já foi trabalhado (follow-up, reunião ou mudança de estágio) e não pode ser devolvido.';
      END IF;

      v_autor := COALESCE(auth.uid(), (SELECT user_id FROM public.vendedores WHERE id = b.puxado_por));

      -- Histórico: nota no lead (some com o lead) + auditoria durável.
      INSERT INTO public.lead_atividades (lead_id, autor_id, tipo, corpo)
      VALUES (l.id, v_autor, 'nota',
              CASE WHEN _automatico
                   THEN 'Lead devolvido automaticamente ao banco de leads por falta de contato.'
                   ELSE 'Lead devolvido ao banco de leads.' END);

      INSERT INTO public.auditoria (actor_id, acao, entidade, entidade_id, detalhes)
      VALUES (v_autor,
              CASE WHEN _automatico THEN 'devolucao_automatica' ELSE 'devolucao' END,
              'banco_leads', b.id,
              jsonb_build_object(
                'lead_id', l.id,
                'nome_contato', l.nome_contato,
                'vendedor_id', b.puxado_por,
                'vezes_devolvido', b.vezes_devolvido + 1
              ));

      DELETE FROM public.leads WHERE id = l.id;
    END IF;
  END IF;

  v_novo_status := CASE WHEN b.vezes_devolvido + 1 >= 3 THEN 'arquivado'::public.banco_lead_status
                        ELSE 'disponivel'::public.banco_lead_status END;

  UPDATE public.banco_leads
     SET status = v_novo_status,
         puxado_por = NULL,
         puxado_em = NULL,
         lead_id = NULL,
         vezes_devolvido = b.vezes_devolvido + 1,
         bloqueado_ate = now() + interval '7 days'
   WHERE id = _id;

  RETURN v_novo_status::text;
END;
$$;

REVOKE ALL ON FUNCTION public.devolver_banco_lead(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.devolver_banco_lead(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.devolver_banco_lead(uuid, boolean) TO authenticated;

-- =====================================================================
-- CRON: aviso + devolução automática
-- =====================================================================

CREATE OR REPLACE FUNCTION public.avisar_leads_a_devolver(_dias integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dias integer := GREATEST(3, LEAST(COALESCE(_dias, 7), 30));
  v_total integer := 0;
  v record;
BEGIN
  FOR v IN
    SELECT ve.user_id, count(*) AS qtd
      FROM public.banco_leads b
      JOIN public.leads l ON l.id = b.lead_id
      JOIN public.vendedores ve ON ve.id = b.puxado_por
     WHERE b.status = 'puxado'
       AND ve.user_id IS NOT NULL
       AND b.puxado_em < now() - make_interval(days => v_dias - 1)
       AND b.puxado_em >= now() - make_interval(days => v_dias)
       AND l.estagio = 'contatado'
       AND l.follow_ups_feitos = 0
       AND NOT EXISTS (SELECT 1 FROM public.lead_reunioes r WHERE r.lead_id = l.id)
     GROUP BY ve.user_id
  LOOP
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (v.user_id, 'banco_leads', 'Leads voltam ao banco amanhã',
            v.qtd || ' lead(s) voltam ao banco de leads amanhã se você não iniciar o contato.',
            '/banco-leads');
    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.devolver_leads_abandonados(_dias integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dias integer := GREATEST(3, LEAST(COALESCE(_dias, 7), 30));
  v_total integer := 0;
  v record;
BEGIN
  FOR v IN
    SELECT b.id
      FROM public.banco_leads b
      JOIN public.leads l ON l.id = b.lead_id
     WHERE b.status = 'puxado'
       AND b.puxado_em < now() - make_interval(days => v_dias)
       AND l.estagio = 'contatado'
       AND l.follow_ups_feitos = 0
       AND NOT EXISTS (SELECT 1 FROM public.lead_reunioes r WHERE r.lead_id = l.id)
  LOOP
    PERFORM public.devolver_banco_lead(v.id, true);
    v_total := v_total + 1;
  END LOOP;

  PERFORM public.avisar_leads_a_devolver(v_dias);
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.devolver_leads_abandonados(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.devolver_leads_abandonados(integer) FROM anon;
REVOKE ALL ON FUNCTION public.devolver_leads_abandonados(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.devolver_leads_abandonados(integer) TO service_role;

REVOKE ALL ON FUNCTION public.avisar_leads_a_devolver(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avisar_leads_a_devolver(integer) FROM anon;
REVOKE ALL ON FUNCTION public.avisar_leads_a_devolver(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.avisar_leads_a_devolver(integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('devolver-leads-abandonados')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'devolver-leads-abandonados');

SELECT cron.schedule(
  'devolver-leads-abandonados',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://brazonpainel.lovable.app/api/public/hooks/devolver-leads-abandonados',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', COALESCE((SELECT cron_token FROM public.configuracoes LIMIT 1), '')
    ),
    body := '{}'::jsonb
  );
  $$
);