CREATE TYPE public.lead_estagio AS ENUM ('contatado','interessado','nao_interessado','em_negociacao','ganho','perdido');
CREATE TYPE public.lead_origem AS ENUM ('prospeccao_ativa','indicacao','inbound','evento','rede_social','outro');
CREATE TYPE public.reuniao_status AS ENUM ('marcada','realizada','remarcada','no_show','cancelada');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  nome_contato text NOT NULL CHECK (char_length(trim(nome_contato)) BETWEEN 2 AND 120),
  empresa text,
  cargo text,
  telefone text NOT NULL,
  email text,
  segmento text,
  origem public.lead_origem NOT NULL DEFAULT 'prospeccao_ativa',
  estagio public.lead_estagio NOT NULL DEFAULT 'contatado',
  valor_estimado numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_estimado >= 0),
  motivo_perda text,
  observacoes text,
  proximo_contato date,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  contatado_em date NOT NULL DEFAULT CURRENT_DATE,
  fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_reunioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  agendada_para timestamptz NOT NULL,
  status public.reuniao_status NOT NULL DEFAULT 'marcada',
  remarcada_de uuid REFERENCES public.lead_reunioes(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  tipo text NOT NULL,
  de text,
  para text,
  corpo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leads_vendedor_idx ON public.leads (vendedor_id, created_at DESC);
CREATE INDEX leads_estagio_idx ON public.leads (estagio);
CREATE INDEX leads_contatado_em_idx ON public.leads (contatado_em);
CREATE INDEX leads_proximo_contato_idx ON public.leads (proximo_contato) WHERE proximo_contato IS NOT NULL;
CREATE INDEX lead_reunioes_lead_idx ON public.lead_reunioes (lead_id, agendada_para DESC);
CREATE INDEX lead_reunioes_vendedor_idx ON public.lead_reunioes (vendedor_id, agendada_para DESC);
CREATE INDEX lead_atividades_lead_idx ON public.lead_atividades (lead_id, created_at DESC);
CREATE UNIQUE INDEX leads_telefone_por_vendedor ON public.leads (vendedor_id, regexp_replace(telefone, '\D', '', 'g'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads, public.lead_reunioes, public.lead_atividades TO authenticated;
GRANT ALL ON public.leads, public.lead_reunioes, public.lead_atividades TO service_role;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER lead_reunioes_updated_at BEFORE UPDATE ON public.lead_reunioes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_admin_all ON public.leads FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY leads_select_own ON public.leads FOR SELECT TO authenticated USING (vendedor_id = public.current_vendedor_id());
CREATE POLICY leads_insert_own ON public.leads FOR INSERT TO authenticated WITH CHECK (vendedor_id = public.current_vendedor_id());
CREATE POLICY leads_update_own ON public.leads FOR UPDATE TO authenticated USING (vendedor_id = public.current_vendedor_id()) WITH CHECK (vendedor_id = public.current_vendedor_id());
CREATE POLICY leads_delete_own ON public.leads FOR DELETE TO authenticated USING (vendedor_id = public.current_vendedor_id());

CREATE POLICY lead_reunioes_admin_all ON public.lead_reunioes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY lead_reunioes_select_own ON public.lead_reunioes FOR SELECT TO authenticated USING (vendedor_id = public.current_vendedor_id());
CREATE POLICY lead_reunioes_insert_own ON public.lead_reunioes FOR INSERT TO authenticated WITH CHECK (vendedor_id = public.current_vendedor_id());
CREATE POLICY lead_reunioes_update_own ON public.lead_reunioes FOR UPDATE TO authenticated USING (vendedor_id = public.current_vendedor_id()) WITH CHECK (vendedor_id = public.current_vendedor_id());
CREATE POLICY lead_reunioes_delete_own ON public.lead_reunioes FOR DELETE TO authenticated USING (vendedor_id = public.current_vendedor_id());

CREATE POLICY lead_atividades_admin_all ON public.lead_atividades FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY lead_atividades_select_scope ON public.lead_atividades FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.vendedor_id = public.current_vendedor_id()));
CREATE POLICY lead_atividades_insert_scope ON public.lead_atividades FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.vendedor_id = public.current_vendedor_id()));

CREATE OR REPLACE FUNCTION public.leads_registra_estagio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estagio IS DISTINCT FROM OLD.estagio THEN
    IF NEW.estagio IN ('ganho','perdido','nao_interessado') THEN
      NEW.fechado_em := COALESCE(NEW.fechado_em, now());
    ELSE
      NEW.fechado_em := NULL;
    END IF;
    INSERT INTO public.lead_atividades (lead_id, autor_id, tipo, de, para)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.vendedor_id::uuid), 'estagio', OLD.estagio::text, NEW.estagio::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_estagio_trg BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leads_registra_estagio();

CREATE OR REPLACE FUNCTION public.lead_reunioes_herda_vendedor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT vendedor_id INTO NEW.vendedor_id FROM public.leads WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lead_reunioes_vendedor_trg BEFORE INSERT OR UPDATE ON public.lead_reunioes FOR EACH ROW EXECUTE FUNCTION public.lead_reunioes_herda_vendedor();

REVOKE EXECUTE ON FUNCTION public.leads_registra_estagio() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lead_reunioes_herda_vendedor() FROM PUBLIC, anon, authenticated;