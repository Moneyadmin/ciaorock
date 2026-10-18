-- Schema completo di Ciao Rock per un progetto Supabase NUOVO.
-- Incollalo una volta sola nel SQL Editor e premi Run.
-- Generato concatenando, in ordine, le migrazioni di supabase/migrations e drizzle/migrations.


-- ============================================================
-- supabase/migrations/20260815063116_e8dc89b2-d911-48ea-a2cd-f71b5fa207e1.sql
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL UNIQUE,
  bio text NOT NULL DEFAULT '',
  streak_current integer NOT NULL DEFAULT 1,
  streak_best integer NOT NULL DEFAULT 1,
  last_login_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_nickname_lower_idx ON public.profiles (lower(nickname));

CREATE TABLE public.rocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  clue text NOT NULL,
  photo text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  difficulty text NOT NULL DEFAULT 'Facile',
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  move_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rocks_created_at_idx ON public.rocks (created_at DESC);

CREATE TABLE public.finds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id uuid NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo text NOT NULL,
  lat double precision,
  lng double precision,
  city text,
  region text,
  country text,
  continent text,
  found_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rock_id, user_id)
);
CREATE INDEX finds_user_idx ON public.finds (user_id);

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rocks TO authenticated;
GRANT ALL ON public.rocks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finds TO authenticated;
GRANT ALL ON public.finds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "rocks_select_authenticated" ON public.rocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "rocks_insert_own" ON public.rocks FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "rocks_update_authenticated" ON public.rocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rocks_delete_own" ON public.rocks FOR DELETE TO authenticated USING (creator_id = auth.uid());

CREATE POLICY "finds_select_authenticated" ON public.finds FOR SELECT TO authenticated USING (true);
CREATE POLICY "finds_insert_own" ON public.finds FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "finds_delete_own" ON public.finds FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "friendships_insert_own" ON public.friendships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER rocks_set_updated_at BEFORE UPDATE ON public.rocks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finds;;

-- ============================================================
-- supabase/migrations/20260908054004_d4a4b841-13bb-4a6a-afbb-74d564716177.sql
-- ============================================================
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy user_roles_select_authenticated on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

insert into public.user_roles (user_id, role) values ('764c9bcc-3de9-41e9-9ffc-7bc5ce234feb', 'admin');

alter table public.profiles add column points_adjust integer not null default 0;
alter table public.profiles add column banned boolean not null default false;

