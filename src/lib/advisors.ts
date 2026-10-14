import { supabase } from './supabase'

export type Role = 'admin' | 'gerente' | 'asesor'

export const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerencia' },
  { value: 'asesor', label: 'Asesor' },
]

/** Una persona del equipo (tabla `advisors`). Sin `user_id` todavía no ha ingresado al panel. */
export interface Advisor {
  id: string
  name: string
  whatsapp: string | null
  email: string
  role: Role
  active: boolean
  assign_weight: number
  user_id: string | null
}

function db() {
  if (!supabase) throw new Error('Supabase no está configurado (faltan variables VITE_SUPABASE_*).')
  return supabase
}

export function emptyAdvisor(): Advisor {
  return { id: crypto.randomUUID(), name: '', whatsapp: null, email: '', role: 'asesor', active: true, assign_weight: 1, user_id: null }
}

/**
 * Deja solo dígitos con código de país. Asume Ecuador (593) cuando el número
 * viene en formato local: 0987654321 o 987654321.
 */
export function normalizeWhatsapp(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 && d.startsWith('0')) d = '593' + d.slice(1)
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d
  return d
}

export const isValidWhatsapp = (digits: string) => /^[0-9]{8,15}$/.test(digits)

export function whatsappLink(digits: string, propertyTitle?: string): string {
  const msg = propertyTitle
    ? `Hola, me interesa la propiedad "${propertyTitle}" que vi en KREER. ¿Me pueden dar más información?`
    : 'Hola, quisiera información sobre las propiedades de KREER.'
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

export async function listAdvisors(): Promise<Advisor[]> {
  const { data, error } = await db().from('advisors').select('id,name,whatsapp,email,role,active,assign_weight,user_id').order('name')
  if (error) throw error
  return data as Advisor[]
}

export async function saveAdvisor(a: Advisor) {
  // user_id solo lo vincula la base de datos en el primer ingreso (my_staff), nunca el formulario.
  const { user_id: _u, ...row } = a
  const { error } = await db().from('advisors').upsert(row)
  if (error) throw error
}

export async function setAdvisorActive(id: string, active: boolean) {
  const { error } = await db().from('advisors').update({ active }).eq('id', id)
  if (error) throw error
}

export async function removeAdvisor(id: string) {
  const { error } = await db().from('advisors').delete().eq('id', id)
  if (error) throw error
}
