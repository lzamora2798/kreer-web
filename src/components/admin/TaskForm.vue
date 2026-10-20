<script setup lang="ts">
import { ref } from 'vue'
import { TASK_DEFAULT_HOUR, TASK_KINDS, type TaskKind } from '../../lib/crm'
import { dayAt, toLocalInput } from '../../lib/format'
import type { NewTask } from '../../lib/tasks'

const props = defineProps<{
  busy?: boolean
  /** Error al guardar, que muestra quien usa el formulario. */
  error?: string
  /** Quien la hará si no se elige otra persona. */
  advisorId: string
  /** Lead fijo (en la ficha). Si falta y llega `leads`, se puede elegir uno. */
  leadId?: string | null
  leads?: { id: string; label: string }[]
  /** Solo la dirección elige responsable; para un asesor no se pasa y la tarea es suya. */
  advisors?: { id: string; name: string }[]
}>()
const emit = defineEmits<{ submit: [task: NewTask]; cancel: [] }>()

const QUICK = [
  { label: 'Mañana', days: 1 },
  { label: 'En 3 días', days: 3 },
  { label: 'En 1 semana', days: 7 },
] as const

const title = ref('')
const kind = ref<TaskKind>('llamar')
const due = ref(toLocalInput(dayAt(1, TASK_DEFAULT_HOUR)))
const pickedLead = ref(props.leadId ?? '')
const pickedAdvisor = ref(props.advisorId)
const localError = ref('')

function submit() {
  localError.value = ''
  const text = title.value.trim()
  const when = new Date(due.value)
  if (!text) { localError.value = 'Escribe qué hay que hacer.'; return }
  if (!due.value || Number.isNaN(when.getTime())) { localError.value = 'Indica cuándo.'; return }
  emit('submit', { leadId: pickedLead.value || null, advisorId: pickedAdvisor.value, title: text, kind: kind.value, dueAt: when.toISOString() })
}
</script>

<template>
  <form class="grid gap-3" @submit.prevent="submit">
    <input v-model="title" class="field" maxlength="200" placeholder="Ej. Llamar para confirmar la visita del sábado" aria-label="Qué hay que hacer" />

    <div class="flex flex-wrap gap-2" role="group" aria-label="Tipo de tarea">
      <button
        v-for="k in TASK_KINDS" :key="k.value" type="button"
        class="border px-3 py-1.5 text-sm transition-colors"
        :class="kind === k.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-body hover:bg-sand'"
        :aria-pressed="kind === k.value"
        @click="kind = k.value"
      >{{ k.label }}</button>
    </div>

    <div class="grid gap-2">
      <label class="grid gap-1 text-sm">Cuándo
        <input v-model="due" type="datetime-local" class="field" required />
      </label>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Atajos de fecha">
        <button
          v-for="q in QUICK" :key="q.days" type="button"
          class="border border-line bg-white px-3 py-1 text-xs text-ink-body transition-colors hover:bg-sand"
          @click="due = toLocalInput(dayAt(q.days, TASK_DEFAULT_HOUR))"
        >{{ q.label }}</button>
      </div>
    </div>

    <label v-if="leads && !props.leadId" class="grid gap-1 text-sm">Lead (opcional)
      <select v-model="pickedLead" class="field">
        <option value="">Ninguno</option>
        <option v-for="l in leads" :key="l.id" :value="l.id">{{ l.label }}</option>
      </select>
    </label>
    <label v-if="advisors" class="grid gap-1 text-sm">Responsable
      <select v-model="pickedAdvisor" class="field">
        <option v-for="a in advisors" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </label>

    <div class="flex gap-3">
      <button class="btn btn-primary flex-1" :disabled="busy">{{ busy ? 'Guardando…' : 'Crear tarea' }}</button>
      <button type="button" class="btn border border-line text-ink-soft" @click="emit('cancel')">Cancelar</button>
    </div>
    <p v-if="localError || error" class="text-sm text-red-700" role="alert">{{ localError || error }}</p>
  </form>
</template>
