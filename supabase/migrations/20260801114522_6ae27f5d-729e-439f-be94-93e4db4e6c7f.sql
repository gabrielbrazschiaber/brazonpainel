ALTER TABLE public.auth_telemetria ADD COLUMN IF NOT EXISTS trace_id text;
CREATE INDEX IF NOT EXISTS auth_telemetria_trace_id_idx ON public.auth_telemetria (trace_id);