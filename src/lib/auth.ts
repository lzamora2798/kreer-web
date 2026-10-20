import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import type { Role } from './advisors'
import { db, supabase } from './supabase'

/** La persona del equipo (tabla `advisors`) que corresponde al usuario con sesión. */
export interface Staff {
  id: string
  name: string
  role: Role
  active: boolean
}

/** Roles que ven y administran todo (admin y gerencia). */
export const MANAGER_ROLES: Role[] = ['admin', 'gerente']

export const user = ref<User | null>(null)
export const staff = ref<Staff | null>(null)
export const role = computed(() => staff.value?.role ?? null)
export const isManager = computed(() => !!role.value && MANAGER_ROLES.includes(role.value))
export const isAdmin = computed(() => role.value === 'admin')

let started: Promise<void> | null = null

/** Pregunta a la base quién es el usuario; en su primer ingreso `my_staff()` lo vincula por correo. */
async function fetchStaff(): Promise<Staff | null> {
  const { data, error } = await db().rpc('my_staff')
  if (error) throw error
  const row = (data as Staff[] | null)?.[0]
  return row?.active ? row : null
}

async function loadStaff() {
  try { staff.value = await fetchStaff() } catch { staff.value = null }
}

export function initAuth(): Promise<void> {
  if (!supabase) return Promise.resolve()
  if (!started) {
    const client = supabase
    started = client.auth.getSession().then(async ({ data }) => {
      user.value = data.session?.user ?? null
      if (user.value) await loadStaff()
      client.auth.onAuthStateChange((_e, s) => {
        const next = s?.user ?? null
        const changed = next?.id !== user.value?.id
        user.value = next
        if (!changed) return
        // No esperar llamadas a Supabase dentro del callback: bloquea el cliente.
        setTimeout(() => { if (next) void loadStaff(); else staff.value = null }, 0)
      })
    })
  }
  return started
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return 'Correo o contraseña incorrectos.'
  try {
    staff.value = await fetchStaff()
  } catch {
    staff.value = null
    await supabase.auth.signOut()
    return 'No se pudo verificar tu acceso. Inténtalo de nuevo.'
  }
  if (!staff.value) {
    await supabase.auth.signOut()
    return 'Esta cuenta no pertenece al equipo de KREER o está inactiva.'
  }
  return null
}

export async function signOut() {
  staff.value = null
  await supabase?.auth.signOut()
}
