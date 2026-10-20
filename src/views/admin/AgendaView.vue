<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TaskForm from '../../components/admin/TaskForm.vue'
import TaskRow from '../../components/admin/TaskRow.vue'
import { listAdvisors, type Advisor } from '../../lib/advisors'
import { isManager, staff } from '../../lib/auth'
import { AGENDA_UPCOMING_DAYS, interestLabel, isClosed } from '../../lib/crm'
import { addDays, startOfDay } from '../../lib/format'
import { leadError, listLeads } from '../../lib/leads'
import { createTask, deleteTask, listPendingTasks, setTaskDone, type NewTask, type Task } from '../../lib/tasks'

const tasks = ref<Task[]>([])
const advisors = ref<Advisor[]>([])
const leadOptions = ref<{ id: string; label: string }[] | null>(null)
const loading = ref(true)
const error = ref('')

const advisorFilter = ref('') // '' = todo el equipo (solo la dirección lo cambia)
const showForm = ref(false)
const saving = ref(false)
const formError = ref('')

// Reloj para que "vencida" y las secciones avancen sin recargar.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

async function reload() {
  tasks.value = await listPendingTasks()
}

onMounted(async () => {
  timer = setInterval(() => { now.value = Date.now() }, 60_000)
  try {
    const [, a] = await Promise.all([reload(), isManager.value ? listAdvisors() : Promise.resolve([])])
    advisors.value = a.filter((x) => x.active)
  } catch (e) { error.value = leadError(e) } finally { loading.value = false }
})
onUnmounted(() => clearInterval(timer))

const visible = computed(() => tasks.value.filter((t) => !advisorFilter.value || t.advisor_id === advisorFilter.value))

/**
 * Secciones por fecha. Una tarea que acabas de marcar como hecha se queda tachada en su sección
 * hasta recargar (así puedes deshacerlo); el contador solo cuenta las pendientes.
 */
const groups = computed(() => {
  const t = now.value
  const today = startOfDay(t)
  const edge = (days: number) => addDays(today, days).getTime()
  const buckets = [
    { key: 'vencidas', label: 'Vencidas', late: true, has: (d: number) => d < t },
    { key: 'hoy', label: 'Hoy', late: false, has: (d: number) => d >= t && d < edge(1) },
    { key: 'manana', label: 'Mañana', late: false, has: (d: number) => d >= edge(1) && d < edge(2) },
    { key: 'proximos', label: `Próximos ${AGENDA_UPCOMING_DAYS} días`, late: false, has: (d: number) => d >= edge(2) && d < edge(AGENDA_UPCOMING_DAYS + 1) },
    { key: 'despues', label: 'Más adelante', late: false, has: (d: number) => d >= edge(AGENDA_UPCOMING_DAYS + 1) },
  ]
  return buckets
    .map((b) => {
      const items = visible.value.filter((x) => b.has(new Date(x.due_at).getTime()))
      return { ...b, items, pending: items.filter((x) => !x.done_at).length }
    })
    .filter((b) => b.items.length)
})
const pendingCount = computed(() => visible.value.filter((t) => !t.done_at).length)

async function openForm() {
  formError.value = ''
  showForm.value = true
  if (leadOptions.value) return
  try {
    const leads = await listLeads()
    leadOptions.value = leads.filter((l) => !isClosed(l.stage)).map((l) => ({ id: l.id, label: `${l.contact.name} · ${interestLabel(l.interest)}` }))
  } catch (e) { formError.value = leadError(e) }
}

async function create(n: NewTask) {
  saving.value = true
  formError.value = ''
  try {
    await createTask(n)
    showForm.value = false
    await reload()
  } catch (e) { formError.value = leadError(e) } finally { saving.value = false }
}

async function toggle(t: Task) {
  error.value = ''
  try { t.done_at = await setTaskDone(t.id, !t.done_at) } catch (e) { error.value = leadError(e) }
}

async function remove(t: Task) {
  if (!confirm(`¿Eliminar la tarea "${t.title}"?`)) return
  error.value = ''
  try {
    await deleteTask(t.id)
    tasks.value = tasks.value.filter((x) => x.id !== t.id)
  } catch (e) { error.value = leadError(e) }
}
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="eyebrow">Panel</p>
      <h1 class="mt-2 text-4xl">Agenda</h1>
      <p class="mt-2 max-w-xl text-sm text-ink-soft">
        Tus seguimientos pendientes: llamadas, mensajes y visitas.
        <template v-if="isManager">Como parte de la dirección ves las de todo el equipo.</template>
        Las tareas de un cliente también se crean desde su ficha en Leads.
      </p>
    </div>
    <button v-if="!showForm" class="btn btn-primary" @click="openForm">Nueva tarea</button>
  </div>

  <section v-if="showForm && staff" class="mt-6 max-w-2xl border border-line bg-white p-6">
    <p class="mb-4 text-sm font-medium text-ink">Nueva tarea</p>
    <TaskForm
      :advisor-id="staff.id" :leads="leadOptions ?? []" :advisors="isManager ? advisors : undefined"
      :busy="saving" :error="formError" @submit="create" @cancel="showForm = false"
    />
  </section>

  <p v-if="error" class="mt-6 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error }}</p>
  <p v-if="loading" class="mt-10 text-sm text-ink-soft">Cargando…</p>

  <template v-else-if="!error">
    <div v-if="isManager" class="mt-6 max-w-xs">
      <select v-model="advisorFilter" class="field" aria-label="Responsable">
        <option value="">Todo el equipo</option>
        <option v-for="a in advisors" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </div>

    <p v-if="!groups.length" class="mt-10 text-ink-soft">
      {{ tasks.length ? 'Este asesor no tiene tareas pendientes.' : 'No hay tareas pendientes. Crea una aquí o desde la ficha de un lead.' }}
    </p>

    <template v-else>
      <p class="mt-6 text-xs text-ink-soft">{{ pendingCount }} {{ pendingCount === 1 ? 'tarea pendiente' : 'tareas pendientes' }}</p>
      <section v-for="g in groups" :key="g.key" class="mt-6">
        <h2 class="text-lg" :class="g.late ? 'text-red-700' : ''">
          {{ g.label }} <span class="text-sm font-normal text-ink-soft">· {{ g.pending }}</span>
        </h2>
        <ul class="mt-2 border border-line bg-white px-4">
          <TaskRow
            v-for="t in g.items" :key="t.id" :task="t" :now="now" show-lead :show-advisor="isManager"
            @toggle="toggle" @remove="remove"
          />
        </ul>
      </section>
    </template>
  </template>
</template>
