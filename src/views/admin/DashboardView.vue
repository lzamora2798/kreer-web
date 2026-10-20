<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BarList from '../../components/admin/BarList.vue'
import KpiTile from '../../components/admin/KpiTile.vue'
import TaskRow from '../../components/admin/TaskRow.vue'
import { isManager } from '../../lib/auth'
import { PERIODS, STAGES, UNCONTACTED_LATE_MIN, UNCONTACTED_WARN_MIN, interestLabel, isClosed, sourceLabel, type Period } from '../../lib/crm'
import { addDays, formatDuration, formatNumber, formatPercent, minutesSince, startOfDay } from '../../lib/format'
import { leadError, listUncontacted, type Lead } from '../../lib/leads'
import { countUnassigned, getFunnel, getMetrics, leadsBySource, periodRange, type AdvisorMetrics } from '../../lib/metrics'
import { listPendingTasks, setTaskDone, type Task } from '../../lib/tasks'

const UNCONTACTED_SHOWN = 6
const TASKS_SHOWN = 6

// Reloj para que las antigüedades y "vencida" avancen sin recargar.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onUnmounted(() => clearInterval(timer))

/* ---------- Para atender ahora (no depende del periodo) ---------- */

const uncontacted = ref<Lead[]>([])
const uncontactedTotal = ref(0)
const pendingTasks = ref<Task[]>([])
const funnel = ref<Record<string, number>>({})
const unassigned = ref(0)
const nowLoading = ref(true)
const nowError = ref('')
const actionError = ref('')

async function loadNow() {
  try {
    const [u, t, f, un] = await Promise.all([
      listUncontacted(UNCONTACTED_SHOWN), listPendingTasks(), getFunnel(), isManager.value ? countUnassigned() : Promise.resolve(0),
    ])
    uncontacted.value = u.items
    uncontactedTotal.value = u.total
    pendingTasks.value = t
    funnel.value = f
    unassigned.value = un
  } catch (e) { nowError.value = leadError(e) } finally { nowLoading.value = false }
}

const endOfToday = computed(() => addDays(startOfDay(now.value), 1).getTime())
const dueMs = (t: Task) => new Date(t.due_at).getTime()
// Vencidas y de hoy, de la más atrasada a la más próxima. Una que acabas de marcar queda tachada hasta recargar (para poder deshacer).
const dueTasks = computed(() => pendingTasks.value.filter((t) => dueMs(t) < endOfToday.value))
const overdueCount = computed(() => dueTasks.value.filter((t) => !t.done_at && dueMs(t) < now.value).length)
const todayCount = computed(() => dueTasks.value.filter((t) => !t.done_at && dueMs(t) >= now.value).length)
const tasksSummary = computed(() => {
  const parts = []
  if (overdueCount.value) parts.push(`${overdueCount.value} ${overdueCount.value === 1 ? 'vencida' : 'vencidas'}`)
  if (todayCount.value) parts.push(`${todayCount.value} para hoy`)
  return parts.join(' · ')
})

/** Tiempo que lleva el lead esperando, con el mismo semáforo de la lista de leads. */
function waiting(l: Lead) {
  const m = minutesSince(l.assigned_at ?? l.created_at, now.value)
  return { text: formatDuration(m), cls: m >= UNCONTACTED_LATE_MIN ? 'text-red-700' : m >= UNCONTACTED_WARN_MIN ? 'text-amber-700' : 'text-ink-soft' }
}

async function toggleTask(t: Task) {
  actionError.value = ''
  try { t.done_at = await setTaskDone(t.id, !t.done_at) } catch (e) { actionError.value = leadError(e) }
}

// Solo las etapas abiertas: ganado y perdido se miden por periodo, en las cifras de abajo.
const funnelItems = computed(() => STAGES.filter((s) => !isClosed(s.value)).map((s) => ({ key: s.value, label: s.label, value: funnel.value[s.value] ?? 0 })))

/* ---------- Rendimiento (depende del periodo) ---------- */

const period = ref<Period>('30')
const rows = ref<AdvisorMetrics[]>([])
const sources = ref<{ source: string; total: number }[]>([])
const periodLoading = ref(true)
const loadedOnce = ref(false)
const periodError = ref('')
let loadSeq = 0 // si cambias de periodo mientras carga otro, la respuesta vieja se descarta

async function loadPeriod() {
  const mine = ++loadSeq
  periodLoading.value = true
  periodError.value = ''
  const { from, to } = periodRange(period.value)
  try {
    const [m, s] = await Promise.all([getMetrics(from, to), leadsBySource(from, to)])
    if (mine !== loadSeq) return
    rows.value = m
    sources.value = s
    loadedOnce.value = true
  } catch (e) {
    if (mine === loadSeq) periodError.value = leadError(e)
  } finally { if (mine === loadSeq) periodLoading.value = false }
}
watch(period, loadPeriod)

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 60_000)
  void loadNow()
  void loadPeriod()
})

