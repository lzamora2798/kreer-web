# Pendientes

Estado: POC funcional. El alcance completo (CRM, paneles por rol, portal con SEO, WhatsApp) salió de los PDF de KREER y está planificado por fases en [plan-crm.md](plan-crm.md); esta lista es lo inmediato. Ordenado por impacto. Cada ítem de "Admin" que sea una pantalla nueva se suma al menú lateral (ver [contexto.md](contexto.md#agregar-una-sección-al-menú)).

## 1. Consultas / leads (lo más importante; es la Fase 1 de [plan-crm.md](plan-crm.md))
`ContactForm` ya envía la consulta a Supabase (`submit_lead`): se guarda como lead, se asigna a un asesor y no duplica clientes repetidos. **Falta probarlo contra el Supabase real**, y para eso hay que ejecutar antes las migraciones 003–005 (ver [supabase.md](supabase.md#orden-de-puesta-en-marcha)).
- [x] Migraciones 004 (tablas) y 005 (`submit_lead`, asignación) — escritas, probadas con `npm run test:db` y ya ejecutadas en el Supabase real (funcionando).
- [x] `src/lib/leads.ts` y `ContactForm` → `submit_lead` (sin `VITE_API_URL`), con honeypot, UTM y propiedad precargada desde "Solicitar información".
- [x] Admin → **Leads** (paso 7 de [fase1-plan.md](fase1-plan.md)): lista con filtros, ficha con historial y alta manual; ítem "Leads" en el menú. Falta probarlo contra el Supabase real.
- [x] **Tareas y Agenda** (paso 9): `/admin/agenda` + tareas dentro de la ficha del lead + "Tarea vencida" en la lista. Sin migración nueva. Falta probarlo contra el Supabase real.
- [x] **Resumen** (paso 11): `/admin` con lo que requiere atención ahora y el rendimiento por periodo (asesor y gerencia). Sin migración nueva. Falta probarlo contra el Supabase real y cotejar las cifras con un conteo manual.
- [ ] Contador de leads nuevos en el menú con avisos en vivo (paso 12).
- [ ] Kanban (paso 8): opcional, solo otra vista de los mismos leads; se pospuso.
- [ ] Captcha (p. ej. Cloudflare Turnstile) si el honeypot no alcanza.

## 2. Admin
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
- [x] Guard del router por rol: exige una fila activa en Equipo (`my_staff()`) y respeta `meta.roles`.
- [ ] Tests básicos de `normalizeWhatsapp` / `formatPrice` y un linter.
- [ ] Si una subida de fotos falla a medias, quedan archivos huérfanos en Storage.

## Preguntas abiertas para KREER
- Marca: el correo repite `#457d80` dos veces. ¿Falta un tercer color? (`TODO(marca)` en `tailwind.config.js`; no se inventó uno.) Ojo: el beige del logo mide `#CAC5BB` y podría ser ese tercer color.
- Marca: los PNG del logo miden `#457d8b`, no `#457d80`. ¿Cuál es el correcto? Si es `#457d8b`, cambiar `brand-600` y recalcular la escala (blanco sobre él da 4,61:1, sigue pasando AA).
- Marca: pedir el logotipo completo ("kreer Grupo inmobiliario") en versión blanca; hoy solo el login y la barra del admin (fondo oscuro) usan la K blanca.
- Marca: pedir el **SVG oficial del logotipo** (hoy es PNG en `public/brand/`; lo usan header, footer y el final de `BuildingsAnimation`, que lleva `TODO(svg)`).
- Marca: el favicon, el placeholder de las tarjetas y la K blanca usan la **K**, que no es el isotipo (la flecha) del logotipo completo. Confirmar cuál es la marca correcta.
- Hero: el prototipo `animacion-edificios.html` no estaba en `./motionpath` (solo una demo ajena de GreenSock, sin versionar junto a `motionpath.zip`). La animación se diseñó desde la descripción; si aparece el original, sustituir el timeline de `BuildingsAnimation`.
- Marca: ¿cuál es la tipografía oficial? Poppins + Inter son una estimación. Pedir también fotos reales de propiedades y una para el hero (hay `TODO(foto)`).
- Marca: falta el círculo teal con K beige (llegaron 5 archivos, no 6).
- ¿Cuál es el plan completo de fases (el código cita Fase 2 y Fase 6)?
- ¿Las consultas deben avisar por correo/WhatsApp a un asesor además de guardarse?
- ¿Las consultas se asignan a un asesor, o las atiende cualquiera?
- ¿Habrá más de un rol (admin / asesor con acceso limitado)?
