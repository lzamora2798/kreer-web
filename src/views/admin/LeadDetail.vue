<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LeadTimeline from '../../components/admin/LeadTimeline.vue'
import LostReasonDialog from '../../components/admin/LostReasonDialog.vue'
import StageBadge from '../../components/admin/StageBadge.vue'
import TaskForm from '../../components/admin/TaskForm.vue'
import TaskRow from '../../components/admin/TaskRow.vue'
import { isValidWhatsapp, listAdvisors, normalizeWhatsapp, type Advisor } from '../../lib/advisors'
import { isManager, staff } from '../../lib/auth'
import { DIRECTIONAL_EVENTS, MANUAL_EVENTS, STAGES, interestLabel, isClosed, sourceLabel, type ManualEventKind, type Stage } from '../../lib/crm'
import { formatDateTime } from '../../lib/format'
import { addEvent, assignLead, getLead, leadError, listEvents, saveContact, setStage, type Lead, type LeadEvent } from '../../lib/leads'
import { createTask, deleteTask, listLeadTasks, setTaskDone, type NewTask, type Task } from '../../lib/tasks'

const props = defineProps<{ id: string }>()

const lead = ref<Lead | null>(null)
const events = ref<LeadEvent[]>([])
const advisors = ref<Advisor[]>([])
const loading = ref(true)
const error = ref('')

// Contacto editable
const contact = ref({ name: '', phone: '', email: '', notes: '' })
const contactBusy = ref(false)
const contactMsg = ref('')

// Cambio de etapa / asesor
const askLost = ref(false)
const stageBusy = ref(false)
const actionError = ref('')

// Compositor del historial
const kind = ref<ManualEventKind>('nota')
const direction = ref<'entrante' | 'saliente'>('saliente')
const body = ref('')
const noteBusy = ref(false)
const noteError = ref('')

// Tareas del lead. Se cargan aparte: si fallan, el resto de la ficha sigue funcionando.
const DONE_PREVIEW = 3 // tareas hechas que se muestran antes de "Ver más"
const tasks = ref<Task[]>([])
const tasksError = ref('')
const showTaskForm = ref(false)
const showAllDone = ref(false)
const taskBusy = ref(false)
const taskFormError = ref('')
const now = ref(Date.now()) // avanza solo para que "vencida" se actualice
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60_000) })
onUnmounted(() => clearInterval(timer))

const directional = computed(() => DIRECTIONAL_EVENTS.includes(kind.value))
const waLink = computed(() => (lead.value?.contact.phone ? `https://wa.me/${lead.value.contact.phone}` : ''))
const utmText = computed(() => Object.entries(lead.value?.utm ?? {}).map(([k, v]) => `${k.replace('utm_', '')}: ${v}`).join(' · '))
// Quien puede ser responsable: personas activas (la dirección también puede atender).
const assignable = computed(() => advisors.value.filter((a) => a.active || a.id === lead.value?.advisor_id))

// La tarea es de quien atiende el lead; si no tiene asesor, de quien la crea. Solo la dirección puede elegir otra persona.
const taskAdvisorId = computed(() => lead.value?.advisor_id ?? staff.value?.id ?? '')
const taskAdvisors = computed(() => (isManager.value ? assignable.value.map((a) => ({ id: a.id, name: a.name })) : undefined))
const doneTasks = computed(() => tasks.value.filter((t) => t.done_at))
const shownTasks = computed(() => [
  ...tasks.value.filter((t) => !t.done_at),
  ...(showAllDone.value ? doneTasks.value : doneTasks.value.slice(0, DONE_PREVIEW)),
])
const hiddenDone = computed(() => (showAllDone.value ? 0 : Math.max(0, doneTasks.value.length - DONE_PREVIEW)))

function fillContact(l: Lead) {
  contact.value = { name: l.contact.name, phone: l.contact.phone ?? '', email: l.contact.email, notes: l.contact.notes }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [l, ev, adv] = await Promise.all([getLead(props.id), listEvents(props.id), isManager.value ? listAdvisors() : Promise.resolve([])])
    if (!l) { error.value = 'Lead no encontrado, o no tienes acceso a él.'; return }
    lead.value = l
    events.value = ev
    advisors.value = adv
    fillContact(l)
    showTaskForm.value = false
    showAllDone.value = false
    void loadTasks()
  } catch (e) { error.value = leadError(e) } finally { loading.value = false }
}

