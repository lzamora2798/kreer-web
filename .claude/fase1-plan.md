# Fase 1 · Base del CRM — plan de implementación

Parte de [plan-crm.md](plan-crm.md) y del código actual. Es un documento vivo: marca cada casilla al terminarla.

## 0. Alcance

**Entra:** roles y login por asesor · contactos y leads reales · el formulario web crea leads · asignación automática · Kanban + lista · ficha del lead con historial · tareas y recordatorios · agenda · clientes · panel del asesor · dashboard gerencial básico · menú lateral por rol · avisos en vivo dentro del panel.

**No entra (fases siguientes):** WhatsApp/Instagram, correos de aviso, tabla de citas, ventas y comisiones, captación de propietarios, proformas, comparador, SEO/Nuxt, pantalla para configurar etapas o reglas.

## 1. Decisiones (defaults recomendados; cámbialos antes de empezar a codificar)
| # | Tema | Decisión | Por qué |
|---|---|---|---|
| D1 | Tabla de equipo | **Se extiende `advisors`** (no se crea `staff`); en la interfaz pasa a llamarse "Equipo" | `properties.advisor_id`, los triggers de WhatsApp y `lib/advisors.ts` ya dependen de ella; renombrarla rompe más de lo que aporta |
| D2 | Roles | `admin`, `gerente`, `asesor`. Admin y gerente ven todo; **solo admin** crea/edita/desactiva al equipo | Mínimo útil; los permisos finos pueden esperar |
| D3 | Acceso de asesores | El admin registra al asesor en **Equipo** (con correo) y lo invita desde Supabase → Authentication → Users. En su primer ingreso, `my_staff()` vincula su usuario por **correo verificado** | No requiere servidor ni Edge Functions. Más adelante se puede automatizar la invitación |
| D4 | Etapas del pipeline | `nuevo → contactado → seguimiento → cita → negociacion → ganado / perdido`. *Asignado* **no** es etapa: es el campo `advisor_id` + un evento | Si todo lead se asigna al llegar, "asignado" sería una columna siempre vacía |
| D5 | Asignación | Automática: gana el asesor activo con **menor carga ponderada** (leads recibidos en 30 días ÷ `assign_weight`); empate → quien lleva más tiempo sin recibir. Sin asesores activos el lead queda **sin asignar** y la gerencia lo ve | Reparto justo y explicable |
| D6 | Cliente repetido | Se busca por teléfono o correo. Si ya tiene un lead abierto **no se crea otro**: se agrega una nota con el nuevo mensaje | Evita duplicados y que dos asesores atiendan al mismo cliente |
| D7 | Citas | Sin tabla propia: la etapa `cita` + tareas de tipo `visita` | La tabla `appointments` llega en la Fase 3 |
| D8 | Avisos al asesor | Solo dentro del panel (Realtime + contador + título de pestaña) | Correo/WhatsApp dependen de servicios externos (Fase 5) |
| D9 | Arrastrar tarjetas | HTML5 nativo, **sin librerías**; en móvil, selector de etapa | El drag nativo no funciona con touch; no se suma dependencia |
| D10 | Gráficos | HTML/CSS/SVG simple, sin librería | Dashboard básico; si se necesita más, cargar el skill `dataviz` |

## 2. Base de datos — 3 migraciones nuevas
Se ejecutan **una vez, en orden**, en Supabase → SQL Editor (igual que `002_asesores.sql`). Son aditivas e idempotentes (`if not exists`, `create or replace`, `drop policy if exists`). No tocan datos existentes.

