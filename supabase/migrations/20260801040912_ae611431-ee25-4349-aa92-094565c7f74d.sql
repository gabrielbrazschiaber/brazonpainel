ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_ups_feitos smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_contato_em timestamptz,
  ADD COLUMN IF NOT EXISTS cadencia_encerrada boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS leads_cadencia_idx
  ON public.leads (vendedor_id, proximo_contato)
  WHERE estagio NOT IN ('ganho','perdido') AND cadencia_encerrada = false;

CREATE OR REPLACE FUNCTION public.lead_proximo_follow_up(
  _estagio public.lead_estagio,
  _tentativas smallint,
  _base date DEFAULT CURRENT_DATE
) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE d date;
BEGIN
  d := CASE
    WHEN _estagio IN ('ganho','perdido') THEN NULL
    WHEN _estagio = 'em_negociacao' THEN _base + 2
    WHEN _estagio = 'interessado'   THEN _base + 3
    WHEN _estagio = 'nao_interessado' THEN _base + 90
    WHEN _estagio = 'contatado' THEN
      CASE _tentativas
        WHEN 0 THEN _base + 2
        WHEN 1 THEN _base + 4
        WHEN 2 THEN _base + 7
        WHEN 3 THEN _base + 15
        ELSE NULL
      END
    ELSE _base + 7
  END;
  IF d IS NOT NULL THEN
    IF EXTRACT(DOW FROM d) = 6 THEN d := d + 2; END IF;
    IF EXTRACT(DOW FROM d) = 0 THEN d := d + 1; END IF;
  END IF;
  RETURN d;
END;
$$;

REVOKE ALL ON FUNCTION public.lead_proximo_follow_up(public.lead_estagio, smallint, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_proximo_follow_up(public.lead_estagio, smallint, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leads_agenda_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estagio IN ('ganho','perdido') THEN
      NEW.proximo_contato := NULL;
      NEW.cadencia_encerrada := true;
    ELSIF NEW.proximo_contato IS NULL THEN
      d := public.lead_proximo_follow_up(NEW.estagio, 0::smallint);
      NEW.proximo_contato := d;
      NEW.cadencia_encerrada := (d IS NULL);
    END IF;
    IF NEW.ultimo_contato_em IS NULL THEN
      NEW.ultimo_contato_em := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estagio IS DISTINCT FROM OLD.estagio THEN
    IF NEW.estagio IN ('ganho','perdido') THEN
      NEW.proximo_contato := NULL;
      NEW.cadencia_encerrada := true;
    ELSE
      NEW.follow_ups_feitos := 0;
      d := public.lead_proximo_follow_up(NEW.estagio, 0::smallint);
      NEW.proximo_contato := d;
      NEW.cadencia_encerrada := (d IS NULL);
    END IF;
  END IF;

  IF NEW.proximo_contato IS NULL AND NEW.estagio NOT IN ('ganho','perdido') THEN
    NEW.cadencia_encerrada := true;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.leads_agenda_follow_up() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS leads_follow_up_trg ON public.leads;
CREATE TRIGGER leads_follow_up_trg
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_agenda_follow_up();

UPDATE public.leads
   SET proximo_contato = public.lead_proximo_follow_up(estagio, 0::smallint),
       ultimo_contato_em = COALESCE(ultimo_contato_em, updated_at)
 WHERE proximo_contato IS NULL
   AND cadencia_encerrada = false
   AND estagio NOT IN ('ganho','perdido');