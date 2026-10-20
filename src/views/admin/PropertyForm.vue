<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listAdvisors, type Advisor } from '../../lib/advisors'
import { OPERATIONS, TYPES, deleteImages, emptyProperty, getProperty, saveProperty, uploadImage, type Property } from '../../lib/properties'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const isNew = computed(() => !props.id)

const form = ref<Property>(emptyProperty())
const original = ref<string[]>([])
const newFiles = ref<{ file: File; url: string }[]>([])
const removed = ref<string[]>([])
const advisors = ref<Advisor[]>([])
// Solo asesores activos con WhatsApp (es lo que usa el botón del sitio); se conserva el actual aunque ya no cumpla.
const selectableAdvisors = computed(() => advisors.value.filter((a) => (a.active && a.whatsapp) || a.id === form.value.advisor_id))
const loading = ref(!!props.id)
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  try { advisors.value = await listAdvisors() } catch (e) { error.value = (e as Error).message }
  if (!props.id) return
  try {
    const p = await getProperty(props.id)
    if (!p) { error.value = 'Propiedad no encontrada.'; return }
    form.value = p
    original.value = [...p.images]
  } catch (e) { error.value = (e as Error).message } finally { loading.value = false }
})

function pick(e: Event) {
  const input = e.target as HTMLInputElement
  for (const file of Array.from(input.files ?? [])) {
    if (!file.type.startsWith('image/')) continue
    newFiles.value.push({ file, url: URL.createObjectURL(file) })
  }
  input.value = ''
}
function removeExisting(url: string) {
  form.value.images = form.value.images.filter((u) => u !== url)
  removed.value.push(url)
}
function removeNew(i: number) { newFiles.value.splice(i, 1) }
function makeCover(i: number) {
  const [u] = form.value.images.splice(i, 1)
  form.value.images.unshift(u)
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const uploaded: string[] = []
    for (const nf of newFiles.value) uploaded.push(await uploadImage(form.value.id, nf.file))
    form.value.images = [...form.value.images, ...uploaded]
    await saveProperty(form.value)
    if (removed.value.length) await deleteImages(removed.value)
    router.replace('/admin/propiedades')
  } catch (e) {
    error.value = (e as Error).message
  } finally { busy.value = false }
}
</script>

<template>
  <router-link to="/admin/propiedades" class="text-sm text-brand-600 hover:text-brand-700">← Volver a propiedades</router-link>
  <h1 class="mt-3 text-4xl">{{ isNew ? 'Nueva propiedad' : 'Editar propiedad' }}</h1>
  <p v-if="loading" class="mt-8 text-sm text-ink-soft">Cargando…</p>

  <form v-else class="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]" @submit.prevent="submit">
    <div class="grid gap-4 border border-line bg-white p-6">
      <label class="grid gap-1 text-sm">Título
        <input v-model="form.title" class="field" required maxlength="120" placeholder="Casa familiar con jardín" />
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">Tipo de propiedad
          <select v-model="form.type" class="field"><option v-for="t in TYPES" :key="t">{{ t }}</option></select>
        </label>
        <label class="grid gap-1 text-sm">Operación
          <select v-model="form.operation" class="field"><option v-for="o in OPERATIONS" :key="o">{{ o }}</option></select>
        </label>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="grid gap-1 text-sm">Precio (USD){{ form.operation === 'Alquiler' ? ' por mes' : '' }}
          <input v-model.number="form.price" type="number" min="0" step="0.01" class="field" required />
        </label>
        <label class="grid gap-1 text-sm">Zona / sector
          <input v-model="form.zone" class="field" placeholder="Samborondón" />
        </label>
      </div>
      <label class="grid gap-1 text-sm">Dirección
        <input v-model="form.address" class="field" />
      </label>
      <div class="grid grid-cols-3 gap-4">
        <label class="grid gap-1 text-sm">Habitaciones<input v-model.number="form.beds" type="number" min="0" class="field" /></label>
        <label class="grid gap-1 text-sm">Baños<input v-model.number="form.baths" type="number" min="0" class="field" /></label>
        <label class="grid gap-1 text-sm">Área (m²)<input v-model.number="form.area" type="number" min="0" step="0.01" class="field" /></label>
      </div>
      <label class="grid gap-1 text-sm">Asesor de contacto
        <select v-model="form.advisor_id" class="field">
          <option :value="null">Sin asesor</option>
          <option v-for="a in selectableAdvisors" :key="a.id" :value="a.id">{{ a.name }}{{ a.active ? '' : ' (inactivo)' }}</option>
        </select>
        <span class="text-xs text-ink-soft">
          El botón de WhatsApp del sitio usará el número de este asesor.
          <router-link v-if="!selectableAdvisors.length" to="/admin/equipo" class="text-brand-600">Agrega un asesor con WhatsApp.</router-link>
        </span>
      </label>
      <label class="grid gap-1 text-sm">Descripción
        <textarea v-model="form.description" rows="5" class="field !h-auto py-3" />
      </label>
    </div>

    <div class="grid content-start gap-4">
      <div class="border border-line bg-white p-6">
        <p class="text-sm font-medium text-ink">Fotos</p>
        <p class="mt-1 text-xs text-ink-soft">La primera es la portada. Se reducen automáticamente a 1600 px.</p>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <div v-for="(u, i) in form.images" :key="u" class="group relative aspect-square bg-sand">
            <img :src="u" alt="" class="h-full w-full object-cover" />
            <span v-if="i === 0" class="absolute left-1 top-1 bg-night px-1.5 py-0.5 text-[10px] text-paper">Portada</span>
            <div class="absolute inset-x-0 bottom-0 flex justify-between bg-night/80 px-1 py-0.5 text-[10px] text-paper opacity-0 transition group-hover:opacity-100">
              <button type="button" v-if="i > 0" @click="makeCover(i)">Portada</button><span v-else />
              <button type="button" @click="removeExisting(u)">Quitar</button>
            </div>
          </div>
          <div v-for="(n, i) in newFiles" :key="n.url" class="relative aspect-square bg-sand">
            <img :src="n.url" alt="" class="h-full w-full object-cover" />
            <span class="absolute left-1 top-1 bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">Nueva</span>
            <button type="button" class="absolute bottom-1 right-1 bg-night/80 px-1.5 py-0.5 text-[10px] text-paper" @click="removeNew(i)">Quitar</button>
          </div>
        </div>
        <label class="btn btn-ghost mt-4 w-full cursor-pointer !border-line !text-brand-600 hover:!bg-sand hover:!text-brand-700">
          Agregar fotos
          <input type="file" accept="image/*" multiple class="hidden" @change="pick" />
        </label>
      </div>

      <div class="border border-line bg-white p-6">
        <label class="flex items-center gap-3 text-sm">
          <input v-model="form.published" type="checkbox" class="h-4 w-4 accent-brand-600" />
          Publicar en el sitio
        </label>
        <button class="btn btn-primary mt-5 w-full" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar propiedad' }}</button>
        <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}</p>
      </div>
    </div>
  </form>
</template>