create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.double_days (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  multiplier integer not null default 2,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.double_days to authenticated;
grant all on public.double_days to service_role;
alter table public.double_days enable row level security;
create policy double_days_select_authenticated on public.double_days for select to authenticated using (true);
create policy double_days_admin_insert on public.double_days for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy double_days_admin_update on public.double_days for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy double_days_admin_delete on public.double_days for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy rocks_delete_admin on public.rocks for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
;

-- ============================================================
-- supabase/migrations/20260908054016_acf0a4f2-13e2-4f45-937c-f7251c538f1d.sql
-- ============================================================
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;;

-- ============================================================
-- supabase/migrations/20260909053544_8842d8fe-60f5-43ae-85fd-7e0e4c52690c.sql
-- ============================================================
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS rocks_deleted_at_idx ON public.rocks (deleted_at);;

-- ============================================================
-- supabase/migrations/20260912061137_7f8b35be-6511-4e38-baac-d9a3ca0598d3.sql
-- ============================================================
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX messages_recipient_idx ON public.messages (recipient_id, created_at DESC);

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_authenticated" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announcements_insert_admin" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "announcements_delete_admin" ON public.announcements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX announcements_created_idx ON public.announcements (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;;

-- ============================================================
-- drizzle/migrations/0000_rock_points_ratings.sql
-- ============================================================
ALTER TABLE public.rocks
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS points_override integer,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2),
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.finds ADD COLUMN IF NOT EXISTS points_awarded integer NOT NULL DEFAULT 10;

CREATE OR REPLACE FUNCTION public.tier_points(_tier text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _tier
    WHEN 'Leggendario' THEN 1000
    WHEN 'Difficile' THEN 650
    WHEN 'Medio' THEN 350
    WHEN 'Media' THEN 350
    ELSE 150 END
$$;

CREATE OR REPLACE FUNCTION public.tier_from_avg(_avg numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _avg >= 4.25 THEN 'Leggendario'
              WHEN _avg >= 3.25 THEN 'Difficile'
              WHEN _avg >= 2.25 THEN 'Medio'
              ELSE 'Facile' END
$$;

CREATE OR REPLACE FUNCTION public.rocks_compute_points()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.points_override IS NOT NULL THEN
    NEW.points := NEW.points_override;
  ELSIF NEW.rating_count >= 2 AND NEW.rating_avg IS NOT NULL THEN
    NEW.points := public.tier_points(public.tier_from_avg(NEW.rating_avg));
  ELSE
    NEW.points := public.tier_points(NEW.difficulty);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rocks_compute_points ON public.rocks;
CREATE TRIGGER rocks_compute_points BEFORE INSERT OR UPDATE ON public.rocks
FOR EACH ROW EXECUTE FUNCTION public.rocks_compute_points();

UPDATE public.rocks SET points = public.tier_points(difficulty);

CREATE OR REPLACE FUNCTION public.finds_award_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT points INTO NEW.points_awarded FROM public.rocks WHERE id = NEW.rock_id;
  NEW.points_awarded := COALESCE(NEW.points_awarded, 150);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS finds_award_points ON public.finds;
CREATE TRIGGER finds_award_points BEFORE INSERT ON public.finds
FOR EACH ROW EXECUTE FUNCTION public.finds_award_points();

CREATE TABLE public.rock_ratings (
  rock_id uuid NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rock_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.rock_ratings TO authenticated;
GRANT ALL ON public.rock_ratings TO service_role;
ALTER TABLE public.rock_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings readable by players" ON public.rock_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finders rate rocks" ON public.rock_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.finds f WHERE f.rock_id = rock_ratings.rock_id AND f.user_id = auth.uid()));
CREATE POLICY "Update own rating" ON public.rock_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.rock_ratings_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rocks r SET
    rating_avg = s.avg, rating_count = s.cnt
  FROM (SELECT AVG(stars)::numeric(3,2) avg, COUNT(*)::int cnt FROM public.rock_ratings WHERE rock_id = NEW.rock_id) s
  WHERE r.id = NEW.rock_id;
  RETURN NEW;
END $$;

CREATE TRIGGER rock_ratings_recalc AFTER INSERT OR UPDATE ON public.rock_ratings
FOR EACH ROW EXECUTE FUNCTION public.rock_ratings_recalc();;

-- ============================================================
-- drizzle/migrations/0001_ai_points_feedback.sql
-- ============================================================
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS ai_points integer, ADD COLUMN IF NOT EXISTS ai_reason text, ADD COLUMN IF NOT EXISTS sentiment_avg numeric(4,2);
ALTER TABLE public.rock_ratings ADD COLUMN IF NOT EXISTS feedback text, ADD COLUMN IF NOT EXISTS sentiment numeric(3,2);

DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.rock_ratings'::regclass AND contype='c' LOOP
    EXECUTE format('ALTER TABLE public.rock_ratings DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.rock_ratings ADD CONSTRAINT rock_ratings_stars_range CHECK (stars BETWEEN 0 AND 5);
ALTER TABLE public.rock_ratings ADD CONSTRAINT rock_ratings_feedback_len CHECK (feedback IS NULL OR char_length(feedback) <= 500);

CREATE OR REPLACE FUNCTION public.rocks_compute_points() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base numeric; f numeric;
BEGIN
  -- only the server (service role) may set the AI score
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.ai_points := NULL; NEW.ai_reason := NULL;
    ELSE NEW.ai_points := OLD.ai_points; NEW.ai_reason := OLD.ai_reason; END IF;
  END IF;
  IF NEW.points_override IS NOT NULL THEN
    NEW.points := NEW.points_override; RETURN NEW;
  END IF;
  base := COALESCE(NEW.ai_points, LEAST(public.tier_points(NEW.difficulty), 650) / 3.0);
  IF NEW.rating_count >= 3 AND NEW.rating_avg IS NOT NULL THEN
    f := power(2, ((NEW.rating_avg - 2.5) / 2.5) + 0.5 * COALESCE(NEW.sentiment_avg, 0));
    base := base * f;
  END IF;
  NEW.points := GREATEST(50, LEAST(2000, (round(base / 10) * 10)::int));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.rock_ratings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.sentiment := NULL; ELSE NEW.sentiment := OLD.sentiment; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rock_ratings_guard ON public.rock_ratings;
CREATE TRIGGER rock_ratings_guard BEFORE INSERT OR UPDATE ON public.rock_ratings FOR EACH ROW EXECUTE FUNCTION public.rock_ratings_guard();

CREATE OR REPLACE FUNCTION public.rock_ratings_recalc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.rocks r SET rating_avg = s.avg, rating_count = s.cnt, sentiment_avg = s.sent
  FROM (SELECT AVG(stars)::numeric(3,2) avg, COUNT(*)::int cnt, AVG(sentiment)::numeric(4,2) sent
        FROM public.rock_ratings WHERE rock_id = NEW.rock_id) s
  WHERE r.id = NEW.rock_id;
  RETURN NEW;
END $$;

UPDATE public.rocks SET points = points;;

-- ============================================================
-- drizzle/migrations/0002_profiles_live_location.sql
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision, ADD COLUMN IF NOT EXISTS updated_at timestamptz;;

-- ============================================================
-- drizzle/migrations/0003_friend_requests.sql
-- ============================================================
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';
ALTER TABLE public.friendships ALTER COLUMN status SET DEFAULT 'pending';
GRANT UPDATE ON public.friendships TO authenticated;
DROP POLICY IF EXISTS friendships_insert_own ON public.friendships;
CREATE POLICY friendships_insert_own ON public.friendships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND friend_id <> auth.uid());
CREATE POLICY friendships_accept_received ON public.friendships FOR UPDATE TO authenticated USING (friend_id = auth.uid()) WITH CHECK (friend_id = auth.uid() AND status = 'accepted');
DROP POLICY IF EXISTS friendships_delete_own ON public.friendships;
CREATE POLICY friendships_delete_own ON public.friendships FOR DELETE TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());;

-- ============================================================
-- supabase/migrations/20261015090000_regole_lato_server.sql
-- ============================================================
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
;

-- ============================================================
-- supabase/migrations/20261016090000_importazione.sql
-- ============================================================
-- Importazione dei dati dalla vecchia app (pagina /setup, src/lib/setup.functions.ts).

-- Durante l'importazione i ritrovamenti mantengono i punti assegnati all'epoca,
-- invece di ricalcolarli con i punti attuali del sasso.
CREATE OR REPLACE FUNCTION public.finds_award_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('ciaorock.importing', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT points INTO NEW.points_awarded FROM public.rocks WHERE id = NEW.rock_id;
  NEW.points_awarded := COALESCE(NEW.points_awarded, 150);
  RETURN NEW;
END $$;

-- Inserisce righe esportate (JSON) mantenendo ID e valori originali. Solo service role.
-- Le colonne usate sono quelle presenti sia nei dati sia nella tabella; le righe già presenti
-- vengono saltate, quindi l'importazione si può ripetere senza duplicati.
CREATE OR REPLACE FUNCTION public.admin_import(_table text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cols text;
  n integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'admin_import: riservato al server';
  END IF;
  IF _table NOT IN ('profiles', 'rocks', 'finds', 'rock_ratings', 'double_days', 'announcements', 'user_roles') THEN
    RAISE EXCEPTION 'admin_import: tabella non ammessa (%)', _table;
  END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RETURN 0;
  END IF;

  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position) INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = _table
    AND c.column_name IN (SELECT jsonb_object_keys(_rows -> 0));

  PERFORM set_config('ciaorock.importing', 'on', true);
  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) ON CONFLICT DO NOTHING',
    _table, cols
  ) USING _rows;
  GET DIAGNOSTICS n = ROW_COUNT;
  -- come per i nuovi ritrovamenti, non teniamo le coordinate esatte di dove sono stati trovati
  IF _table = 'finds' THEN
    UPDATE public.finds SET lat = NULL, lng = NULL WHERE lat IS NOT NULL OR lng IS NOT NULL;
  END IF;
  PERFORM set_config('ciaorock.importing', 'off', true);
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_import(text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import(text, jsonb) TO service_role;
;

-- ============================================================
-- supabase/migrations/20261018090000_negozio_coop.sql
-- ============================================================
-- Nuove meccaniche: bonus creatore, bonus giornaliero, negozio con targhette, profilo con foto,
-- missioni co-op tra amici. Tutti i punti "extra" passano dal registro points_ledger, scritto
-- solo dal database; classifica e saldo vengono calcolati qui, non nel browser.

-- ---------------------------------------------------------------------------
-- Registro dei punti bonus
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('daily', 'creator', 'coop')),
  ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref)
);
CREATE INDEX IF NOT EXISTS points_ledger_user_idx ON public.points_ledger (user_id);
GRANT SELECT ON public.points_ledger TO authenticated;
GRANT ALL ON public.points_ledger TO service_role;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY points_ledger_select_own ON public.points_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Moltiplicatore della giornata speciale (giorno in UTC, come la vecchia classifica).
CREATE OR REPLACE FUNCTION public.day_multiplier(_at timestamptz)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce((SELECT multiplier FROM public.double_days WHERE day = (_at AT TIME ZONE 'UTC')::date), 1)
$$;

