# Plan: Panel administrativo + CRM

Salido de los tres PDF de la raíz del proyecto. El CRM vive **dentro del mismo panel `/admin`**, con el mismo menú lateral; lo que ve cada persona depende de su rol.

## 1. Qué dice cada documento
| PDF | Qué aporta |
|---|---|
| `PROPUESTA DE DESARROLLO (1).pdf` | Requerimiento original de KREER: 8 módulos (web, portal, CRM, panel de asesores, panel gerencial, captación de propietarios, métricas, WhatsApp). Objetivo: *Marketing → Web → Portal → Lead → CRM → Asesor → Seguimiento → Visita → Negociación → Cierre*. Debe ser escalable (WhatsApp, IA, firma electrónica, app móvil) **sin reconstruir**. |
| `Revision de propuesta EZTA.pdf` | Respuesta de KREER a la propuesta económica de EZTA: faltaban el CRM (asignación automática, pipeline, historial), los paneles (métricas, asesores, gerencia), las herramientas del portal (filtros avanzados, comparador con estructura dinámica por propiedad, ficha con mapas/videos/planos, **generador de proformas**), el flujo WhatsApp↔CRM (registrar la conversación en la ficha del lead y avisar al asesor) y la **titularidad del código**. |
| `Revision de propuesta de desarrollo.pdf` (8-sep-2026) | KREER exige el alcance **completo, no solo MVP/demo**, y pide **definir qué es Demo/MVP y qué es producto final**. Agrega: **URLs individuales por propiedad indexables en Google** (ej. `kreer.ec/propiedades/casa-ciudad-celeste`), agendamiento de visitas, recordatorios y agenda, titularidad total (código, repo, BD, infraestructura, credenciales) y **costos recurrentes** más allá del hosting estimado de $10–20/mes. |

## 2. Hallazgos que cambian la arquitectura
1. **SEO por propiedad vs. SPA actual.** Hoy el sitio es una SPA de Vite (todas las rutas sirven `index.html`, ver `vercel.json`). Google puede indexarla con limitaciones, pero **WhatsApp/Facebook/Instagram no ejecutan JavaScript**: al compartir `/propiedades/casa-ciudad-celeste` mostrarían la tarjeta genérica del sitio, no la foto y el precio de esa casa. Hace falta HTML renderizado en servidor por propiedad (título, descripción, Open Graph, JSON-LD, `sitemap.xml`). Opciones:
   - **A (recomendada): Nuxt 3** para el sitio público (SSR/ISR en Vercel) y `/admin/**` como SPA (`ssr: false`). Es Vue, así que los componentes actuales se reutilizan.
   - B: mantener Vite y añadir una función serverless de Vercel que devuelva el HTML con meta tags para `/propiedades/*`. Más parche, menos limpio.
   - Requiere además `properties.slug` único.
   - **Esto conviene decidirlo antes de construir el portal**, porque cambia la estructura del frontend.
2. **Roles.** Hoy solo existe `admins`. El CRM necesita al menos `admin`, `gerente` y `asesor`, y que **cada asesor tenga su propio login** (hoy `advisors` es solo una tabla de contacto sin usuario). Un asesor debe ver únicamente sus leads/clientes/tareas; la gerencia ve todo. Se resuelve con RLS en Supabase.
3. **Titularidad.** Supabase, Vercel, el repositorio Git y el dominio deben crearse bajo cuentas/organizaciones **de KREER**, no personales. Hoy el proyecto ni siquiera está en git (ver [pendientes.md](pendientes.md)).
4. **WhatsApp e Instagram son lo más caro y riesgoso.** Requiere la API oficial (WhatsApp Business Platform de Meta, con verificación del negocio, plantillas aprobadas y costo por conversación, a veces vía un proveedor tipo Twilio/360dialog) y un endpoint que reciba webhooks (Edge Function de Supabase o función de Vercel). Es independiente del resto: conviene dejarlo para una fase propia.
5. **Todo se mide con eventos.** Las métricas del documento (tiempo de respuesta, llamadas, seguimientos, conversión…) solo se pueden calcular si desde el día uno se guardan **marcas de tiempo e historial de etapas**. Diseñar el modelo de datos pensando en eso evita rehacerlo.
6. **Propiedades con estructura dinámica.** "Comparador… estructura dinámica para cada propiedad" implica que un terreno, una casa y un local no comparten los mismos campos. Propuesta: columnas comunes + `attributes jsonb` y una tabla de definición de campos por tipo.

