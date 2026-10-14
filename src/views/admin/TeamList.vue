<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ROLES, emptyAdvisor, isValidWhatsapp, listAdvisors, normalizeWhatsapp, removeAdvisor, saveAdvisor, setAdvisorActive, type Advisor } from '../../lib/advisors'

const items = ref<Advisor[]>([])
const form = ref<Advisor>(emptyAdvisor())
const wa = ref('')
const editing = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')

const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label ?? r
const friendly = (e: unknown) => {
  const m = (e as Error).message
  return m.includes('advisors_email_key') ? 'Ya hay una persona con ese correo.' : m
}

function access(a: Advisor) {
  if (a.user_id) return { text: 'Con acceso', cls: 'bg-brand-600 text-white' }
  if (a.email) return { text: 'Pendiente de ingreso', cls: 'bg-sand text-ink-soft' }
  return { text: 'Sin acceso (falta correo)', cls: 'bg-sand text-ink-soft' }
}

async function load() {
  try { items.value = await listAdvisors() } catch (e) { error.value = friendly(e) } finally { loading.value = false }
}
onMounted(load)

function edit(a: Advisor) { form.value = { ...a }; wa.value = a.whatsapp ?? ''; editing.value = true; error.value = '' }
function reset() { form.value = emptyAdvisor(); wa.value = ''; editing.value = false; error.value = '' }

async function submit() {
  const digits = wa.value.trim() ? normalizeWhatsapp(wa.value) : null
  if (digits && !isValidWhatsapp(digits)) { error.value = 'WhatsApp inválido. Ejemplo: 0987654321 o +593 98 765 4321.'; return }
  busy.value = true
  error.value = ''
  try {
    await saveAdvisor({ ...form.value, name: form.value.name.trim(), email: form.value.email.trim(), whatsapp: digits })
    reset()
    await load()
  } catch (e) { error.value = friendly(e) } finally { busy.value = false }
}

async function toggle(a: Advisor) {
  try { await setAdvisorActive(a.id, !a.active); a.active = !a.active; error.value = '' } catch (e) { error.value = friendly(e) }
}

async function del(a: Advisor) {
  if (!confirm(`¿Eliminar a ${a.name}? Sus propiedades quedarán sin asesor de contacto. Si solo dejó el equipo, mejor desactívalo.`)) return
  try { await removeAdvisor(a.id); await load(); error.value = '' } catch (e) { error.value = friendly(e) }
}
</script>

<template>
  <p class="eyebrow">Administración</p>
  <h1 class="mt-2 text-4xl">Equipo</h1>
  <p class="mt-2 max-w-xl text-sm text-ink-soft">Personas con acceso al panel. Los asesores reciben leads y se asignan a propiedades; en el sitio público solo se muestra su botón de WhatsApp, el nombre y el correo son de uso interno.</p>

  <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
    <div class="grid content-start gap-6">
      <form class="grid gap-4 border border-line bg-white p-6" @submit.prevent="submit">
        <p class="text-sm font-medium text-ink">{{ editing ? 'Editar persona' : 'Nueva persona' }}</p>
        <input v-model="form.name" class="field" placeholder="Nombre completo" required />
        <input v-model="form.email" type="email" class="field" placeholder="Correo (para su acceso al panel)" autocomplete="off" />
        <input v-model="wa" class="field" placeholder="WhatsApp (0987654321 o +593…), opcional" />
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="grid gap-1 text-sm">Rol
            <select v-model="form.role" class="field"><option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option></select>
          </label>
          <label v-if="form.role === 'asesor'" class="grid gap-1 text-sm">Peso de asignación (1–10)
            <input v-model.number="form.assign_weight" type="number" min="1" max="10" class="field" required />
          </label>
        </div>
        <p v-if="form.role === 'asesor'" class="-mt-2 text-xs text-ink-soft">A mayor peso, más leads nuevos recibe.</p>
        <label class="flex items-center gap-3 text-sm">
          <input v-model="form.active" type="checkbox" class="h-4 w-4 accent-[#537C88]" />
          Activo
        </label>
        <div class="flex gap-3">
          <button class="btn btn-primary flex-1" :disabled="busy">{{ busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar al equipo' }}</button>
          <button v-if="editing" type="button" class="btn border border-line text-ink-soft" @click="reset">Cancelar</button>
        </div>
        <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
      </form>

      <div class="border border-line bg-sand p-6 text-sm">
        <p class="font-medium text-ink">Cómo dar acceso al panel</p>
        <ol class="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">
          <li>Registra a la persona aquí, con su correo.</li>
          <li>En Supabase → Authentication → Users, invítala con ese mismo correo.</li>
          <li>Al ingresar por primera vez queda vinculada sola y verás "Con acceso".</li>
        </ol>
      </div>
    </div>

    <div>
      <p v-if="loading" class="text-sm text-ink-soft">Cargando…</p>
      <p v-else-if="!items.length" class="text-ink-soft">Aún no hay personas en el equipo.</p>
      <div v-else class="overflow-x-auto border border-line bg-white">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="border-b border-line bg-sand text-xs uppercase tracking-widest text-ink-soft">
            <tr><th class="p-3">Persona</th><th class="p-3">Rol</th><th class="p-3">Acceso</th><th class="p-3">Estado</th><th class="p-3 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in items" :key="a.id" class="border-b border-line last:border-0" :class="{ 'opacity-60': !a.active }">
              <td class="p-3">
                <p class="font-medium text-ink">{{ a.name }}</p>
                <p class="text-xs text-ink-soft">{{ a.email || 'Sin correo' }}<template v-if="a.whatsapp"> · +{{ a.whatsapp }}</template></p>
              </td>
              <td class="p-3">{{ roleLabel(a.role) }}<span v-if="a.role === 'asesor' && a.assign_weight > 1" class="text-xs text-ink-soft"> · peso {{ a.assign_weight }}</span></td>
              <td class="p-3"><span class="px-2 py-1 text-xs font-medium" :class="access(a).cls">{{ access(a).text }}</span></td>
              <td class="p-3">
                <button class="px-3 py-1 text-xs font-medium" :class="a.active ? 'bg-brand-600 text-white' : 'bg-sand text-ink-soft'" @click="toggle(a)">{{ a.active ? 'Activo' : 'Inactivo' }}</button>
              </td>
              <td class="space-x-4 p-3 text-right">
                <button class="font-medium text-brand-600 hover:text-brand-700" @click="edit(a)">Editar</button>
                <button class="text-red-700" @click="del(a)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
