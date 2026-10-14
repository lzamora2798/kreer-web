-- KREER · 004 · CRM: contactos, leads, historial y tareas (Fase 1).
-- Ejecútalo UNA vez en Supabase → SQL Editor → Run (después de 003_roles.sql).
-- Repetible: no borra datos. Si algo falla, el editor revierte el script completo.
--
-- Los leads NO se insertan desde el navegador: nacen en las funciones de 005
-- (submit_lead desde el sitio público, create_lead desde el panel).

-- 1) Contactos (clientes, propietarios, inversionistas) ----------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  phone      text check (phone ~ '^[0-9]{8,15}$'),             -- solo dígitos, con código de país
  email      text not null default '' check (char_length(email) <= 160),
  kind       text not null default 'cliente' check (kind in ('cliente', 'propietario', 'inversionista')),
  notes      text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references public.advisors (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_reachable check (phone is not null or email <> '')
);
create unique index if not exists contacts_phone_key on public.contacts (phone) where phone is not null;
create unique index if not exists contacts_email_key on public.contacts (lower(email)) where email <> '';

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

-- 2) Leads: una oportunidad de negocio de un contacto ------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid not null references public.contacts (id) on delete restrict,
  advisor_id       uuid references public.advisors (id) on delete set null,   -- null = sin asignar
  source           text not null default 'manual' check (source in ('web', 'instagram', 'whatsapp', 'referido', 'manual', 'otro')),
  interest         text not null check (interest in ('comprar', 'alquilar', 'vender', 'invertir')),
  property_id      uuid references public.properties (id) on delete set null,
  stage            text not null default 'nuevo' check (stage in ('nuevo', 'contactado', 'seguimiento', 'cita', 'negociacion', 'ganado', 'perdido')),
  lost_reason      text,
  message          text not null default '' check (char_length(message) <= 2000),
  utm              jsonb,
  assigned_at      timestamptz,
  first_contact_at timestamptz,
  closed_at        timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint leads_lost_reason check (stage <> 'perdido' or nullif(btrim(lost_reason), '') is not null)
);
create index if not exists leads_advisor_stage_idx on public.leads (advisor_id, stage);
create index if not exists leads_stage_idx         on public.leads (stage);
create index if not exists leads_created_idx       on public.leads (created_at);
create index if not exists leads_contact_idx       on public.leads (contact_id);

-- 3) Historial del lead. Inmutable: no hay políticas de update ni delete. -----
-- Es la fuente de las métricas (llamadas, seguimientos, negociaciones…).
create table if not exists public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint generated always as identity,                              -- desempata eventos con la misma marca de tiempo
  lead_id    uuid not null references public.leads (id) on delete cascade,
  advisor_id uuid references public.advisors (id) on delete set null,          -- null = el sistema
  kind       text not null check (kind in ('nota', 'llamada', 'whatsapp', 'correo', 'visita', 'cambio_etapa', 'asignacion', 'sistema')),
  direction  text check (direction in ('entrante', 'saliente')),
  body       text not null default '' check (char_length(body) <= 4000),
  from_stage text,
  to_stage   text,
  meta       jsonb,
  created_at timestamptz not null default clock_timestamp()                    -- distinto aun dentro de una misma transacción
);
create index if not exists lead_events_lead_idx on public.lead_events (lead_id, created_at desc, seq desc);
create index if not exists lead_events_kind_idx on public.lead_events (kind, created_at);

-- 4) Tareas y recordatorios ---------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references public.leads (id) on delete cascade,
  advisor_id uuid not null references public.advisors (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  kind       text not null default 'llamar' check (kind in ('llamar', 'whatsapp', 'correo', 'visita', 'otro')),
  due_at     timestamptz not null,
  done_at    timestamptz,
  created_by uuid default public.current_advisor_id() references public.advisors (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_pending_idx on public.tasks (advisor_id, due_at) where done_at is null;
create index if not exists tasks_lead_idx    on public.tasks (lead_id);

-- 5) Reglas automáticas del lead ----------------------------------------------
-- Antes de guardar: fechas derivadas y columnas que nunca cambian.
create or replace function public.leads_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.advisor_id is not null and new.assigned_at is null then new.assigned_at := now(); end if;
    if new.stage in ('ganado', 'perdido') and new.closed_at is null then new.closed_at := now(); end if;
    if new.stage not in ('nuevo', 'perdido') and new.first_contact_at is null then new.first_contact_at := now(); end if;
  else
    new.created_at := old.created_at;
    new.source     := old.source;
    new.contact_id := old.contact_id;

    if new.advisor_id is distinct from old.advisor_id then
      new.assigned_at := case when new.advisor_id is null then null else now() end;
      new.last_activity_at := now();
    end if;

    if new.stage is distinct from old.stage then
      new.closed_at := case when new.stage in ('ganado', 'perdido') then now() else null end;
      if new.stage <> 'perdido' then new.lost_reason := null; end if;
      -- Pasar a una etapa de trabajo equivale a haber contactado al cliente.
      if new.stage not in ('nuevo', 'perdido') and new.first_contact_at is null then new.first_contact_at := now(); end if;
      new.last_activity_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists leads_before on public.leads;
create trigger leads_before before insert or update on public.leads
  for each row execute function public.leads_before_write();

-- Después de guardar: deja constancia en el historial. security definer porque
-- los eventos de sistema no se pueden insertar con los permisos del usuario.
create or replace function public.leads_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  who uuid := public.current_advisor_id();   -- null cuando lo dispara el sitio público
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, advisor_id, kind, body, to_stage, meta)
    values (new.id, who, 'sistema', 'Lead creado', new.stage, jsonb_build_object('source', new.source));
    if new.advisor_id is not null then
      insert into public.lead_events (lead_id, advisor_id, kind, body, meta)
      values (new.id, who, 'asignacion', 'Asignado',
              jsonb_build_object('to', new.advisor_id, 'to_name', (select name from public.advisors where id = new.advisor_id)));
    end if;
  else
    if new.stage is distinct from old.stage then
      insert into public.lead_events (lead_id, advisor_id, kind, body, from_stage, to_stage)
      values (new.id, who, 'cambio_etapa', case when new.stage = 'perdido' then new.lost_reason else '' end, old.stage, new.stage);
    end if;
    if new.advisor_id is distinct from old.advisor_id then
      insert into public.lead_events (lead_id, advisor_id, kind, body, meta)
      values (new.id, who, 'asignacion', case when new.advisor_id is null then 'Sin asignar' else 'Reasignado' end,
              jsonb_build_object(
                'from', old.advisor_id, 'from_name', (select name from public.advisors where id = old.advisor_id),
                'to',   new.advisor_id, 'to_name',   (select name from public.advisors where id = new.advisor_id)));
    end if;
  end if;
  return null;