### `supabase/003_roles.sql` — roles y vínculo con usuarios
- [x] `advisors` + columnas: `user_id` (único, → `auth.users`), `role` (`admin|gerente|asesor`, default `asesor`), `active` (default `true`), `assign_weight` (1–10, default 1), `last_assigned_at`.
- [x] `advisors.whatsapp` pasa a **nullable** (admin/gerente no siempre tienen). Índice único `lower(email)` cuando no está vacío.
- [x] **Sembrar** desde `admins`: cada admin actual pasa a ser fila de `advisors` con `role='admin'` y su `user_id` (nombre provisional = parte local del correo).
- [x] Funciones (`security definer`, `stable`, `set search_path = public`): `staff_role()`, `current_advisor_id()`, `is_staff()`, `is_manager()` (admin|gerente), `can_manage_team()` (admin).
- [x] **`is_admin()` se redefine** = `is_manager()` **o** existe en la tabla legada `admins`. El respaldo legado evita bloquear a nadie si el sembrado falla. Así siguen funcionando, sin tocarlas, las políticas de `properties` y de Storage.
- [x] Políticas de `advisors`: lectura para cualquier staff; escritura solo `can_manage_team()` (se elimina `admin all advisors`).
- [x] Política nueva en `properties`: **staff puede leer todas** (borradores incluidos), para que el asesor vea el catálogo.
- [x] `my_staff()` — `security definer`: si el usuario tiene `advisors.user_id` la devuelve; si no, vincula la fila con su correo **solo si el correo está confirmado** (`auth.users.email_confirmed_at`) y `active`. Devuelve `id, name, role, active`.
- [x] **Agregado:** trigger `advisors_keep_admin` (no deja desactivar, degradar ni borrar al último admin) y, en `my_staff()`, auto-alta de un admin legado que se agregue a la tabla `admins` después de la migración.
- Estado: **hecha y probada** (16 pruebas en `003_roles.test.mjs`). Pendiente: ejecutarla en el Supabase real.

### `supabase/004_crm_core.sql` — tablas, triggers, RLS
| Tabla | Columnas clave |
|---|---|
| `contacts` | `name`, `phone` (dígitos con país), `email`, `kind` (`cliente|propietario|inversionista`), `notes`, `created_by`; únicos parciales por `phone` y `lower(email)` |
| `leads` | `contact_id`, `advisor_id` (null = sin asignar), `source` (`web|instagram|whatsapp|referido|manual|otro`), `interest` (`comprar|alquilar|vender|invertir`), `property_id`, `stage`, `lost_reason`, `message`, `utm jsonb`, `assigned_at`, `first_contact_at`, `closed_at`, `last_activity_at`, `created_at`, `updated_at` |
| `lead_events` | `lead_id` (cascade), `advisor_id` (null = sistema), `kind` (`nota|llamada|whatsapp|correo|visita|cambio_etapa|asignacion|sistema`), `direction` (`entrante|saliente`), `body`, `from_stage`, `to_stage`, `meta jsonb`, `created_at`. **Inmutable**: sin políticas de update ni delete |
| `tasks` | `lead_id` (opcional), `advisor_id`, `title`, `kind` (`llamar|whatsapp|correo|visita|otro`), `due_at`, `done_at`, `created_by` |

- [x] Restricción: `stage = 'perdido'` exige `lost_reason`.
- [x] Índices: `leads(advisor_id, stage)`, `leads(stage)`, `leads(created_at)`, `lead_events(lead_id, created_at desc)`, `lead_events(kind, created_at)`, `tasks(advisor_id, due_at) where done_at is null`.
- [x] **Triggers** (las funciones que escriben eventos son `security definer`, si no RLS las bloquea):
  - `leads` antes de insertar/actualizar: `assigned_at` al cambiar de asesor; `closed_at` al pasar a ganado/perdido (y se limpia al reabrir); `first_contact_at` al pasar a cualquier etapa **distinta de `nuevo` y `perdido`**; `last_activity_at`/`updated_at`; `created_at`, `source` y `contact_id` inmutables.
  - `leads` después: evento `cambio_etapa` al cambiar de etapa, `asignacion` al cambiar de asesor, `sistema` al crearse.
  - `lead_events` después de insertar: sube `last_activity_at` y fija `first_contact_at` si el evento es `llamada|whatsapp|correo|visita`.
- [x] **RLS** (todas con RLS activo):
  - `leads`: asesor lee/actualiza `advisor_id = current_advisor_id()` y su `with check` impide pasárselo a otro; manager todo; borrar solo manager. Insertar solo por RPC.
  - `contacts`: manager todo; asesor los de sus leads o creados por él.
  - `lead_events`: lee quien ve el lead; inserta staff solo tipos manuales (`nota|llamada|whatsapp|correo|visita`) en leads que puede ver.
  - `tasks`: asesor las suyas; manager todas.
