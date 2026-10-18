\set ON_ERROR_STOP 1
-- utenti: A giocatore, B amico di A, C sconosciuto, X admin
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002'),('cccccccc-0000-4000-8000-000000000003'),('764c9bcc-3de9-41e9-9ffc-7bc5ce234feb');
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'OK   %', label; else raise exception 'FAIL %', label; end if; end $$;

-- il browser non può creare profili (li crea il server dopo età, consenso e controllo AI)
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  insert into public.profiles (id, nickname) values ('aaaaaaaa-0000-4000-8000-000000000001','anna');
  raise exception 'FAIL profilo creato dal browser';
exception when insufficient_privilege then raise notice 'OK   profilo non creabile dal browser';
end $$;
do $$ begin
  perform public.accept_terms((current_date - interval '13 years')::date, 'v1');
  raise exception 'FAIL accettato un tredicenne';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   sotto i 14 anni non si entra (%)', sqlerrm;
end $$;
select public.accept_terms((current_date - interval '15 years')::date, 'v1');
select pg_temp.check((select age_14_declared from public.consents where user_id = auth.uid()), 'consenso registrato a 15 anni, senza data di nascita');
reset role;
-- il server (service role) crea i profili, anche provando a barare
set role service_role; select pg_temp.as_service();
insert into public.profiles (id, nickname, points_adjust, banned, streak_best, latitude, longitude) values ('aaaaaaaa-0000-4000-8000-000000000001','anna',0,false,1,45.1,9.1);
insert into public.profiles (id, nickname) values ('bbbbbbbb-0000-4000-8000-000000000002','bruno');
insert into public.profiles (id, nickname) values ('cccccccc-0000-4000-8000-000000000003','carla');
insert into public.profiles (id, nickname) values ('764c9bcc-3de9-41e9-9ffc-7bc5ce234feb','staff');
reset role;
select pg_temp.check((select points_adjust = 0 and streak_best = 1 and latitude is null from public.profiles where nickname='anna'), 'profilo nuovo: punti, serie e posizione non falsificabili');

-- A prova a darsi punti, togliersi il ban, gonfiare la serie
reset role; update public.profiles set banned = true where nickname = 'anna';  -- (come service: la mettiamo bannata)
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
update public.profiles set points_adjust = 5000, banned = false, streak_best = 99, streak_current = 99, last_login_date = '2020-01-01', bio = 'ciao', nickname = 'parolaccia' where id = auth.uid();
reset role;
select pg_temp.check((select points_adjust = 0 and banned and streak_best = 1 and last_login_date is null and bio = '' from public.profiles where nickname='anna'), 'profilo: punti/ban/serie protetti, nickname e bio solo dal server (controllo AI)');

-- serie calcolata dal database
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select * from public.touch_streak();
reset role;
select pg_temp.check((select last_login_date = (now() at time zone 'Europe/Rome')::date from public.profiles where nickname='anna'), 'touch_streak aggiorna la serie');

-- sassi: insert dal browser vietato
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  insert into public.rocks (name, clue, photo, lat, lng) values ('x','indizio lungo','p',45,9);
  raise exception 'FAIL insert sasso dal browser permesso';
exception when insufficient_privilege then raise notice 'OK   insert sasso dal browser vietato'; end $$;
reset role;
-- il server (service role) crea un sasso di B
set role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into public.rocks (id, name, clue, photo, lat, lng, difficulty, creator_id, ai_points) values ('11111111-0000-4000-8000-000000000001','Volpe','sotto la panchina','data:x',45.4642,9.19,'Medio','bbbbbbbb-0000-4000-8000-000000000002', 400);
reset role;
select pg_temp.check((select points = 400 from public.rocks where name='Volpe'), 'service role può impostare i punti AI');

-- A prova a modificare il sasso (punti forzati, posizione, autore)
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
update public.rocks set points_override = 2000, lat = 0, creator_id = auth.uid() where name = 'Volpe';
reset role;
select pg_temp.check((select points = 400 and lat = 45.4642 and creator_id = 'bbbbbbbb-0000-4000-8000-000000000002' from public.rocks where name='Volpe'), 'giocatore non può modificare un sasso');

-- ritrovamenti dal browser vietati
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  insert into public.finds (rock_id, photo, found_at) values ('11111111-0000-4000-8000-000000000001','p','2026-01-01');
  raise exception 'FAIL insert ritrovamento dal browser permesso';
exception when insufficient_privilege then raise notice 'OK   insert ritrovamento dal browser vietato'; end $$;
-- voto senza averlo trovato
do $$ begin
  insert into public.rock_ratings (rock_id, user_id, stars) values ('11111111-0000-4000-8000-000000000001', auth.uid(), 5);
  raise exception 'FAIL voto senza ritrovamento permesso';
exception when insufficient_privilege then raise notice 'OK   voto senza ritrovamento vietato'; end $$;
reset role;
-- il server registra il ritrovamento di A
set role service_role; select set_config('request.jwt.claims', '{"role":"service_role"}', false);
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','p');
reset role;
select pg_temp.check((select points_awarded = 400 from public.finds limit 1), 'ritrovamento dal server: punti presi dal sasso');
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.rock_ratings (rock_id, user_id, stars) values ('11111111-0000-4000-8000-000000000001', auth.uid(), 4);
do $$ begin
  delete from public.finds where user_id = auth.uid();
  raise exception 'FAIL cancellazione ritrovamento permessa';
exception when insufficient_privilege then raise notice 'OK   cancellazione ritrovamento vietata'; end $$;
reset role;
select pg_temp.check((select count(*) = 1 from public.finds), 'giocatore non può cancellare i propri ritrovamenti');
select pg_temp.check((select count(*) = 1 from public.rock_ratings), 'chi ha trovato il sasso può votarlo');

-- admin: può modificare sassi e profili
set role authenticated; select pg_temp.as_user('764c9bcc-3de9-41e9-9ffc-7bc5ce234feb');
update public.rocks set points_override = 900 where name = 'Volpe';
update public.profiles set banned = false, points_adjust = 50 where nickname = 'anna';
reset role;
select pg_temp.check((select points = 900 from public.rocks where name='Volpe'), 'admin può correggere i punti di un sasso');
select pg_temp.check((select not banned and points_adjust = 50 from public.profiles where nickname='anna'), 'admin può sbannare e correggere punti');

-- amicizia A-B accettata, C sconosciuto
set role service_role;
insert into public.friendships (user_id, friend_id, status) values ('aaaaaaaa-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002','accepted');
reset role;
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check(to_regclass('public.player_locations') is null, 'posizione dal vivo non più salvata né condivisa');
select pg_temp.check((select count(*) = 0 from public.profiles where latitude is not null), 'nessuna coordinata nei profili');
reset role;
\echo TUTTI I TEST SUPERATI
