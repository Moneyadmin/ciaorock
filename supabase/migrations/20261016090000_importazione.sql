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
