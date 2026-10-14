# KREER Web

Sitio público + panel de administración de **KREER Grupo Inmobiliario** (Ecuador, precios en USD). Hoy es un POC: la portada es estática y las propiedades/asesores se gestionan desde `/admin` con Supabase.

## Stack
Vue 3 (`<script setup>` + TypeScript) · Vite · Tailwind 3 · vue-router 4 · Supabase (Auth + Postgres + Storage). Deploy en Vercel (SPA con rewrite a `index.html`).

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm run build` — `vue-tsc -b && vite build` (úsalo para verificar tipos; no hay linter)
- `npm run test:db` — prueba las migraciones y permisos (RLS) en un Postgres en memoria; correrlo antes de ejecutar una migración nueva en Supabase

## Dónde está cada cosa
- `src/views/HomeView.vue` + `src/components/` — sitio público (una sola página con anclas `#propiedades`, `#vender`, `#contacto`…)
- `src/views/admin/` — panel: `AdminLayout` (menú lateral), `LoginView`, `PropertyList`, `PropertyForm`, `TeamList` (equipo y roles)
- `src/lib/` — acceso a datos: `supabase.ts` (cliente, `null` sin env), `auth.ts`, `properties.ts`, `advisors.ts`
- `src/router.ts` — rutas; `/admin/*` exige sesión (`meta.requiresAuth`)
- `supabase/*.sql` — esquema y migraciones numeradas; se ejecutan a mano, en orden, en Supabase → SQL Editor. `supabase/tests/` — pruebas con PGlite

## Convenciones
- Todo el texto de interfaz y los comentarios van **en español**.
- Estilo: clases de Tailwind directas en el template; utilidades propias en `src/style.css` (`btn`, `btn-primary`, `field`, `eyebrow`). Bordes casi rectos (radio 2px). Paleta y tipografías en `tailwind.config.js`.
- Marca: logos en `public/brand/` (no editarlos ni recolorearlos). Color de acción solo `brand-600`; `brand-slate` solo para acentos; sobre fondos oscuros el texto va en `paper`/`greige`, nunca teal. Sin hex en componentes: usar tokens.
- Cada página del admin abre con `<p class="eyebrow">Panel</p>` + `<h1 class="mt-2 text-4xl">`.
- Acceso a datos solo desde `src/lib/*`; las vistas no llaman a `supabase` directamente (excepto `LoginView` para ver si está configurado).
- Si faltan `VITE_SUPABASE_*`, el sitio público cae a datos de ejemplo (`src/data/properties.ts`) y el admin avisa que falta configurar.
- Textos entre corchetes (`[Zona norte]`, `$ [185.000]`) son datos de ejemplo pendientes de confirmar con KREER.
- Nunca escribas valores de `.env` en documentación ni en commits.

## Más contexto
- [.claude/contexto.md](.claude/contexto.md) — negocio, rutas, sistema de diseño, cómo agregar una sección al admin
- [.claude/supabase.md](.claude/supabase.md) — tablas, RLS, storage, puesta en marcha
- [.claude/plan-crm.md](.claude/plan-crm.md) — plan del panel admin + CRM según los PDF de KREER: requisitos, roles, modelo de datos, fases, decisiones abiertas
- [.claude/fase1-plan.md](.claude/fase1-plan.md) — plan de implementación de la Fase 1 (migraciones, archivos a tocar, orden de pasos, pruebas); lleva casillas de avance
- [.claude/pendientes.md](.claude/pendientes.md) — lo que falta por construir de inmediato, priorizado
