# Contexto del proyecto

## Negocio
KREER Grupo Inmobiliario: compra, venta, alquiler e inversión con asesores que dan seguimiento hasta el cierre. Mercado Ecuador (WhatsApp con prefijo `593` por defecto, formato de precio `es-EC`, USD).

El proyecto va por fases. El código menciona la **Fase 2** (portal con filtros reales) y la **Fase 6** (formulario completo de captación de propietarios), pero el plan completo de fases no está en el repo — confirmarlo con el equipo antes de asumir alcance.

## Rutas
| Ruta | Vista | Acceso |
|---|---|---|
| `/` | `HomeView` | público |
| `/admin/login` | `LoginView` | público |
| `/admin` | `PropertyList` (dentro de `AdminLayout`) | sesión + admin |
| `/admin/propiedades/nueva` | `PropertyForm` | sesión + admin |
| `/admin/propiedades/:id` | `PropertyForm` (editar) | sesión + admin |
| `/admin/equipo` (antes `/admin/asesores`, que redirige) | `TeamList` | sesión + admin |
| cualquier otra | redirige a `/` | — |

El guard (`router.ts`) solo verifica que haya sesión. El rol de admin se comprueba al iniciar sesión (`signIn` → RPC `is_admin`) y, lo que realmente protege los datos, en las políticas RLS de Supabase.

## Portada (`HomeView`)
`AppHeader` → `HeroSearch` → `FeaturedProperties` → `ServicesBand` → `SellCta` → `AboutStats` → `ContactForm` → `AppFooter`.
- `FeaturedProperties` trae hasta 9 propiedades publicadas; el botón de WhatsApp usa `contact_whatsapp` de la propiedad (si no hay, muestra "Solicitar información").
- `HeroSearch` todavía **no filtra**: solo hace scroll a `#propiedades`.
- Favoritos (corazón) solo viven en memoria.

## Panel de administración
`AdminLayout.vue` tiene **menú lateral izquierdo**: fijo en escritorio (`lg:`), y en móvil barra superior + panel deslizable con fondo oscuro. Incluye ítems de navegación, "Ver sitio", "Salir" y el correo del usuario.

### Agregar una sección al menú
1. Crear la vista en `src/views/admin/`.
2. Añadir la ruta hija en `src/router.ts` dentro de `/admin`.
3. Añadir un ítem al arreglo `nav` de `AdminLayout.vue`: `label`, `to`, `icon` (path SVG 24×24, trazo 1.5) y `match(path)` para resaltarlo como activo (así "Propiedades" también se resalta en `/admin/propiedades/...`).

## Sistema de diseño
- Colores (`tailwind.config.js`): `brand` 300–700 (azul-verdoso, principal `brand-600`), `night` (fondo oscuro), `paper` (fondo claro), `sand`, `sage`, `greige`, `line` (bordes), `ink` / `ink-body` / `ink-soft` (textos).
- Tipografías: `font-display` Cormorant Garamond (títulos, logo con `tracking-[0.25em]`), `font-sans` Jost (cuerpo).
- Radio de borde 2px en todo (estética sobria, sin esquinas redondeadas).
- Utilidades en `src/style.css`: `.btn`, `.btn-primary`, `.btn-ghost`, `.field` (input/select/textarea), `.eyebrow` (etiqueta pequeña en mayúsculas).
- Íconos: SVG en línea, `stroke="currentColor"`, `stroke-width="1.5"`. No hay librería de íconos.

## Flujo de datos de fotos
`PropertyForm` reduce cada foto a máx. 1600 px JPEG en el navegador (`shrink` en `lib/properties.ts`) y la sube al bucket `property-images` en `{propertyId}/{uuid}.jpg`. La primera de `images[]` es la portada. Al borrar una propiedad se borran sus fotos.
