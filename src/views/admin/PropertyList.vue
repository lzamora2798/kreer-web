<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { isManager } from '../../lib/auth'
import { formatPrice, listAll, removeProperty, setPublished, type Property } from '../../lib/properties'

// Los asesores ven el catálogo completo (borradores incluidos) pero no lo modifican.
const stateClass = (p: Property) => (p.published ? 'bg-brand-600 text-white' : 'bg-sand text-ink-soft')

const items = ref<Property[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  try { items.value = await listAll() } catch (e) { error.value = (e as Error).message } finally { loading.value = false }
}
onMounted(load)

async function toggle(p: Property) {
  try { await setPublished(p.id, !p.published); p.published = !p.published } catch (e) { error.value = (e as Error).message }
}
async function del(p: Property) {
  if (!confirm(`¿Eliminar "${p.title}"? Esta acción no se puede deshacer.`)) return
  try { await removeProperty(p); items.value = items.value.filter((x) => x.id !== p.id) } catch (e) { error.value = (e as Error).message }
}
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="eyebrow">Panel</p>
      <h1 class="mt-2 text-4xl">Propiedades</h1>
    </div>
    <router-link v-if="isManager" to="/admin/propiedades/nueva" class="btn btn-primary">Nueva propiedad</router-link>
  </div>

  <p v-if="error" class="mt-6 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{{ error }}</p>
  <p v-if="loading" class="mt-10 text-sm text-ink-soft">Cargando…</p>
  <p v-else-if="!items.length" class="mt-10 text-ink-soft">Aún no hay propiedades.{{ isManager ? ' Crea la primera.' : '' }}</p>

  <div v-else class="mt-8 overflow-x-auto border border-line bg-white">
    <table class="w-full min-w-[720px] text-left text-sm">
      <thead class="border-b border-line bg-sand text-xs uppercase tracking-widest text-ink-soft">
        <tr><th class="p-3">Propiedad</th><th class="p-3">Tipo</th><th class="p-3">Precio</th><th class="p-3">Estado</th><th v-if="isManager" class="p-3 text-right">Acciones</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in items" :key="p.id" class="border-b border-line last:border-0">
          <td class="p-3">
            <div class="flex items-center gap-3">
              <img v-if="p.images[0]" :src="p.images[0]" alt="" class="h-12 w-16 object-cover" />
              <div v-else class="h-12 w-16 bg-sand" />
              <div><p class="font-medium text-ink">{{ p.title }}</p><p class="text-xs text-ink-soft">{{ p.zone }}</p></div>
            </div>
          </td>
          <td class="p-3">{{ p.type }} · {{ p.operation }}</td>
          <td class="p-3">{{ formatPrice(p) }}</td>
          <td class="p-3">
            <button v-if="isManager" class="px-3 py-1 text-xs font-medium" :class="stateClass(p)" @click="toggle(p)">{{ p.published ? 'Publicada' : 'Borrador' }}</button>
            <span v-else class="px-3 py-1 text-xs font-medium" :class="stateClass(p)">{{ p.published ? 'Publicada' : 'Borrador' }}</span>
          </td>
          <td v-if="isManager" class="space-x-4 p-3 text-right">
            <router-link :to="`/admin/propiedades/${p.id}`" class="font-medium text-brand-600 hover:text-brand-700">Editar</router-link>
            <button class="text-red-700" @click="del(p)">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
