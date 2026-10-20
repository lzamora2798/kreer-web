<script setup lang="ts">
import { reactive } from 'vue'
import BuildingsAnimation from './BuildingsAnimation.vue'
const q = reactive({ op: 'Comprar', type: '', zone: '', max: '' })
const ops = ['Comprar', 'Alquilar', 'Invertir']
function search() {
  // POC: el portal con filtros reales llega en la Fase 2.
  document.getElementById('propiedades')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section class="relative bg-paper pb-24 pt-36">
    <div class="absolute inset-0 bg-gradient-to-br from-brand-300/40 via-paper to-paper" aria-hidden="true" />
    <div class="relative mx-auto max-w-6xl px-5">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p class="eyebrow">Grupo inmobiliario</p>
          <h1 class="mt-4 text-4xl leading-[1.1] md:text-6xl">Encuentra el lugar donde quieres crecer.</h1>
          <p class="mt-6 max-w-xl text-lg">Acompañamos cada operación —compra, venta, alquiler e inversión— con asesores que dan seguimiento hasta el cierre.</p>
        </div>
        <!-- Cuadro de la derecha: aloja la animación de marca (edificios → logo). Solo en escritorio: en móvil
             empujaría el buscador fuera de la pantalla. Esquinas redondeadas a pedido (el resto del sitio usa radio de 2px).
             TODO(foto): si KREER entrega una foto de propiedad para el hero, evaluar reemplazar la animación por
             <img src="…" alt="…" class="h-full w-full object-cover" />. -->
        <div class="hidden aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-brand-300/50 lg:grid" aria-hidden="true">
          <BuildingsAnimation />
        </div>
      </div>

      <form class="mt-12 border border-line bg-white p-5 text-ink shadow-sm md:p-6" @submit.prevent="search">
        <div class="mb-4 flex gap-6 border-b border-line">
          <button v-for="o in ops" :key="o" type="button" class="-mb-px border-b-2 pb-3 text-sm font-medium transition"
            :class="q.op === o ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-soft'" @click="q.op = o">{{ o }}</button>
        </div>
        <div class="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select v-model="q.type" class="field" aria-label="Tipo de propiedad">
            <option value="">Tipo de propiedad</option><option>Casa</option><option>Departamento</option><option>Terreno</option><option>Local comercial</option>
          </select>
          <input v-model="q.zone" class="field" placeholder="Ciudad o zona" aria-label="Ubicación" />
          <select v-model="q.max" class="field" aria-label="Precio máximo">
            <option value="">Precio máximo</option><option>$ [100.000]</option><option>$ [200.000]</option><option>$ [300.000]</option>
          </select>
          <button class="btn btn-primary">Buscar</button>
        </div>
      </form>
    </div>
  </section>
</template>
