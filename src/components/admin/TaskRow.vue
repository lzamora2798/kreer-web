<script setup lang="ts">
import { computed } from 'vue'
import { taskKindLabel } from '../../lib/crm'
import { formatDue } from '../../lib/format'
import type { Task } from '../../lib/tasks'

const props = defineProps<{
  task: Task
  /** Hora actual (ms); la pasa quien lista, para que "vencida" avance sin recargar. */
  now: number
  /** Muestra el nombre del cliente con enlace a su lead (en la Agenda; en la ficha sobra). */
  showLead?: boolean
  /** Muestra quién debe hacerla (útil para la dirección). */
  showAdvisor?: boolean
}>()
const emit = defineEmits<{ toggle: [task: Task]; remove: [task: Task] }>()

const overdue = computed(() => !props.task.done_at && new Date(props.task.due_at).getTime() < props.now)
</script>

<template>
  <li class="flex items-start gap-3 border-b border-line py-3 last:border-0">
    <!-- click.prevent: la casilla solo cambia cuando la base confirma, así nunca queda desincronizada si falla -->
    <input
      type="checkbox" :checked="!!task.done_at" class="mt-1 h-4 w-4 shrink-0 accent-brand-600"
      :aria-label="task.done_at ? 'Volver a marcar como pendiente' : 'Marcar como hecha'"
      @click.prevent="emit('toggle', task)"
    />
    <div class="min-w-0 flex-1">
      <p class="text-sm" :class="task.done_at ? 'text-ink-soft line-through' : 'text-ink'">{{ task.title }}</p>
      <p class="mt-0.5 text-xs text-ink-soft">
        {{ taskKindLabel(task.kind) }} ·
        <span :class="overdue ? 'font-medium text-red-700' : ''">{{ formatDue(task.due_at, now) }}</span>
        <template v-if="showLead && task.lead">
          · <router-link :to="`/admin/leads/${task.lead.id}`" class="text-brand-600 hover:text-brand-700">{{ task.lead.contact.name }}</router-link>
        </template>
        <template v-if="showAdvisor && task.advisor"> · {{ task.advisor.name }}</template>
      </p>
    </div>
    <button type="button" class="shrink-0 text-xs text-ink-soft hover:text-red-700" @click="emit('remove', task)">Eliminar</button>
  </li>
</template>