- [x] Realtime: `alter publication supabase_realtime add table public.leads` (dentro de un `do $$` que no falle si ya está).
- [x] **Cambios respecto a lo planeado:** `lead_events.seq` (identidad) desempata eventos con la misma marca de tiempo; el historial se ordena por `created_at, seq`. `lead_events.created_at` usa `clock_timestamp()`. Las llamadas/WhatsApp **entrantes** y las notas no cuentan como primer contacto; una **visita** sí.
- Estado: **hecha y probada** (29 pruebas en `004_crm_core.test.mjs`). Pendiente: ejecutarla en el Supabase real.

### `supabase/005_crm_functions.sql` — lógica de negocio
- [x] Todas con `set search_path = public`. Las internas: `revoke execute … from public, anon, authenticated` (en Postgres las funciones son ejecutables por todos por defecto).
- [x] `pick_advisor()` *(interna)* — aplica D5; usa `pg_advisory_xact_lock` para que dos leads simultáneos no se asignen igual; actualiza `last_assigned_at`.
- [x] `ingest_lead(...)` *(interna)* — normaliza, busca/crea contacto, aplica D6, crea lead, asigna, devuelve `{lead_id, status: 'created'|'existing'}`.
- [x] **`submit_lead(p_name, p_email, p_phone, p_interest, p_message, p_property_id, p_utm, p_website)`** — `grant execute … to anon`. Valida longitudes y formato; si `p_website` (honeypot) trae algo, responde éxito sin guardar; fuente `web`.
- [x] **`create_lead(...)`** — solo staff; fuente `manual`; asesor = quien lo crea (o el elegido, si es manager). Si el cliente ya lo atiende otro asesor, devuelve error claro con su nombre.
- [x] **`crm_metrics(p_from, p_to)`** — *security invoker* (RLS limita lo que cada rol ve). Una fila por asesor (+ fila "sin asignar") con: recibidos, contactados, tiempo medio de respuesta (`first_contact_at − assigned_at`), llamadas, seguimientos (llamada/whatsapp/correo/visita **salientes**), visitas, negociaciones (leads que pasaron a `negociacion` en el periodo), ganados, perdidos.
- [x] **`crm_funnel()`** — leads actuales por etapa (también *security invoker*).
- [x] **Cambios respecto a lo planeado:**
  - `normalize_phone()` (nueva): el **servidor** normaliza teléfonos con la misma regla que `normalizeWhatsapp()` de la app (Ecuador por defecto). Sin esto, `0987654321` y `+593 98 765 4321` creaban dos contactos.
  - D6 afinada: mismo contacto **y mismo interés** con lead abierto → nota; **otro interés** → lead nuevo, pero **con el mismo asesor** que ya lo atiende.
  - Freno anti-repetición: máximo 3 notas entrantes por lead en 10 minutos (las demás se ignoran). Un formulario público sigue siendo abusable con contactos falsos distintos; el captcha queda como endurecimiento futuro.
  - El reparto es por **menor carga**, así que un asesor nuevo (o que vuelve de vacaciones) recibe leads seguidos hasta igualar al resto.
  - `crm_metrics`: *recibidos, contactados y tiempo de respuesta* cuentan leads que **llegaron** en el periodo; *llamadas, seguimientos, visitas, negociaciones, ganados y perdidos* cuentan lo que **ocurrió** en el periodo. *Seguimientos* = contactos salientes posteriores al primer contacto. La conversión de la interfaz (ganados ÷ recibidos del periodo) es una aproximación.
- Estado: **hecha y probada** (33 pruebas en `005_crm_functions.test.mjs`; 78 en total con `npm run test:db`). Pendiente: ejecutarla en el Supabase real.

