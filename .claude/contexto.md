# Contexto del proyecto

## Negocio
KREER Grupo Inmobiliario: compra, venta, alquiler e inversión con asesores que dan seguimiento hasta el cierre. Mercado Ecuador (WhatsApp con prefijo `593` por defecto, formato de precio `es-EC`, USD).

El proyecto va por fases. El código menciona la **Fase 2** (portal con filtros reales) y la **Fase 6** (formulario completo de captación de propietarios), pero el plan completo de fases no está en el repo — confirmarlo con el equipo antes de asumir alcance.

## Rutas
| Ruta | Vista | Acceso |
|---|---|---|
| `/` | `HomeView` | público |
| `/admin/login` | `LoginView` | público |
| `/admin` | redirige a `/admin/leads` (el Resumen la tomará en el paso 11 de la Fase 1) | sesión + equipo |
| `/admin/leads` | `LeadBoard` — lista con filtros (hoy solo lista; el Kanban es el paso 8). Cada rol ve lo que la RLS le deja: el asesor solo sus leads | cualquier rol |
| `/admin/leads/nuevo` | `LeadForm` — alta manual (RPC `create_lead`) | cualquier rol |
| `/admin/leads/:id` | `LeadDetail` — ficha: contacto editable, etapa, asesor (solo dirección), tareas del lead, compositor y línea de tiempo | cualquier rol |
| `/admin/agenda` | `AgendaView` — tareas pendientes en Vencidas · Hoy · Mañana · Próximos 7 días · Más adelante; completar con un clic y crear (con lead opcional). El asesor ve las suyas; la dirección, las de todos y puede filtrar por responsable | cualquier rol |
| `/admin/propiedades` | `PropertyList` (dentro de `AdminLayout`); el asesor la ve en solo lectura | cualquier rol |
| `/admin/propiedades/nueva` | `PropertyForm` | admin, gerente |
| `/admin/propiedades/:id` | `PropertyForm` (editar) | admin, gerente |
| `/admin/equipo` (antes `/admin/asesores`, que redirige) | `TeamList`; solo el admin puede escribir | admin, gerente |
| cualquier otra | redirige a `/` | — |

El guard (`router.ts`) exige sesión **y** una fila activa en Equipo (`auth.ts` la carga con la RPC `my_staff()`; sin ella cierra la sesión). Cada ruta puede limitar roles con `meta.roles`; quien no cumple vuelve a `/admin`. `auth.ts` expone `staff`, `role`, `isManager` (admin o gerente) e `isAdmin`. Lo que realmente protege los datos son las políticas RLS de Supabase; el guard y el menú solo ordenan la interfaz.

## Portada (`HomeView`)
`AppHeader` → `HeroSearch` → `FeaturedProperties` → `ServicesBand` → `SellCta` → `AboutStats` → `ContactForm` → `AppFooter`.
- `FeaturedProperties` trae hasta 9 propiedades publicadas; el botón de WhatsApp usa `contact_whatsapp` de la propiedad (si no hay, muestra "Solicitar información").
- `HeroSearch` todavía **no filtra**: solo hace scroll a `#propiedades`.
- La columna derecha del hero (solo escritorio, `lg:`) aloja `BuildingsAnimation`: SVG animado con GSAP (edificios que suben piso por piso → ventanas que se encienden → entra el logo completo arriba a la izquierda; los edificios se quedan). Corre una vez al montar; con `prefers-reduced-motion`, o si el cuadro está oculto (móvil), no se anima y queda el estado final. Sus colores son variables `--bld-*` en su `<style>`, leídas de los tokens `brand-*` con `theme()` (sin hex). El logo es el PNG oficial `public/brand/logo-full-teal.png` (`TODO(svg)`: usar el SVG cuando KREER lo entregue).
- Favoritos (corazón) solo viven en memoria.

## Panel de administración
`AdminLayout.vue` tiene **menú lateral izquierdo**: fijo en escritorio (`lg:`), y en móvil barra superior + panel deslizable con fondo oscuro. Incluye los ítems de navegación (agrupados por sección y filtrados por rol), "Ver sitio", "Salir", y el correo, nombre y rol del usuario.

