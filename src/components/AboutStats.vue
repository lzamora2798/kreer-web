<script setup lang="ts">
const stats = [
  { n: '[+250]', l: 'Operaciones cerradas' },
  { n: '[+15]', l: 'Asesores' },
  { n: '[+10]', l: 'Años de experiencia' },
  { n: '[24 h]', l: 'Tiempo de respuesta' },
]
</script>
<template>
  <section id="nosotros" class="mx-auto max-w-6xl px-5 py-24">
    <div class="grid gap-12 md:grid-cols-2">
      <div>
        <p class="eyebrow">Quiénes somos</p>
        <h2 class="mt-3 text-3xl md:text-4xl">Confianza que se construye operación a operación.</h2>
        <p class="mt-5 leading-relaxed">En KREER cada cliente tiene seguimiento desde el primer contacto hasta la firma. Ningún interesado se pierde: cada consulta llega a un asesor y se atiende en el menor tiempo posible.</p>
      </div>
      <dl class="grid grid-cols-2 gap-px bg-line self-start">
        <div v-for="s in stats" :key="s.l" class="bg-paper p-6">
          <dt class="font-display text-4xl font-semibold text-ink">{{ s.n }}</dt>
          <dd class="mt-1 text-sm text-ink-soft">{{ s.l }}</dd>
        </div>
      </dl>
    </div>
    <p class="mt-6 text-xs text-ink-soft">Cifras de ejemplo, pendientes de confirmar con KREER.</p>
  </section>
</template>
