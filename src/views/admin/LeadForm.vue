<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isValidWhatsapp, listAdvisors, normalizeWhatsapp, type Advisor } from '../../lib/advisors'
import { isManager } from '../../lib/auth'
import { INTERESTS, SOURCES, type Interest, type Source } from '../../lib/crm'
import { createLead, leadError, type NewLeadResult } from '../../lib/leads'
import { listAll, type Property } from '../../lib/properties'

const router = useRouter()

const form = reactive({ name: '', phone: '', email: '', interest: 'comprar' as Interest, source: 'whatsapp' as Source, message: '', propertyId: '', advisorId: '' })
const advisors = ref<Advisor[]>([])
const properties = ref<Property[]>([])
const busy = ref(false)
const error = ref('')
const existing = ref<NewLeadResult | null>(null)

// "Sitio web" lo pone el formulario público; aquí solo se registran los demás orígenes.
const sources = SOURCES.filter((s) => s.value !== 'web')
const assignable = computed(() => advisors.value.filter((a) => a.active))

onMounted(async () => {
  try {
    const [p, a] = await Promise.all([listAll(), isManager.value ? listAdvisors() : Promise.resolve([])])
    properties.value = p
    advisors.value = a
  } catch (e) { error.value = leadError(e) }
})

async function submit() {
  error.value = ''
  existing.value = null
  const digits = form.phone.trim() ? normalizeWhatsapp(form.phone) : ''
  if (digits && !isValidWhatsapp(digits)) { error.value = 'Teléfono inválido. Ejemplo: 0987654321 o +593 98 765 4321.'; return }
  if (!digits && !form.email.trim()) { error.value = 'Indica un teléfono o un correo.'; return }
  busy.value = true
  try {
    const r = await createLead({
      name: form.name.trim(), phone: digits, email: form.email.trim(), interest: form.interest, source: form.source,
      message: form.message.trim(), propertyId: form.propertyId || null, advisorId: form.advisorId || null,
    })
    if (r.status === 'created') router.replace(`/admin/leads/${r.lead_id}`)
    else existing.value = r // el cliente ya tenía una consulta abierta: se agregó una nota en vez de duplicarla
  } catch (e) { error.value = leadError(e) } finally { busy.value = false }
}
</script>

<template>
  <router-link to="/admin/leads" class="text-sm text-brand-600 hover:text-brand-700">← Volver a leads</router-link>
  <h1 class="mt-3 text-4xl">Nuevo lead</h1>
  <p class="mt-2 max-w-xl text-sm text-ink-soft">
    Para personas que te contactan por otro medio (llamada, WhatsApp, Instagram, referidos).
    <template v-if="isManager">Si no eliges asesor, se reparte automáticamente.</template>
    <template v-else>Quedará asignado a ti.</template>
  </p>

  <form class="mt-8 grid max-w-2xl gap-4 border border-line bg-white p-6" @submit.prevent="submit">
    <input v-model="form.name" class="field" placeholder="Nombre completo" required maxlength="120" aria-label="Nombre" />
    <div class="grid gap-4 sm:grid-cols-2">
      <input v-model="form.phone" type="tel" class="field" placeholder="Teléfono / WhatsApp" aria-label="Teléfono" />
      <input v-model="form.email" type="email" class="field" placeholder="Correo" maxlength="160" aria-label="Correo" />
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="grid gap-1 text-sm">Interés
        <select v-model="form.interest" class="field"><option v-for="i in INTERESTS" :key="i.value" :value="i.value">{{ i.label }}</option></select>
      </label>
      <label class="grid gap-1 text-sm">¿Cómo llegó?
        <select v-model="form.source" class="field"><option v-for="s in sources" :key="s.value" :value="s.value">{{ s.label }}</option></select>
      </label>
    </div>
    <label class="grid gap-1 text-sm">Propiedad de interés (opcional)
      <select v-model="form.propertyId" class="field">
        <option value="">Ninguna</option>
        <option v-for="p in properties" :key="p.id" :value="p.id">{{ p.title }}{{ p.published ? '' : ' (borrador)' }}</option>
      </select>
    </label>
    <label v-if="isManager" class="grid gap-1 text-sm">Asesor
      <select v-model="form.advisorId" class="field">
        <option value="">Asignar automáticamente</option>
        <option v-for="a in assignable" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </label>
    <textarea v-model="form.message" rows="4" maxlength="2000" class="field !h-auto py-3" placeholder="Qué busca o qué se conversó" aria-label="Mensaje" />

    <button class="btn btn-primary" :disabled="busy">{{ busy ? 'Guardando…' : 'Registrar lead' }}</button>
    <p v-if="error" class="text-sm text-red-700" role="alert">{{ error }}</p>
    <p v-if="existing" class="bg-sand p-4 text-sm text-ink" role="status">
      Este cliente ya tenía una consulta abierta con el mismo interés, así que no se creó otro lead: se agregó una nota al existente.
      <router-link :to="`/admin/leads/${existing.lead_id}`" class="font-medium text-brand-600 hover:text-brand-700">Ver el lead →</router-link>
    </p>
  </form>
</template>
