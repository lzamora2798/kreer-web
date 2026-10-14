-- KREER · 005 · CRM: asignación automática, entrada de leads y métricas (Fase 1).
-- Ejecútalo UNA vez en Supabase → SQL Editor → Run (después de 004_crm_core.sql).
-- Repetible. Si algo falla, el editor revierte el script completo.
--
-- Funciones públicas (las que llama la app):
--   submit_lead  → formulario del sitio, sin sesión
--   create_lead  → panel, solo equipo
--   crm_metrics, crm_funnel → panel, con sesión (cada rol ve solo lo que le toca por RLS)
-- Funciones internas (no ejecutables desde la API): pick_advisor, ingest_lead.

-- 1) Quién recibe el siguiente lead ---------------------------------------------
-- Gana el asesor activo con menor carga ponderada: leads recibidos en los últimos
-- 30 días ÷ peso. En empate, quien lleva más tiempo sin recibir uno. Si no hay
-- asesores activos devuelve null y el lead queda "sin asignar" para la dirección.
create or replace function public.pick_advisor()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  chosen uuid;
begin
  -- Evita que dos leads simultáneos lean el mismo reparto y se vayan al mismo asesor.
  perform pg_advisory_xact_lock(hashtext('kreer.pick_advisor'));

  select a.id into chosen
    from public.advisors a
   where a.active and a.role = 'asesor'
   order by (select count(*) from public.leads l
              where l.advisor_id = a.id and l.assigned_at > now() - interval '30 days')::numeric / a.assign_weight,
            a.last_assigned_at nulls first,
            a.created_at
   limit 1;

  if chosen is not null then
    update public.advisors set last_assigned_at = clock_timestamp() where id = chosen;
  end if;
  return chosen;
end $$;

-- Deja solo dígitos con código de país. Asume Ecuador (593) si el número viene en
-- formato local (0987654321 o 987654321). Misma regla que normalizeWhatsapp() de la
-- app: así un cliente no se duplica por escribir su número distinto.
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  with a as (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d),
       b as (select case when d like '00%' then substr(d, 3) else d end as d from a)
  select nullif(case
           when length(d) = 10 and d like '0%' then '593' || substr(d, 2)
           when length(d) = 9  and d like '9%' then '593' || d
           else d end, '')
    from b
$$;

