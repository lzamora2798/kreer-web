# Supabase

Variables en `.env` (nunca documentar sus valores): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. (`VITE_API_URL` ya no se usa: las consultas del sitio van directo a Supabase con `submit_lead`.)

## Orden de puesta en marcha
1. Supabase → SQL Editor: ejecutar en orden `supabase/schema.sql`, `002_asesores.sql`, `003_roles.sql`, `004_crm_core.sql` y `005_crm_functions.sql` (una sola vez cada uno; son idempotentes en lo posible y el editor revierte el script completo si algo falla).
2. Authentication → Users: crear el usuario administrador.
3. Autorizarlo. Con la migración 003 aplicada, lo normal es que el admin entre y se registre en **Equipo**; para el primer admin de una base nueva sigue valiendo:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'TU_CORREO@dominio.com';
   ```
   (al iniciar sesión, `my_staff()` le crea su fila en `advisors` con rol admin).
4. Cada migración nueva va como `supabase/00N_nombre.sql`, comentada en español y con encabezado "Ejecútalo UNA vez…", y con su `supabase/tests/00N_*.test.mjs`.

## Pruebas de base de datos
`npm run test:db` levanta un Postgres en memoria (PGlite, sin Docker) con un arnés que simula `auth`, `storage` y los roles `anon`/`authenticated`, aplica todas las migraciones y prueba permisos por rol. Correrlo **antes** de ejecutar una migración nueva en Supabase.

## Roles y acceso (migración 003)
- `advisors` es la tabla de **todo el equipo**: `role` (`admin|gerente|asesor`), `active`, `assign_weight`, `user_id` (usuario de Auth vinculado).
- `is_admin()` = admin o gerente (o fila legada en `admins`): ve y administra catálogo y CRM. `can_manage_team()` = solo admin: crea/edita/desactiva personas. `is_staff()` = cualquier persona activa del equipo (los asesores leen propiedades y equipo, no escriben).
- Dar acceso a alguien: registrarlo en **Equipo** con su correo → invitarlo en Authentication → Users con ese correo → en su primer ingreso `my_staff()` lo vincula, **solo si su correo está confirmado**.
- No se puede desactivar, degradar ni borrar al último admin (trigger `advisors_keep_admin`).
- Las funciones de rol son ejecutables por todos a propósito: las políticas de `properties` las evalúan también para visitantes sin sesión. `my_staff()` sí está restringida a usuarios con sesión.

## Tablas
- **`admins`** (`user_id`) — quién es administrador. RLS activo y **sin políticas**: no se lee desde el navegador, solo vía `is_admin()`.
- **`properties`** — `id, title, description, operation ('Venta'|'Alquiler'), type, price, zone, address, beds, baths, area, published, images text[], advisor_id, contact_whatsapp, created_at, updated_at`.
  - Público: `select` solo de `published = true`. Admin: todo.
  - `updated_at` se actualiza por trigger.
  - `contact_whatsapp` se llena por trigger desde el asesor (no se envía desde el cliente; `saveProperty` lo excluye).
- **`advisors`** — el equipo: `id, name, whatsapp (opcional; solo dígitos 8–15, con código de país), email (único), role, active, assign_weight, user_id, last_assigned_at, created_at`. Lectura: solo el equipo; escritura: solo admin. El nombre y correo **nunca** se exponen al público; por eso el WhatsApp se copia a `properties.contact_whatsapp`.

## Funciones y triggers
- `is_admin()` — `security definer`, usada por todas las políticas. El login (`signIn`) y el guard del router usan `my_staff()`, que además devuelve el rol.
- `touch_updated_at` → `properties_touch`.
- `sync_property_contact` → `properties_sync_contact` (al insertar o cambiar `advisor_id`).
- `propagate_advisor_contact` → `advisors_propagate` (si cambia el WhatsApp del asesor, actualiza todas sus propiedades).

## Storage
Bucket público `property-images`. Lectura pública; insertar/actualizar/borrar solo `is_admin()`.

## CRM (migraciones 004 y 005)
- **`contacts`** (clientes, propietarios, inversionistas; teléfono y correo únicos) · **`leads`** (una oportunidad por contacto: etapa, asesor, fuente, interés, propiedad, UTM, fechas de asignación/primer contacto/cierre) · **`lead_events`** (historial inmutable; base de las métricas) · **`tasks`** (recordatorios).
- Etapas: `nuevo → contactado → seguimiento → cita → negociacion → ganado | perdido`. `perdido` exige `lost_reason`.
- Triggers: fechas derivadas (`assigned_at`, `first_contact_at`, `closed_at`), historial automático de etapa y asignación, y columnas inmutables (`source`, `contact_id`, `created_at`). Las funciones que escriben eventos son `security definer`.
- RLS: la dirección (admin/gerente) ve todo; un asesor solo sus leads y lo que cuelga de ellos, y no puede regalar ni soltar un lead. Los leads **no se insertan** desde la API: nacen en `submit_lead` (sitio público, sin sesión) o `create_lead` (panel).
- Funciones: `submit_lead` (anon + autenticados), `create_lead`, `crm_metrics(desde, hasta)`, `crm_funnel()` (autenticados). Internas, no ejecutables desde la API: `pick_advisor`, `ingest_lead`. `normalize_phone` es pura.
- Asignación: menor carga ponderada (leads de 30 días ÷ peso), desempate por quien lleva más sin recibir; sin asesores activos queda "sin asignar".
- Verificación rápida tras ejecutar las migraciones, en el SQL Editor: `select count(*) from advisors where role = 'admin';` (≥ 1) y `select proname from pg_proc where proname in ('my_staff','submit_lead','create_lead','crm_metrics','crm_funnel');` (5 filas).
- ⚠️ El código del panel de esta rama **requiere** 003 aplicada: `TeamList` y `PropertyForm` leen columnas nuevas de `advisors`. Ejecuta las migraciones **antes** de desplegar o abrir el panel con este código.

## Cuidado
- En Authentication → Providers/Settings conviene **desactivar el registro público** (signups): cualquier usuario con sesión pasa el guard del router (aunque RLS le impida ver o tocar datos).
- Plan gratuito: 1 GB de Storage (por eso la compresión de fotos).