## 3. Frontend — cambios sobre el código existente
| Archivo | Cambio |
|---|---|
| [src/lib/supabase.ts](../src/lib/supabase.ts) | Exportar `db()` (hoy duplicado en `properties.ts` y `advisors.ts`); las libs nuevas lo usan |
| [src/lib/auth.ts](../src/lib/auth.ts) | Añadir `staff` (ref), `role`, `isManager`, `isAdmin`. `signIn` valida con `my_staff()` en vez de `is_admin`. `initAuth` carga `staff` tras la sesión. ⚠️ En `onAuthStateChange` **no** esperar llamadas a Supabase dentro del callback (bloquea el cliente): usar `setTimeout(…, 0)` |
| [src/router.ts](../src/router.ts) | Reordenar rutas (§4). El guard: sin sesión → login; sesión sin `staff` activo → cerrar sesión y login; `meta.roles` no cumplido → `/admin` |
| [src/lib/advisors.ts](../src/lib/advisors.ts) | `Advisor` + `role, active, assign_weight, user_id`; `whatsapp` opcional (validar solo si viene); `listAdvisors` y `saveAdvisor` con los campos nuevos |
| [src/views/admin/AdminLayout.vue](../src/views/admin/AdminLayout.vue) | `nav` con secciones (CRM / Catálogo / Administración), `roles` por ítem, contador de leads nuevos y rol del usuario en el pie |
| [src/views/admin/AdvisorList.vue](../src/views/admin/AdvisorList.vue) | Pasa a `TeamList.vue` (ruta `equipo`): rol, activo, peso, estado "con acceso / pendiente de ingreso" e instrucciones de invitación. Solo admin edita |
| [src/views/admin/PropertyList.vue](../src/views/admin/PropertyList.vue) | Ocultar crear/editar/eliminar/publicar para `asesor` (solo lectura) |
| [src/views/admin/PropertyForm.vue](../src/views/admin/PropertyForm.vue) | `router.replace('/admin')` y el enlace "← Volver" apuntan ahora a `/admin/propiedades`; el selector de asesor lista solo activos **con WhatsApp** |
| [src/components/ContactForm.vue](../src/components/ContactForm.vue) | Reemplazar el `fetch` a `VITE_API_URL` por `supabase.rpc('submit_lead')`; campo honeypot oculto; guardar `utm_*` de la URL; precargar propiedad; mostrar el error real; sin Supabase se mantiene el envío simulado |
| [src/components/FeaturedProperties.vue](../src/components/FeaturedProperties.vue) | "Solicitar información" fija la propiedad en un estado compartido (`src/lib/contact.ts`) antes de ir a `#contacto` |
| [src/style.css](../src/style.css) | Utilidades `.panel` y `.badge` (hoy se repite `border border-line bg-white p-6`) |
| `.env` | `VITE_API_URL` deja de usarse |

**Archivos nuevos**
- Libs: `src/lib/leads.ts`, `contacts.ts`, `tasks.ts`, `metrics.ts`, `format.ts` (fechas es-EC, "hace 2 h", duración), `contact.ts` (propiedad seleccionada), `crm.ts` (constantes: etapas con etiqueta y color, fuentes, intereses, motivos de pérdida, tipos de evento).
- Vistas (`src/views/admin/`): `DashboardView.vue` (asesor o gerencial según rol), `LeadBoard.vue`, `LeadDetail.vue`, `LeadForm.vue`, `ContactList.vue`, `ContactDetail.vue`, `AgendaView.vue`, `TeamList.vue`.
- Componentes (`src/components/admin/`): `StageBadge.vue`, `LeadCard.vue`, `LeadTimeline.vue`, `KpiTile.vue`, `BarList.vue`, `LostReasonDialog.vue`.
- TypeScript: el proyecto usa `erasableSyntaxOnly` y `noUnusedLocals`. **Nada de `enum`**; usar uniones de cadenas y `as const`. Un import sin usar rompe `npm run build`.

## 4. Rutas y menú
| Ruta | Vista | Roles |
|---|---|---|
| `/admin` | `DashboardView` | todos |
| `/admin/leads` · `/admin/leads/nuevo` · `/admin/leads/:id` | `LeadBoard` · `LeadForm` · `LeadDetail` | todos |
| `/admin/clientes` · `/admin/clientes/:id` | `ContactList` · `ContactDetail` | todos |
| `/admin/agenda` | `AgendaView` | todos |
| `/admin/propiedades` · `…/nueva` · `…/:id` | `PropertyList` · `PropertyForm` | todos ven; solo manager edita |
| `/admin/equipo` | `TeamList` | admin, gerente (solo admin escribe) |
| `/admin/asesores` | redirige a `/admin/equipo` | — |

