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
  <header class="absolute inset-x-0 top-0 z-20 text-ink">
    <div class="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
      <a href="#" class="flex items-center">
        <img src="/brand/logo-full-teal.png" alt="KREER Grupo Inmobiliario" width="127" height="48" class="h-12 w-auto" />
      </a>
      <nav class="hidden items-center gap-8 text-sm md:flex">
        <a v-for="l in links" :key="l.label" :href="l.href" class="text-ink-body transition hover:text-brand-600">{{ l.label }}</a>
      </nav>
      <button class="md:hidden" aria-label="Menú" @click="open = !open">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </div>
    <nav v-if="open" class="flex flex-col gap-4 border-t border-line bg-paper px-5 py-5 text-sm text-ink-body md:hidden">
      <a v-for="l in links" :key="l.label" :href="l.href" @click="open = false">{{ l.label }}</a>
    </nav>
  </header>
</template>