## 3. Menú lateral por rol
`AdminLayout.vue` ya tiene el menú; se agregan ítems al arreglo `nav` filtrados por rol.

| Ítem | Asesor | Gerencia / Admin | Contenido |
|---|:-:|:-:|---|
| Resumen | ✅ (el suyo) | ✅ (global) | Asesor: leads nuevos, tareas de hoy, citas, sus cifras. Gerencia: dashboard visual con todas las métricas. |
| Leads | ✅ (asignados) | ✅ (todos) | Tablero Kanban por etapa + lista, filtros, asignar/reasignar. |
| Clientes | ✅ | ✅ | Contactos (compradores, propietarios, inversionistas) con historial completo. |
| Agenda | ✅ | ✅ | Citas/visitas + tareas y recordatorios. |
| Propiedades | ✅ (lectura) | ✅ | Ya existe. Se amplía: slug, video, planos, ubicación, campos dinámicos. |
| Captaciones | ✅ | ✅ | Propietarios que quieren vender/alquilar → se convierten en propiedad. |
| Proformas | ✅ | ✅ | Generar y enviar proformas por lead/propiedad. |
| Conversaciones | ✅ | ✅ | WhatsApp por lead (fase WhatsApp). |
| Ventas y comisiones | ✅ (las suyas) | ✅ | Cierres, monto, comisión por asesor. |
| Equipo | ❌ | ✅ | Hoy "Asesores": ahora con usuario, rol, activo/inactivo y peso de asignación. |
| Métricas | ❌ | ✅ | Reportes por asesor/periodo/fuente. |
| Configuración | ❌ | ✅ | Reglas de asignación, etapas, fuentes, motivos de pérdida. |

## 4. Modelo de datos propuesto (Supabase)
Nuevas tablas, todas con RLS por rol. Convención: migración `supabase/00N_*.sql`.
- **Equipo** — no hay tabla `staff`: se **extiende `advisors`** con `user_id` (auth), `role` (`admin|gerente|asesor`), `active`, `assign_weight`. `admins` queda como respaldo legado. Detalle en [fase1-plan.md](fase1-plan.md).
- **`contacts`** — `name, phone (también WhatsApp), email, kind (cliente|propietario|inversionista)`.
- **`leads`** — `contact_id, source (web|instagram|whatsapp|captacion|manual), interest (comprar|alquilar|vender|invertir), property_id, advisor_id, stage, assigned_at, first_contact_at, closed_at, lost_reason`.
- **`lead_events`** — historial inmutable: `lead_id, staff_id, kind (llamada|whatsapp|correo|nota|visita|cambio_etapa|asignacion), direction, body, from_stage, to_stage, created_at`. **Base de las métricas.**
- **`tasks`** — `lead_id, staff_id, title, due_at, done_at` (recordatorios).
- **`appointments`** — `lead_id, property_id, staff_id, starts_at, status (programada|realizada|cancelada|no_asistio)`.
- **`captations`** — datos del propietario y de la propiedad, fotos, precio esperado, operación, `status (nueva|en_revision|publicada|rechazada)`, `property_id` al publicarse.
- **`proformas`** — `lead_id, property_id, staff_id, items jsonb, total, pdf_url, sent_at`.
- **`deals`** — `lead_id, property_id, staff_id, amount, commission_pct, commission_amount, closed_at`.
- **`whatsapp_messages`** — `lead_id, direction, body, wa_message_id, created_at` (fase WhatsApp).
- **`properties`** (ampliar) — `slug` único, `video_url`, `floor_plans text[]`, `lat`, `lng`, `attributes jsonb`.
- Configuración: `pipeline_stages`, `assignment_rules`, `property_type_fields`.

**Asignación automática:** función Postgres disparada al insertar un lead, así funciona igual para web, WhatsApp o Instagram. Empezar con *round-robin* entre asesores activos, ponderado por `assign_weight`; luego reglas por zona/tipo. Registra el evento `asignacion` y avisa al asesor.