Menú: **CRM** (Resumen, Leads, Clientes, Agenda) · **Catálogo** (Propiedades) · **Administración** (Equipo).

## 5. Pantallas
- **Resumen (asesor):** leads nuevos sin contactar (con antigüedad), tareas vencidas y de hoy, mis cifras del periodo, mis leads por etapa.
- **Resumen (gerencia):** selector de periodo (7 / 30 / 90 días / mes); fichas: recibidos, sin asignar (hoy), contactados %, tiempo medio de respuesta, en negociación, ganados, perdidos, conversión; tabla por asesor; embudo por etapa; leads por fuente.
- **Leads:** alternar Kanban / Lista (en móvil, Lista por defecto). Filtros: asesor (solo manager), fuente, interés, búsqueda, "sin asignar", "sin contactar". Tarjeta con nombre, interés, propiedad, antigüedad y asesor. Semáforo: `nuevo` sin contactar > 30 min ámbar, > 2 h rojo (constantes en `crm.ts`). Arrastrar cambia de etapa; **perdido pide motivo**. Ganado/perdido solo muestran los últimos 30 días.
- **Ficha del lead:** datos editables del contacto con botones Llamar (`tel:`), WhatsApp (`wa.me`, reutilizando `whatsappLink`) y Correo; etapa; asesor (reasignar: solo manager); propiedad de interés; **línea de tiempo** con compositor (nota / llamada / WhatsApp / correo / visita, entrante o saliente); tareas del lead con atajos "en 1 día / 3 días / elegir fecha".
- **Agenda:** Vencidas · Hoy · Mañana · Próximos 7 días; completar con un clic; crear tarea (con lead opcional); el manager filtra por asesor.
- **Clientes:** lista con búsqueda; ficha con datos y sus leads.
- **Equipo:** ver D2 y D3.

## 6. Orden de construcción
Cada paso termina con `npm run build` en verde y, si toca la base de datos, su verificación (§7). **No avanzar si el paso anterior falla.**

| # | Paso | Tam. | Punto de control |
|---|---|:-:|---|
| 0 ✅ | `git init`, `.env` en `.gitignore`, primer commit | S | Hay historial para volver atrás |
| 1 ✅ | Migración **003** + vista **Equipo** (`TeamList`) | M | Los admins de hoy siguen entrando y editando propiedades |
| 2 | `auth.ts` con `staff`/roles, `signIn` con `my_staff`, guard por rol | M | Un asesor de prueba entra; un usuario sin fila en Equipo es rechazado |
| 3 | Reordenar rutas (`/admin/propiedades`), menú lateral por rol, arreglar enlaces de `PropertyForm`/`PropertyList` | S | Navegación completa y lectura sola para asesor |
| 4 ✅ | Migración **004** (tablas, triggers, RLS) | L | Pruebas SQL de RLS y triggers |
| 5 ✅ | Migración **005** (funciones) | L | Pruebas SQL de asignación, duplicados y métricas |
| 6 | `ContactForm` → `submit_lead` + honeypot + UTM + propiedad precargada | M | Una consulta real aparece en `leads`, asignada |
| 7 | `leads.ts` + **Lista** de leads + **ficha** con línea de tiempo y compositor + `LeadForm` manual | L | Mover etapa, anotar, reasignar; todo queda en el historial |
| 8 | **Kanban** con drag nativo y diálogo de motivo de pérdida | M | Mover de columna = mover de etapa |
| 9 | **Tareas** y **Agenda** (+ tareas dentro de la ficha) | M | Una tarea vencida se ve en Agenda y en Resumen |
| 10 | **Clientes** (lista y ficha) | S | — |
| 11 | **Resumen** del asesor y **dashboard gerencial** | L | Las cifras coinciden con un conteo manual |
| 12 | **Avisos en vivo** (Realtime): toast, contador en el menú, título de pestaña | S | Un lead nuevo aparece sin recargar |
| 13 | Pulido: estados vacíos, errores, móvil, actualizar `.claude/*` y esta lista | S | Recorrido final por rol |