async function loadTasks() {
  tasksError.value = ''
  try { tasks.value = await listLeadTasks(props.id) } catch (e) { tasksError.value = leadError(e) }
}

async function addTask(n: NewTask) {
  if (!lead.value) return
  taskBusy.value = true
  taskFormError.value = ''
  try {
    await createTask({ ...n, leadId: lead.value.id })
    showTaskForm.value = false
    await loadTasks()
  } catch (err) { taskFormError.value = leadError(err) } finally { taskBusy.value = false }
}

async function toggleTask(t: Task) {
  tasksError.value = ''
  try { await setTaskDone(t.id, !t.done_at); await loadTasks() } catch (err) { tasksError.value = leadError(err) }
}

async function removeTask(t: Task) {
  if (!confirm(`¿Eliminar la tarea "${t.title}"?`)) return
  tasksError.value = ''
  try { await deleteTask(t.id); await loadTasks() } catch (err) { tasksError.value = leadError(err) }
}
onMounted(load)
watch(() => props.id, load)

/** Vuelve a leer el lead y su historial (los triggers de la base escriben eventos al cambiar etapa o asesor). */
async function refresh() {
  const [l, ev] = await Promise.all([getLead(props.id), listEvents(props.id)])
  if (l) { lead.value = l; fillContact(l) }
  events.value = ev
}

async function changeStage(e: Event) {
  const select = e.target as HTMLSelectElement
  const next = select.value as Stage
  if (!lead.value || next === lead.value.stage) return
  actionError.value = ''
  if (next === 'perdido') { select.value = lead.value.stage; askLost.value = true; return }
  stageBusy.value = true
  try { await setStage(lead.value.id, next); await refresh() } catch (err) { actionError.value = leadError(err); select.value = lead.value.stage } finally { stageBusy.value = false }
}

async function confirmLost(reason: string) {
  if (!lead.value) return
  stageBusy.value = true
  actionError.value = ''
  try { await setStage(lead.value.id, 'perdido', reason); askLost.value = false; await refresh() } catch (err) { actionError.value = leadError(err); askLost.value = false } finally { stageBusy.value = false }
}

async function changeAdvisor(e: Event) {
  const select = e.target as HTMLSelectElement
  if (!lead.value) return
  actionError.value = ''
  try { await assignLead(lead.value.id, select.value || null); await refresh() } catch (err) { actionError.value = leadError(err); select.value = lead.value.advisor_id ?? '' }
}

async function submitContact() {
  if (!lead.value) return
  contactMsg.value = ''
  const name = contact.value.name.trim()
  const email = contact.value.email.trim()
  const digits = contact.value.phone.trim() ? normalizeWhatsapp(contact.value.phone) : null
  if (!name) { contactMsg.value = 'Escribe el nombre.'; return }
  if (digits && !isValidWhatsapp(digits)) { contactMsg.value = 'Teléfono inválido. Ejemplo: 0987654321 o +593 98 765 4321.'; return }
  if (!digits && !email) { contactMsg.value = 'Indica un teléfono o un correo.'; return }
  contactBusy.value = true
  try {
    await saveContact({ id: lead.value.contact.id, name, phone: digits, email, notes: contact.value.notes.trim() })
    await refresh()
    contactMsg.value = 'Datos guardados.'
  } catch (err) { contactMsg.value = leadError(err) } finally { contactBusy.value = false }
}

async function submitEvent() {
  if (!lead.value || !staff.value) return
  noteError.value = ''
  if (kind.value === 'nota' && !body.value.trim()) { noteError.value = 'Escribe la nota.'; return }
  noteBusy.value = true
  try {
    await addEvent(lead.value.id, staff.value.id, kind.value, directional.value ? direction.value : null, body.value)
    body.value = ''
    await refresh()
  } catch (err) { noteError.value = leadError(err) } finally { noteBusy.value = false }
}
</script>

