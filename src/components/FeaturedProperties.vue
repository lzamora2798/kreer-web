<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { contactProperty } from '../lib/contact'
import { featured } from '../data/properties'
import { formatPrice, listPublished } from '../lib/properties'
import { supabase } from '../lib/supabase'
import { whatsappLink } from '../lib/advisors'

interface Card {
  id: string; title: string; zone: string; operation: string; price: string
  beds: number; baths: number; area: number; image?: string; whatsapp?: string | null
}

const cards = ref<Card[]>([])
const loading = ref(true)
const live = !!supabase
const favs = ref<Set<string>>(new Set())

function toggle(id: string) {
  const s = new Set(favs.value)
  s.has(id) ? s.delete(id) : s.add(id)
  favs.value = s
}

onMounted(async () => {
  if (!live) {
    cards.value = featured.map((p) => ({ ...p, id: String(p.id) }))
    loading.value = false
    return
  }
  try {
    const rows = await listPublished()
    cards.value = rows.slice(0, 9).map((p) => ({
      id: p.id, title: p.title, zone: p.zone, operation: p.operation, price: formatPrice(p),
      beds: p.beds, baths: p.baths, area: p.area, image: p.images[0], whatsapp: p.contact_whatsapp,
    }))
  } catch {
    cards.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section id="propiedades" class="mx-auto max-w-6xl px-5 py-24">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Propiedades</p>
        <h2 class="mt-3 text-3xl md:text-4xl">Selección destacada</h2>
      </div>
      <a href="#contacto" class="text-sm font-medium text-brand-600 hover:text-brand-700">Consultar por una propiedad →</a>
    </div>

    <p v-if="loading" class="mt-12 text-sm text-ink-soft">Cargando propiedades…</p>
    <p v-else-if="!cards.length" class="mt-12 text-ink-soft">Pronto publicaremos nuevas propiedades. Contáctanos y te asesoramos.</p>

    <div v-else class="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="p in cards" :key="p.id" class="group border border-line bg-white">
        <div class="relative aspect-[4/3]">
          <img v-if="p.image" :src="p.image" :alt="p.title" loading="lazy" class="h-full w-full object-cover" />
          <!-- TODO(foto): sin foto real de la propiedad se muestra este placeholder con el isotipo de KREER. -->
          <div v-else class="grid h-full w-full place-items-center bg-brand-300/30">
            <img src="/brand/logo-k-teal.png" alt="" width="52" height="56" class="h-14 w-auto" />
          </div>
          <span class="absolute left-3 top-3 bg-paper px-3 py-1 text-xs font-medium tracking-wide text-brand-700 shadow-sm">{{ p.operation }}</span>
          <button class="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-white/90" :aria-label="favs.has(p.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'" @click="toggle(p.id)">
            <svg viewBox="0 0 24 24" class="h-5 w-5 text-brand-600" :fill="favs.has(p.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
          </button>
        </div>
        <div class="p-5">
          <p class="text-xs uppercase tracking-widest text-ink-soft">{{ p.zone }}</p>
          <h3 class="mt-1 text-xl">{{ p.title }}</h3>
          <p class="mt-3 font-display text-2xl font-semibold text-ink">{{ p.price }}</p>
          <ul class="mt-4 flex gap-5 border-t border-line pt-4 text-sm text-ink-soft">
            <li v-if="p.beds">{{ p.beds }} hab.</li>
            <li v-if="p.baths">{{ p.baths }} baños</li>
            <li v-if="p.area">{{ p.area }} m²</li>
          </ul>
          <a v-if="p.whatsapp" :href="whatsappLink(p.whatsapp, p.title)" target="_blank" rel="noopener" class="btn btn-primary mt-5 w-full">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8L4 20Z" /><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1.2-1.2-1.7-.9-.8.6c-.9-.4-1.6-1.1-2-2l.6-.8-.9-1.7L9 9.5Z" /></svg>
            Consultar por WhatsApp
          </a>
          <a v-else href="#contacto" class="btn btn-ghost mt-5 w-full !border-line !text-brand-600 hover:!bg-sand hover:!text-brand-700" @click="contactProperty = { id: p.id, title: p.title }">Solicitar información</a>
        </div>
      </article>
    </div>
    <p v-if="!live" class="mt-6 text-xs text-ink-soft">Datos de ejemplo entre corchetes, pendientes de confirmar con KREER.</p>
  </section>
</template>