### Agregar una sección al menú
1. Crear la vista en `src/views/admin/`.
2. Añadir la ruta hija en `src/router.ts` dentro de `/admin` (con `meta: { roles: [...] }` si no es para todo el equipo).
3. Añadir un ítem al arreglo `sections` de `AdminLayout.vue`, dentro de su grupo (CRM · Catálogo · Administración): `label`, `to`, `icon` (path SVG 24×24, trazo 1.5), `match(path)` para resaltarlo como activo (así "Propiedades" también se resalta en `/admin/propiedades/...`) y, opcional, `roles` (mismo criterio que la ruta). Los grupos sin ítems visibles para el rol se ocultan.

## Sistema de diseño
- Colores (`tailwind.config.js`; ahí cada token está marcado como MARCA o DERIVADO):
  - **Marca** (correo de la cliente): `brand-600` `#457d80`, único color de acción (botones primarios, enlaces, estados activos); `brand-slate` `#48657a`, secundario, solo acentos (eyebrows, íconos decorativos), nunca como segundo color de acción. `greige` `#CAC5BB` se midió en el círculo beige del logo (no viene en el correo).
  - **Derivados** (no son marca, se pueden ajustar): `brand-300/400/500/700` (mismo matiz que `brand-600`; `700` es el hover del botón primario), `night` (fondo oscuro), `paper` (fondo claro), `sand`, `sage`, `line` (bordes), `ink` / `ink-body` / `ink-soft` (textos).
  - Sobre `night` los teals de marca no pasan como texto (3,3:1 y 2,5:1): usar `paper` o `greige`.
  - Sin hex en componentes: todo color va por token.
  - El sitio público es claro (hero con lavado teal suave, footer `paper`); `night` queda solo en el panel `/admin`. La banda `SellCta` va en `brand-600` con texto `paper` (4,56:1; `greige` ahí no pasa AA) y botón `btn-light`.
- Tipografías (**estimadas**, validar con la guía de marca): `font-display` Poppins 500/600 (títulos), `font-sans` Inter 400/500 (interfaz y cuerpo). El logotipo es una geométrica de terminales planas; Poppins es la más cercana de las candidatas.
- Logos en `public/brand/` (PNG, sin editar ni recolorear con filtros): `logo-full-teal` (isotipo + "kreer Grupo inmobiliario"), `logo-wordmark-teal` (sin isotipo), `logo-k-teal`, `logo-k-white` (K sola, para fondos oscuros), `logo-circle-beige` (círculo beige con K teal; de él salen el favicon y el apple-touch-icon). Header y footer del sitio público (fondo claro) usan el logotipo completo `logo-full-teal`. No existe versión blanca del logotipo completo: sobre fondos oscuros (login y barra del admin) se usa la K blanca. Tarjetas sin foto: placeholder `brand-300/30` con `logo-k-teal` (`TODO(foto)` en `FeaturedProperties`); el cuadro del hero aloja la animación de marca (ver Portada; `TODO(foto)` en `HeroSearch` por si KREER entrega una foto). Los originales están en `brand/` (fuera de git).
- Radio de borde 2px en todo (estética sobria, sin esquinas redondeadas). Única excepción, por pedido expreso: la imagen del hero (`rounded-2xl`).
- Utilidades en `src/style.css`: `.btn`, `.btn-primary`, `.btn-ghost`, `.field` (input/select/textarea), `.eyebrow` (etiqueta pequeña en mayúsculas).
- Íconos: SVG en línea, `stroke="currentColor"`, `stroke-width="1.5"`. No hay librería de íconos.

## Flujo de datos de fotos
`PropertyForm` reduce cada foto a máx. 1600 px JPEG en el navegador (`shrink` en `lib/properties.ts`) y la sube al bucket `property-images` en `{propertyId}/{uuid}.jpg`. La primera de `images[]` es la portada. Al borrar una propiedad se borran sus fotos.
