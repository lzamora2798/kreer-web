import { CLOSED_STAGES, type Period, type Source, type Stage } from './crm'
import { addDays, startOfDay } from './format'
import { db } from './supabase'

/** Cifras de una persona del equipo en un periodo (RPC `crm_metrics`). La fila sin `advisor_id` es "Sin asignar". */
export interface AdvisorMetrics {
  advisor_id: string | null
  advisor_name: string
  /** Leads que llegaron en el periodo. */
  received: number
  /** De esos, los que ya tuvieron un primer contacto. */
  contacted: number
  /** De la asignación al primer contacto, en minutos; null si ninguno se contactó. */
  avg_response_minutes: number | null
  /** Lo siguiente ocurrió en el periodo (no depende de cuándo llegó el lead). */
  calls: number
  followups: number
  visits: number
  negotiations: number
  won: number
  lost: number
}

/** Rango [desde, hasta) del periodo; el límite superior es exclusivo, así que `to` es mañana a las 00:00 para incluir todo hoy. */
export function periodRange(period: Period, now: Date | number = new Date()): { from: Date; to: Date } {
  const today = startOfDay(now)
  const to = addDays(today, 1)
  if (period === 'mes') return { from: new Date(today.getFullYear(), today.getMonth(), 1), to }
  return { from: addDays(today, -(Number(period) - 1)), to }
}

// RLS limita lo que cada rol ve: un asesor solo suma lo suyo y la dirección ve todo el equipo.
export async function getMetrics(from: Date, to: Date): Promise<AdvisorMetrics[]> {
  const { data, error } = await db().rpc('crm_metrics', { p_from: from.toISOString(), p_to: to.toISOString() })
  if (error) throw error
  return (data as AdvisorMetrics[]).map((r) => ({ ...r, avg_response_minutes: r.avg_response_minutes == null ? null : Number(r.avg_response_minutes) }))
}

/** Leads actuales por etapa (RPC `crm_funnel`); las etapas sin leads no vienen y quedan en 0. */
export async function getFunnel(): Promise<Record<Stage, number>> {
  const { data, error } = await db().rpc('crm_funnel')
  if (error) throw error
  const out: Record<string, number> = { nuevo: 0, contactado: 0, seguimiento: 0, cita: 0, negociacion: 0, ganado: 0, perdido: 0 }
  for (const r of data as { stage: string; total: number }[]) out[r.stage] = r.total
  return out as Record<Stage, number>
}

/** Leads abiertos que nadie atiende (solo la dirección los ve: un asesor no tiene acceso a los que no son suyos). */
export async function countUnassigned(): Promise<number> {
  const { count, error } = await db().from('leads').select('id', { count: 'exact', head: true })
    .is('advisor_id', null).not('stage', 'in', `(${CLOSED_STAGES.join(',')})`)
  if (error) throw error
  return count ?? 0
}

/** Leads que llegaron en el periodo, por fuente, de mayor a menor. */
export async function leadsBySource(from: Date, to: Date): Promise<{ source: Source; total: number }[]> {
  const { data, error } = await db().from('leads').select('source')
    .gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(5000)
  if (error) throw error
  const counts = new Map<Source, number>()
  for (const r of data as { source: Source }[]) counts.set(r.source, (counts.get(r.source) ?? 0) + 1)
  return [...counts].map(([source, total]) => ({ source, total })).sort((a, b) => b.total - a.total)
}
