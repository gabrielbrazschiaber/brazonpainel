ALTER TABLE public.tarefas REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tarefas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;
  END IF;
END $$;