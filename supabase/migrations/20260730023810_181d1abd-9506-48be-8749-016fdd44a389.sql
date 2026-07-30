ALTER TABLE public.conversa_mensagens REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversa_mensagens;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;