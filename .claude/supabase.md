# Supabase

Variables en `.env` (nunca documentar sus valores): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (opcional; ver "Leads" en [pendientes.md](pendientes.md)).

## Orden de puesta en marcha
1. Supabase → SQL Editor: ejecutar `supabase/schema.sql`, luego `supabase/002_asesores.sql` (una sola vez cada uno; son idempotentes en lo posible).
2. Authentication → Users: crear el usuario administrador.
3. Autorizarlo:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'TU_CORREO@dominio.com';
   ```
4. Cada migración nueva va como `supabase/00N_nombre.sql`, comentada en español y con encabezado "Ejecútalo UNA vez…".

## Tablas
- **`admins`** (`user_id`) — quién es administrador. RLS activo y **sin políticas**: no se lee desde el navegador, solo vía `is_admin()`.
- **`properties`** — `id, title, description, operation ('Venta'|'Alquiler'), type, price, zone, address, beds, baths, area, published, images text[], advisor_id, contact_whatsapp, created_at, updated_at`.
  - Público: `select` solo de `published = true`. Admin: todo.
  - `updated_at` se actualiza por trigger.
  - `contact_whatsapp` se llena por trigger desde el asesor (no se envía desde el cliente; `saveProperty` lo excluye).
- **`advisors`** — `id, name, whatsapp (solo dígitos 8–15, con código de país), email, created_at`. Solo admin (RLS `for all`). El nombre y correo **nunca** se exponen al público; por eso el WhatsApp se copia a `properties.contact_whatsapp`.

## Funciones y triggers
- `is_admin()` — `security definer`, usada por todas las políticas y por `signIn`.
- `touch_updated_at` → `properties_touch`.
- `sync_property_contact` → `properties_sync_contact` (al insertar o cambiar `advisor_id`).
- `propagate_advisor_contact` → `advisors_propagate` (si cambia el WhatsApp del asesor, actualiza todas sus propiedades).

## Storage
Bucket público `property-images`. Lectura pública; insertar/actualizar/borrar solo `is_admin()`.

## Cuidado
- En Authentication → Providers/Settings conviene **desactivar el registro público** (signups): cualquier usuario con sesión pasa el guard del router (aunque RLS le impida ver o tocar datos).
- Plan gratuito: 1 GB de Storage (por eso la compresión de fotos).
