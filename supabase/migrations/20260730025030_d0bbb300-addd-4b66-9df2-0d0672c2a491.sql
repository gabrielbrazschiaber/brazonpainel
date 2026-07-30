ALTER TYPE public.tarefa_status ADD VALUE IF NOT EXISTS 'aguardando_cliente';

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS dados jsonb;

CREATE INDEX IF NOT EXISTS tarefas_categoria_idx ON public.tarefas (categoria);