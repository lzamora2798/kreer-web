<script setup lang="ts">
import { reactive, ref } from 'vue'
const API = import.meta.env.VITE_API_URL as string | undefined
const form = reactive({ name: '', email: '', phone: '', interest: 'Comprar', message: '' })
const state = ref<'idle' | 'sending' | 'done' | 'error'>('idle')

async function submit() {
  state.value = 'sending'
  try {
    if (API) {
      const r = await fetch(`${API}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!r.ok) throw new Error(String(r.status))
    } else {
      await new Promise((res) => setTimeout(res, 700)) // POC sin backend
    }
    state.value = 'done'
  } catch {
    state.value = 'error'
  }
}
</script>

<template>
  <section id="contacto" class="bg-sand py-24">
    <div class="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2">
      <div>
        <p class="eyebrow">Contacto</p>
        <h2 class="mt-3 text-4xl md:text-5xl">Hablemos de tu próximo paso.</h2>
        <p class="mt-5 max-w-md leading-relaxed">Déjanos tus datos y un asesor se comunicará contigo. Cada consulta queda registrada para su seguimiento.</p>
        <ul class="mt-8 space-y-2 text-sm text-ink-soft">
          <li>[Teléfono / WhatsApp]</li><li>[correo@kreer.com]</li><li>[Dirección de oficina]</li>
        </ul>
      </div>

      <div class="bg-paper p-6 md:p-8">
        <div v-if="state === 'done'" class="py-10 text-center">
          <h3 class="text-3xl">Gracias, {{ form.name || 'te contactaremos' }}.</h3>
          <p class="mt-3 text-sm">Recibimos tu solicitud. Un asesor te escribirá pronto.</p>
        </div>
        <form v-else class="grid gap-4" @submit.prevent="submit">
          <input v-model="form.name" class="field" placeholder="Nombre completo" required />
          <div class="grid gap-4 sm:grid-cols-2">
            <input v-model="form.email" type="email" class="field" placeholder="Correo" required />
            <input v-model="form.phone" type="tel" class="field" placeholder="Teléfono / WhatsApp" required />
          </div>
          <select v-model="form.interest" class="field" aria-label="Interés">
            <option>Comprar</option><option>Alquilar</option><option>Vender</option><option>Invertir</option>
          </select>
          <textarea v-model="form.message" rows="4" class="field !h-auto py-3" placeholder="Cuéntanos qué buscas" />
          <button class="btn btn-primary" :disabled="state === 'sending'">{{ state === 'sending' ? 'Enviando…' : 'Enviar solicitud' }}</button>
          <p v-if="state === 'error'" class="text-sm text-red-700">No pudimos enviar el formulario. Inténtalo nuevamente.</p>
        </form>
      </div>
    </div>
  </section>
</template>
