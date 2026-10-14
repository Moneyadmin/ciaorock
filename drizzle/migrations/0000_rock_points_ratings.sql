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
FOR EACH ROW EXECUTE FUNCTION public.rock_ratings_recalc();