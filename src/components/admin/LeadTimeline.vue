<script setup lang="ts">
import { EVENT_LABELS, stageLabel } from '../../lib/crm'
import { formatDateTime } from '../../lib/format'
import type { LeadEvent } from '../../lib/leads'

defineProps<{ events: LeadEvent[] }>()

// Lo que escribe una persona (nota, llamada…) se destaca; lo automático del sistema va más discreto.
const manual = (e: LeadEvent) => !['cambio_etapa', 'asignacion', 'sistema'].includes(e.kind)

function headline(e: LeadEvent): string {
  if (e.kind === 'cambio_etapa') return `Etapa: ${e.from_stage ? stageLabel(e.from_stage) : '—'} → ${e.to_stage ? stageLabel(e.to_stage) : '—'}`
  if (e.kind === 'asignacion') {
    const to = e.meta?.to_name
    if (!to) return 'Quedó sin asignar'
    return e.meta?.from_name ? `Reasignado de ${e.meta.from_name} a ${to}` : `Asignado a ${to}`
  }
  if (e.kind === 'sistema') return e.body || 'Evento del sistema'
  const dir = e.direction === 'entrante' ? ' · entrante' : e.direction === 'saliente' ? ' · saliente' : ''
  return `${EVENT_LABELS[e.kind] ?? e.kind}${dir}`
}

// El cuerpo de "sistema" ya se muestra como titular; en cambio de etapa guarda el motivo de pérdida.
const detail = (e: LeadEvent) => (e.kind === 'sistema' || e.kind === 'asignacion' ? '' : e.body)
</script>

<template>
  <p v-if="!events.length" class="text-sm text-ink-soft">Aún no hay actividad.</p>
  <ol v-else class="grid">
    <li v-for="e in events" :key="e.id" class="relative border-l border-line pb-5 pl-5 last:pb-0">
      <span class="absolute -left-[5px] top-1.5 h-2.5 w-2.5" :class="manual(e) ? 'bg-brand-600' : 'bg-greige'" aria-hidden="true" />
      <p class="text-sm" :class="manual(e) ? 'font-medium text-ink' : 'text-ink-soft'">{{ headline(e) }}</p>
      <p v-if="detail(e)" class="mt-1 whitespace-pre-line text-sm text-ink-body">{{ detail(e) }}</p>
      <p class="mt-1 text-xs text-ink-soft">{{ formatDateTime(e.created_at) }}<template v-if="e.advisor"> · {{ e.advisor.name }}</template></p>
    </li>
  </ol>
</template>
