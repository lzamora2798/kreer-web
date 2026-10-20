<script setup lang="ts">
defineProps<{
  label: string
  value: string
  /** Aclaración o comparación bajo la cifra (p. ej. "62 % de los recibidos"). */
  note?: string
}>()
</script>

<template>
  <div class="border border-line bg-white p-5">
    <p class="text-sm text-ink-soft">{{ label }}</p>
    <p class="mt-2 font-sans text-3xl font-semibold text-ink">{{ value }}</p>
    <p v-if="note" class="mt-1 text-xs text-ink-soft">{{ note }}</p>
  </div>
</template>
