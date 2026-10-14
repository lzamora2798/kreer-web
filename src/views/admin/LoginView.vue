<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { signIn } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = (await signIn(email.value, password.value)) ?? ''
  busy.value = false
  if (!error.value) router.replace('/admin')
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-night px-5">
    <form class="w-full max-w-sm bg-paper p-8" @submit.prevent="submit">
      <p class="eyebrow">Administración</p>
      <h1 class="mt-4">
        <img src="/brand/logo-full-teal.png" alt="KREER Grupo Inmobiliario" width="176" height="66" class="h-auto w-44" />
      </h1>
      <p v-if="!supabase" class="mt-4 text-sm text-red-700">Falta configurar Supabase (variables VITE_SUPABASE_*).</p>
      <div class="mt-6 grid gap-4">
        <input v-model="email" type="email" class="field" placeholder="Correo" autocomplete="username" required />
        <input v-model="password" type="password" class="field" placeholder="Contraseña" autocomplete="current-password" required />
        <button class="btn btn-primary" :disabled="busy || !supabase">{{ busy ? 'Ingresando…' : 'Ingresar' }}</button>
        <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
      </div>
    </form>
  </main>
</template>
