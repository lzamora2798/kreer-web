<script setup lang="ts">
import { ref } from 'vue'
const open = ref(false)
const links = [
  { label: 'Comprar', href: '#propiedades' },
  { label: 'Alquilar', href: '#propiedades' },
  { label: 'Vender', href: '#vender' },
  { label: 'Invertir', href: '#servicios' },
  { label: 'Nosotros', href: '#nosotros' },
  { label: 'Contacto', href: '#contacto' },
]
</script>

<template>
  <header class="absolute inset-x-0 top-0 z-20 text-paper">
    <div class="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
      <a href="#" class="flex items-center gap-3">
        <span class="grid h-9 w-9 place-items-center rounded-full bg-brand-600">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 18V6m0 6 8-6m-8 6 8 6" /></svg>
        </span>
        <span class="font-display text-2xl tracking-[0.25em] text-greige">KREER</span>
      </a>
      <nav class="hidden items-center gap-8 text-sm md:flex">
        <a v-for="l in links" :key="l.label" :href="l.href" class="text-paper/80 transition hover:text-paper">{{ l.label }}</a>
      </nav>
      <button class="md:hidden" aria-label="Menú" @click="open = !open">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </div>
    <nav v-if="open" class="flex flex-col gap-4 bg-night px-5 py-5 text-sm md:hidden">
      <a v-for="l in links" :key="l.label" :href="l.href" @click="open = false">{{ l.label }}</a>
    </nav>
  </header>
</template>