**Pipeline:** `Nuevo → Contactado → Seguimiento → Cita/Visita → Negociación → Cierre (ganado | perdido)`. La asignación a un asesor no es una etapa: es el campo `advisor_id` y un evento `asignacion`. Cada cambio de etapa se guarda en `lead_events`.

## 5. Cómo se calcula cada métrica del PDF
| Métrica | Fuente |
|---|---|
| Leads recibidos | `count(leads)` por `created_at` / asesor / fuente |
| Leads contactados | leads con `first_contact_at` no nulo |
| Tiempo de respuesta | `first_contact_at − assigned_at` |
| Llamadas, seguimientos | `lead_events` por `kind` |
| Citas, visitas | `appointments` por `status` |
| Captaciones | `captations` |
| Negociaciones | leads que pasaron a la etapa Negociación (`lead_events`) |
| Cierres, comisiones | `deals` |
| Conversión | cierres ÷ leads |
Se exponen como vistas SQL (`v_metrics_asesor`, …) para que el dashboard solo las consulte.

## 6. Fases propuestas (MVP vs. producto final)
Tamaños relativos: S / M / L. La numeración de fases del código (Fase 2 = portal con filtros, Fase 6 = captación) viene de un plan previo que no está en el repo; ajustar cuando se tenga.

| Fase | Contenido | Tam. |
|---|---|:-:|
| **1 · Base del CRM (MVP)** — plan detallado en [fase1-plan.md](fase1-plan.md) | Roles y login por asesor · tabla `leads`/`contacts`/`lead_events` · el formulario web crea leads reales (hoy se pierden) · asignación round-robin · Kanban · notas e historial · tareas/recordatorios · panel del asesor · dashboard gerencial básico · menú por rol | L |
| **2 · Portal público** | Decisión Nuxt/SSR · slug y URLs `/propiedades/:slug` · filtros avanzados · ficha (fotos, video, planos, mapa) · sitemap/OG/JSON-LD · solicitar información ligada a la propiedad | L |
| **3 · Agenda y proformas** | Citas/visitas (también agendables desde la web) · agenda unificada · generador de proformas en PDF · favoritos y comparador | M |
| **4 · Captación y comisiones** | Formulario de captación → CRM → propiedad · "¿cuánto vale mi propiedad?" (opcional) · ventas y comisiones | M |
| **5 · WhatsApp / Instagram** | WhatsApp Business API · webhook · conversación en la ficha del lead · aviso al asesor · plantillas · leads de Instagram | L |
| **6 · Métricas avanzadas y web corporativa** | Reportes y productividad · blog · páginas Quiénes somos/Equipo · pulido | M |
| **Futuro** | IA, firma electrónica, app móvil (una PWA instalable puede adelantar la móvil con notificaciones) | — |

## 7. Costos recurrentes a aclarar (KREER los pidió)
Más allá del hosting de $10–20/mes: Supabase plan Pro si el proyecto crece o para evitar pausas del plan gratuito, dominio `.ec`, **WhatsApp Business API** (costo por conversación + proveedor), envío de correos (p. ej. Resend), mapas (Google Maps tiene cuota de pago; Leaflet+OpenStreetMap es gratis), almacenamiento de fotos (1 GB gratis) y videos (mejor incrustar YouTube/Vimeo). **Verificar precios vigentes de cada servicio antes de cotizar.**

## 8. Decisiones abiertas
1. ¿Se entrega el alcance completo o primero un MVP? KREER pidió dejar clara la línea. Propuesta: Fase 1 + 2 = MVP.
2. ¿Nuxt (SSR) para el sitio público? Recomendado, ver §2.
3. ¿Quién crea las cuentas (Supabase, Vercel, GitHub, dominio) y a nombre de quién? Debe ser KREER.
4. ¿Los leads pueden reasignarse a mano o solo automático? ¿Qué pasa si un asesor no responde en X horas?
5. ¿Cómo se calculan las comisiones (porcentaje fijo, escalonado, dividido entre captador y vendedor)?
6. ¿Número de WhatsApp Business ya verificado con Meta? ¿Cuántos asesores usarán el CRM?
7. ¿Dónde está el documento de "características recomendadas" y el plan de fases del desarrollador (la carta a Juan lo menciona)?