<template>
  <router-link to="/admin/leads" class="text-sm text-brand-600 hover:text-brand-700">← Volver a leads</router-link>
  <p v-if="loading" class="mt-8 text-sm text-ink-soft">Cargando…</p>
  <p v-else-if="error" class="mt-8 border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error }}</p>

  <template v-else-if="lead">
    <div class="mt-3 flex flex-wrap items-center gap-4">
      <h1 class="text-4xl">{{ lead.contact.name }}</h1>
      <StageBadge :stage="lead.stage" />
    </div>
    <p class="mt-2 text-sm text-ink-soft">
      {{ interestLabel(lead.interest) }} · {{ sourceLabel(lead.source) }} · llegó el {{ formatDateTime(lead.created_at) }}
    </p>

    <div class="mt-6 flex flex-wrap gap-3">
      <a v-if="lead.contact.phone" :href="`tel:+${lead.contact.phone}`" class="btn btn-ghost !border-line !text-brand-600 hover:!bg-sand hover:!text-brand-700">Llamar</a>
      <a v-if="waLink" :href="waLink" target="_blank" rel="noopener" class="btn btn-ghost !border-line !text-brand-600 hover:!bg-sand hover:!text-brand-700">WhatsApp</a>
      <a v-if="lead.contact.email" :href="`mailto:${lead.contact.email}`" class="btn btn-ghost !border-line !text-brand-600 hover:!bg-sand hover:!text-brand-700">Correo</a>
    </div>

    <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <div class="grid content-start gap-6">
        <section class="grid gap-4 border border-line bg-white p-6">
          <p class="text-sm font-medium text-ink">Seguimiento</p>
          <label class="grid gap-1 text-sm">Etapa
            <select class="field" :value="lead.stage" :disabled="stageBusy" @change="changeStage">
              <option v-for="s in STAGES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </label>
          <p v-if="lead.stage === 'perdido' && lead.lost_reason" class="-mt-1 text-sm text-ink-soft">Motivo: {{ lead.lost_reason }}</p>
          <p v-if="isClosed(lead.stage) && lead.closed_at" class="-mt-1 text-xs text-ink-soft">Cerrado el {{ formatDateTime(lead.closed_at) }}</p>

          <label v-if="isManager" class="grid gap-1 text-sm">Asesor
            <select class="field" :value="lead.advisor_id ?? ''" @change="changeAdvisor">
              <option value="">Sin asignar</option>
              <option v-for="a in assignable" :key="a.id" :value="a.id">{{ a.name }}{{ a.active ? '' : ' (inactivo)' }}</option>
            </select>
          </label>
          <p v-else class="text-sm">Asesor: <span class="text-ink">{{ lead.advisor?.name ?? 'Sin asignar' }}</span></p>

          <p v-if="actionError" class="text-sm text-red-700" role="alert">{{ actionError }}</p>

          <dl class="grid gap-2 border-t border-line pt-4 text-sm">
            <div v-if="lead.property" class="flex justify-between gap-4"><dt class="text-ink-soft">Propiedad</dt><dd class="text-right text-ink">{{ lead.property.title }}</dd></div>
            <div v-if="lead.first_contact_at" class="flex justify-between gap-4"><dt class="text-ink-soft">Primer contacto</dt><dd class="text-right text-ink">{{ formatDateTime(lead.first_contact_at) }}</dd></div>
            <div v-if="utmText" class="flex justify-between gap-4"><dt class="text-ink-soft">Campaña</dt><dd class="text-right text-ink">{{ utmText }}</dd></div>
          </dl>
          <div v-if="lead.message" class="border-t border-line pt-4 text-sm">
            <p class="text-ink-soft">Mensaje inicial</p>
            <p class="mt-1 whitespace-pre-line text-ink-body">{{ lead.message }}</p>
          </div>
        </section>

        <form class="grid gap-3 border border-line bg-white p-6" @submit.prevent="submitContact">
          <p class="text-sm font-medium text-ink">Datos del contacto</p>
          <input v-model="contact.name" class="field" placeholder="Nombre completo" required maxlength="120" aria-label="Nombre" />
          <input v-model="contact.phone" class="field" placeholder="Teléfono / WhatsApp" aria-label="Teléfono" />
          <input v-model="contact.email" type="email" class="field" placeholder="Correo" maxlength="160" aria-label="Correo" />
          <textarea v-model="contact.notes" rows="3" maxlength="2000" class="field !h-auto py-3" placeholder="Notas sobre el cliente (presupuesto, familia, preferencias…)" aria-label="Notas del contacto" />
          <button class="btn btn-primary" :disabled="contactBusy">{{ contactBusy ? 'Guardando…' : 'Guardar datos' }}</button>
          <p v-if="contactMsg" class="text-sm" :class="contactMsg === 'Datos guardados.' ? 'text-ink-soft' : 'text-red-700'" role="status">{{ contactMsg }}</p>
        </form>
      </div>

      <div class="grid content-start gap-6">
        <section class="border border-line bg-white p-6">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-ink">Tareas</p>
            <button v-if="!showTaskForm" type="button" class="text-sm text-brand-600 hover:text-brand-700" @click="showTaskForm = true">+ Nueva tarea</button>
          </div>
          <div v-if="showTaskForm" class="mt-4 border-b border-line pb-5">
            <TaskForm
              :advisor-id="taskAdvisorId" :lead-id="lead.id" :advisors="taskAdvisors"
              :busy="taskBusy" :error="taskFormError" @submit="addTask" @cancel="showTaskForm = false"
            />
          </div>
          <p v-if="tasksError" class="mt-3 text-sm text-red-700" role="alert">{{ tasksError }}</p>
          <ul v-if="shownTasks.length" class="mt-2">
            <TaskRow v-for="t in shownTasks" :key="t.id" :task="t" :now="now" :show-advisor="isManager" @toggle="toggleTask" @remove="removeTask" />
          </ul>
          <p v-else-if="!tasksError && !showTaskForm" class="mt-3 text-sm text-ink-soft">
            Sin tareas. Agenda el próximo paso (una llamada, una visita…) para no perder el seguimiento.
          </p>
          <button v-if="hiddenDone" type="button" class="mt-2 text-xs text-brand-600 hover:text-brand-700" @click="showAllDone = true">
            Ver {{ hiddenDone }} {{ hiddenDone === 1 ? 'hecha más' : 'hechas más' }}
          </button>
        </section>

        <form class="grid gap-3 border border-line bg-white p-6" @submit.prevent="submitEvent">
          <p class="text-sm font-medium text-ink">Registrar actividad</p>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Tipo de actividad">
            <button
              v-for="k in MANUAL_EVENTS" :key="k.value" type="button"
              class="border px-3 py-1.5 text-sm transition-colors"
              :class="kind === k.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-body hover:bg-sand'"
              :aria-pressed="kind === k.value"
              @click="kind = k.value"
            >{{ k.label }}</button>
          </div>
          <div v-if="directional" class="flex gap-5 text-sm" role="radiogroup" aria-label="Dirección">
            <label class="flex items-center gap-2"><input v-model="direction" type="radio" value="saliente" class="accent-brand-600" /> La hice yo (saliente)</label>
            <label class="flex items-center gap-2"><input v-model="direction" type="radio" value="entrante" class="accent-brand-600" /> Escribió / llamó el cliente (entrante)</label>
          </div>
          <textarea v-model="body" rows="3" maxlength="4000" class="field !h-auto py-3" :placeholder="kind === 'nota' ? 'Escribe una nota…' : 'Qué se habló (opcional)'" aria-label="Detalle" />
          <button class="btn btn-primary" :disabled="noteBusy">{{ noteBusy ? 'Guardando…' : 'Registrar' }}</button>
          <p v-if="noteError" class="text-sm text-red-700" role="alert">{{ noteError }}</p>
        </form>

        <section class="border border-line bg-white p-6">
          <p class="mb-5 text-sm font-medium text-ink">Historial</p>
          <LeadTimeline :events="events" />
        </section>
      </div>
    </div>

    <LostReasonDialog v-if="askLost" :busy="stageBusy" @confirm="confirmLost" @cancel="askLost = false" />
  </template>
</template>
