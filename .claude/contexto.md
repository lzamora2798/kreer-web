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
- Colores (`tailwind.config.js`; ahí cada token está marcado como MARCA o DERIVADO):
  - **Marca** (correo de la cliente): `brand-600` `#457d80`, único color de acción (botones primarios, enlaces, estados activos); `brand-slate` `#48657a`, secundario, solo acentos (eyebrows, íconos decorativos), nunca como segundo color de acción. `greige` `#CAC5BB` se midió en el círculo beige del logo (no viene en el correo).
  - **Derivados** (no son marca, se pueden ajustar): `brand-300/400/500/700` (mismo matiz que `brand-600`; `700` es el hover del botón primario), `night` (fondo oscuro), `paper` (fondo claro), `sand`, `sage`, `line` (bordes), `ink` / `ink-body` / `ink-soft` (textos).
  - Sobre `night` los teals de marca no pasan como texto (3,3:1 y 2,5:1): usar `paper` o `greige`.
  - Sin hex en componentes: todo color va por token (los tonos de `src/data/properties.ts` son nombres de token).
- Tipografías: `font-display` Cormorant Garamond (títulos), `font-sans` Jost (interfaz y cuerpo).
- Logos en `public/brand/` (PNG, sin editar ni recolorear con filtros): `logo-full-teal` (isotipo + "kreer Grupo inmobiliario"), `logo-wordmark-teal` (sin isotipo), `logo-k-teal`, `logo-k-white` (K sola, para fondos oscuros), `logo-circle-beige` (círculo beige con K teal; de él salen el favicon y el apple-touch-icon). No existe versión blanca del logotipo completo: sobre fondos oscuros (header, footer, barra del admin) se usa la K blanca. Los originales están en `brand/` (fuera de git).
- Radio de borde 2px en todo (estética sobria, sin esquinas redondeadas).
- Utilidades en `src/style.css`: `.btn`, `.btn-primary`, `.btn-ghost`, `.field` (input/select/textarea), `.eyebrow` (etiqueta pequeña en mayúsculas).
- Íconos: SVG en línea, `stroke="currentColor"`, `stroke-width="1.5"`. No hay librería de íconos.

## Flujo de datos de fotos
`PropertyForm` reduce cada foto a máx. 1600 px JPEG en el navegador (`shrink` en `lib/properties.ts`) y la sube al bucket `property-images` en `{propertyId}/{uuid}.jpg`. La primera de `images[]` es la portada. Al borrar una propiedad se borran sus fotos.