-- 2) Entrada única de leads (la usan submit_lead y create_lead) -------------------
-- Valida, busca o crea el contacto (por teléfono o correo) y:
--  · si ya tiene un lead abierto con el mismo interés NO crea otro: agrega una nota;
--  · si tiene un lead abierto con otro interés, el nuevo va al mismo asesor;
--  · si no, lo asigna con pick_advisor().
-- p_claim_for: si viene, rechaza clientes que ya atiende otro asesor.
create or replace function public.ingest_lead(
  p_name text, p_email text, p_phone text, p_interest text, p_source text,
  p_message text default '', p_property_id uuid default null, p_utm jsonb default null,
  p_advisor_id uuid default null, p_claim_for uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := public.normalize_phone(p_phone);
  v_msg   text := left(btrim(coalesce(p_message, '')), 2000);
  v_utm   jsonb := p_utm;
  v_cid   uuid;
  v_open  uuid;
  v_adv   uuid;
  v_other text;
  v_lead  uuid;
begin
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Escribe tu nombre.' using errcode = '22023';
  end if;
  if v_email <> '' and (char_length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'El correo no es válido.' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{8,15}$' then
    raise exception 'El teléfono no es válido.' using errcode = '22023';
  end if;
  if v_phone is null and v_email = '' then
    raise exception 'Indica un teléfono o un correo.' using errcode = '22023';
  end if;
  if p_interest is null or p_interest not in ('comprar', 'alquilar', 'vender', 'invertir') then
    raise exception 'Indica qué te interesa.' using errcode = '22023';
  end if;
  if v_utm is not null and (jsonb_typeof(v_utm) <> 'object' or length(v_utm::text) > 1000) then v_utm := null; end if;
  if p_property_id is not null and not exists (select 1 from public.properties where id = p_property_id) then p_property_id := null; end if;
  if p_advisor_id is not null and not exists (select 1 from public.advisors where id = p_advisor_id and active) then
    raise exception 'El asesor elegido no está disponible.' using errcode = '22023';
  end if;

  -- Contacto: por teléfono o por correo.
  select id into v_cid from public.contacts
   where (v_phone is not null and phone = v_phone) or (v_email <> '' and lower(email) = v_email)
   order by created_at limit 1;

  if v_cid is null then
    insert into public.contacts (name, phone, email, kind, created_by)
    values (v_name, v_phone, v_email,
            case p_interest when 'vender' then 'propietario' when 'invertir' then 'inversionista' else 'cliente' end,
            public.current_advisor_id())
    returning id into v_cid;
  else
    -- Completa el dato que faltaba, salvo que ya pertenezca a otro contacto.
    update public.contacts c set
      phone = coalesce(c.phone, case when v_phone is not null and not exists (select 1 from public.contacts x where x.phone = v_phone) then v_phone end),
      email = case when c.email = '' and v_email <> '' and not exists (select 1 from public.contacts x where lower(x.email) = v_email) then v_email else c.email end
    where c.id = v_cid;
  end if;

  if p_claim_for is not null then
    select a.name into v_other
      from public.leads l join public.advisors a on a.id = l.advisor_id
     where l.contact_id = v_cid and l.stage not in ('ganado', 'perdido') and l.advisor_id <> p_claim_for
     limit 1;
    if found then
      raise exception 'Este cliente ya lo atiende %.', v_other using errcode = '23505';
    end if;
  end if;

  -- ¿Ya hay un lead abierto con el mismo interés? Se agrega una nota en vez de duplicar.
  select id into v_open from public.leads
   where contact_id = v_cid and stage not in ('ganado', 'perdido') and interest = p_interest
   order by created_at desc limit 1;

  if v_open is not null then
    -- Freno básico contra repeticiones: máximo 3 notas entrantes en 10 minutos por lead.
    if (select count(*) from public.lead_events
         where lead_id = v_open and kind = 'nota' and direction = 'entrante'
           and created_at > now() - interval '10 minutes') >= 3 then
      return jsonb_build_object('lead_id', v_open, 'contact_id', v_cid, 'status', 'throttled');
    end if;
    insert into public.lead_events (lead_id, advisor_id, kind, direction, body, meta)
    values (v_open, public.current_advisor_id(), 'nota', case when p_source = 'web' then 'entrante' end,
            case when v_msg <> '' then v_msg else 'Volvió a consultar' end,
            jsonb_build_object('source', p_source, 'property_id', p_property_id));
    return jsonb_build_object('lead_id', v_open, 'contact_id', v_cid, 'status', 'existing');
  end if;

  -- Asesor: el indicado; si no, el que ya atiende a este cliente; si no, el reparto automático.
  v_adv := p_advisor_id;
  if v_adv is null then
    select advisor_id into v_adv from public.leads
     where contact_id = v_cid and stage not in ('ganado', 'perdido') and advisor_id is not null
     order by created_at desc limit 1;
  end if;
  if v_adv is null then v_adv := public.pick_advisor(); end if;

  insert into public.leads (contact_id, advisor_id, source, interest, property_id, message, utm)
  values (v_cid, v_adv, p_source, p_interest, p_property_id, v_msg, v_utm)
  returning id into v_lead;

  return jsonb_build_object('lead_id', v_lead, 'contact_id', v_cid, 'status', 'created', 'advisor_id', v_adv);
end $$;

-- 3) Formulario del sitio público (sin sesión) --------------------------------------
-- No devuelve nada a propósito: no revela si el cliente ya existía ni a quién se asignó.
-- p_website es un campo trampa oculto en el formulario: si trae texto, es un robot.
create or replace function public.submit_lead(
  p_name text, p_email text, p_phone text, p_interest text, p_message text default '',
  p_property_id uuid default null, p_utm jsonb default null, p_website text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if nullif(btrim(coalesce(p_website, '')), '') is not null then return; end if;
  perform public.ingest_lead(p_name, p_email, p_phone, p_interest, 'web', p_message, p_property_id, p_utm);
end $$;

-- 4) Crear un lead desde el panel ---------------------------------------------------
-- Asesor: el lead queda para él, y no puede tomar un cliente que ya atiende otro.
-- Dirección: puede elegir asesor; si no elige, se reparte automáticamente.
create or replace function public.create_lead(
  p_name text, p_email text, p_phone text, p_interest text, p_source text default 'manual',
  p_message text default '', p_property_id uuid default null, p_advisor_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_advisor_id();
begin
  if me is null then
    raise exception 'Solo el equipo puede crear leads.' using errcode = '42501';
  end if;
  if public.is_manager() then
    return public.ingest_lead(p_name, p_email, p_phone, p_interest, p_source, p_message, p_property_id, null, p_advisor_id, null);
  end if;
  return public.ingest_lead(p_name, p_email, p_phone, p_interest, p_source, p_message, p_property_id, null, me, me);
end $$;

-- 5) Métricas ------------------------------------------------------------------------
-- Se ejecuta con los permisos de quien llama (security invoker): un asesor solo suma
-- lo suyo y la dirección ve todo. Una fila por asesor y una "sin asignar" para la dirección.
--  · received, contacted, avg_response_minutes: leads que LLEGARON en el periodo.
--  · calls, followups, visits, negotiations, won, lost: lo que OCURRIÓ en el periodo.
--  · followups: contactos salientes posteriores al primer contacto del lead.
--  · avg_response_minutes: de la asignación al primer contacto (se omite si el lead se
--    reasignó después de haber sido contactado).
create or replace function public.crm_metrics(p_from timestamptz, p_to timestamptz)
returns table (
  advisor_id uuid, advisor_name text,
  received int, contacted int, avg_response_minutes numeric,
  calls int, followups int, visits int, negotiations int, won int, lost int)
language sql stable set search_path = public as $$
  with cohort as (
    select l.advisor_id as aid, count(*) as received, count(l.first_contact_at) as contacted,
           avg(extract(epoch from l.first_contact_at - l.assigned_at) / 60) filter (where l.first_contact_at >= l.assigned_at) as avg_resp
      from public.leads l
     where l.created_at >= p_from and l.created_at < p_to
     group by l.advisor_id
  ), touch as (
    select e.advisor_id as aid,
           count(*) filter (where e.kind = 'llamada' and coalesce(e.direction, 'saliente') = 'saliente') as calls,
           count(*) filter (where e.kind = 'visita') as visits,
           count(*) filter (where e.kind in ('llamada', 'whatsapp', 'correo', 'visita')
                              and coalesce(e.direction, 'saliente') = 'saliente'
                              and e.created_at > l.first_contact_at) as followups
      from public.lead_events e join public.leads l on l.id = e.lead_id
     where e.created_at >= p_from and e.created_at < p_to and e.advisor_id is not null
     group by e.advisor_id
  ), nego as (
    select l.advisor_id as aid, count(distinct e.lead_id) as n
      from public.lead_events e join public.leads l on l.id = e.lead_id
     where e.kind = 'cambio_etapa' and e.to_stage = 'negociacion' and e.created_at >= p_from and e.created_at < p_to
     group by l.advisor_id
  ), closed as (
    select l.advisor_id as aid,
           count(*) filter (where l.stage = 'ganado') as won,
           count(*) filter (where l.stage = 'perdido') as lost
      from public.leads l
     where l.closed_at >= p_from and l.closed_at < p_to
     group by l.advisor_id
  ), keys as (
    select a.id as aid from public.advisors a where a.active and a.role = 'asesor'
    union select aid from cohort union select aid from touch union select aid from nego union select aid from closed
  )
  select k.aid, coalesce(a.name, 'Sin asignar'),
         coalesce(c.received, 0)::int, coalesce(c.contacted, 0)::int, round(c.avg_resp, 1),
         coalesce(t.calls, 0)::int, coalesce(t.followups, 0)::int, coalesce(t.visits, 0)::int,
         coalesce(n.n, 0)::int, coalesce(x.won, 0)::int, coalesce(x.lost, 0)::int
    from keys k
    left join public.advisors a on a.id = k.aid
    left join cohort c on c.aid is not distinct from k.aid
    left join touch  t on t.aid is not distinct from k.aid
    left join nego   n on n.aid is not distinct from k.aid
    left join closed x on x.aid is not distinct from k.aid
   where public.is_manager() or k.aid = public.current_advisor_id()
   order by (k.aid is null), a.name
$$;

-- Leads actuales por etapa (los que el usuario puede ver).
create or replace function public.crm_funnel()
returns table (stage text, total int)
language sql stable set search_path = public as $$
  select l.stage, count(*)::int from public.leads l group by l.stage
$$;

-- 6) Quién puede ejecutar qué --------------------------------------------------------
-- En Postgres toda función nace ejecutable por todos: aquí se cierra lo interno y se
-- abre solo lo necesario.
revoke execute on function public.pick_advisor() from public, anon, authenticated;
revoke execute on function public.ingest_lead(text, text, text, text, text, text, uuid, jsonb, uuid, uuid) from public, anon, authenticated;

revoke execute on function public.submit_lead(text, text, text, text, text, uuid, jsonb, text) from public;
grant  execute on function public.submit_lead(text, text, text, text, text, uuid, jsonb, text) to anon, authenticated;

revoke execute on function public.create_lead(text, text, text, text, text, text, uuid, uuid) from public, anon;
grant  execute on function public.create_lead(text, text, text, text, text, text, uuid, uuid) to authenticated;

revoke execute on function public.crm_metrics(timestamptz, timestamptz) from public, anon;
grant  execute on function public.crm_metrics(timestamptz, timestamptz) to authenticated;

revoke execute on function public.crm_funnel() from public, anon;
grant  execute on function public.crm_funnel() to authenticated;
