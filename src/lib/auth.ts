import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const user = ref<User | null>(null)
let started: Promise<void> | null = null

export function initAuth(): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (!started) {
    const client = supabase
    started = client.auth.getSession().then(({ data }) => {
      user.value = data.session?.user ?? null
      client.auth.onAuthStateChange((_e, s) => { user.value = s?.user ?? null })
    })
  }
  return started
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return 'Correo o contraseña incorrectos.'
  const { data } = await supabase.rpc('is_admin')
  if (data !== true) {
    await supabase.auth.signOut()
    return 'Esta cuenta no tiene permiso de administración.'
  }
  return null
}

export async function signOut() {
  await supabase?.auth.signOut()
}
