<script setup lang="ts">
import { reactive, ref } from 'vue'
import { contactProperty } from '../lib/contact'
import { INTERESTS, type Interest } from '../lib/crm'
import { submitLead } from '../lib/leads'

const form = reactive({ name: '', email: '', phone: '', interest: 'comprar' as Interest, message: '', website: '' })
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle')
const error = ref('')

async function submit() {
  state.value = 'sending'
  error.value = ''
  try {
    await submitLead({ ...form, propertyId: contactProperty.value?.id ?? null })
    contactProperty.value = null
    state.value = 'done'
  } catch (e) {
    error.value = (e as Error).message
    state.value = 'error'
  }
}
</script>

<template>
  <section id="contacto" class="bg-sand py-24">
    <div class="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2">
      <div>
        <p class="eyebrow">Contacto</p>
        <h2 class="mt-3 text-3xl md:text-4xl">Hablemos de tu próximo paso.</h2>
        <p class="mt-5 max-w-md leading-relaxed">Déjanos tus datos y un asesor se comunicará contigo. Cada consulta queda registrada para su seguimiento.</p>
        <ul class="mt-8 space-y-2 text-sm text-ink-soft">
          <li>[Teléfono / WhatsApp]</li><li>[correo@kreer.com]</li><li>[Dirección de oficina]</li>
        </ul>
      </div>

      <div class="bg-paper p-6 md:p-8">
        <div v-if="state === 'done'" class="py-10 text-center">
          <h3 class="text-2xl">Gracias, {{ form.name || 'te contactaremos' }}.</h3>
          <p class="mt-3 text-sm">Recibimos tu solicitud. Un asesor te escribirá pronto.</p>
        </div>
        <form v-else class="grid gap-4" @submit.prevent="submit">
          <p v-if="contactProperty" class="flex items-start justify-between gap-3 bg-sand px-4 py-3 text-sm">
            <span>Consulta sobre: <strong class="font-medium text-ink">{{ contactProperty.title }}</strong></span>
            <button type="button" class="shrink-0 text-brand-600 hover:text-brand-700" @click="contactProperty = null">Quitar</button>
          </p>
          <input v-model="form.name" class="field" placeholder="Nombre completo" required maxlength="120" />
          <div class="grid gap-4 sm:grid-cols-2">
            <input v-model="form.email" type="email" class="field" placeholder="Correo" required />
            <input v-model="form.phone" type="tel" class="field" placeholder="Teléfono / WhatsApp" required />
          </div>
          <select v-model="form.interest" class="field" aria-label="Interés">
            <option v-for="i in INTERESTS" :key="i.value" :value="i.value">{{ i.label }}</option>
          </select>
          <textarea v-model="form.message" rows="4" class="field !h-auto py-3" placeholder="Cuéntanos qué buscas" maxlength="2000" />
          <!-- Campo trampa contra robots: las personas no lo ven; si trae texto, la consulta se descarta en el servidor. -->
          <div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label>No llenar este campo<input v-model="form.website" type="text" tabindex="-1" autocomplete="off" /></label>
          </div>
          <button class="btn btn-primary" :disabled="state === 'sending'">{{ state === 'sending' ? 'Enviando…' : 'Enviar solicitud' }}</button>
          <p v-if="state === 'error'" class="text-sm text-red-700" role="alert">{{ error }}</p>
        </form>
      </div>
    </div>
  </section>
</template>