## 7. Verificación
**Base de datos** (la parte donde un error es más caro):
- [x] **Arnés local con PGlite** (Postgres en WebAssembly, sin Docker): `supabase/tests/00_harness.sql` simula roles, `auth` y `storage` de Supabase; `helpers.mjs` aplica `schema.sql` + migraciones y ejecuta consultas como `anon`/`authenticated` con un usuario dado. Se corre con **`npm run test:db`**. Cada migración nueva trae su `NNN_*.test.mjs`; se comprobó que las pruebas fallan si se rompe la migración a propósito.
- [x] Pruebas de 004 y 005 (`004_*.test.mjs`, `005_*.test.mjs`): crea 1 admin y 2 asesores, ejecuta `submit_lead` como `anon` varias veces y comprueba reparto, duplicado → nota, honeypot ignorado, **aislamiento** (A no ve leads de B; manager ve todo), perdido sin motivo → error, eventos y `first_contact_at`, y `crm_metrics`. Termina con `rollback`.
- [ ] Antes de ejecutar en el Supabase real: exportar `properties` y `advisors` (no hay copias automáticas en el plan gratuito).

**Interfaz:**
- [ ] `npm run build` limpio en cada paso.
- [ ] Recorrido manual con 3 usuarios reales de prueba: admin, gerente, asesor A y asesor B (hace falta crearlos en Supabase).
- [ ] Opcional: Vitest para funciones puras (`normalizeWhatsapp`, `formatPrice`, reglas de etapa, `timeAgo`).

## 8. Criterios de terminado
1. Un visitante envía el formulario → aparece un lead **asignado** en pocos segundos, con su historial.
2. El mismo cliente escribe de nuevo con un lead abierto → **no** se duplica; queda una nota.
3. El asesor A **no** ve leads ni clientes del asesor B (comprobado en SQL y en la interfaz).
4. La gerencia ve todo y puede reasignar; la reasignación queda registrada.
5. Todo cambio de etapa queda en el historial; `perdido` exige motivo.
6. Las tareas vencidas aparecen en Agenda y en Resumen.
7. Las cifras del dashboard coinciden con un conteo manual sobre datos de prueba.
8. Las funciones de hoy (propiedades, asesores, fotos, WhatsApp en tarjetas) siguen funcionando.
9. `npm run build` pasa.

## 9. Riesgos
| Riesgo | Mitigación |
|---|---|
| Quedarse sin acceso al migrar los roles | `is_admin()` conserva el respaldo de la tabla `admins`; no se borra hasta confirmar |
| Un trigger que escribe eventos falla por RLS | Funciones de trigger `security definer` + prueba específica |
| Alguien se registra con el correo de un asesor y reclama su cuenta | `my_staff()` exige correo **confirmado**; además desactivar el registro público en Supabase Auth |
| Spam o abuso de `submit_lead` (llamable sin sesión) | Honeypot, validación, deduplicación; endurecer con captcha (p. ej. Cloudflare Turnstile) si aparece abuso |
| `onAuthStateChange` bloquea el cliente de Supabase | No esperar llamadas dentro del callback |
| Realtime no entrega cambios | La tabla debe estar en la publicación y la sesión debe tener permiso (RLS aplica) |
| Plan gratuito de Supabase: proyectos inactivos se pausan y no hay respaldos | Un CRM en producción debe ir en plan de pago y en una cuenta de KREER — **verificar condiciones vigentes** |
| Husos horarios | Todo `timestamptz`; "hoy/mañana" se calculan en el navegador (Ecuador no cambia de hora); los periodos de métricas viajan como ISO explícito |
| Desvío respecto a [plan-crm.md](plan-crm.md) (etapas, `advisors` en vez de `staff`) | Ya actualizado allí |

## 10. Qué necesito de ti para empezar
1. ¿Confirmas las decisiones D1–D10, o cambias alguna?
2. ¿El proyecto de Supabase ya está en uso? ¿Tiene datos reales? ¿Está en una cuenta de KREER o tuya? (define el cuidado al migrar)
3. ¿Puedes crear en Supabase 3 usuarios de prueba (gerente y dos asesores) cuando lleguemos al paso 2?
4. ¿Abres Docker Desktop para probar las migraciones en local antes de tocar la base real?
5. ¿Hago el `git init` del paso 0 ya?
