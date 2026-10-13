-- KREER · 002 · Asesores y contacto por propiedad.
-- Ejecútalo UNA vez en Supabase → SQL Editor → Run (después de schema.sql).

-- 1) Asesores: tabla solo para administradores (nada es público desde aquí) --
create table if not exists public.advisors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  whatsapp   text not null check (whatsapp ~ '^[0-9]{8,15}$'),  -- solo dígitos, con código de país
  email      text not null default '',
  created_at timestamptz not null default now()
);
alter table public.advisors enable row level security;

drop policy if exists "admin all advisors" on public.advisors;
create policy "admin all advisors" on public.advisors
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) Cada propiedad apunta a un asesor. Además guardamos SOLO su WhatsApp en la
--    propiedad (dato que ya es público en el botón), así la tabla de asesores
--    nunca se expone al público.
alter table public.properties
  add column if not exists advisor_id uuid references public.advisors (id) on delete set null,
  add column if not exists contact_whatsapp text;

create or replace function public.sync_property_contact()
returns trigger language plpgsql as $$
begin
  select whatsapp into new.contact_whatsapp from public.advisors where id = new.advisor_id;
  return new;
end $$;

drop trigger if exists properties_sync_contact on public.properties;
create trigger properties_sync_contact
  before insert or update of advisor_id on public.properties
  for each row execute function public.sync_property_contact();

-- Si el asesor cambia de número, se actualizan todas sus propiedades.
create or replace function public.propagate_advisor_contact()
returns trigger language plpgsql as $$
begin
  update public.properties set contact_whatsapp = new.whatsapp where advisor_id = new.id;
  return new;
end $$;

drop trigger if exists advisors_propagate on public.advisors;
create trigger advisors_propagate
  after update of whatsapp on public.advisors
  for each row execute function public.propagate_advisor_contact();
