<script setup lang="ts">
const items = [
  { t: 'Comprar', d: 'Propiedades verificadas y acompañamiento legal y financiero en cada paso.', i: 'M3 11 12 4l9 7v9H3zM9 20v-6h6v6' },
  { t: 'Vender', d: 'Valoración realista, difusión y negociación para cerrar al mejor precio.', i: 'M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5' },
  { t: 'Alquilar', d: 'Inquilinos y propietarios conectados con contratos claros y seguimiento.', i: 'M7 14a4 4 0 1 1 3.9-5H20v3h-2v2h-3v-2h-4.1A4 4 0 0 1 7 14Z' },
  { t: 'Invertir', d: 'Oportunidades con análisis de rentabilidad y proyección a mediano plazo.', i: 'M4 19V5m0 14h16M8 15l4-4 3 3 5-6' },
]
</script>

<template>
  <section id="servicios" class="bg-sand py-24">
    <div class="mx-auto max-w-6xl px-5">
      <p class="eyebrow">Servicios</p>
      <h2 class="mt-3 max-w-xl text-3xl md:text-4xl">Una sola plataforma para cada operación.</h2>
      <div class="mt-12 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="s in items" :key="s.t" class="bg-paper p-8">
          <svg viewBox="0 0 24 24" class="h-7 w-7 text-brand-slate" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path :d="s.i" /></svg>
          <h3 class="mt-6 text-xl">{{ s.t }}</h3>
          <p class="mt-2 text-sm leading-relaxed">{{ s.d }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
