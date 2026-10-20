<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '../../lib/format'

const props = defineProps<{
  items: { key: string; label: string; value: number }[]
  /** Qué mostrar cuando todo vale 0. */
  empty?: string
}>()

// Una sola serie = un solo color. La barra nace de una línea base común; el valor va en la punta.
const max = computed(() => Math.max(0, ...props.items.map((i) => i.value)))
const total = computed(() => props.items.reduce((s, i) => s + i.value, 0))
const ratio = (v: number) => (max.value ? v / max.value : 0)
const tip = (i: { label: string; value: number }) => `${i.label}: ${formatNumber(i.value)}${total.value ? ` (${Math.round((i.value / total.value) * 100)} % del total)` : ''}`
</script>

<template>
  <p v-if="!max" class="text-sm text-ink-soft">{{ empty ?? 'Sin datos todavía.' }}</p>
  <!-- Es una lista con texto: lector de pantalla y tabla comparten la misma información que las barras -->
  <ul v-else>
    <li v-for="i in items" :key="i.key" class="grid grid-cols-[6.5rem_1fr] items-center gap-3 py-1.5 sm:grid-cols-[8rem_1fr]" :title="tip(i)">
      <span class="text-sm text-ink-body">{{ i.label }}</span>
      <span class="flex items-center gap-2">
        <!-- ≤ 24 px de grosor, extremo de datos redondeado a 4 px y base recta; deja 2.5rem libres para el valor -->
        <span
          v-if="i.value" class="h-4 shrink-0 rounded-r-[4px] bg-brand-slate" aria-hidden="true"
          :style="{ width: `max(2px, calc((100% - 2.5rem) * ${ratio(i.value)}))` }"
        />
        <span class="text-sm font-medium tabular-nums text-ink">{{ formatNumber(i.value) }}</span>
      </span>
    </li>
  </ul>
</template>
