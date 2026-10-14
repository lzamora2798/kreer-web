<script setup lang="ts">
import { reactive } from 'vue'
const q = reactive({ op: 'Comprar', type: '', zone: '', max: '' })
const ops = ['Comprar', 'Alquilar', 'Invertir']
function search() {
  // POC: el portal con filtros reales llega en la Fase 2.
  document.getElementById('propiedades')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section class="relative bg-night pb-24 pt-36 text-paper">
    <div class="absolute inset-0 bg-gradient-to-br from-brand-700 from-0% to-night to-70% opacity-40" aria-hidden="true" />
    <div class="relative mx-auto max-w-6xl px-5">
      <p class="eyebrow !text-brand-300">Grupo inmobiliario</p>
      <h1 class="mt-4 max-w-2xl text-5xl leading-[1.05] !text-paper md:text-7xl">Encuentra el lugar donde quieres crecer.</h1>
      <p class="mt-6 max-w-xl text-lg text-greige">Acompañamos cada operación —compra, venta, alquiler e inversión— con asesores que dan seguimiento hasta el cierre.</p>

      <form class="mt-12 bg-paper p-5 text-ink md:p-6" @submit.prevent="search">
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
