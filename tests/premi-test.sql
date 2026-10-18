\set ON_ERROR_STOP 1
-- Test dei premi creati dall'admin (badge e targhette, temporanei, a pagamento o a condizione).
-- Da eseguire su un Postgres di prova dopo tutte le migrazioni (vedi tests/README.md).
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false) $$;
create or replace function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false) $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok then raise notice 'OK   %', label; else raise exception 'FAIL %', label; end if; end $$;
create or replace function pg_temp.owns(u text, item text) returns boolean language sql as $$
  select exists (select 1 from public.purchases where user_id = u::uuid and item_id = item) $$;

insert into auth.users values
  ('aaaaaaaa-0000-4000-8000-000000000001'), ('dddddddd-0000-4000-8000-000000000004'),
  ('cccccccc-0000-4000-8000-000000000003');
set role service_role; select pg_temp.as_service();
insert into public.profiles (id, nickname) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'anna'),
  ('dddddddd-0000-4000-8000-000000000004', 'admin'),
  ('cccccccc-0000-4000-8000-000000000003', 'carla');
insert into public.user_roles (user_id, role) values ('dddddddd-0000-4000-8000-000000000004', 'admin');
insert into public.rocks (id, name, clue, photo, lat, lng, creator_id, ai_points) values
  ('11111111-0000-4000-8000-000000000001', 'Volpe', 'sotto la panchina', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 100),
  ('11111111-0000-4000-8000-000000000002', 'Gufo', 'dietro la fontana', 'x', 45.46, 9.19, 'cccccccc-0000-4000-8000-000000000003', 100);
reset role;

-- Solo l'admin crea premi
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  insert into public.shop_items (id, kind, label, price) values ('furbo', 'plate', 'Furbo', 0);
  raise exception 'FAIL un giocatore ha creato un premio';
exception when insufficient_privilege then raise notice 'OK   un giocatore non crea premi';
end $$;
reset role;

set role authenticated; select pg_temp.as_user('dddddddd-0000-4000-8000-000000000004');
insert into public.shop_items (id, kind, label, icon, description, price, unlock, starts_at, ends_at) values
  ('due-sassi', 'badge', 'Doppietta', '✌️', 'Trova 2 sassi', null, '{"type":"finds","n":2}', null, null),
  ('volpe', 'badge', 'Amico della volpe', '🦊', 'Trova la Volpe', null,
     '{"type":"rock","n":1,"ref":"11111111-0000-4000-8000-000000000001"}', null, null),
  ('scaduto', 'badge', 'Estate', '☀️', '', null, '{"type":"finds","n":1}', now() - interval '20 days', now() - interval '10 days'),
  ('futuro', 'plate', 'Natale', '🎄', '', 10, null, now() + interval '10 days', now() + interval '20 days'),
  ('evento', 'plate', 'Evento', '🎉', '', 50, null, now() - interval '1 day', now() + interval '1 day');
select pg_temp.check(true, 'l''admin crea badge e targhette');
do $$ begin
  insert into public.shop_items (id, kind, label) values ('niente', 'badge', 'Niente');
  raise exception 'FAIL premio senza prezzo né condizione accettato';
exception when check_violation then raise notice 'OK   serve un prezzo o una condizione';
end $$;
do $$ begin
  insert into public.shop_items (id, kind, label, unlock) values ('sbagliato', 'badge', 'X', '{"type":"rock","n":1}');
  raise exception 'FAIL condizione sasso senza sasso accettata';
exception when check_violation then raise notice 'OK   condizione "sasso" richiede quale sasso';
end $$;
reset role;

-- Sblocco a condizione al momento del ritrovamento
set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'p');
reset role;
select pg_temp.check(pg_temp.owns('aaaaaaaa-0000-4000-8000-000000000001', 'volpe'), 'badge "trova la Volpe" sbloccato subito');
select pg_temp.check(not pg_temp.owns('aaaaaaaa-0000-4000-8000-000000000001', 'due-sassi'), 'badge da 2 sassi non ancora');
select pg_temp.check(not pg_temp.owns('aaaaaaaa-0000-4000-8000-000000000001', 'scaduto'), 'badge scaduto non si sblocca');
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check((select progress = 1 and goal = 2 from public.my_reward_progress() where item_id = 'due-sassi'), 'avanzamento 1/2');
reset role;
set role service_role; select pg_temp.as_service();
insert into public.finds (rock_id, user_id, photo) values ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'p');
reset role;
select pg_temp.check(pg_temp.owns('aaaaaaaa-0000-4000-8000-000000000001', 'due-sassi'), 'badge da 2 sassi sbloccato');
set role authenticated; select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) = 2 from public.claim_rewards()), 'avviso dei 2 badge nuovi');
select pg_temp.check((select count(*) = 0 from public.claim_rewards()), 'avviso una volta sola');
select pg_temp.check((select count(*) = 2 from public.user_special_badges('aaaaaaaa-0000-4000-8000-000000000001')), 'badge visibili agli altri');
select pg_temp.check((select spent = 0 from public.my_wallet()), 'i premi sbloccati non costano');

-- Acquisti nel periodo
do $$ begin
  perform public.buy_item('futuro');
  raise exception 'FAIL comprato prima dell''inizio';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   non si compra prima dell''inizio';
end $$;
do $$ begin
  perform public.buy_item('volpe');
  raise exception 'FAIL comprato un premio a condizione';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   premio a condizione non acquistabile';
end $$;
select pg_temp.check(public.buy_item('evento') >= 0, 'targhetta temporanea acquistabile nel periodo');
select public.equip_plate('evento');
do $$ begin
  perform public.equip_plate('volpe');
  raise exception 'FAIL badge indossato come targhetta';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   un badge non si indossa come targhetta';
end $$;
reset role;

-- Premio posseduto: non si cancella, si disattiva
set role authenticated; select pg_temp.as_user('dddddddd-0000-4000-8000-000000000004');
do $$ begin
  delete from public.shop_items where id = 'evento';
  raise exception 'FAIL cancellato un premio posseduto';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK   premio posseduto non cancellabile';
end $$;
update public.shop_items set active = false where id = 'evento';
delete from public.shop_items where id = 'futuro';
select pg_temp.check(not exists (select 1 from public.shop_items where id = 'futuro'), 'premio mai ottenuto cancellabile');
reset role;
select pg_temp.check((select plate_label = 'Evento' from public.leaderboard() where nickname = 'anna'), 'targhetta disattivata resta a chi ce l''ha');

\echo TEST PREMI SUPERATI
