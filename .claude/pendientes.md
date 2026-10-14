# Pendientes

Estado: POC funcional. El alcance completo (CRM, paneles por rol, portal con SEO, WhatsApp) salió de los PDF de KREER y está planificado por fases en [plan-crm.md](plan-crm.md); esta lista es lo inmediato. Ordenado por impacto. Cada ítem de "Admin" que sea una pantalla nueva se suma al menú lateral (ver [contexto.md](contexto.md#agregar-una-sección-al-menú)).

## 1. Consultas / leads (lo más importante; es la Fase 1 de [plan-crm.md](plan-crm.md))
`ContactForm` promete "cada consulta queda registrada", pero hoy **se pierde**: con `VITE_API_URL` hace `POST {API}/leads` a un backend que no existe en este repo; sin esa variable simula el envío y no guarda nada.
- [ ] Migración `supabase/003_leads.sql`: tabla `leads` (nombre, correo, teléfono, interés, mensaje, `property_id` opcional, estado `nuevo|contactado|cerrado`, fecha). RLS: `insert` para anónimos (con límites de longitud), `select/update/delete` solo `is_admin()`.
- [ ] `src/lib/leads.ts` y que `ContactForm` inserte directo en Supabase (quitar `VITE_API_URL`).
- [ ] Admin → **Consultas**: listado, filtro por estado, cambiar estado, ver mensaje. Nuevo ítem en el menú lateral, con contador de "nuevas".
- [ ] Protección anti-spam (honeypot o captcha) en el formulario.

## 2. Admin
- [ ] **Resumen** (`/admin`): hoy la raíz es el listado de propiedades. Un dashboard con totales (publicadas, borradores, asesores, consultas nuevas) y accesos rápidos.
- [ ] Búsqueda y filtros en `PropertyList` (estado, operación, tipo, asesor).
- [ ] Mostrar el asesor asignado en el listado de propiedades.
- [ ] Gestión de usuarios admin desde la interfaz (hoy se autoriza por SQL).
- [ ] Reordenar fotos (hoy solo se puede elegir portada).
- [ ] Confirmaciones/avisos propios (hoy `confirm()` nativo y mensajes de error en texto).

## 3. Sitio público
- [ ] **Portal con filtros reales** (Fase 2): `HeroSearch` debe filtrar por operación, tipo, zona y precio; listado completo con paginación.
- [ ] **Página de detalle** de propiedad (`/propiedades/:id`) con galería, descripción, mapa y botón de WhatsApp. Hoy las tarjetas no enlazan a nada.
- [ ] **Captación de propietarios** (Fase 6): formulario completo para quien quiere vender/alquilar (`SellCta` lo menciona).
- [ ] Favoritos persistentes (localStorage) o eliminar el corazón.
- [ ] Reemplazar los datos entre corchetes por los reales de KREER: teléfono, correo y dirección (`ContactForm`), cifras (`AboutStats`), precios del selector (`HeroSearch`), enlaces del `AppFooter`.
- [ ] Página 404 propia (hoy cualquier ruta desconocida redirige a `/`).
- [ ] SEO: título/descripción por página, Open Graph (imagen social con el logo), `sitemap`.

## 4. Proyecto / calidad
- [ ] `git init` (el proyecto aún no está bajo control de versiones).
- [ ] Agregar `.env` y `.env.*` al `.gitignore` (hoy solo ignora `*.local`).
- [ ] Reescribir `README.md` (es la plantilla de Vite): cómo configurar Supabase y correr el proyecto.
- [ ] Desactivar el registro público en Supabase Auth (ver [supabase.md](supabase.md#cuidado)).
- [ ] Guard del router que también verifique `is_admin()` (hoy solo verifica sesión).
- [ ] Tests básicos de `normalizeWhatsapp` / `formatPrice` y un linter.
- [ ] Si una subida de fotos falla a medias, quedan archivos huérfanos en Storage.

## Preguntas abiertas para KREER
- Marca: el correo repite `#457d80` dos veces. ¿Falta un tercer color? (`TODO(marca)` en `tailwind.config.js`; no se inventó uno.) Ojo: el beige del logo mide `#CAC5BB` y podría ser ese tercer color.
- Marca: los PNG del logo miden `#457d8b`, no `#457d80`. ¿Cuál es el correcto? Si es `#457d8b`, cambiar `brand-600` y recalcular la escala (blanco sobre él da 4,61:1, sigue pasando AA).
- Marca: pedir el logotipo completo ("kreer Grupo inmobiliario") en versión blanca; hoy header, footer y barra del admin usan solo la K blanca.
- Marca: falta el círculo teal con K beige (llegaron 5 archivos, no 6).
- ¿Cuál es el plan completo de fases (el código cita Fase 2 y Fase 6)?
- ¿Las consultas deben avisar por correo/WhatsApp a un asesor además de guardarse?
- ¿Las consultas se asignan a un asesor, o las atiende cualquiera?
- ¿Habrá más de un rol (admin / asesor con acceso limitado)?
