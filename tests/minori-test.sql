\set ON_ERROR_STOP 1
-- Test di tutela minori e privacy: chat solo tra amici, foto-prova private, cancellazione account.
-- Da eseguire su un Postgres di prova dopo tutte le migrazioni (vedi tests/README.md).
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'OK   %', label; else raise exception 'FAIL %', label; end if; end $$;

insert into auth.users values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'),
  ('cccccccc-0000-4000-8000-000000000003'), ('dddddddd-0000-4000-8000-000000000004');
set role service_role; select pg_temp.as_service();
insert into public.profiles (id, nickname) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'anna'), ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno'),
  ('cccccccc-0000-4000-8000-000000000003', 'carla'), ('dddddddd-0000-4000-8000-000000000004', 'admin');
insert into public.user_roles (user_id, role) values ('dddddddd-0000-4000-8000-000000000004', 'admin');
insert into public.friendships (user_id, friend_id, status)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'accepted');
insert into public.rocks (id, name, clue, photo, lat, lng, creator_id, ai_points) values
  ('11111111-0000-4000-8000-000000000001', 'Volpe', 'sotto la panchina', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 100),
  ('11111111-0000-4000-8000-000000000002', 'Gufo', 'dietro la fontana', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 100);
insert into public.finds (rock_id, user_id, photo) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'foto-di-anna');
reset role;

-- Chat solo tra amici
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.messages (recipient_id, body) values ('bbbbbbbb-0000-4000-8000-000000000002', 'ciao bruno');
select pg_temp.check(true, 'messaggio a un amico');
do $$ begin
  insert into public.messages (recipient_id, body) values ('cccccccc-0000-4000-8000-000000000003', 'ciao');
  raise exception 'FAIL messaggio a uno sconosciuto';
exception when insufficient_privilege then raise notice 'OK   niente messaggi a chi non è amico';
end $$;
reset role;
set role service_role; select pg_temp.as_service();
update public.profiles set banned = true where nickname = 'anna';
reset role;
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  insert into public.messages (recipient_id, body) values ('bbbbbbbb-0000-4000-8000-000000000002', 'ancora');
  raise exception 'FAIL messaggio da account bannato';
exception when insufficient_privilege then raise notice 'OK   un account bannato non scrive';
end $$;
reset role;
set role service_role; select pg_temp.as_service();
update public.profiles set banned = false where nickname = 'anna';
reset role;

-- Foto-prova: solo chi le scatta e gli admin
select pg_temp.check((select photo = '' from public.finds where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'la foto non resta nella tabella pubblica dei ritrovamenti');
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check((select photo = 'foto-di-anna' from public.find_photos), 'chi scatta vede la sua foto-prova');
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) = 0 from public.find_photos), 'un amico non vede la foto-prova');
select pg_temp.check((select count(*) = 1 from public.finds), 'il ritrovamento (senza foto) resta visibile');
select pg_temp.as_user('dddddddd-0000-4000-8000-000000000004');
select pg_temp.check((select count(*) = 1 from public.find_photos), 'l''admin vede la foto-prova');
reset role;

-- Cancellazione dell'account di carla: il sasso trovato da anna resta (anonimo), l'altro sparisce
set role service_role; select pg_temp.as_service();
select public.prepare_account_deletion('cccccccc-0000-4000-8000-000000000003');
reset role;
-- come fa Supabase con auth.admin.deleteUser
delete from auth.users where id = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.check(not exists (select 1 from public.profiles where nickname = 'carla'), 'profilo cancellato');
select pg_temp.check((select creator_id = 'dddddddd-0000-4000-8000-000000000004' from public.rocks where name = 'Volpe'), 'sasso già trovato resta, senza il nome di chi l''ha creato');
select pg_temp.check(not exists (select 1 from public.rocks where name = 'Gufo'), 'sasso mai trovato cancellato');
select pg_temp.check((select count(*) = 1 from public.finds), 'il ritrovamento di anna e i suoi punti restano');

\echo TEST TUTELA MINORI SUPERATI
