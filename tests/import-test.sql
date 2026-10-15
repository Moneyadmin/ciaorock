\set ON_ERROR_STOP 1
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'OK   %', label; else raise exception 'FAIL %', label; end if; end $$;
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002');
set role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select public.admin_import('profiles', '[
  {"id":"aaaaaaaa-0000-4000-8000-000000000001","nickname":"anna","bio":"","streak_current":3,"streak_best":12,"last_login_date":"2026-09-01","created_at":"2026-08-20T10:00:00Z","points_adjust":40,"banned":false,"latitude":45.1,"longitude":9.1,"colonna_sconosciuta":1},
  {"id":"bbbbbbbb-0000-4000-8000-000000000002","nickname":"bruno","bio":"ciao","streak_current":1,"streak_best":1,"last_login_date":null,"created_at":"2026-08-21T10:00:00Z","points_adjust":0,"banned":true,"latitude":null,"longitude":null}
]'::jsonb);
select public.admin_import('rocks', '[
  {"id":"11111111-0000-4000-8000-000000000001","name":"Volpe","clue":"sotto la panchina","photo":"data:x","lat":45.46,"lng":9.19,"difficulty":"Medio","creator_id":"bbbbbbbb-0000-4000-8000-000000000002","hidden_by":null,"move_count":2,"created_at":"2026-08-22T10:00:00Z","updated_at":"2026-08-22T10:00:00Z","points":800,"points_override":null,"rating_avg":null,"rating_count":0,"ai_points":800,"ai_reason":"difficile","sentiment_avg":null,"deleted_at":null}
]'::jsonb);
select public.admin_import('finds', '[
  {"id":"22222222-0000-4000-8000-000000000001","rock_id":"11111111-0000-4000-8000-000000000001","user_id":"aaaaaaaa-0000-4000-8000-000000000001","photo":"p","lat":45.46,"lng":9.19,"city":"Milano","region":"Lombardia","country":"Italia","continent":"Europa","found_at":"2026-09-02T18:00:00Z","points_awarded":350}
]'::jsonb);
select public.admin_import('rock_ratings', '[{"rock_id":"11111111-0000-4000-8000-000000000001","user_id":"aaaaaaaa-0000-4000-8000-000000000001","stars":4,"created_at":"2026-09-02T18:05:00Z","feedback":"tosto","sentiment":0.6}]'::jsonb);
select public.admin_import('user_roles', '[{"id":"33333333-0000-4000-8000-000000000001","user_id":"aaaaaaaa-0000-4000-8000-000000000001","role":"admin","created_at":"2026-08-20T10:00:00Z"}]'::jsonb);
-- seconda esecuzione: nessun duplicato
select pg_temp.check((select public.admin_import('finds', '[{"id":"22222222-0000-4000-8000-000000000001","rock_id":"11111111-0000-4000-8000-000000000001","user_id":"aaaaaaaa-0000-4000-8000-000000000001","photo":"p","found_at":"2026-09-02T18:00:00Z","points_awarded":350}]'::jsonb)) = 0, 'reimportazione senza duplicati');
reset role;
select pg_temp.check((select points_awarded = 350 and lat is null and city = 'Milano' from public.finds), 'ritrovamento importato: punti storici (350, non 800), città sì, coordinate no');
select pg_temp.check((select points_adjust = 40 and streak_best = 12 and latitude is null from public.profiles where nickname='anna'), 'profilo importato: punti e serie conservati, posizione rimossa');
select pg_temp.check((select banned from public.profiles where nickname='bruno'), 'ban conservato');
select pg_temp.check((select ai_points = 800 and move_count = 2 from public.rocks), 'sasso importato con punti AI e spostamenti');
select pg_temp.check((select sentiment = 0.6 from public.rock_ratings), 'voto importato con il giudizio AI');
select pg_temp.check((select public.has_role('aaaaaaaa-0000-4000-8000-000000000001','admin')), 'ruolo admin importato');
-- dopo l'importazione i nuovi ritrovamenti prendono di nuovo i punti dal sasso
set role service_role;
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002','p');
reset role;
select pg_temp.check((select points_awarded = 800 from public.finds where user_id='bbbbbbbb-0000-4000-8000-000000000002'), 'nuovi ritrovamenti: punti calcolati come sempre');
-- un giocatore non può usare la funzione di importazione
set role authenticated; select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', false);
do $$ begin
  perform public.admin_import('rocks', '[]'::jsonb);
  raise exception 'FAIL importazione permessa a un giocatore';
exception when insufficient_privilege then raise notice 'OK   importazione vietata ai giocatori'; end $$;
reset role;
\echo TEST IMPORTAZIONE SUPERATI
