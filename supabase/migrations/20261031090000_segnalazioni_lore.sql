-- Storia del sasso (facoltativa) e segnalazioni di sassi smarriti.
--
-- Chi non trova un sasso può segnalare che non c'è, con una foto di dove dovrebbe essere, se si
-- trova entro 75 m dal sasso (lo controlla il server). Alla terza segnalazione aperta gli admin
-- ricevono una notifica e decidono se toglierlo dalla mappa. Se qualcuno lo trova o lo sposta,
-- le segnalazioni aperte si chiudono da sole.

ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS lore text;
ALTER TABLE public.rocks DROP CONSTRAINT IF EXISTS rocks_lore_len;
ALTER TABLE public.rocks ADD CONSTRAINT rocks_lore_len CHECK (lore IS NULL OR char_length(lore) <= 1000);

-- ---------------------------------------------------------------------------
-- Segnalazioni
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id uuid NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text CHECK (resolution IN ('found', 'moved', 'removed', 'dismissed'))
);
-- una segnalazione aperta per giocatore e sasso
CREATE UNIQUE INDEX IF NOT EXISTS rock_reports_open_once
  ON public.rock_reports (rock_id, user_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS rock_reports_rock_idx ON public.rock_reports (rock_id) WHERE resolved_at IS NULL;

GRANT SELECT ON public.rock_reports TO authenticated;
GRANT ALL ON public.rock_reports TO service_role;
ALTER TABLE public.rock_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rock_reports_select ON public.rock_reports;
-- il giocatore vede le sue, l'admin tutte (le foto non sono pubbliche)
CREATE POLICY rock_reports_select ON public.rock_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Notifiche per gli admin
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('rock_missing')),
  rock_id uuid REFERENCES public.rocks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_notifications_select ON public.admin_notifications;
DROP POLICY IF EXISTS admin_notifications_update ON public.admin_notifications;
CREATE POLICY admin_notifications_select ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_notifications_update ON public.admin_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
EXCEPTION WHEN duplicate_object OR undefined_object OR object_not_in_prerequisite_state THEN NULL;
END $$;

-- Terza segnalazione aperta: notifica agli admin (una sola volta per ciclo di segnalazioni).
CREATE OR REPLACE FUNCTION public.rock_reports_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.rock_reports
      WHERE rock_id = NEW.rock_id AND resolved_at IS NULL) = 3 THEN
    INSERT INTO public.admin_notifications (kind, rock_id) VALUES ('rock_missing', NEW.rock_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rock_reports_notify ON public.rock_reports;
CREATE TRIGGER rock_reports_notify AFTER INSERT ON public.rock_reports
FOR EACH ROW EXECUTE FUNCTION public.rock_reports_notify();

-- Il sasso c'era (qualcuno l'ha trovato) o è stato spostato: le segnalazioni aperte si chiudono.
CREATE OR REPLACE FUNCTION public.rock_reports_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'finds' THEN
    UPDATE public.rock_reports SET resolved_at = now(), resolution = 'found'
    WHERE rock_id = NEW.rock_id AND resolved_at IS NULL;
  ELSIF NEW.lat IS DISTINCT FROM OLD.lat OR NEW.lng IS DISTINCT FROM OLD.lng THEN
    UPDATE public.rock_reports SET resolved_at = now(), resolution = 'moved'
    WHERE rock_id = NEW.id AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finds_close_reports ON public.finds;
CREATE TRIGGER finds_close_reports AFTER INSERT ON public.finds
FOR EACH ROW EXECUTE FUNCTION public.rock_reports_close();
DROP TRIGGER IF EXISTS rocks_close_reports ON public.rocks;
CREATE TRIGGER rocks_close_reports AFTER UPDATE OF lat, lng ON public.rocks
FOR EACH ROW EXECUTE FUNCTION public.rock_reports_close();

REVOKE EXECUTE ON FUNCTION public.rock_reports_notify() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rock_reports_close() FROM public, anon, authenticated;
