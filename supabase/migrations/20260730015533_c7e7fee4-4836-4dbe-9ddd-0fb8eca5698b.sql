CREATE TYPE public.conversa_tipo AS ENUM ('equipe','atendimento');

CREATE TABLE public.conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.conversa_tipo NOT NULL,
  titulo text,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  criado_por_id uuid NOT NULL,
  ultima_mensagem_em timestamptz NOT NULL DEFAULT now(),
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversas_atendimento_tem_cliente CHECK (tipo <> 'atendimento' OR cliente_id IS NOT NULL)
);

CREATE UNIQUE INDEX conversas_atendimento_unica ON public.conversas (cliente_id) WHERE tipo = 'atendimento';
CREATE INDEX conversas_tipo_atividade_idx ON public.conversas (tipo, ultima_mensagem_em DESC);
CREATE INDEX conversas_cliente_idx ON public.conversas (cliente_id);
CREATE INDEX conversas_vendedor_idx ON public.conversas (vendedor_id);

CREATE TABLE public.conversa_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversa_id, user_id)
);

CREATE INDEX conversa_participantes_user_idx ON public.conversa_participantes (user_id);

CREATE TABLE public.conversa_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  corpo text NOT NULL CHECK (char_length(btrim(corpo)) BETWEEN 1 AND 4000),
  sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversa_mensagens_conversa_idx ON public.conversa_mensagens (conversa_id, created_at);
CREATE INDEX conversa_mensagens_autor_idx ON public.conversa_mensagens (autor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversa_participantes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversa_mensagens TO authenticated;
GRANT ALL ON public.conversas TO service_role;
GRANT ALL ON public.conversa_participantes TO service_role;
GRANT ALL ON public.conversa_mensagens TO service_role;

CREATE TRIGGER conversas_updated_at BEFORE UPDATE ON public.conversas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER conversa_participantes_updated_at BEFORE UPDATE ON public.conversa_participantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER conversa_mensagens_updated_at BEFORE UPDATE ON public.conversa_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pode_ver_conversa(_conversa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversas c
    WHERE c.id = _conversa_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR EXISTS (
          SELECT 1 FROM public.conversa_participantes p
          WHERE p.conversa_id = c.id AND p.user_id = auth.uid()
        )
        OR (c.tipo = 'atendimento' AND c.vendedor_id IS NOT NULL AND c.vendedor_id = public.current_vendedor_id())
        OR (c.tipo = 'atendimento' AND EXISTS (
              SELECT 1 FROM public.clientes cl
              WHERE cl.id = c.cliente_id AND cl.user_id = auth.uid()
            ))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.pode_ver_conversa(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_ver_conversa(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_conversa(uuid) TO authenticated;

ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversa_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversa_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversas_admin_all ON public.conversas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY conversas_select_scope ON public.conversas FOR SELECT TO authenticated
  USING (public.pode_ver_conversa(id));

CREATE POLICY conversas_insert_scope ON public.conversas FOR INSERT TO authenticated
  WITH CHECK (
    criado_por_id = auth.uid()
    AND (
      (tipo = 'equipe' AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.current_vendedor_id() IS NOT NULL))
      OR (tipo = 'atendimento' AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (vendedor_id IS NOT NULL AND vendedor_id = public.current_vendedor_id())
        OR EXISTS (SELECT 1 FROM public.clientes cl
                   WHERE cl.id = cliente_id AND cl.user_id = auth.uid())))
    )
  );

CREATE POLICY conversas_update_scope ON public.conversas FOR UPDATE TO authenticated
  USING (public.pode_ver_conversa(id)
         AND (public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.current_vendedor_id() IS NOT NULL))
  WITH CHECK (public.pode_ver_conversa(id)
         AND (public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.current_vendedor_id() IS NOT NULL));

CREATE POLICY conversa_participantes_admin_all ON public.conversa_participantes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY conversa_participantes_select_scope ON public.conversa_participantes FOR SELECT TO authenticated
  USING (public.pode_ver_conversa(conversa_id));

CREATE POLICY conversa_participantes_insert_scope ON public.conversa_participantes FOR INSERT TO authenticated
  WITH CHECK (
    public.pode_ver_conversa(conversa_id)
    AND (user_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.current_vendedor_id() IS NOT NULL)
  );

CREATE POLICY conversa_participantes_update_own ON public.conversa_participantes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY conversa_participantes_delete_scope ON public.conversa_participantes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (public.pode_ver_conversa(conversa_id) AND public.current_vendedor_id() IS NOT NULL)
  );

CREATE POLICY conversa_mensagens_admin_all ON public.conversa_mensagens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY conversa_mensagens_select_scope ON public.conversa_mensagens FOR SELECT TO authenticated
  USING (public.pode_ver_conversa(conversa_id));

CREATE POLICY conversa_mensagens_insert_scope ON public.conversa_mensagens FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND sistema = false AND public.pode_ver_conversa(conversa_id));

CREATE POLICY conversa_mensagens_update_own ON public.conversa_mensagens FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() AND sistema = false)
  WITH CHECK (autor_id = auth.uid() AND sistema = false);

CREATE POLICY conversa_mensagens_delete_own ON public.conversa_mensagens FOR DELETE TO authenticated
  USING ((autor_id = auth.uid() AND sistema = false)
         OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.conversa_registra_atividade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversas
     SET ultima_mensagem_em = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversa_id;

  UPDATE public.conversa_participantes
     SET lido_em = CASE WHEN user_id = NEW.autor_id THEN NEW.created_at ELSE NULL END
   WHERE conversa_id = NEW.conversa_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER conversa_mensagens_atividade
  AFTER INSERT ON public.conversa_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.conversa_registra_atividade();

REVOKE ALL ON FUNCTION public.conversa_registra_atividade() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conversa_registra_atividade() FROM anon;
REVOKE ALL ON FUNCTION public.conversa_registra_atividade() FROM authenticated;