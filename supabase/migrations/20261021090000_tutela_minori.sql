-- Tutela dei minori e privacy: età minima 14 anni con accettazione di termini e informativa,
-- chat solo tra amici, foto-prova visibili solo a chi le scatta (e agli admin), cancellazione
-- dell'account.

-- ---------------------------------------------------------------------------
-- 1. Età minima e accettazione di termini e informativa
-- ---------------------------------------------------------------------------
-- Non salviamo la data di nascita (minimizzazione): solo che il giocatore ha dichiarato almeno
-- 14 anni, quando e quale versione dei documenti ha accettato.
CREATE TABLE IF NOT EXISTS public.consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age_14_declared boolean NOT NULL,
  terms_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consents_select_own ON public.consents;
CREATE POLICY consents_select_own ON public.consents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.accept_terms(_birth date, _version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Accedi per continuare.'; END IF;
  IF _birth IS NULL OR _birth < date '1900-01-01' OR _birth > current_date THEN
    RAISE EXCEPTION 'Data di nascita non valida.';
  END IF;
  IF _birth > (current_date - interval '14 years')::date THEN
    RAISE EXCEPTION 'Ciao Rock è riservato a chi ha almeno 14 anni.';
  END IF;
  IF coalesce(length(_version), 0) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Versione dei documenti non valida.';
  END IF;
  INSERT INTO public.consents (user_id, age_14_declared, terms_version)
  VALUES (auth.uid(), true, _version)
  ON CONFLICT (user_id) DO UPDATE
    SET age_14_declared = true, terms_version = excluded.terms_version, accepted_at = now();
END $$;

-- I profili nuovi si creano solo dopo l'accettazione (l'importazione usa il service role).
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND EXISTS (SELECT 1 FROM public.consents c WHERE c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Chat solo tra amici (e mai da un account bannato)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND char_length(body) BETWEEN 1 AND 1000
    AND public.are_friends(auth.uid(), recipient_id)
    AND NOT coalesce((SELECT banned FROM public.profiles WHERE id = auth.uid()), true)
  );

-- ---------------------------------------------------------------------------
-- 3. Foto-prova dei ritrovamenti: le vede solo chi le ha scattate (e gli admin)
-- ---------------------------------------------------------------------------
-- La tabella finds resta leggibile da tutti (classifica, badge, città) ma senza la foto, che
-- passa in find_photos. find_photos non è nel canale realtime, quindi la foto non viaggia mai
-- verso gli altri giocatori.
CREATE TABLE IF NOT EXISTS public.find_photos (
  find_id uuid PRIMARY KEY REFERENCES public.finds(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo text NOT NULL
);
GRANT SELECT ON public.find_photos TO authenticated;
GRANT ALL ON public.find_photos TO service_role;
ALTER TABLE public.find_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS find_photos_select ON public.find_photos;
CREATE POLICY find_photos_select ON public.find_photos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Ogni nuovo ritrovamento: la foto viene spostata prima che la riga venga scritta.
CREATE OR REPLACE FUNCTION public.finds_stash_photo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.photo, '') <> '' THEN
    INSERT INTO public.find_photos (find_id, user_id, photo)
    VALUES (NEW.id, NEW.user_id, NEW.photo)
    ON CONFLICT (find_id) DO UPDATE SET photo = excluded.photo;
  END IF;
  NEW.photo := '';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS finds_stash_photo ON public.finds;
CREATE TRIGGER finds_stash_photo BEFORE INSERT OR UPDATE OF photo ON public.finds
FOR EACH ROW EXECUTE FUNCTION public.finds_stash_photo();

-- Foto già esistenti
INSERT INTO public.find_photos (find_id, user_id, photo)
SELECT id, user_id, photo FROM public.finds WHERE coalesce(photo, '') <> ''
ON CONFLICT (find_id) DO NOTHING;
UPDATE public.finds SET photo = '' WHERE coalesce(photo, '') <> '';

-- ---------------------------------------------------------------------------
-- 4. Cancellazione dell'account
-- ---------------------------------------------------------------------------
-- Chiamata dal server (service role) prima di eliminare l'utente da auth.users, che cancella a
-- cascata profilo, ritrovamenti, messaggi, amicizie, acquisti e il resto. I sassi che altri hanno
-- già trovato restano nel gioco ma in forma anonima (passano a un admin), per non togliere i
-- punti a chi li ha trovati; gli altri sassi vengono cancellati.
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  heir uuid;
BEGIN
  SELECT r.user_id INTO heir FROM public.user_roles r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.role = 'admin' AND r.user_id <> _uid
  ORDER BY p.created_at LIMIT 1;

  IF heir IS NOT NULL THEN
    UPDATE public.rocks r SET creator_id = heir
    WHERE r.creator_id = _uid
      AND EXISTS (SELECT 1 FROM public.finds f WHERE f.rock_id = r.id AND f.user_id <> _uid);
  END IF;
  UPDATE public.rocks SET hidden_by = NULL WHERE hidden_by = _uid;
  DELETE FROM public.rocks WHERE creator_id = _uid;
END $$;
REVOKE EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.accept_terms(date, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_terms(date, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Nickname e bio passano dal controllo AI del server
-- ---------------------------------------------------------------------------
-- Il browser non può più creare il profilo né cambiare nickname e bio: lo fa il server (service
-- role) dopo il controllo del testo. Resta tutto il resto della protezione già esistente.
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
    RAISE EXCEPTION 'Il profilo si crea dall''app.' USING ERRCODE = '42501';
  END IF;

  NEW.nickname := OLD.nickname;
  NEW.bio := OLD.bio;
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
