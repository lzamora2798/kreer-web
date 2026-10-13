-- KREER · esquema inicial. Pégalo completo en Supabase → SQL Editor → Run.

-- 1) Administradores autorizados -------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- (sin políticas: nadie puede leer/escribir la tabla desde el navegador)

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- 2) Propiedades ------------------------------------------------------------
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  operation   text not null check (operation in ('Venta', 'Alquiler')),
  type        text not null,
  price       numeric(12,2) not null check (price >= 0),
  zone        text not null default '',
  address     text not null default '',
  beds        int  not null default 0,
  baths       int  not null default 0,
  area        numeric(10,2) not null default 0,
  published   boolean not null default false,
  images      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();

alter table public.properties enable row level security;

drop policy if exists "public read published" on public.properties;
create policy "public read published" on public.properties
  for select using (published = true);

drop policy if exists "admin read all" on public.properties;
create policy "admin read all" on public.properties
  for select using (public.is_admin());

drop policy if exists "admin insert" on public.properties;
create policy "admin insert" on public.properties
  for insert with check (public.is_admin());

drop policy if exists "admin update" on public.properties;
create policy "admin update" on public.properties
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete" on public.properties;
create policy "admin delete" on public.properties
  for delete using (public.is_admin());

-- 3) Fotos (Storage) --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects
  for select using (bucket_id = 'property-images');

drop policy if exists "admin write images" on storage.objects;
create policy "admin write images" on storage.objects
  for insert with check (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admin update images" on storage.objects;
create policy "admin update images" on storage.objects
  for update using (bucket_id = 'property-images' and public.is_admin());

drop policy if exists "admin delete images" on storage.objects;
create policy "admin delete images" on storage.objects
  for delete using (bucket_id = 'property-images' and public.is_admin());

-- 4) Después de crear tu usuario en Authentication → Users, autorízalo:
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'TU_CORREO@dominio.com';
