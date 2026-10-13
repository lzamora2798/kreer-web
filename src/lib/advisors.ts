import { supabase } from './supabase'

export interface Advisor {
  id: string
  name: string
  whatsapp: string
  email: string
}

function db() {
  if (!supabase) throw new Error('Supabase no está configurado (faltan variables VITE_SUPABASE_*).')
  return supabase
}

export function emptyAdvisor(): Advisor {
  return { id: crypto.randomUUID(), name: '', whatsapp: '', email: '' }
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
  const { data, error } = await db().from('advisors').select('id,name,whatsapp,email').order('name')
  if (error) throw error
  return data as Advisor[]
}

export async function saveAdvisor(a: Advisor) {
  const { error } = await db().from('advisors').upsert(a)
  if (error) throw error
}

export async function removeAdvisor(id: string) {
  const { error } = await db().from('advisors').delete().eq('id', id)
  if (error) throw error
}
