import { BUCKET, supabase } from './supabase'

export const OPERATIONS = ['Venta', 'Alquiler'] as const
export const TYPES = ['Casa', 'Departamento', 'Suite', 'Terreno', 'Local comercial', 'Oficina'] as const

export interface Property {
  id: string
  title: string
  description: string
  operation: (typeof OPERATIONS)[number]
  type: string
  price: number
  zone: string
  address: string
  beds: number
  baths: number
  area: number
  published: boolean
  images: string[]
  advisor_id: string | null
  contact_whatsapp?: string | null
  created_at?: string
}

function db() {
  if (!supabase) throw new Error('Supabase no está configurado (faltan variables VITE_SUPABASE_*).')
  return supabase
}

export function emptyProperty(): Property {
  return { id: crypto.randomUUID(), title: '', description: '', operation: 'Venta', type: 'Casa', price: 0, zone: '', address: '', beds: 0, baths: 0, area: 0, published: false, images: [], advisor_id: null }
}

export async function listPublished(): Promise<Property[]> {
  const { data, error } = await db().from('properties').select('*').eq('published', true).order('created_at', { ascending: false })
  if (error) throw error
  return data as Property[]
}

export async function listAll(): Promise<Property[]> {
  const { data, error } = await db().from('properties').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Property[]
}

export async function getProperty(id: string): Promise<Property | null> {
  const { data, error } = await db().from('properties').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Property | null
}

export async function saveProperty(p: Property) {
  const { created_at: _c, contact_whatsapp: _w, ...row } = p
  const { error } = await db().from('properties').upsert(row)
  if (error) throw error
}

export async function setPublished(id: string, published: boolean) {
  const { error } = await db().from('properties').update({ published }).eq('id', id)
  if (error) throw error
}

export async function removeProperty(p: Property) {
  const { error } = await db().from('properties').delete().eq('id', p.id)
  if (error) throw error
  await deleteImages(p.images)
}

/** Reduce la foto (máx. 1600 px, JPEG) para cuidar los 1 GB gratis de almacenamiento. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82))
}

export async function uploadImage(propertyId: string, file: File): Promise<string> {
  const blob = await shrink(file)
  const path = `${propertyId}/${crypto.randomUUID()}.jpg`
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function deleteImages(urls: string[]) {
  const marker = `/${BUCKET}/`
  const paths = urls.map((u) => u.split(marker)[1]).filter(Boolean) as string[]
  if (paths.length) await db().storage.from(BUCKET).remove(paths)
}

export function formatPrice(p: Pick<Property, 'price' | 'operation'>): string {
  const n = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 }).format(p.price)
  return `$ ${n}${p.operation === 'Alquiler' ? ' /mes' : ''}`
}