-- ---------------------------------------------------------------------------
-- 1. Bonus creatore: metà dei punti a ogni ritrovamento del proprio sasso da parte di altri
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finds_creator_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  creator uuid;
BEGIN
  IF coalesce(current_setting('ciaorock.importing', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT creator_id INTO creator FROM public.rocks WHERE id = NEW.rock_id;
  IF creator IS NOT NULL AND creator <> NEW.user_id THEN
    INSERT INTO public.points_ledger (user_id, amount, reason, ref, created_at)
    VALUES (creator,
            round(coalesce(NEW.points_awarded, 10) * public.day_multiplier(NEW.found_at) * 0.5),
            'creator', NEW.id::text, NEW.found_at)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS finds_creator_bonus ON public.finds;
CREATE TRIGGER finds_creator_bonus AFTER INSERT ON public.finds
FOR EACH ROW EXECUTE FUNCTION public.finds_creator_bonus();

-- Bonus anche per i ritrovamenti già avvenuti (si può rieseguire: niente doppioni).
CREATE OR REPLACE FUNCTION public.backfill_creator_bonus()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.points_ledger (user_id, amount, reason, ref, created_at)
  SELECT r.creator_id,
         round(coalesce(f.points_awarded, 10) * public.day_multiplier(f.found_at) * 0.5),
         'creator', f.id::text, f.found_at
  FROM public.finds f
  JOIN public.rocks r ON r.id = f.rock_id
  JOIN public.profiles p ON p.id = r.creator_id
  WHERE r.creator_id <> f.user_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.backfill_creator_bonus() FROM public, anon, authenticated;
SELECT public.backfill_creator_bonus();

-- ---------------------------------------------------------------------------
-- Punti guadagnati, spesi e classifica
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_points(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(0, (
      coalesce((SELECT sum(coalesce(points_awarded, 10) * public.day_multiplier(found_at))
                FROM public.finds WHERE user_id = _uid), 0)
    + coalesce((SELECT sum(15 * public.day_multiplier(created_at))
                FROM public.rocks WHERE creator_id = _uid), 0)
    + coalesce((SELECT sum(amount) FROM public.points_ledger WHERE user_id = _uid AND amount > 0), 0)
    + coalesce((SELECT points_adjust FROM public.profiles WHERE id = _uid), 0)
  ))::integer
$$;
REVOKE EXECUTE ON FUNCTION public.user_points(uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Negozio: targhette dorate
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_items (
  id text PRIMARY KEY,
  kind text NOT NULL DEFAULT 'plate' CHECK (kind IN ('plate')),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer NOT NULL CHECK (price >= 0),
  style text NOT NULL DEFAULT 'gold',
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY shop_items_select ON public.shop_items FOR SELECT TO authenticated USING (true);

INSERT INTO public.shop_items (id, label, description, price, style, sort) VALUES
  ('esploratore', 'Esploratore', 'Per chi non si ferma mai', 300, 'gold', 10),
  ('cacciatore', 'Cacciatore di sassi', 'Nessun nascondiglio ti sfugge', 750, 'gold', 20),
  ('artista', 'Artista della pietra', 'I tuoi sassi sono opere d''arte', 1200, 'gold', 30),
  ('leggenda', 'Leggenda di Ciao Rock', 'Il gotha dei cercatori', 3000, 'gold-shine', 40),
  ('re-dei-sassi', 'Re dei sassi', 'Solo per i più grandi', 6000, 'gold-shine', 50)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.purchases (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.shop_items(id),
  price integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_select_own ON public.purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Profilo: foto, targhetta indossata, biografia di massimo 500 caratteri
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS plate_id text REFERENCES public.shop_items(id);
UPDATE public.profiles SET bio = left(bio, 500) WHERE char_length(bio) > 500;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (char_length(bio) <= 500);

CREATE OR REPLACE FUNCTION public.my_wallet()
RETURNS TABLE (earned integer, spent integer, balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT public.user_points(auth.uid()) AS v),
       s AS (SELECT coalesce(sum(price), 0)::integer AS v FROM public.purchases WHERE user_id = auth.uid())
  SELECT e.v, s.v, greatest(0, e.v - s.v) FROM e, s
$$;

CREATE OR REPLACE FUNCTION public.buy_item(_item text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item public.shop_items%ROWTYPE;
  saldo integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Accedi per usare il negozio.'; END IF;
  -- un acquisto alla volta per giocatore
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  SELECT * INTO item FROM public.shop_items WHERE id = _item AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Articolo non disponibile.'; END IF;
  IF EXISTS (SELECT 1 FROM public.purchases WHERE user_id = auth.uid() AND item_id = _item) THEN
    RAISE EXCEPTION 'Ce l''hai già.';
  END IF;
  SELECT balance INTO saldo FROM public.my_wallet();
  IF saldo < item.price THEN
    RAISE EXCEPTION 'Saldo insufficiente: ti servono % punti, ne hai %.', item.price, saldo;
  END IF;
  INSERT INTO public.purchases (user_id, item_id, price) VALUES (auth.uid(), _item, item.price);
  RETURN saldo - item.price;
END $$;

CREATE OR REPLACE FUNCTION public.equip_plate(_item text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Accedi per scegliere la targhetta.'; END IF;
  IF _item IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.purchases WHERE user_id = auth.uid() AND item_id = _item
  ) THEN
    RAISE EXCEPTION 'Prima devi comprare questa targhetta.';
  END IF;
  PERFORM set_config('ciaorock.equip', 'on', true);
  UPDATE public.profiles SET plate_id = _item WHERE id = auth.uid();
  PERFORM set_config('ciaorock.equip', 'off', true);
END $$;

-- Protezione del profilo: ai campi già protetti si aggiungono foto e targhetta; la bio viene
-- ripulita da tag HTML e caratteri di controllo.
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  -- senza JWT (auth.role() nullo) è un accesso diretto al database, es. SQL editor della dashboard
  trusted boolean := coalesce(auth.role(), 'service_role') = 'service_role'
    OR coalesce(public.has_role(auth.uid(), 'admin'), false);
  streak_call boolean := coalesce(current_setting('ciaorock.touch_streak', true), '') = 'on';
  equip_call boolean := coalesce(current_setting('ciaorock.equip', true), '') = 'on';
BEGIN
  NEW.latitude := NULL;
  NEW.longitude := NULL;
  NEW.bio := left(
    regexp_replace(regexp_replace(coalesce(NEW.bio, ''), '<[^>]*>', '', 'g'),
                   '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
    500);

  IF trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.points_adjust := 0;
    NEW.banned := false;
    NEW.streak_current := 1;
    NEW.streak_best := 1;
    NEW.last_login_date := NULL;
    NEW.avatar_url := NULL;
    NEW.plate_id := NULL;
    RETURN NEW;
  END IF;

  NEW.points_adjust := OLD.points_adjust;
  NEW.banned := OLD.banned;
  NEW.created_at := OLD.created_at;
  NEW.avatar_url := OLD.avatar_url;
  IF NOT equip_call THEN
    NEW.plate_id := OLD.plate_id;
  END IF;
  IF NOT streak_call THEN
    NEW.streak_current := OLD.streak_current;
    NEW.streak_best := OLD.streak_best;
    NEW.last_login_date := OLD.last_login_date;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Bonus giornaliero: 15 punti al primo accesso di ogni giorno (ora italiana)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.touch_streak();
CREATE FUNCTION public.touch_streak()
RETURNS TABLE (streak_current integer, streak_best integer, last_login_date date, daily_bonus integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  p public.profiles%ROWTYPE;
  cur integer;
  bonus integer := 0;
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
  INSERT INTO public.points_ledger (user_id, amount, reason, ref)
  VALUES (p.id, 15, 'daily', today::text)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS cur = ROW_COUNT;
  IF cur > 0 THEN bonus := 15; END IF;
  RETURN QUERY SELECT p.streak_current, p.streak_best, p.last_login_date, bonus;
END $$;
REVOKE EXECUTE ON FUNCTION public.touch_streak() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.touch_streak() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Missioni co-op: stesso sasso, 30 minuti, punti ×2
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coop_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rock_id uuid NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'success', 'failed', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  creator_found_at timestamptz,
  partner_found_at timestamptz,
  creator_bonus integer,
  partner_bonus integer,
  CHECK (creator_id <> partner_id)
);
CREATE INDEX IF NOT EXISTS coop_missions_creator_idx ON public.coop_missions (creator_id, status);
CREATE INDEX IF NOT EXISTS coop_missions_partner_idx ON public.coop_missions (partner_id, status);
GRANT SELECT ON public.coop_missions TO authenticated;
GRANT ALL ON public.coop_missions TO service_role;
ALTER TABLE public.coop_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY coop_missions_select_own ON public.coop_missions FOR SELECT TO authenticated
  USING (creator_id = auth.uid() OR partner_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.coop_missions;

-- Inviti non accettati entro 10 minuti e missioni oltre i 30 minuti si chiudono da sole.
CREATE OR REPLACE FUNCTION public.coop_expire()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.coop_missions SET status = 'cancelled', completed_at = now()
   WHERE status = 'pending' AND expires_at < now();
  UPDATE public.coop_missions SET status = 'failed', completed_at = now()
   WHERE status = 'active' AND expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.coop_invite(_partner uuid, _rock uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  rock_creator uuid;
  mission uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Accedi per giocare.'; END IF;
  PERFORM public.coop_expire();
  IF NOT public.are_friends(me, _partner) THEN
    RAISE EXCEPTION 'Puoi sfidare solo i tuoi amici.';
  END IF;
  SELECT creator_id INTO rock_creator FROM public.rocks WHERE id = _rock AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Questo sasso non esiste più.'; END IF;
  IF rock_creator IN (me, _partner) THEN
    RAISE EXCEPTION 'Scegli un sasso che non è stato creato da nessuno di voi due.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.finds WHERE rock_id = _rock AND user_id IN (me, _partner)) THEN
    RAISE EXCEPTION 'Scegli un sasso che nessuno di voi due ha già trovato.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coop_missions
             WHERE status IN ('pending', 'active')
               AND (creator_id IN (me, _partner) OR partner_id IN (me, _partner))) THEN
    RAISE EXCEPTION 'Tu o il tuo amico avete già una missione in corso.';
  END IF;
  INSERT INTO public.coop_missions (creator_id, partner_id, rock_id, expires_at)
  VALUES (me, _partner, _rock, now() + interval '10 minutes')
  RETURNING id INTO mission;
  RETURN mission;
END $$;

CREATE OR REPLACE FUNCTION public.coop_respond(_mission uuid, _accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.coop_missions%ROWTYPE;
BEGIN
  PERFORM public.coop_expire();
  SELECT * INTO m FROM public.coop_missions WHERE id = _mission FOR UPDATE;
  IF NOT FOUND OR m.partner_id <> auth.uid() THEN RAISE EXCEPTION 'Invito non trovato.'; END IF;
  IF m.status <> 'pending' THEN RAISE EXCEPTION 'L''invito è scaduto o è già stato gestito.'; END IF;
  IF _accept AND EXISTS (
    SELECT 1 FROM public.finds WHERE rock_id = m.rock_id AND user_id IN (m.creator_id, m.partner_id)
  ) THEN
    -- (niente RAISE: annullerebbe anche questo aggiornamento)
    UPDATE public.coop_missions SET status = 'cancelled', completed_at = now() WHERE id = _mission;
    RETURN 'already_found';
  END IF;
  IF _accept THEN
    UPDATE public.coop_missions
       SET status = 'active', accepted_at = now(), expires_at = now() + interval '30 minutes'
     WHERE id = _mission;
    RETURN 'active';
  END IF;
  UPDATE public.coop_missions SET status = 'declined', completed_at = now() WHERE id = _mission;
  RETURN 'declined';
END $$;

CREATE OR REPLACE FUNCTION public.coop_cancel(_mission uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.coop_missions SET status = 'cancelled', completed_at = now()
   WHERE id = _mission AND status IN ('pending', 'active')
     AND (creator_id = auth.uid() OR partner_id = auth.uid());
END $$;

-- Punti dei ritrovamenti di un giocatore tra due istanti (giornate speciali comprese).
CREATE OR REPLACE FUNCTION public.find_points_between(_uid uuid, _from timestamptz, _to timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(coalesce(points_awarded, 10) * public.day_multiplier(found_at)), 0)::integer
  FROM public.finds WHERE user_id = _uid AND found_at BETWEEN _from AND _to
$$;

-- A ogni ritrovamento: se fa parte di una missione attiva lo segniamo; quando entrambi hanno
-- trovato il sasso in tempo, i punti dei ritrovamenti fatti durante la missione raddoppiano.
CREATE OR REPLACE FUNCTION public.finds_coop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.coop_missions%ROWTYPE;
  b1 integer;
  b2 integer;
BEGIN
  IF coalesce(current_setting('ciaorock.importing', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  PERFORM public.coop_expire();
  FOR m IN
    SELECT * FROM public.coop_missions
     WHERE status = 'active' AND rock_id = NEW.rock_id AND now() <= expires_at
       AND (creator_id = NEW.user_id OR partner_id = NEW.user_id)
     FOR UPDATE
  LOOP
    IF NEW.user_id = m.creator_id THEN
      m.creator_found_at := NEW.found_at;
    ELSE
      m.partner_found_at := NEW.found_at;
    END IF;
    IF m.creator_found_at IS NOT NULL AND m.partner_found_at IS NOT NULL THEN
      b1 := public.find_points_between(m.creator_id, m.accepted_at, now());
      b2 := public.find_points_between(m.partner_id, m.accepted_at, now());
      INSERT INTO public.points_ledger (user_id, amount, reason, ref)
      VALUES (m.creator_id, b1, 'coop', m.id::text), (m.partner_id, b2, 'coop', m.id::text)
      ON CONFLICT DO NOTHING;
      UPDATE public.coop_missions
         SET creator_found_at = m.creator_found_at, partner_found_at = m.partner_found_at,
             status = 'success', completed_at = now(), creator_bonus = b1, partner_bonus = b2
       WHERE id = m.id;
    ELSE
      UPDATE public.coop_missions
         SET creator_found_at = m.creator_found_at, partner_found_at = m.partner_found_at
       WHERE id = m.id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS finds_coop ON public.finds;
CREATE TRIGGER finds_coop AFTER INSERT ON public.finds
FOR EACH ROW EXECUTE FUNCTION public.finds_coop();

-- ---------------------------------------------------------------------------
-- Classifica calcolata dal database
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS TABLE (
  id uuid, nickname text, found integer, created integer, streak_best integer, points integer,
  avatar_url text, plate_label text, plate_style text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (
    SELECT user_id, count(*)::integer AS n,
           sum(coalesce(points_awarded, 10) * public.day_multiplier(found_at)) AS pts
    FROM public.finds GROUP BY user_id
  ), c AS (
    SELECT creator_id AS user_id, count(*)::integer AS n,
           sum(15 * public.day_multiplier(created_at)) AS pts
    FROM public.rocks GROUP BY creator_id
  ), l AS (
    SELECT user_id, sum(amount) AS pts FROM public.points_ledger WHERE amount > 0 GROUP BY user_id
  )
  SELECT p.id, p.nickname, coalesce(f.n, 0), coalesce(c.n, 0), p.streak_best,
         greatest(0, coalesce(f.pts, 0) + coalesce(c.pts, 0) + coalesce(l.pts, 0)
                     + coalesce(p.points_adjust, 0))::integer,
         p.avatar_url, s.label, s.style
  FROM public.profiles p
  LEFT JOIN f ON f.user_id = p.id
  LEFT JOIN c ON c.user_id = p.id
  LEFT JOIN l ON l.user_id = p.id
  LEFT JOIN public.shop_items s ON s.id = p.plate_id
  WHERE NOT p.banned
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.leaderboard()', 'public.my_wallet()', 'public.buy_item(text)',
    'public.equip_plate(text)', 'public.coop_invite(uuid, uuid)',
    'public.coop_respond(uuid, boolean)', 'public.coop_cancel(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'public.coop_expire()', 'public.find_points_between(uuid, timestamptz, timestamptz)',
    'public.day_multiplier(timestamptz)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Foto profilo: bucket pubblico in lettura; le scrive solo il server (dopo il controllo AI)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('avatars', 'avatars', true, 524288, ARRAY['image/jpeg', 'image/webp', 'image/png'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
;