const dayMonth = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' })
const rangeLabel = computed(() => {
  const { from, to } = periodRange(period.value, now.value)
  return `Del ${dayMonth.format(from)} al ${dayMonth.format(addDays(to, -1))}`
})

type Count = 'received' | 'contacted' | 'calls' | 'followups' | 'visits' | 'negotiations' | 'won' | 'lost'
const sum = (k: Count) => rows.value.reduce((s, r) => s + r[k], 0)
const totals = computed(() => ({
  received: sum('received'), contacted: sum('contacted'), calls: sum('calls'), followups: sum('followups'),
  visits: sum('visits'), negotiations: sum('negotiations'), won: sum('won'), lost: sum('lost'),
}))
// Promedio de los promedios de cada asesor, ponderado por los leads que contactó.
function weightedResponse(list: AdvisorMetrics[]): number | null {
  let acc = 0
  let weight = 0
  for (const r of list) if (r.avg_response_minutes != null && r.contacted) { acc += r.avg_response_minutes * r.contacted; weight += r.contacted }
  return weight ? acc / weight : null
}
const response = (min: number | null) => (min == null ? '—' : formatDuration(Math.round(min)))
const sourceItems = computed(() => sources.value.map((s) => ({ key: s.source, label: sourceLabel(s.source), value: s.total })))
const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`
</script>

<template>
  <p class="eyebrow">Panel</p>
  <h1 class="mt-2 text-4xl">Resumen</h1>
  <p class="mt-2 max-w-xl text-sm text-ink-soft">
    {{ isManager ? 'El estado del equipo: qué necesita atención y cómo va el periodo.' : 'Tu actividad: qué necesita atención y cómo va tu periodo.' }}
  </p>

  <!-- ===== Para atender ahora ===== -->
  <h2 class="mt-10 text-2xl">Para atender ahora</h2>
  <p v-if="nowError" class="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ nowError }}</p>
  <p v-else-if="nowLoading" class="mt-4 text-sm text-ink-soft">Cargando…</p>

  <template v-else>
    <p v-if="actionError" class="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ actionError }}</p>
    <p v-if="isManager && unassigned" class="mt-4 bg-sand px-4 py-3 text-sm text-ink">
      <strong class="font-medium">{{ formatNumber(unassigned) }}</strong>
      {{ unassigned === 1 ? 'lead abierto no tiene asesor.' : 'leads abiertos no tienen asesor.' }}
      <router-link to="/admin/leads" class="font-medium text-brand-600 hover:text-brand-700">Revisar en Leads →</router-link>
    </p>

    <div class="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <section class="border border-line bg-white p-6">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-sm font-medium text-ink">Esperan su primer contacto</p>
          <span class="text-sm tabular-nums text-ink-soft">{{ formatNumber(uncontactedTotal) }}</span>
        </div>
        <p v-if="!uncontacted.length" class="mt-3 text-sm text-ink-soft">Todo al día: ningún lead espera una primera respuesta.</p>
        <ul v-else class="mt-2">
          <li v-for="l in uncontacted" :key="l.id" class="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
            <div class="min-w-0">
              <router-link :to="`/admin/leads/${l.id}`" class="block truncate text-sm font-medium text-brand-600 hover:text-brand-700">{{ l.contact.name }}</router-link>
              <p class="truncate text-xs text-ink-soft">
                {{ interestLabel(l.interest) }}
                <template v-if="isManager"> · <span :class="l.advisor ? '' : 'text-red-700'">{{ l.advisor?.name ?? 'Sin asignar' }}</span></template>
              </p>
            </div>
            <span class="shrink-0 text-xs font-medium tabular-nums" :class="waiting(l).cls">{{ waiting(l).text }}</span>
          </li>
        </ul>
        <router-link v-if="uncontactedTotal > uncontacted.length" to="/admin/leads" class="mt-2 inline-block text-xs text-brand-600 hover:text-brand-700">
          Ver los {{ formatNumber(uncontactedTotal) }} en Leads →
        </router-link>
      </section>

      <section class="border border-line bg-white p-6">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-sm font-medium text-ink">Tareas de hoy</p>
          <span v-if="tasksSummary" class="text-sm" :class="overdueCount ? 'font-medium text-red-700' : 'text-ink-soft'">{{ tasksSummary }}</span>
        </div>
        <p v-if="!dueTasks.length" class="mt-3 text-sm text-ink-soft">Sin tareas vencidas ni para hoy.</p>
        <ul v-else class="mt-2">
          <TaskRow
            v-for="t in dueTasks.slice(0, TASKS_SHOWN)" :key="t.id" :task="t" :now="now" show-lead :show-advisor="isManager" no-remove
            @toggle="toggleTask"
          />
        </ul>
        <router-link to="/admin/agenda" class="mt-2 inline-block text-xs text-brand-600 hover:text-brand-700">
          {{ dueTasks.length > TASKS_SHOWN ? `Ver las ${dueTasks.length} en la agenda →` : 'Abrir la agenda →' }}
        </router-link>
      </section>

      <section class="border border-line bg-white p-6 md:col-span-2 lg:col-span-1">
        <p class="text-sm font-medium text-ink">{{ isManager ? 'Leads abiertos por etapa' : 'Mis leads abiertos por etapa' }}</p>
        <p class="mt-1 text-xs text-ink-soft">Cuántos hay en cada etapa hoy.</p>
        <div class="mt-3"><BarList :items="funnelItems" empty="No hay leads abiertos." /></div>
      </section>
    </div>
  </template>

  <!-- ===== Rendimiento ===== -->
  <div class="mt-12 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 class="text-2xl">Rendimiento</h2>
      <p class="mt-1 text-sm text-ink-soft">{{ rangeLabel }}</p>
    </div>
    <div class="flex flex-wrap gap-2" role="group" aria-label="Periodo">
      <button
        v-for="p in PERIODS" :key="p.value" type="button"
        class="border px-3 py-1.5 text-sm transition-colors"
        :class="period === p.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-body hover:bg-sand'"
        :aria-pressed="period === p.value"
        @click="period = p.value"
      >{{ p.label }}</button>
    </div>
  </div>

  <p v-if="periodError" class="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ periodError }}</p>
  <p v-else-if="!loadedOnce" class="mt-4 text-sm text-ink-soft">Cargando…</p>

  <!-- Al cambiar de periodo se conserva lo anterior, atenuado, hasta que llegan los datos nuevos -->
  <div v-else class="transition-opacity" :class="periodLoading ? 'opacity-60' : ''" :aria-busy="periodLoading">
    <div class="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiTile label="Recibidos" :value="formatNumber(totals.received)" note="Leads que llegaron en el periodo" />
      <KpiTile label="Contactados" :value="formatNumber(totals.contacted)" :note="`${formatPercent(totals.contacted, totals.received)} de los recibidos`" />
      <KpiTile label="Respuesta media" :value="response(weightedResponse(rows))" note="De la asignación al primer contacto" />
      <KpiTile label="Llamadas" :value="formatNumber(totals.calls)" :note="plural(totals.followups, 'seguimiento', 'seguimientos')" />
      <KpiTile label="Visitas" :value="formatNumber(totals.visits)" note="Registradas en las fichas" />
      <KpiTile label="A negociación" :value="formatNumber(totals.negotiations)" note="Leads que pasaron a esa etapa" />
      <KpiTile label="Ganados" :value="formatNumber(totals.won)" :note="`Conversión ${formatPercent(totals.won, totals.received)} de los recibidos`" />
      <KpiTile label="Perdidos" :value="formatNumber(totals.lost)" note="Cerrados como perdidos" />
    </div>

    <section v-if="isManager" class="mt-8">
      <h3 class="text-lg">Por asesor</h3>
      <div class="mt-2 overflow-x-auto border border-line bg-white">
        <table class="w-full min-w-[820px] text-left text-sm">
          <thead class="border-b border-line bg-sand text-xs uppercase tracking-widest text-ink-soft">
            <tr>
              <th class="whitespace-nowrap p-3">Asesor</th>
              <th class="whitespace-nowrap p-3 text-right">Recibidos</th><th class="whitespace-nowrap p-3 text-right">Contactados</th><th class="whitespace-nowrap p-3 text-right">Respuesta</th>
              <th class="whitespace-nowrap p-3 text-right">Llamadas</th><th class="whitespace-nowrap p-3 text-right">Seguim.</th><th class="whitespace-nowrap p-3 text-right">Visitas</th>
              <th class="whitespace-nowrap p-3 text-right">Negoc.</th><th class="whitespace-nowrap p-3 text-right">Ganados</th><th class="whitespace-nowrap p-3 text-right">Perdidos</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.advisor_id ?? 'none'" class="border-b border-line hover:bg-paper">
              <td class="whitespace-nowrap p-3 font-medium" :class="r.advisor_id ? 'text-ink' : 'text-red-700'">{{ r.advisor_name }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.received) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.contacted) }}</td>
              <td class="p-3 text-right tabular-nums">{{ response(r.avg_response_minutes) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.calls) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.followups) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.visits) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.negotiations) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.won) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(r.lost) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-sand font-medium text-ink">
              <td class="p-3">Total</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.received) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.contacted) }}</td>
              <td class="p-3 text-right tabular-nums">{{ response(weightedResponse(rows)) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.calls) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.followups) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.visits) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.negotiations) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.won) }}</td>
              <td class="p-3 text-right tabular-nums">{{ formatNumber(totals.lost) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="mt-2 text-xs text-ink-soft">
        Recibidos, contactados y respuesta cuentan los leads que llegaron en el periodo; llamadas, seguimientos, visitas, negociaciones, ganados y perdidos, lo que ocurrió en él.
      </p>
    </section>

    <section class="mt-8 max-w-xl border border-line bg-white p-6">
      <p class="text-sm font-medium text-ink">Leads por fuente</p>
      <p class="mt-1 text-xs text-ink-soft">Los que llegaron en el periodo.</p>
      <div class="mt-3"><BarList :items="sourceItems" empty="No llegaron leads en este periodo." /></div>
    </section>
  </div>
</template>
