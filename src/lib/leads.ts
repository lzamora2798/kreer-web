import { CLOSED_STAGES, CLOSED_VISIBLE_DAYS, type Interest, type ManualEventKind, type Source, type Stage } from './crm'
import { db, supabase } from './supabase'

/* ---------- Envío desde el sitio público ---------- */

export interface LeadRequest {
  name: string
  email: string
  phone: string
  interest: Interest
  message: string
  propertyId: string | null
  /** Campo trampa del formulario: si trae texto, es un robot y el servidor no guarda nada. */
  website: string
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

/** utm_* de la URL actual (de dónde llegó el visitante), o null si no hay ninguno. */
function readUtm(): Record<string, string> | null {
  const params = new URLSearchParams(window.location.search)
  const utm: Record<string, string> = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)?.trim()
    if (v) utm[k] = v.slice(0, 100)
  }
  return Object.keys(utm).length ? utm : null
}

/**
 * Envía una consulta del sitio público: la base crea (o actualiza) el contacto, el lead y lo asigna
 * a un asesor (RPC `submit_lead`, migración 005). Sin Supabase configurado simula el envío.
 */
export async function submitLead(r: LeadRequest): Promise<void> {
  if (!supabase) {
    await new Promise((res) => setTimeout(res, 700)) // POC sin Supabase: no se guarda nada
    return
  }
  const { error } = await db().rpc('submit_lead', {
    p_name: r.name,
    p_email: r.email,
    p_phone: r.phone,
    p_interest: r.interest,
    p_message: r.message,
    p_property_id: r.propertyId,
    p_utm: readUtm(),
    p_website: r.website,
  })
  // 22023 = dato inválido: el mensaje de la base ya está en español y es para el visitante. El resto no se muestra.
  if (error) throw new Error(error.code === '22023' ? error.message : 'No pudimos enviar el formulario. Inténtalo nuevamente.')
}

/* ---------- Panel: leads, contactos e historial ---------- */

export interface LeadContact {
  id: string
  name: string
  phone: string | null
  email: string
  kind: 'cliente' | 'propietario' | 'inversionista'
  notes: string
}

export interface Lead {
  id: string
  contact_id: string
  advisor_id: string | null
  source: Source
  interest: Interest
  property_id: string | null
  stage: Stage
  lost_reason: string | null
  message: string
  utm: Record<string, string> | null
  assigned_at: string | null
  first_contact_at: string | null
  closed_at: string | null
  last_activity_at: string
  created_at: string
  updated_at: string
  contact: LeadContact
  advisor: { id: string; name: string } | null
  property: { id: string; title: string } | null
}

export interface LeadEvent {
  id: string
  lead_id: string
  advisor_id: string | null
  kind: ManualEventKind | 'cambio_etapa' | 'asignacion' | 'sistema'
  direction: 'entrante' | 'saliente' | null
  body: string
  from_stage: Stage | null
  to_stage: Stage | null
  meta: { to_name?: string | null; from_name?: string | null; source?: string } | null
  created_at: string
  advisor: { name: string } | null
}

// RLS decide qué ve cada rol: un asesor solo recibe los leads que le tocan.
const LEAD_SELECT = '*, contact:contacts(id,name,phone,email,kind,notes), advisor:advisors(id,name), property:properties(id,title)'

/** Leads abiertos + los cerrados recientemente. */
export async function listLeads(): Promise<Lead[]> {
  const since = new Date(Date.now() - CLOSED_VISIBLE_DAYS * 86_400_000).toISOString()
  const [open, closed] = await Promise.all([
    db().from('leads').select(LEAD_SELECT).not('stage', 'in', `(${CLOSED_STAGES.join(',')})`).order('created_at', { ascending: false }).limit(500),
    db().from('leads').select(LEAD_SELECT).in('stage', [...CLOSED_STAGES]).gte('closed_at', since).order('closed_at', { ascending: false }).limit(200),
  ])
  if (open.error) throw open.error
  if (closed.error) throw closed.error
  return [...(open.data as unknown as Lead[]), ...(closed.data as unknown as Lead[])]
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await db().from('leads').select(LEAD_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as Lead | null
}

/** Historial del lead, del más reciente al más antiguo. */
export async function listEvents(leadId: string): Promise<LeadEvent[]> {
  const { data, error } = await db().from('lead_events').select('*, advisor:advisors(name)').eq('lead_id', leadId)
    .order('created_at', { ascending: false }).order('seq', { ascending: false })
  if (error) throw error
  return data as unknown as LeadEvent[]
}

/** Cambia la etapa. `perdido` exige motivo (la base lo rechaza si falta). */
export async function setStage(id: string, stage: Stage, lostReason?: string) {
  const { error } = await db().from('leads').update(stage === 'perdido' ? { stage, lost_reason: lostReason } : { stage }).eq('id', id)
  if (error) throw error
}

/** Reasigna el lead (null = sin asignar). La base deja constancia en el historial. */
export async function assignLead(id: string, advisorId: string | null) {
  const { error } = await db().from('leads').update({ advisor_id: advisorId }).eq('id', id)
  if (error) throw error
}

export async function addEvent(leadId: string, advisorId: string, kind: ManualEventKind, direction: 'entrante' | 'saliente' | null, body: string) {
  const { error } = await db().from('lead_events').insert({ lead_id: leadId, advisor_id: advisorId, kind, direction, body: body.trim() })
  if (error) throw error
}

export async function saveContact(c: Pick<LeadContact, 'id' | 'name' | 'phone' | 'email' | 'notes'>) {
  const { id, ...fields } = c
  const { error } = await db().from('contacts').update(fields).eq('id', id)
  if (error) throw error
}

export interface NewLead {
  name: string
  phone: string
  email: string
  interest: Interest
  source: Source
  message: string
  propertyId: string | null
  /** Solo la dirección puede elegir; vacío = reparto automático (o el propio asesor, si quien crea es asesor). */
  advisorId: string | null
}

export interface NewLeadResult {
  lead_id: string
  /** `created`; o `existing` / `throttled` si el cliente ya tenía una consulta abierta y solo se agregó una nota. */
  status: 'created' | 'existing' | 'throttled'
}

/** Crea un lead desde el panel (RPC `create_lead`): busca al contacto, evita duplicados y asigna. */
export async function createLead(l: NewLead): Promise<NewLeadResult> {
  const { data, error } = await db().rpc('create_lead', {
    p_name: l.name, p_email: l.email, p_phone: l.phone, p_interest: l.interest, p_source: l.source,
    p_message: l.message, p_property_id: l.propertyId, p_advisor_id: l.advisorId,
  })
  if (error) throw error
  return data as NewLeadResult
}

/** Mensajes en español para los errores de base de datos más comunes del CRM. */
export function leadError(e: unknown): string {
  const m = (e as Error)?.message ?? String(e)
  if (m.includes('contacts_phone_key')) return 'Ya existe otro contacto con ese teléfono.'
  if (m.includes('contacts_email_key')) return 'Ya existe otro contacto con ese correo.'
  if (m.includes('contacts_reachable')) return 'El contacto necesita al menos un teléfono o un correo.'
  if (m.includes('leads_lost_reason')) return 'Indica el motivo por el que se perdió.'
  if (m.includes('row-level security')) return 'No tienes permiso para hacer este cambio.'
  return m
}
