-- Regole di gioco controllate dal server (non più solo dall'app).
--
-- Dopo questa migrazione:
--  * ritrovamenti, nuovi sassi e spostamenti si scrivono SOLO dal server (service role),
--    che controlla distanza, foto (AI) e permessi: src/lib/game.functions.ts;
--  * gli utenti non possono più modificare sassi altrui né i campi "di gioco" del proprio
--    profilo (punti, ban, serie);
--  * la posizione dal vivo sta in player_locations ed è leggibile solo dagli amici.
--
-- Va applicata insieme alla versione dell'app che la usa: la versione precedente (Lovable)
-- non riuscirebbe più a registrare ritrovamenti o sassi.

-- ---------------------------------------------------------------------------
-- 1. Ritrovamenti: solo dal server
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "finds_insert_own" ON public.finds;
DROP POLICY IF EXISTS "finds_delete_own" ON public.finds;
REVOKE INSERT, UPDATE, DELETE ON public.finds FROM authenticated;

-- Le coordinate esatte di dove un ragazzo ha trovato un sasso erano leggibili da tutti:
-- non servono al gioco (la città basta per i badge), quindi non le teniamo.
UPDATE public.finds SET lat = NULL, lng = NULL WHERE lat IS NOT NULL OR lng IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2-3. Sassi: creazione e spostamento solo dal server, modifiche solo admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rocks_insert_own" ON public.rocks;
DROP POLICY IF EXISTS "rocks_update_authenticated" ON public.rocks;
REVOKE INSERT ON public.rocks FROM authenticated;

-- Il pannello admin modifica i sassi con il proprio account (punti manuali, cestino, posizione).
DROP POLICY IF EXISTS rocks_update_admin ON public.rocks;
CREATE POLICY rocks_update_admin ON public.rocks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4. Profilo: campi di gioco protetti
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- senza JWT (auth.role() nullo) è un accesso diretto al database, es. SQL editor della dashboard
  trusted boolean := coalesce(auth.role(), 'service_role') = 'service_role'
    OR coalesce(public.has_role(auth.uid(), 'admin'), false);
  streak_call boolean := coalesce(current_setting('ciaorock.touch_streak', true), '') = 'on';
BEGIN
  -- la posizione dal vivo ora sta in player_locations
  NEW.latitude := NULL;
  NEW.longitude := NULL;

  IF trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.points_adjust := 0;
    NEW.banned := false;
    NEW.streak_current := 1;
    NEW.streak_best := 1;
    NEW.last_login_date := NULL;
    RETURN NEW;
  END IF;

  NEW.points_adjust := OLD.points_adjust;
  NEW.banned := OLD.banned;
  NEW.created_at := OLD.created_at;
  IF NOT streak_call THEN
    NEW.streak_current := OLD.streak_current;
    NEW.streak_best := OLD.streak_best;
    NEW.last_login_date := OLD.last_login_date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

-- Serie di giorni consecutivi: calcolata dal database con l'ora italiana, non dal telefono.
CREATE OR REPLACE FUNCTION public.touch_streak()
RETURNS TABLE (streak_current integer, streak_best integer, last_login_date date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  p public.profiles%ROWTYPE;
  cur integer;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF p.last_login_date IS DISTINCT FROM today THEN
    cur := CASE WHEN p.last_login_date = today - 1 THEN p.streak_current + 1 ELSE 1 END;
    PERFORM set_config('ciaorock.touch_streak', 'on', true);
    UPDATE public.profiles
      SET streak_current = cur,
          streak_best = GREATEST(p.streak_best, cur),
          last_login_date = today
      WHERE id = p.id
      RETURNING profiles.streak_current, profiles.streak_best, profiles.last_login_date
      INTO p.streak_current, p.streak_best, p.last_login_date;
    PERFORM set_config('ciaorock.touch_streak', 'off', true);
  END IF;
  RETURN QUERY SELECT p.streak_current, p.streak_best, p.last_login_date;
END $$;

REVOKE EXECUTE ON FUNCTION public.touch_streak() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.touch_streak() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Posizione dal vivo: visibile solo agli amici
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((user_id = _a AND friend_id = _b) OR (user_id = _b AND friend_id = _a))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.player_locations (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_locations TO authenticated;
GRANT ALL ON public.player_locations TO service_role;
ALTER TABLE public.player_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_locations_select_friends ON public.player_locations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.are_friends(auth.uid(), user_id));
CREATE POLICY player_locations_insert_own ON public.player_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY player_locations_update_own ON public.player_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY player_locations_delete_own ON public.player_locations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.player_locations_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS player_locations_touch ON public.player_locations;
CREATE TRIGGER player_locations_touch BEFORE INSERT OR UPDATE ON public.player_locations
FOR EACH ROW EXECUTE FUNCTION public.player_locations_touch();

-- Le vecchie coordinate sul profilo erano pubbliche: le cancelliamo (il trigger sopra le
-- tiene vuote anche in futuro). Le colonne restano solo per compatibilità e si possono
-- eliminare quando la vecchia app non è più in uso.
UPDATE public.profiles SET latitude = NULL, longitude = NULL
  WHERE latitude IS NOT NULL OR longitude IS NOT NULL;
