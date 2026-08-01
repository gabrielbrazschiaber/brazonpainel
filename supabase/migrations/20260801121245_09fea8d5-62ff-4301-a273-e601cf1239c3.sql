CREATE INDEX IF NOT EXISTS idx_auth_telemetria_trace ON public.auth_telemetria (trace_id, created_at);

-- Linha do tempo completa de um Trace ID (apenas admin).
CREATE OR REPLACE FUNCTION public.auth_telemetria_trace(_trace_id text)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  tipo text,
  motivo text,
  rota text,
  duracao_ms integer,
  papel text,
  erro text,
  app_version text,
  user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem ler a telemetria de acesso.';
  END IF;

  IF _trace_id IS NULL OR length(btrim(_trace_id)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, t.created_at, t.tipo, t.motivo, COALESCE(t.rota, '—'),
         t.duracao_ms, t.papel, t.erro, t.app_version, t.user_id
  FROM public.auth_telemetria t
  WHERE t.trace_id = btrim(_trace_id)
  ORDER BY t.created_at ASC
  LIMIT 500;
END;
$$;

-- Alertas: aumento de incidentes por versão e rota comparando janela recente x base.
CREATE OR REPLACE FUNCTION public.auth_telemetria_alertas(
  _janela_horas integer DEFAULT 6,
  _base_horas integer DEFAULT 72,
  _minimo_incidentes integer DEFAULT 3
)
RETURNS TABLE (
  app_version text,
  rota text,
  eventos_janela bigint,
  incidentes_janela bigint,
  taxa_janela numeric,
  eventos_base bigint,
  incidentes_base bigint,
  taxa_base numeric,
  fator numeric,
  severidade text,
  ultimo_erro text,
  ultima timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_janela integer := GREATEST(1, LEAST(_janela_horas, 168));
  v_base integer := GREATEST(2, LEAST(_base_horas, 720));
  v_min integer := GREATEST(1, LEAST(_minimo_incidentes, 1000));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem ler a telemetria de acesso.';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT t.app_version,
           COALESCE(t.rota, '—') AS rota,
           count(*) AS eventos,
           count(*) FILTER (WHERE t.tipo IN ('papel_erro', 'papel_sem_papel')) AS incidentes
    FROM public.auth_telemetria t
    WHERE t.created_at >= now() - make_interval(hours => v_base)
      AND t.created_at < now() - make_interval(hours => v_janela)
    GROUP BY 1, 2
  ),
  janela AS (
    SELECT t.app_version,
           COALESCE(t.rota, '—') AS rota,
           count(*) AS eventos,
           count(*) FILTER (WHERE t.tipo IN ('papel_erro', 'papel_sem_papel')) AS incidentes,
           max(t.created_at) AS ultima,
           (array_remove(array_agg(t.erro ORDER BY t.created_at DESC), NULL))[1] AS ultimo_erro
    FROM public.auth_telemetria t
    WHERE t.created_at >= now() - make_interval(hours => v_janela)
    GROUP BY 1, 2
  ),
  calc AS (
    SELECT j.app_version,
           j.rota,
           j.eventos AS eventos_janela,
           j.incidentes AS incidentes_janela,
           ROUND(j.incidentes::numeric / GREATEST(j.eventos, 1) * 100, 1) AS taxa_janela,
           COALESCE(b.eventos, 0) AS eventos_base,
           COALESCE(b.incidentes, 0) AS incidentes_base,
           ROUND(COALESCE(b.incidentes, 0)::numeric / GREATEST(COALESCE(b.eventos, 0), 1) * 100, 1) AS taxa_base,
           j.ultimo_erro,
           j.ultima
    FROM janela j
    LEFT JOIN base b ON b.app_version = j.app_version AND b.rota = j.rota
    WHERE j.incidentes >= v_min
  )
  SELECT c.app_version,
         c.rota,
         c.eventos_janela,
         c.incidentes_janela,
         c.taxa_janela,
         c.eventos_base,
         c.incidentes_base,
         c.taxa_base,
         ROUND(c.taxa_janela / GREATEST(c.taxa_base, 0.5), 2) AS fator,
         CASE
           WHEN c.taxa_janela >= 25 OR c.taxa_janela >= GREATEST(c.taxa_base, 0.5) * 3 THEN 'critico'
           WHEN c.taxa_janela >= 10 OR c.taxa_janela >= GREATEST(c.taxa_base, 0.5) * 1.5 THEN 'atencao'
           ELSE 'estavel'
         END AS severidade,
         c.ultimo_erro,
         c.ultima
  FROM calc c
  WHERE c.taxa_janela >= 10 OR c.taxa_janela >= GREATEST(c.taxa_base, 0.5) * 1.5
  ORDER BY c.incidentes_janela DESC, c.taxa_janela DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_telemetria_trace(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auth_telemetria_alertas(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_telemetria_trace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_telemetria_alertas(integer, integer, integer) TO authenticated;