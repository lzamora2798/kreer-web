<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { emptyAdvisor, isValidWhatsapp, listAdvisors, normalizeWhatsapp, removeAdvisor, saveAdvisor, type Advisor } from '../../lib/advisors'

const items = ref<Advisor[]>([])
const form = ref<Advisor>(emptyAdvisor())
const editing = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')

async function load() {
  try { items.value = await listAdvisors() } catch (e) { error.value = (e as Error).message } finally { loading.value = false }
}
onMounted(load)

function edit(a: Advisor) { form.value = { ...a }; editing.value = true; error.value = '' }
function reset() { form.value = emptyAdvisor(); editing.value = false; error.value = '' }

async function submit() {
  const digits = normalizeWhatsapp(form.value.whatsapp)
  if (!isValidWhatsapp(digits)) { error.value = 'WhatsApp inválido. Ejemplo: 0987654321 o +593 98 765 4321.'; return }
  busy.value = true
  error.value = ''
  try {
    await saveAdvisor({ ...form.value, whatsapp: digits })
    reset()
    await load()
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}

async function del(a: Advisor) {
  if (!confirm(`¿Eliminar a ${a.name}? Sus propiedades quedarán sin asesor de contacto.`)) return
  try { await removeAdvisor(a.id); await load() } catch (e) { error.value = (e as Error).message }
}
</script>

<template>
  <p class="eyebrow">Panel</p>
  <h1 class="mt-2 text-4xl">Asesores</h1>
  <p class="mt-2 max-w-xl text-sm text-ink-soft">Los asesores se asignan a las propiedades. En el sitio público solo se muestra el botón de WhatsApp; el nombre y el correo son de uso interno.</p>

  <div class="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
    <form class="grid content-start gap-4 border border-line bg-white p-6" @submit.prevent="submit">
      <p class="text-sm font-medium text-ink">{{ editing ? 'Editar asesor' : 'Nuevo asesor' }}</p>
      <input v-model="form.name" class="field" placeholder="Nombre completo" required />
      <input v-model="form.whatsapp" class="field" placeholder="WhatsApp (0987654321 o +593…)" required />
      <input v-model="form.email" type="email" class="field" placeholder="Correo (interno, opcional)" />
      <div class="flex gap-3">
        <button class="btn btn-primary flex-1" :disabled="busy">{{ busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar asesor' }}</button>
        <button v-if="editing" type="button" class="btn border border-line text-ink-soft" @click="reset">Cancelar</button>
      </div>
      <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
    </form>

    <div>
      <p v-if="loading" class="text-sm text-ink-soft">Cargando…</p>
      <p v-else-if="!items.length" class="text-ink-soft">Aún no hay asesores. Agrega el primero.</p>
      <div v-else class="overflow-x-auto border border-line bg-white">
        <table class="w-full min-w-[420px] text-left text-sm">
          <thead class="border-b border-line bg-sand text-xs uppercase tracking-widest text-ink-soft">
            <tr><th class="p-3">Asesor</th><th class="p-3">WhatsApp</th><th class="p-3 text-right">Acciones</th></tr>
          </thead>
          <tbody>
            <tr v-for="a in items" :key="a.id" class="border-b border-line last:border-0">
              <td class="p-3"><p class="font-medium text-ink">{{ a.name }}</p><p class="text-xs text-ink-soft">{{ a.email }}</p></td>
              <td class="p-3">+{{ a.whatsapp }}</td>
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
