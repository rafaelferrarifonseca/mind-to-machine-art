ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS cliente text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'em_tratamento',
  ADD COLUMN IF NOT EXISTS dossie jsonb,
  ADD COLUMN IF NOT EXISTS raw_input text;

ALTER TABLE public.threads ALTER COLUMN polo DROP NOT NULL;
ALTER TABLE public.threads ALTER COLUMN natureza DROP NOT NULL;
ALTER TABLE public.threads ALTER COLUMN publico DROP NOT NULL;
ALTER TABLE public.threads ALTER COLUMN objetivo DROP NOT NULL;

CREATE INDEX IF NOT EXISTS threads_user_cliente_idx ON public.threads(user_id, cliente);
CREATE INDEX IF NOT EXISTS threads_user_status_idx ON public.threads(user_id, status);
CREATE INDEX IF NOT EXISTS threads_user_area_idx ON public.threads(user_id, area);