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
