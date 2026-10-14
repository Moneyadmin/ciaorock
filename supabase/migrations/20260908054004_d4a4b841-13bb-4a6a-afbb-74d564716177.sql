create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy user_roles_select_authenticated on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

insert into public.user_roles (user_id, role) values ('764c9bcc-3de9-41e9-9ffc-7bc5ce234feb', 'admin');

alter table public.profiles add column points_adjust integer not null default 0;
alter table public.profiles add column banned boolean not null default false;

create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.double_days (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  multiplier integer not null default 2,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.double_days to authenticated;
grant all on public.double_days to service_role;
alter table public.double_days enable row level security;
create policy double_days_select_authenticated on public.double_days for select to authenticated using (true);
create policy double_days_admin_insert on public.double_days for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy double_days_admin_update on public.double_days for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy double_days_admin_delete on public.double_days for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy rocks_delete_admin on public.rocks for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
