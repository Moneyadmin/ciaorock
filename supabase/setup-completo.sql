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