end $$;

drop trigger if exists leads_after on public.leads;
create trigger leads_after after insert or update on public.leads
  for each row execute function public.leads_after_write();

-- Cada evento sube la actividad del lead; un contacto saliente del asesor (o una
-- visita) marca el primer contacto, que es la base del "tiempo de respuesta".
create or replace function public.lead_events_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.leads
     set last_activity_at = new.created_at,
         first_contact_at = case
           when first_contact_at is null
            and (new.kind = 'visita'
                 or (new.kind in ('llamada', 'whatsapp', 'correo') and coalesce(new.direction, 'saliente') = 'saliente'))
           then new.created_at
           else first_contact_at
         end
   where id = new.lead_id;
  return null;
end $$;

drop trigger if exists lead_events_after on public.lead_events;
create trigger lead_events_after after insert on public.lead_events
  for each row execute function public.lead_events_after_insert();

-- 6) Permisos (RLS) -------------------------------------------------------------
-- Dirección (admin/gerente): todo. Asesor: solo sus leads y lo que cuelga de ellos.
-- Visitantes sin sesión: nada (solo entran leads por submit_lead, de 005).
alter table public.contacts    enable row level security;
alter table public.leads       enable row level security;
alter table public.lead_events enable row level security;
alter table public.tasks       enable row level security;
revoke all on public.contacts, public.leads, public.lead_events, public.tasks from anon;

-- contacts
drop policy if exists "contacts select" on public.contacts;
create policy "contacts select" on public.contacts for select using (
  public.is_manager()
  or created_by = public.current_advisor_id()
  or exists (select 1 from public.leads l where l.contact_id = contacts.id and l.advisor_id = public.current_advisor_id())
);
drop policy if exists "contacts insert" on public.contacts;
create policy "contacts insert" on public.contacts for insert with check (
  public.is_staff() and (public.is_manager() or created_by = public.current_advisor_id())
);
drop policy if exists "contacts update" on public.contacts;
create policy "contacts update" on public.contacts for update using (
  public.is_manager()
  or created_by = public.current_advisor_id()
  or exists (select 1 from public.leads l where l.contact_id = contacts.id and l.advisor_id = public.current_advisor_id())
) with check (public.is_staff());
drop policy if exists "contacts delete" on public.contacts;
create policy "contacts delete" on public.contacts for delete using (public.is_manager());

-- leads (sin política de insert: solo entran por las funciones de 005)
drop policy if exists "leads select" on public.leads;
create policy "leads select" on public.leads for select using (
  public.is_manager() or advisor_id = public.current_advisor_id()
);
drop policy if exists "leads update" on public.leads;
create policy "leads update" on public.leads for update
  using (public.is_manager() or advisor_id = public.current_advisor_id())
  with check (public.is_manager() or advisor_id = public.current_advisor_id());   -- un asesor no puede regalar ni soltar un lead
drop policy if exists "leads delete" on public.leads;
create policy "leads delete" on public.leads for delete using (public.is_manager());

-- lead_events: se ven los de los leads que se pueden ver (RLS de leads aplica en la subconsulta)
drop policy if exists "events select" on public.lead_events;
create policy "events select" on public.lead_events for select using (
  exists (select 1 from public.leads l where l.id = lead_events.lead_id)
);
drop policy if exists "events insert" on public.lead_events;
create policy "events insert" on public.lead_events for insert with check (
  kind in ('nota', 'llamada', 'whatsapp', 'correo', 'visita')     -- los demás tipos los escribe el sistema
  and advisor_id = public.current_advisor_id()
  and exists (select 1 from public.leads l where l.id = lead_events.lead_id)
);

-- tasks
drop policy if exists "tasks select" on public.tasks;
create policy "tasks select" on public.tasks for select using (
  public.is_manager() or advisor_id = public.current_advisor_id()
);
drop policy if exists "tasks insert" on public.tasks;
create policy "tasks insert" on public.tasks for insert with check (
  (public.is_manager() or advisor_id = public.current_advisor_id())
  and public.is_staff()
  and (lead_id is null or exists (select 1 from public.leads l where l.id = tasks.lead_id))
);
drop policy if exists "tasks update" on public.tasks;
create policy "tasks update" on public.tasks for update
  using (public.is_manager() or advisor_id = public.current_advisor_id())
  with check (public.is_manager() or advisor_id = public.current_advisor_id());
drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete using (
  public.is_manager() or advisor_id = public.current_advisor_id()
);

-- 7) Avisos en vivo: el panel se entera de leads nuevos sin recargar -------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads') then
    alter publication supabase_realtime add table public.leads;
  end if;
end $$;
