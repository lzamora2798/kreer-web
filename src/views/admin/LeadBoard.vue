<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import StageBadge from '../../components/admin/StageBadge.vue'
import { listAdvisors, type Advisor } from '../../lib/advisors'
import { isManager } from '../../lib/auth'
import { INTERESTS, SOURCES, STAGES, UNCONTACTED_LATE_MIN, UNCONTACTED_WARN_MIN, interestLabel, isClosed, sourceLabel } from '../../lib/crm'
import { formatDuration, minutesSince, timeAgo } from '../../lib/format'
import { leadError, listLeads, type Lead } from '../../lib/leads'

const leads = ref<Lead[]>([])
const advisors = ref<Advisor[]>([])
const loading = ref(true)
const error = ref('')

// Filtros. `stage`: 'abiertos' (por defecto), 'todas' (incluye cerrados recientes) o una etapa.
const q = ref('')
const stage = ref<string>('abiertos')
const advisor = ref('') // '' = todos · 'none' = sin asignar · id
const source = ref('')
const interest = ref('')
const uncontacted = ref(false)

// Reloj para que los semáforos y "hace X min" avancen sin recargar.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  timer = setInterval(() => { now.value = Date.now() }, 60_000)
  try {
    const [l, a] = await Promise.all([listLeads(), isManager.value ? listAdvisors() : Promise.resolve([])])
    leads.value = l
    advisors.value = a.filter((x) => x.active)
  } catch (e) { error.value = leadError(e) } finally { loading.value = false }
})
onUnmounted(() => clearInterval(timer))

const isUncontacted = (l: Lead) => l.stage === 'nuevo' && !l.first_contact_at

/** Semáforo de un lead nuevo sin contactar, contado desde que se asignó (o llegó). */
function urgency(l: Lead): { level: 'warn' | 'late'; text: string } | null {
  if (!isUncontacted(l)) return null
  const mins = minutesSince(l.assigned_at ?? l.created_at, now.value)
  if (mins >= UNCONTACTED_LATE_MIN) return { level: 'late', text: `Sin contactar · ${formatDuration(mins)}` }
  if (mins >= UNCONTACTED_WARN_MIN) return { level: 'warn', text: `Sin contactar · ${formatDuration(mins)}` }
  return null
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  const digits = term.replace(/\D/g, '')
  return leads.value.filter((l) => {
    if (stage.value === 'abiertos' ? isClosed(l.stage) : stage.value !== 'todas' && l.stage !== stage.value) return false
    if (advisor.value === 'none' ? l.advisor_id : advisor.value && l.advisor_id !== advisor.value) return false
    if (source.value && l.source !== source.value) return false
    if (interest.value && l.interest !== interest.value) return false
    if (uncontacted.value && !isUncontacted(l)) return false
    if (term) {
      const c = l.contact
      const hit = c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
        || (digits.length >= 3 && !!c.phone && c.phone.includes(digits)) || !!l.property?.title.toLowerCase().includes(term)
      if (!hit) return false
    }
    return true
  })
})

