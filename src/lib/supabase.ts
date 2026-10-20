import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** null cuando no hay variables de entorno: el sitio cae a datos de ejemplo. */
export const supabase = url && key ? createClient(url, key) : null
export const BUCKET = 'property-images'

/** El cliente de Supabase, o un error claro si falta configurarlo. Lo usan las libs de datos. */
export function db() {
  if (!supabase) throw new Error('Supabase no está configurado (faltan variables VITE_SUPABASE_*).')
  return supabase
}
