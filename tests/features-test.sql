\set ON_ERROR_STOP 1
-- Test di bonus creatore, bonus giornaliero, negozio, profilo e missioni co-op.
-- Da eseguire su un Postgres di prova dopo tutte le migrazioni (vedi tests/README.md).
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'OK   %', label; else raise exception 'FAIL %', label; end if; end $$;
create or replace function pg_temp.pts(nick text) returns int language sql as $$
  select points from public.leaderboard() where nickname = nick $$;

-- A e B amici, C creatore di sassi
insert into auth.users values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002'),
  ('cccccccc-0000-4000-8000-000000000003');
set role service_role; select pg_temp.as_service();
insert into public.profiles (id, nickname) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'anna'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bruno'),
  ('cccccccc-0000-4000-8000-000000000003', 'carla');
insert into public.friendships (user_id, friend_id, status)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'accepted');
insert into public.rocks (id, name, clue, photo, lat, lng, creator_id, ai_points) values
  ('11111111-0000-4000-8000-000000000001', 'Volpe', 'sotto la panchina', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 400),
  ('11111111-0000-4000-8000-000000000002', 'Gufo', 'dietro la fontana', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 600);
reset role;

-- Bonus giornaliero
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check((select daily_bonus = 15 from public.touch_streak()), 'bonus giornaliero: 15 punti al primo accesso');
select pg_temp.check((select daily_bonus = 0 from public.touch_streak()), 'bonus giornaliero: una volta sola al giorno');
reset role;

-- Bonus creatore: metà dei punti quando un altro trova il sasso
set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'p');
reset role;
select pg_temp.check((select amount = 200 from public.points_ledger where reason = 'creator'), 'creatore: +200 (metà di 400) al ritrovamento');
select pg_temp.check(pg_temp.pts('anna') = 415, 'classifica anna: 400 ritrovamento + 15 giornaliero');
select pg_temp.check(pg_temp.pts('carla') = 230, 'classifica carla: 2 sassi creati (30) + 200 bonus creatore');
select pg_temp.check((select public.backfill_creator_bonus()) = 0, 'recupero bonus creatore senza doppioni');

-- Negozio: saldo separato dalla classifica
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check((select earned = 415 and balance = 415 from public.my_wallet()), 'saldo iniziale 415');
select pg_temp.check(public.buy_item('esploratore') = 115, 'acquisto targhetta da 300: saldo 115');
do $$ begin
  perform public.buy_item('cacciatore');
  raise exception 'FAIL acquisto senza saldo permesso';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   acquisto rifiutato senza saldo (%)', sqlerrm;
end $$;
do $$ begin
  perform public.buy_item('esploratore');
  raise exception 'FAIL doppio acquisto permesso';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   stessa targhetta non si compra due volte';
end $$;
select pg_temp.check(pg_temp.pts('anna') = 415, 'spendere non abbassa la classifica');
select public.equip_plate('esploratore');
do $$ begin
  perform public.equip_plate('leggenda');
  raise exception 'FAIL targhetta non comprata indossata';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   non si indossa una targhetta non comprata';
end $$;
-- scritture dirette vietate
update public.profiles set plate_id = 'leggenda', avatar_url = 'https://evil.example/x.png',
  bio = '<b>Ciao</b>' || chr(7) || ' sono anna' where id = auth.uid();
do $$ begin
  insert into public.purchases (user_id, item_id, price) values (auth.uid(), 'leggenda', 0);
  raise exception 'FAIL acquisto diretto permesso';
exception when insufficient_privilege then raise notice 'OK   acquisto diretto vietato'; end $$;
do $$ begin
  insert into public.points_ledger (user_id, amount, reason, ref) values (auth.uid(), 99999, 'daily', 'x');
  raise exception 'FAIL punti diretti permessi';
exception when insufficient_privilege then raise notice 'OK   registro punti scrivibile solo dal database'; end $$;
reset role;
select pg_temp.check((select plate_id = 'esploratore' and avatar_url is null and bio = 'Ciao sono anna'
  from public.profiles where nickname = 'anna'), 'profilo: targhetta e foto protette, bio ripulita');
select pg_temp.check((select plate_label = 'Esploratore' from public.leaderboard() where nickname = 'anna'), 'targhetta visibile in classifica');
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
update public.profiles set bio = repeat('x', 600) where id = auth.uid();
reset role;
select pg_temp.check((select char_length(bio) = 500 from public.profiles where nickname = 'anna'), 'bio tagliata a 500 caratteri');

-- Missioni co-op
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  perform public.coop_invite('cccccccc-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002');
  raise exception 'FAIL missione con un non amico';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   missione solo con amici';
end $$;
do $$ begin
  perform public.coop_invite('bbbbbbbb-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001');
  raise exception 'FAIL missione su un sasso già trovato';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   missione solo su sassi non ancora trovati';
end $$;
select public.coop_invite('bbbbbbbb-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002');
do $$ begin
  perform public.coop_invite('bbbbbbbb-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002');
  raise exception 'FAIL due missioni insieme';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   una missione alla volta';
end $$;
do $$ begin
  insert into public.coop_missions (creator_id, partner_id, rock_id, status, expires_at)
  values (auth.uid(), 'bbbbbbbb-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 'success', now());
  raise exception 'FAIL missione scritta direttamente';
exception when insufficient_privilege then raise notice 'OK   missioni scrivibili solo tramite le funzioni'; end $$;
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.check((select public.coop_respond(id, true) = 'active' from public.coop_missions limit 1), 'l''amico accetta: parte il timer');
select pg_temp.check((select expires_at > now() + interval '29 minutes' from public.coop_missions limit 1), 'timer di 30 minuti');
select pg_temp.as_user('cccccccc-0000-4000-8000-000000000003');
select pg_temp.check((select count(*) = 0 from public.coop_missions), 'gli altri non vedono la missione');
reset role;

set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'p');
reset role;
select pg_temp.check((select status = 'active' and creator_found_at is not null from public.coop_missions), 'trovato da uno: missione ancora in corso');
set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'p');
reset role;
select pg_temp.check((select status = 'success' and creator_bonus = 600 and partner_bonus = 600 from public.coop_missions),
  'trovato da entrambi: missione riuscita, i 600 punti di ognuno raddoppiano (il ritrovamento di prima no)');
select pg_temp.check(pg_temp.pts('anna') = 415 + 600 + 600, 'classifica anna con bonus co-op');
select pg_temp.check(pg_temp.pts('bruno') = 600 + 600, 'classifica bruno con bonus co-op');
select pg_temp.check(pg_temp.pts('carla') = 30 + 200 + 300 + 300, 'carla: bonus creatore per ogni ritrovamento');

-- Scadenza
set role service_role; select pg_temp.as_service();
insert into public.rocks (id, name, clue, photo, lat, lng, creator_id, ai_points) values
  ('11111111-0000-4000-8000-000000000003', 'Rana', 'nel cespuglio', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 100);
reset role;
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select public.coop_invite('bbbbbbbb-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003');
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000002');
select public.coop_respond((select id from public.coop_missions where status = 'pending'), true);
reset role;
update public.coop_missions set expires_at = now() - interval '1 minute' where status = 'active';
set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'p');
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'p');
reset role;
select pg_temp.check((select status = 'failed' and creator_bonus is null from public.coop_missions where rock_id = '11111111-0000-4000-8000-000000000003'),
  'tempo scaduto: missione fallita, niente bonus');
\echo TEST NUOVE MECCANICHE SUPERATI
