-- Escopo do vendedor nunca nulo (nulo quebrava a comparação da reserva)
UPDATE public.vendedores SET segmentos = COALESCE(segmentos, '{}'), estados = COALESCE(estados, '{}'), cnaes = COALESCE(cnaes, '{}');
ALTER TABLE public.vendedores
  ALTER COLUMN segmentos SET DEFAULT '{}',
  ALTER COLUMN estados SET DEFAULT '{}',
  ALTER COLUMN cnaes SET DEFAULT '{}',
  ALTER COLUMN segmentos SET NOT NULL,
  ALTER COLUMN estados SET NOT NULL,
  ALTER COLUMN cnaes SET NOT NULL;

CREATE OR REPLACE FUNCTION public.pode_ver_banco_lead(_reservado_segmento text, _reservado_estado text, _reservado_cnae text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.vendedores v
     WHERE v.id = public.current_vendedor_id()
       AND (_reservado_segmento IS NULL
            OR COALESCE(cardinality(v.segmentos), 0) = 0
            OR _reservado_segmento = ANY(v.segmentos))
       AND (_reservado_estado IS NULL
            OR COALESCE(cardinality(v.estados), 0) = 0
            OR upper(_reservado_estado) = ANY(v.estados))
       AND (_reservado_cnae IS NULL
            OR COALESCE(cardinality(v.cnaes), 0) = 0
            OR _reservado_cnae = ANY(v.cnaes))
  )
$function$;

-- Durante o prazo: só quem tem escopo compatível vê. Depois do prazo: todos veem.
DROP POLICY IF EXISTS banco_leads_vendedor_select ON public.banco_leads;
CREATE POLICY banco_leads_vendedor_select ON public.banco_leads
FOR SELECT TO authenticated
USING (
  public.current_vendedor_id() IS NOT NULL
  AND (
    puxado_por = public.current_vendedor_id()
    OR (
      status = 'disponivel'::banco_lead_status
      AND (
        bloqueado_ate IS NULL
        OR bloqueado_ate <= now()
        OR public.pode_ver_banco_lead(reservado_segmento, reservado_estado, reservado_cnae)
      )
    )
  )
);