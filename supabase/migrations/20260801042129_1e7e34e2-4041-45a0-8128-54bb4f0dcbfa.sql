CREATE TABLE public.auth_telemetria (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  tipo text NOT NULL,
  motivo text,
  rota text,
  duracao_ms integer,
  papel text,
  erro text,
  app_version text NOT NULL DEFAULT 'desconhecida',
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.auth_telemetria TO anon;
GRANT INSERT, SELECT ON public.auth_telemetria TO authenticated;
GRANT ALL ON public.auth_telemetria TO service_role;

ALTER TABLE public.auth_telemetria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_telemetria_insert_proprio"
  ON public.auth_telemetria FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "auth_telemetria_select_admin"
  ON public.auth_telemetria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX auth_telemetria_created_idx ON public.auth_telemetria (created_at DESC);
CREATE INDEX auth_telemetria_grupo_idx ON public.auth_telemetria (app_version, rota, tipo);

CREATE OR REPLACE FUNCTION public.auth_telemetria_resumo(_dias integer DEFAULT 7)
RETURNS TABLE (
  app_version text,
  rota text,
  tipo text,
  total bigint,
  erros bigint,
  sem_papel bigint,
  p50_ms integer,
  p95_ms integer,
  ultima timestamp with time zone
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

  RETURN QUERY
  SELECT
    t.app_version,
    COALESCE(t.rota, '—') AS rota,
    t.tipo,
    count(*) AS total,
    count(*) FILTER (WHERE t.tipo = 'papel_erro') AS erros,
    count(*) FILTER (WHERE t.tipo = 'papel_sem_papel') AS sem_papel,
    COALESCE(percentile_disc(0.5) WITHIN GROUP (ORDER BY t.duracao_ms), 0)::integer AS p50_ms,
    COALESCE(percentile_disc(0.95) WITHIN GROUP (ORDER BY t.duracao_ms), 0)::integer AS p95_ms,
    max(t.created_at) AS ultima
  FROM public.auth_telemetria t
  WHERE t.created_at >= now() - make_interval(days => GREATEST(1, LEAST(_dias, 90)))
  GROUP BY t.app_version, COALESCE(t.rota, '—'), t.tipo
  ORDER BY erros DESC, total DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_telemetria_resumo(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_telemetria_resumo(integer) TO authenticated, service_role;