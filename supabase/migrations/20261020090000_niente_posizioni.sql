-- La posizione dal vivo dei giocatori non viene più condivisa con nessuno (nemmeno con gli amici):
-- la tabella e tutte le posizioni salvate vengono cancellate. La posizione del telefono resta solo
-- sul dispositivo, per la mappa e per le distanze dai sassi.
DROP TABLE IF EXISTS public.player_locations CASCADE;
DROP FUNCTION IF EXISTS public.player_locations_touch() CASCADE;

-- Per sicurezza: nessuna coordinata nei profili (le colonne della vecchia app restano vuote).
UPDATE public.profiles SET latitude = NULL, longitude = NULL
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;
