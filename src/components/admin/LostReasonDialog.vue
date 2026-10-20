<script setup lang="ts">
import { ref } from 'vue'
import { LOST_REASONS } from '../../lib/crm'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ confirm: [reason: string]; cancel: [] }>()

const reason = ref<string>(LOST_REASONS[0])
const detail = ref('')

function submit() {
  const extra = detail.value.trim()
  emit('confirm', extra ? `${reason.value}: ${extra}` : reason.value)
}
</script>

<template>
  <div class="fixed inset-0 z-[60] grid place-items-center bg-night/60 px-5" @click.self="emit('cancel')" @keydown.esc="emit('cancel')">
    <form class="w-full max-w-sm bg-white p-6" role="dialog" aria-modal="true" aria-labelledby="lost-title" @submit.prevent="submit">
      <h2 id="lost-title" class="text-2xl">¿Por qué se perdió?</h2>
      <p class="mt-2 text-sm text-ink-soft">El motivo queda en el historial y ayuda a entender qué está fallando.</p>
      <select v-model="reason" class="field mt-5" aria-label="Motivo">
        <option v-for="r in LOST_REASONS" :key="r">{{ r }}</option>
      </select>
      <textarea v-model="detail" rows="3" maxlength="300" class="field mt-3 !h-auto py-3" placeholder="Detalle (opcional)" />
      <div class="mt-5 flex gap-3">
        <button class="btn btn-primary flex-1" :disabled="busy">{{ busy ? 'Guardando…' : 'Marcar como perdido' }}</button>
        <button type="button" class="btn border border-line text-ink-soft" @click="emit('cancel')">Cancelar</button>
      </div>
    </form>
  </div>
</template>
