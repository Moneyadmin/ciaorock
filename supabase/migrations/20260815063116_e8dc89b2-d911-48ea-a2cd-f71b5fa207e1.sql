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
ALTER PUBLICATION supabase_realtime ADD TABLE public.finds;