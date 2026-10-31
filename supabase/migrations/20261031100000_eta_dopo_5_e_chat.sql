-- Conferma dell'età non più all'iscrizione ma dopo i primi 5 sassi trovati o nascosti.
-- La chat richiede, a entrambi, età confermata, email confermata e amicizia, e non è mai
-- possibile tra un minorenne e un maggiorenne.

-- Fascia d'età: salviamo solo se è maggiorenne (non la data di nascita). I consensi dati prima
-- di questa colonna vanno riconfermati.
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS adult boolean;

CREATE OR REPLACE FUNCTION public.accept_terms(_birth date, _version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_adult boolean;
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
  is_adult := _birth <= (current_date - interval '18 years')::date;
  INSERT INTO public.consents (user_id, age_14_declared, adult, terms_version)
  VALUES (auth.uid(), true, is_adult, _version)
  ON CONFLICT (user_id) DO UPDATE
    SET age_14_declared = true, adult = excluded.adult,
        terms_version = excluded.terms_version, accepted_at = now();
END $$;

-- Il profilo si crea senza consenso (lo crea comunque solo il server).
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Sassi trovati + nascosti dal giocatore.
CREATE OR REPLACE FUNCTION public.activity_count(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ((SELECT count(*) FROM public.finds WHERE user_id = _uid)
        + (SELECT count(*) FROM public.rocks WHERE creator_id = _uid))::integer
$$;

-- Deve confermare l'età prima di continuare? (dal 5° sasso in poi senza consenso)
CREATE OR REPLACE FUNCTION public.needs_age_check(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.consents WHERE user_id = _uid AND adult IS NOT NULL)
     AND public.activity_count(_uid) >= 5
$$;

-- Può usare la chat: età confermata, email confermata, non bannato.
CREATE OR REPLACE FUNCTION public.can_chat(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM public.consents WHERE user_id = _uid AND adult IS NOT NULL)
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = _uid AND email_confirmed_at IS NOT NULL)
     AND NOT coalesce((SELECT banned FROM public.profiles WHERE id = _uid), true)
$$;

-- Stessa fascia d'età (entrambi minorenni o entrambi maggiorenni).
CREATE OR REPLACE FUNCTION public.same_age_group(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT a.adult = b.adult FROM public.consents a, public.consents b
     WHERE a.user_id = _a AND b.user_id = _b), false)
$$;

-- chat possibile con un amico? (per mostrare il motivo nell'app, senza rivelare l'età)
CREATE OR REPLACE FUNCTION public.chat_allowed_with(_other uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT public.can_chat(auth.uid()) THEN 'me'
    WHEN NOT public.are_friends(auth.uid(), _other) THEN 'friend'
    WHEN NOT public.can_chat(_other) OR NOT public.same_age_group(auth.uid(), _other) THEN 'other'
    ELSE 'ok' END
$$;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND char_length(body) BETWEEN 1 AND 1000
    AND public.chat_allowed_with(recipient_id) = 'ok'
  );

-- Stato del giocatore per l'app (una sola chiamata).
CREATE OR REPLACE FUNCTION public.my_status()
RETURNS TABLE (activity integer, consented boolean, email_confirmed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT public.activity_count(auth.uid()),
         EXISTS (SELECT 1 FROM public.consents WHERE user_id = auth.uid() AND adult IS NOT NULL),
         EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL)
$$;

REVOKE EXECUTE ON FUNCTION public.activity_count(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.needs_age_check(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.needs_age_check(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.can_chat(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.same_age_group(uuid, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_allowed_with(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_allowed_with(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.my_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_status() TO authenticated, service_role;
