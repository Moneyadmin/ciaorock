-- Premi creati dall'admin: nuovi badge e nuove targhette, anche temporanei (disponibili solo in un
-- periodo), da comprare con il saldo oppure sbloccati quando il giocatore soddisfa una condizione.
-- Il catalogo resta shop_items (ora con kind 'plate' o 'badge'); il possesso resta purchases.

-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_kind_check;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_kind_check CHECK (kind IN ('plate', 'badge'));
ALTER TABLE public.shop_items ALTER COLUMN price DROP NOT NULL;
ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT '🏅',
  -- condizione di sblocco: {"type": ..., "n": ..., "ref": ...}; NULL = solo acquisto
  ADD COLUMN IF NOT EXISTS unlock jsonb,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_how;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_how
  CHECK (price IS NOT NULL OR unlock IS NOT NULL);
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_period;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_period
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at);
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_unlock_valid;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_unlock_valid CHECK (
  unlock IS NULL OR (
    jsonb_typeof(unlock) = 'object'
    AND unlock->>'type' IN ('finds', 'creates', 'points', 'streak', 'coop', 'rock', 'city')
    AND jsonb_typeof(unlock->'n') = 'number' AND (unlock->>'n')::numeric BETWEEN 1 AND 1000000
    AND (unlock->>'type' NOT IN ('rock', 'city') OR length(coalesce(unlock->>'ref', '')) > 0)
  )
);
ALTER TABLE public.shop_items DROP CONSTRAINT IF EXISTS shop_items_text_len;
ALTER TABLE public.shop_items ADD CONSTRAINT shop_items_text_len CHECK (
  char_length(label) BETWEEN 1 AND 40 AND char_length(description) <= 200
  AND char_length(icon) BETWEEN 1 AND 16 AND id ~ '^[a-z0-9-]{1,60}$'
);

-- L'admin crea e modifica il catalogo; tutti lo leggono (servono anche i premi scaduti, per
-- mostrare quelli già posseduti).
GRANT INSERT, UPDATE, DELETE ON public.shop_items TO authenticated;
DROP POLICY IF EXISTS shop_items_admin_insert ON public.shop_items;
DROP POLICY IF EXISTS shop_items_admin_update ON public.shop_items;
DROP POLICY IF EXISTS shop_items_admin_delete ON public.shop_items;
CREATE POLICY shop_items_admin_insert ON public.shop_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY shop_items_admin_update ON public.shop_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY shop_items_admin_delete ON public.shop_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- È disponibile adesso (attivo e dentro il periodo, se ne ha uno)?
CREATE OR REPLACE FUNCTION public.item_available(_item public.shop_items)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT _item.active
     AND (_item.starts_at IS NULL OR _item.starts_at <= now())
     AND (_item.ends_at IS NULL OR _item.ends_at > now())
$$;

-- ---------------------------------------------------------------------------
-- Possesso: acquisti e premi sbloccati
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'shop',
  -- false finché il giocatore non ha visto l'avviso "hai sbloccato…"
  ADD COLUMN IF NOT EXISTS seen boolean NOT NULL DEFAULT true;
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_source_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_source_check
  CHECK (source IN ('shop', 'unlock'));

-- Avanzamento verso la condizione di un premio. Conta solo ciò che è successo nel periodo del
-- premio (se ne ha uno): un badge "Halloween" vale per i sassi trovati ad Halloween.
CREATE OR REPLACE FUNCTION public.reward_progress(_uid uuid, _item public.shop_items)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lo timestamptz := coalesce(_item.starts_at, '-infinity');
  hi timestamptz := coalesce(_item.ends_at, 'infinity');
  kind text := _item.unlock->>'type';
  ref text := _item.unlock->>'ref';
  n integer;
BEGIN
  IF kind = 'finds' THEN
    SELECT count(*) INTO n FROM public.finds
    WHERE user_id = _uid AND found_at >= lo AND found_at < hi;
  ELSIF kind = 'creates' THEN
    SELECT count(*) INTO n FROM public.rocks
    WHERE creator_id = _uid AND created_at >= lo AND created_at < hi;
  ELSIF kind = 'points' THEN
    SELECT coalesce((SELECT sum(coalesce(points_awarded, 10) * public.day_multiplier(found_at))
                     FROM public.finds WHERE user_id = _uid AND found_at >= lo AND found_at < hi), 0)
         + coalesce((SELECT sum(15 * public.day_multiplier(created_at))
                     FROM public.rocks WHERE creator_id = _uid AND created_at >= lo AND created_at < hi), 0)
         + coalesce((SELECT sum(amount) FROM public.points_ledger
                     WHERE user_id = _uid AND amount > 0 AND created_at >= lo AND created_at < hi), 0)
    INTO n;
  ELSIF kind = 'streak' THEN
    SELECT streak_current INTO n FROM public.profiles WHERE id = _uid;
  ELSIF kind = 'coop' THEN
    SELECT count(*) INTO n FROM public.coop_missions
    WHERE status = 'success' AND _uid IN (creator_id, partner_id)
      AND completed_at >= lo AND completed_at < hi;
  ELSIF kind = 'rock' THEN
    SELECT count(*) INTO n FROM public.finds
    WHERE user_id = _uid AND rock_id::text = ref AND found_at >= lo AND found_at < hi;
  ELSIF kind = 'city' THEN
    SELECT count(*) INTO n FROM public.finds
    WHERE user_id = _uid AND lower(trim(city)) = lower(trim(ref)) AND found_at >= lo AND found_at < hi;
  END IF;
  RETURN coalesce(n, 0);
END $$;

