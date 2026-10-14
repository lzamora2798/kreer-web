-- KREER · 003 · Roles del equipo y acceso de asesores (Fase 1 del CRM).
-- Ejecútalo UNA vez en Supabase → SQL Editor → Run (después de 002_asesores.sql).
-- Es aditivo y repetible: no borra datos ni la tabla admins.
-- Si algo falla, el editor revierte todo el script; corrige el error y vuelve a ejecutarlo.

-- 1) advisors pasa a ser la tabla de todo el equipo -------------------------
alter table public.advisors
  add column if not exists user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists role text not null default 'asesor',
  add column if not exists active boolean not null default true,
  add column if not exists assign_weight int not null default 1,
  add column if not exists last_assigned_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'advisors_role_check') then
    alter table public.advisors
      add constraint advisors_role_check check (role in ('admin', 'gerente', 'asesor'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'advisors_weight_check') then
    alter table public.advisors
      add constraint advisors_weight_check check (assign_weight between 1 and 10);
  end if;
end $$;

-- Admin y gerente no siempre tienen WhatsApp (el check de formato sigue vigente).
alter table public.advisors alter column whatsapp drop not null;

-- El correo vincula a la persona con su usuario de acceso: no se puede repetir.
create unique index if not exists advisors_email_key
  on public.advisors (lower(email)) where email <> '';

-- 2) Cada admin actual pasa a ser una fila del equipo con rol admin ----------
update public.advisors a
   set user_id = u.id, role = 'admin'
  from auth.users u
 where a.user_id is null
   and a.email <> ''
   and lower(a.email) = lower(u.email)
   and u.id in (select user_id from public.admins);

insert into public.advisors (name, email, role, user_id)
select coalesce(nullif(split_part(u.email, '@', 1), ''), 'Administrador'), coalesce(u.email, ''), 'admin', u.id
  from public.admins ad
  join auth.users u on u.id = ad.user_id
 where not exists (select 1 from public.advisors a where a.user_id = u.id)
   and not exists (select 1 from public.advisors a where a.email <> '' and lower(a.email) = lower(u.email));

-- 3) Funciones de rol --------------------------------------------------------
-- Se dejan ejecutables por todos (valor por defecto): las políticas las evalúan
-- también para visitantes sin sesión, y para ellos solo devuelven null/false.
create or replace function public.staff_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.advisors where user_id = auth.uid() and active limit 1 $$;

create or replace function public.current_advisor_id()
returns uuid language sql stable security definer set search_path = public
as $$ select id from public.advisors where user_id = auth.uid() and active limit 1 $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.advisors where user_id = auth.uid() and active) $$;

-- Dirección: ve todo el CRM y administra el catálogo.
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.staff_role() in ('admin', 'gerente'), false) $$;

-- Solo el rol admin crea, edita o desactiva al equipo.
create or replace function public.can_manage_team()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.staff_role() = 'admin', false)
          or exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- Mismo nombre que antes, así siguen funcionando sin cambios las políticas de
-- properties y de Storage. Conserva la tabla legada admins como respaldo para
-- que nadie quede sin acceso.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_manager()
          or exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- 4) Políticas del equipo ----------------------------------------------------
drop policy if exists "admin all advisors" on public.advisors;
drop policy if exists "staff read advisors" on public.advisors;
create policy "staff read advisors" on public.advisors
  for select using (public.is_staff() or public.is_admin());

drop policy if exists "team insert advisors" on public.advisors;
create policy "team insert advisors" on public.advisors
  for insert with check (public.can_manage_team());

drop policy if exists "team update advisors" on public.advisors;
create policy "team update advisors" on public.advisors
  for update using (public.can_manage_team()) with check (public.can_manage_team());

drop policy if exists "team delete advisors" on public.advisors;
create policy "team delete advisors" on public.advisors
  for delete using (public.can_manage_team());

-- Los asesores ven todo el catálogo (borradores incluidos) en modo lectura.
drop policy if exists "staff read all" on public.properties;
create policy "staff read all" on public.properties
  for select using (public.is_staff());

-- 5) Nunca dejar el sistema sin un administrador activo -----------------------
create or replace function public.advisors_guard_last_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.role = 'admin' and old.active and old.user_id is not null
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.advisors a
                      where a.id <> old.id and a.role = 'admin' and a.active and a.user_id is not null)
     and not exists (select 1 from public.admins)
  then
    raise exception 'Debe quedar al menos un administrador activo.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists advisors_keep_admin on public.advisors;
create trigger advisors_keep_admin before update or delete on public.advisors
  for each row execute function public.advisors_guard_last_admin();

-- 6) Primer ingreso: vincula al usuario con su fila del equipo ---------------
-- Lo llama la app al iniciar sesión. Vincula por correo SOLO si el correo está
-- confirmado en Supabase Auth (si no, cualquiera podría registrarse con el
-- correo de un asesor y reclamar su cuenta). Devuelve nada si no pertenece al equipo.
create or replace function public.my_staff()
returns table (id uuid, name text, role text, active boolean)
language plpgsql security definer set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  mail text;
begin
  if uid is null then return; end if;

  if not exists (select 1 from public.advisors a where a.user_id = uid) then
    select lower(u.email) into mail
      from auth.users u where u.id = uid and u.email_confirmed_at is not null;

    if mail is not null and mail <> '' then
      update public.advisors a set user_id = uid
       where a.user_id is null and a.active and lower(a.email) = mail;
    end if;

    -- Admin legado agregado a mano a la tabla admins después de esta migración.
    if not exists (select 1 from public.advisors a where a.user_id = uid)
       and exists (select 1 from public.admins ad where ad.user_id = uid) then
      insert into public.advisors (name, email, role, user_id)
      select coalesce(nullif(split_part(u.email, '@', 1), ''), 'Administrador'), coalesce(u.email, ''), 'admin', uid
        from auth.users u where u.id = uid
      on conflict do nothing;
    end if;
  end if;

  return query select a.id, a.name, a.role, a.active from public.advisors a where a.user_id = uid;
end $$;

revoke execute on function public.my_staff() from public, anon;
grant execute on function public.my_staff() to authenticated;
