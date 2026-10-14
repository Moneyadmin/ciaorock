ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS rocks_deleted_at_idx ON public.rocks (deleted_at);