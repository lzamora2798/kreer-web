<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'

// Todo en unidades del viewBox (400×300, igual que el cuadro 4:3 del hero): escala con el ancho sin px fijos.
const W = 400, H = 300, GROUND = 260, FLOOR = 22
// Logo oficial (el mismo PNG de public/brand que usa el header), arriba a la izquierda. Original 1962×740.
// TODO(svg): cuando KREER entregue el SVG oficial del logotipo, reemplazar el PNG (también en AppHeader y AppFooter).
const LOGO = { src: '/brand/logo-full-teal.png', x: 20, y: 16, w: 104, h: (104 * 740) / 1962 }

// Ejemplo de skyline: x, ancho, número de pisos y tono (1 = más claro … 4 = más oscuro).
const buildings = [
  { x: 24, w: 60, floors: 5, tone: 1 },
  { x: 92, w: 68, floors: 8, tone: 2 },
  { x: 168, w: 76, floors: 10, tone: 4 },
  { x: 252, w: 64, floors: 7, tone: 3 },
  { x: 324, w: 52, floors: 4, tone: 2 },
]
const floorY = (f: number) => GROUND - f * FLOOR + 2 // 2 de separación entre pisos
const cols = (w: number) => Math.max(2, Math.floor(w / 20))
const winX = (b: { x: number; w: number }, c: number) => b.x + (b.w / cols(b.w)) * (c - 0.5) - 3.5

const root = ref<SVGSVGElement | null>(null)
let ctx: gsap.Context | undefined

onMounted(() => {
  const el = root.value
  // Con movimiento reducido (o sin JS) el CSS ya deja el estado final: edificios con ventanas encendidas y el logo.
  // Tampoco se anima si el cuadro está oculto (móvil): no se gasta CPU en algo que no se ve.
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el.getClientRects().length) return

  ctx = gsap.context(() => {
    gsap.set('.win', { opacity: 0.15 })
    gsap.set('.logo', { opacity: 0, y: -8 })

    // Una sola vez, sin repeat. Los edificios se quedan y al final entra el logo.
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
    el.querySelectorAll('.building').forEach((b, i) => {
      // Cada edificio sube piso por piso, de abajo hacia arriba.
      tl.from(b.querySelectorAll('.floor'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.5, stagger: 0.07 }, i * 0.25)
    })
    tl.to('.win', { opacity: 1, duration: 0.3, stagger: { amount: 1.2, from: 'random' } }, '>-0.1') // se encienden las ventanas
    tl.to('.logo', { opacity: 1, y: 0, duration: 0.7 }, '+=0.3')
  }, el)
})

onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <svg ref="root" class="buildings-anim h-full w-full" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true" focusable="false">
    <g class="skyline">
      <rect class="ground" x="16" :y="GROUND" width="368" height="2" />
      <g v-for="(b, i) in buildings" :key="i" class="building" :class="`tone-${b.tone}`">
        <g v-for="f in b.floors" :key="f" class="floor">
          <rect class="body" :x="b.x" :y="floorY(f)" :width="b.w" :height="FLOOR - 2" />
          <rect v-for="c in cols(b.w)" :key="c" class="win" :x="winX(b, c)" :y="floorY(f) + 5.5" width="7" height="9" />
        </g>
      </g>
    </g>
    <g class="logo">
      <image :href="LOGO.src" :x="LOGO.x" :y="LOGO.y" :width="LOGO.w" :height="LOGO.h" />
    </g>
  </svg>
</template>

<style scoped>
/* Paleta teal de la web como variables CSS (se leen de tailwind.config.js, sin hex en el componente). */
.buildings-anim {
  --bld-1: theme('colors.brand.400');
  --bld-2: theme('colors.brand.500');
  --bld-3: theme('colors.brand.600');
  --bld-4: theme('colors.brand.700');
  --bld-window: theme('colors.paper');
  --bld-ground: theme('colors.brand.600');
}
.tone-1 .body { fill: var(--bld-1); }
.tone-2 .body { fill: var(--bld-2); }
.tone-3 .body { fill: var(--bld-3); }
.tone-4 .body { fill: var(--bld-4); }
.win { fill: var(--bld-window); }
.ground { fill: var(--bld-ground); }
/* El CSS ya describe el estado final (edificios + logo): así se ve con prefers-reduced-motion o si falla el JS. */
</style>