const newCount = computed(() => leads.value.filter(isUncontacted).length)
const hasFilters = computed(() => !!(q.value || advisor.value || source.value || interest.value || uncontacted.value || stage.value !== 'abiertos'))
function clear() { q.value = ''; stage.value = 'abiertos'; advisor.value = ''; source.value = ''; interest.value = ''; uncontacted.value = false }
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="eyebrow">Panel</p>
      <h1 class="mt-2 text-4xl">Leads</h1>
      <p class="mt-2 max-w-xl text-sm text-ink-soft">
        Personas interesadas que llegaron por el sitio o que registraste a mano.
        <template v-if="!isManager">Aquí ves solo los que te asignaron.</template>
      </p>
    </div>
    <router-link to="/admin/leads/nuevo" class="btn btn-primary">Nuevo lead</router-link>
  </div>

  <p v-if="error" class="mt-6 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error }}</p>
  <p v-if="loading" class="mt-10 text-sm text-ink-soft">Cargando…</p>

  <template v-else-if="!error">
    <p v-if="newCount" class="mt-6 bg-sand px-4 py-3 text-sm text-ink">
      <strong class="font-medium">{{ newCount }}</strong> {{ newCount === 1 ? 'lead nuevo espera' : 'leads nuevos esperan' }} su primer contacto.
    </p>

    <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input v-model="q" type="search" class="field sm:col-span-2" placeholder="Buscar por nombre, teléfono, correo o propiedad" aria-label="Buscar" />
      <select v-model="stage" class="field" aria-label="Etapa">
        <option value="abiertos">Abiertos</option>
        <option value="todas">Todas (con cerrados recientes)</option>
        <option v-for="s in STAGES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <select v-if="isManager" v-model="advisor" class="field" aria-label="Asesor">
        <option value="">Todos los asesores</option>
        <option value="none">Sin asignar</option>
        <option v-for="a in advisors" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <select v-model="source" class="field" aria-label="Fuente">
        <option value="">Todas las fuentes</option>
        <option v-for="s in SOURCES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <select v-model="interest" class="field" aria-label="Interés">
        <option value="">Todos los intereses</option>
        <option v-for="i in INTERESTS" :key="i.value" :value="i.value">{{ i.label }}</option>
      </select>
      <label class="flex h-12 items-center gap-3 text-sm">
        <input v-model="uncontacted" type="checkbox" class="h-4 w-4 accent-brand-600" />
        Solo sin contactar
      </label>
    </div>

    <p v-if="!leads.length" class="mt-10 text-ink-soft">
      Aún no hay leads. Llegan cuando alguien llena el formulario del sitio, o puedes <router-link to="/admin/leads/nuevo" class="text-brand-600 hover:text-brand-700">registrar uno</router-link>.
    </p>
    <div v-else-if="!filtered.length" class="mt-10 text-ink-soft">
      Ningún lead coincide con los filtros.
      <button v-if="hasFilters" class="text-brand-600 hover:text-brand-700" @click="clear">Quitar filtros</button>
    </div>

    <template v-else>
      <p class="mt-6 text-xs text-ink-soft">{{ filtered.length }} {{ filtered.length === 1 ? 'lead' : 'leads' }}</p>
      <div class="mt-2 overflow-x-auto border border-line bg-white">
        <table class="w-full min-w-[800px] text-left text-sm">
          <thead class="border-b border-line bg-sand text-xs uppercase tracking-widest text-ink-soft">
            <tr>
              <th class="p-3">Cliente</th><th class="p-3">Interés</th><th class="p-3">Propiedad</th><th class="p-3">Etapa</th>
              <th v-if="isManager" class="p-3">Asesor</th><th class="p-3">Llegó</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in filtered" :key="l.id" class="border-b border-line last:border-0 hover:bg-paper">
              <td class="p-3">
                <router-link :to="`/admin/leads/${l.id}`" class="font-medium text-brand-600 hover:text-brand-700">{{ l.contact.name }}</router-link>
                <p class="text-xs text-ink-soft">{{ l.contact.phone ? `+${l.contact.phone}` : l.contact.email }}</p>
              </td>
              <td class="p-3">{{ interestLabel(l.interest) }}<p class="text-xs text-ink-soft">{{ sourceLabel(l.source) }}</p></td>
              <td class="max-w-[14rem] truncate p-3" :title="l.property?.title">{{ l.property?.title ?? '—' }}</td>
              <td class="p-3">
                <StageBadge :stage="l.stage" />
                <p v-if="urgency(l)" class="mt-1 text-xs font-medium" :class="urgency(l)!.level === 'late' ? 'text-red-700' : 'text-amber-700'">{{ urgency(l)!.text }}</p>
              </td>
              <td v-if="isManager" class="p-3" :class="{ 'text-red-700': !l.advisor }">{{ l.advisor?.name ?? 'Sin asignar' }}</td>
              <td class="whitespace-nowrap p-3 text-ink-soft" :title="l.created_at">{{ timeAgo(l.created_at, now) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </template>
</template>
