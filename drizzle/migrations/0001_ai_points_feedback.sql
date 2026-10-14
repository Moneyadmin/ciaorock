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

UPDATE public.rocks SET points = points;