-- Assegna i premi disponibili di cui il giocatore ha raggiunto la condizione.
CREATE OR REPLACE FUNCTION public.grant_rewards(_uid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item public.shop_items%ROWTYPE;
  granted integer := 0;
BEGIN
  IF _uid IS NULL OR coalesce(current_setting('ciaorock.importing', true), '') = 'on' THEN
    RETURN 0;
  END IF;
  FOR item IN
    SELECT s.* FROM public.shop_items s
    WHERE s.unlock IS NOT NULL AND public.item_available(s)
      AND NOT EXISTS (SELECT 1 FROM public.purchases p WHERE p.user_id = _uid AND p.item_id = s.id)
  LOOP
    IF public.reward_progress(_uid, item) >= (item.unlock->>'n')::numeric THEN
      INSERT INTO public.purchases (user_id, item_id, price, source, seen)
      VALUES (_uid, item.id, 0, 'unlock', false)
      ON CONFLICT DO NOTHING;
      granted := granted + 1;
    END IF;
  END LOOP;
  RETURN granted;
END $$;

-- Dopo un ritrovamento o un sasso creato i premi arrivano subito. Un errore qui non deve mai
-- bloccare il gioco: in quel caso ci riprova claim_rewards() al prossimo accesso.
CREATE OR REPLACE FUNCTION public.rewards_after_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'rocks' THEN
      PERFORM public.grant_rewards(NEW.creator_id);
    ELSE
      PERFORM public.grant_rewards(NEW.user_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'grant_rewards: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS finds_rewards ON public.finds;
CREATE TRIGGER finds_rewards AFTER INSERT ON public.finds
FOR EACH ROW EXECUTE FUNCTION public.rewards_after_activity();
DROP TRIGGER IF EXISTS rocks_rewards ON public.rocks;
CREATE TRIGGER rocks_rewards AFTER INSERT ON public.rocks
FOR EACH ROW EXECUTE FUNCTION public.rewards_after_activity();

-- Chiamata dall'app all'accesso e dopo ogni azione: assegna ciò che manca e restituisce i premi
-- sbloccati non ancora annunciati (poi li segna come visti).
CREATE OR REPLACE FUNCTION public.claim_rewards()
RETURNS TABLE (id text, kind text, label text, icon text, style text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.grant_rewards(auth.uid());
  RETURN QUERY
  WITH fresh AS (
    UPDATE public.purchases p SET seen = true
    WHERE p.user_id = auth.uid() AND NOT p.seen
    RETURNING p.item_id
  )
  SELECT s.id, s.kind, s.label, s.icon, s.style
  FROM fresh JOIN public.shop_items s ON s.id = fresh.item_id;
END $$;

-- Avanzamento del giocatore sui premi a condizione disponibili adesso.
CREATE OR REPLACE FUNCTION public.my_reward_progress()
RETURNS TABLE (item_id text, progress integer, goal integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, public.reward_progress(auth.uid(), s), (s.unlock->>'n')::integer
  FROM public.shop_items s
  WHERE auth.uid() IS NOT NULL AND s.unlock IS NOT NULL AND public.item_available(s)
$$;

-- Badge speciali posseduti da un giocatore (per la pagina profilo degli amici).
CREATE OR REPLACE FUNCTION public.user_special_badges(_uid uuid)
RETURNS TABLE (item_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.item_id FROM public.purchases p
  JOIN public.shop_items s ON s.id = p.item_id
  WHERE p.user_id = _uid AND s.kind = 'badge'
$$;

-- ---------------------------------------------------------------------------
-- Acquisto e targhetta indossata: rispettano periodo e tipo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buy_item(_item text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item public.shop_items%ROWTYPE;
  saldo integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Accedi per usare il negozio.'; END IF;
  -- un acquisto alla volta per giocatore
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  SELECT * INTO item FROM public.shop_items WHERE id = _item;
  IF NOT FOUND OR NOT public.item_available(item) THEN
    RAISE EXCEPTION 'Articolo non disponibile.';
  END IF;
  IF item.price IS NULL THEN
    RAISE EXCEPTION 'Questo premio non si compra: si sblocca giocando.';
  END IF;
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
    SELECT 1 FROM public.purchases p JOIN public.shop_items s ON s.id = p.item_id
    WHERE p.user_id = auth.uid() AND p.item_id = _item AND s.kind = 'plate'
  ) THEN
    RAISE EXCEPTION 'Prima devi ottenere questa targhetta.';
  END IF;
  PERFORM set_config('ciaorock.equip', 'on', true);
  UPDATE public.profiles SET plate_id = _item WHERE id = auth.uid();
  PERFORM set_config('ciaorock.equip', 'off', true);
END $$;

-- Un premio già ottenuto da qualcuno non si cancella (si disattiva): resta di chi ce l'ha.
CREATE OR REPLACE FUNCTION public.shop_items_keep_owned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.purchases WHERE item_id = OLD.id) THEN
    RAISE EXCEPTION 'Qualcuno ha già questo premio: disattivalo invece di eliminarlo.';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS shop_items_keep_owned ON public.shop_items;
CREATE TRIGGER shop_items_keep_owned BEFORE DELETE ON public.shop_items
FOR EACH ROW EXECUTE FUNCTION public.shop_items_keep_owned();

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.claim_rewards()', 'public.my_reward_progress()', 'public.user_special_badges(uuid)',
    'public.buy_item(text)', 'public.equip_plate(text)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
  FOREACH fn IN ARRAY ARRAY[
    'public.grant_rewards(uuid)', 'public.reward_progress(uuid, public.shop_items)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', fn);
  END LOOP;
END $$;

