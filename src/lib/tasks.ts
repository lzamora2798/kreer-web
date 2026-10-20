import type { TaskKind } from './crm'
import { db } from './supabase'

export interface Task {
  id: string
  lead_id: string | null
  advisor_id: string
  title: string
  kind: TaskKind
  due_at: string
  done_at: string | null
  created_at: string
  /** null si no es de un lead, o si el lead ya no es visible para quien consulta (RLS). */
  lead: { id: string; contact: { name: string } } | null
  advisor: { name: string } | null
}

// `tasks` tiene dos llaves hacia `advisors` (advisor_id y created_by): hay que indicar cuál.
const TASK_SELECT = '*, lead:leads(id,contact:contacts(name)), advisor:advisors!advisor_id(name)'

/** Tareas pendientes, de la más próxima a la más lejana. RLS: el asesor ve las suyas; la dirección, todas. */
export async function listPendingTasks(): Promise<Task[]> {
  const { data, error } = await db().from('tasks').select(TASK_SELECT).is('done_at', null).order('due_at').limit(500)
  if (error) throw error
  return data as unknown as Task[]
}

/** Tareas de un lead: pendientes primero (por fecha) y después las hechas (las más recientes primero). */
export async function listLeadTasks(leadId: string): Promise<Task[]> {
  const { data, error } = await db().from('tasks').select(TASK_SELECT).eq('lead_id', leadId).order('due_at')
  if (error) throw error
  const all = data as unknown as Task[]
  const pending = all.filter((t) => !t.done_at)
  const done = all.filter((t) => t.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!))
  return [...pending, ...done]
}

/** Para cada lead con tareas pendientes, la fecha de la más próxima (sirve para marcar los vencidos en la lista). */
export async function listLeadTaskDues(): Promise<Map<string, string>> {
  const { data, error } = await db().from('tasks').select('lead_id,due_at').is('done_at', null).not('lead_id', 'is', null).order('due_at').limit(1000)
  if (error) throw error
  const dues = new Map<string, string>()
  for (const t of data as { lead_id: string; due_at: string }[]) if (!dues.has(t.lead_id)) dues.set(t.lead_id, t.due_at)
  return dues
}

export interface NewTask {
  leadId: string | null
  /** Quién debe hacerla. Un asesor solo puede asignarse a sí mismo; la dirección, a cualquiera. */
  advisorId: string
  title: string
  kind: TaskKind
  /** ISO 8601 */
  dueAt: string
}

export async function createTask(t: NewTask) {
  const { error } = await db().from('tasks').insert({ lead_id: t.leadId, advisor_id: t.advisorId, title: t.title.trim(), kind: t.kind, due_at: t.dueAt })
  if (error) throw error
}

/** Marca la tarea como hecha (devuelve la fecha de cierre) o la reabre (null). */
export async function setTaskDone(id: string, done: boolean): Promise<string | null> {
  const done_at = done ? new Date().toISOString() : null
  const { error } = await db().from('tasks').update({ done_at }).eq('id', id)
  if (error) throw error
  return done_at
}

export async function deleteTask(id: string) {
  const { error } = await db().from('tasks').delete().eq('id', id)
  if (error) throw error
}
