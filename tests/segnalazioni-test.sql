\set ON_ERROR_STOP 1
-- Test di storia del sasso e segnalazioni di sassi smarriti.
-- Da eseguire su un Postgres di prova dopo tutte le migrazioni (vedi tests/README.md).
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'OK   %', label; else raise exception 'FAIL %', label; end if; end $$;

insert into auth.users values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'),
  ('cccccccc-0000-4000-8000-000000000003'), ('dddddddd-0000-4000-8000-000000000004'),
  ('eeeeeeee-0000-4000-8000-000000000005');
set role service_role; select pg_temp.as_service();
insert into public.profiles (id, nickname) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'anna'), ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno'),
  ('cccccccc-0000-4000-8000-000000000003', 'carla'), ('dddddddd-0000-4000-8000-000000000004', 'admin'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'elia');
insert into public.user_roles (user_id, role) values ('dddddddd-0000-4000-8000-000000000004', 'admin');
insert into public.rocks (id, name, clue, photo, lat, lng, creator_id, lore) values
  ('11111111-0000-4000-8000-000000000001', 'Volpe', 'sotto la panchina', 'x', 45.46, 9.19,
   'eeeeeeee-0000-4000-8000-000000000005', 'Dipinta in una notte di pioggia.');
select pg_temp.check((select lore like 'Dipinta%' from public.rocks), 'storia del sasso salvata');
do $$ begin
  update public.rocks set lore = repeat('x', 1001);
  raise exception 'FAIL storia troppo lunga accettata';
exception when check_violation then raise notice 'OK   storia al massimo 1000 caratteri';
end $$;

-- tre segnalazioni (le scrive il server)
insert into public.rock_reports (rock_id, user_id, photo) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'f1'),
  ('11111111-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'f2');
select pg_temp.check((select count(*) = 0 from public.admin_notifications), 'due segnalazioni: ancora nessuna notifica');
do $$ begin
  insert into public.rock_reports (rock_id, user_id, photo)
  values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'f1bis');
  raise exception 'FAIL doppia segnalazione dello stesso giocatore';
exception when unique_violation then raise notice 'OK   una segnalazione aperta per giocatore';
end $$;
insert into public.rock_reports (rock_id, user_id, photo) values
  ('11111111-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000003', 'f3');
select pg_temp.check((select count(*) = 1 from public.admin_notifications where kind = 'rock_missing'), 'terza segnalazione: notifica agli admin');
reset role;

-- visibilità
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) = 1 from public.rock_reports), 'il giocatore vede solo la sua segnalazione');
select pg_temp.check((select count(*) = 0 from public.admin_notifications), 'il giocatore non vede le notifiche admin');
do $$ begin
  insert into public.rock_reports (rock_id, user_id, photo)
  values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'x');
  raise exception 'FAIL segnalazione scritta dal browser';
exception when insufficient_privilege then raise notice 'OK   le segnalazioni le scrive solo il server';
end $$;
select pg_temp.as_user('dddddddd-0000-4000-8000-000000000004');
select pg_temp.check((select count(*) = 3 from public.rock_reports), 'l''admin vede tutte le segnalazioni con le foto');
select pg_temp.check((select count(*) = 1 from public.admin_notifications), 'l''admin vede la notifica');
reset role;

-- qualcuno lo trova: le segnalazioni aperte si chiudono
set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo)
  values ('11111111-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004', 'p');
reset role;
select pg_temp.check((select count(*) = 3 from public.rock_reports where resolution = 'found'), 'sasso ritrovato: segnalazioni chiuse');
set role service_role; select pg_temp.as_service();
insert into public.rock_reports (rock_id, user_id, photo) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'nuova');
update public.rocks set lat = 45.47 where id = '11111111-0000-4000-8000-000000000001';
reset role;
select pg_temp.check((select resolution = 'moved' from public.rock_reports where photo = 'nuova'), 'sasso spostato: segnalazioni chiuse');

\echo TEST SEGNALAZIONI SUPERATI
