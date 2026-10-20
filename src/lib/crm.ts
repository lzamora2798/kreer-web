/** Constantes del CRM. Los valores coinciden con los de las tablas de Supabase (migración 004). */

export const INTERESTS = [
  { value: 'comprar', label: 'Comprar' },
  { value: 'alquilar', label: 'Alquilar' },
  { value: 'vender', label: 'Vender' },
  { value: 'invertir', label: 'Invertir' },
] as const
export type Interest = (typeof INTERESTS)[number]['value']

/** Etapas del pipeline, en orden. `cls` es el color de la etiqueta (solo tokens de la marca). */
export const STAGES = [
  { value: 'nuevo', label: 'Nuevo', cls: 'bg-brand-600 text-white' },
  { value: 'contactado', label: 'Contactado', cls: 'bg-brand-300 text-ink' },
  { value: 'seguimiento', label: 'Seguimiento', cls: 'bg-brand-slate text-white' },
  { value: 'cita', label: 'Cita / visita', cls: 'bg-sage text-ink' },
  { value: 'negociacion', label: 'Negociación', cls: 'bg-night text-paper' },
  { value: 'ganado', label: 'Ganado', cls: 'border-brand-600 bg-white text-brand-700' },
  { value: 'perdido', label: 'Perdido', cls: 'bg-sand text-ink-soft' },
] as const
export type Stage = (typeof STAGES)[number]['value']

export const CLOSED_STAGES: readonly Stage[] = ['ganado', 'perdido']
export const isClosed = (s: Stage) => CLOSED_STAGES.includes(s)
export const stageLabel = (s: string) => STAGES.find((x) => x.value === s)?.label ?? s

/** Los cerrados (ganado/perdido) solo se listan si cerraron hace menos de estos días. */
export const CLOSED_VISIBLE_DAYS = 30

export const SOURCES = [
  { value: 'web', label: 'Sitio web' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'referido', label: 'Referido' },
  { value: 'manual', label: 'Manual' },
  { value: 'otro', label: 'Otro' },
] as const
export type Source = (typeof SOURCES)[number]['value']
export const sourceLabel = (s: string) => SOURCES.find((x) => x.value === s)?.label ?? s
export const interestLabel = (i: string) => INTERESTS.find((x) => x.value === i)?.label ?? i

/** Tipos de evento que registra una persona del equipo desde la ficha (los demás los escribe el sistema). */
export const MANUAL_EVENTS = [
  { value: 'nota', label: 'Nota' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'correo', label: 'Correo' },
  { value: 'visita', label: 'Visita' },
] as const
export type ManualEventKind = (typeof MANUAL_EVENTS)[number]['value']
/** Tipos donde importa si fue el cliente quien escribió/llamó (entrante) o el asesor (saliente). */
export const DIRECTIONAL_EVENTS: readonly ManualEventKind[] = ['llamada', 'whatsapp', 'correo']

export const EVENT_LABELS: Record<string, string> = {
  nota: 'Nota',
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  correo: 'Correo',
  visita: 'Visita',
  cambio_etapa: 'Cambio de etapa',
  asignacion: 'Asignación',
  sistema: 'Sistema',
}

export const LOST_REASONS = [
  'No responde',
  'Ya no le interesa',
  'Fuera de presupuesto',
  'Compró o alquiló con otra inmobiliaria',
  'No es lo que buscaba',
  'Datos falsos o spam',
  'Otro',
] as const

/** Tipos de tarea; coinciden con `tasks.kind` (migración 004). */
export const TASK_KINDS = [
  { value: 'llamar', label: 'Llamar' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'correo', label: 'Correo' },
  { value: 'visita', label: 'Visita' },
  { value: 'otro', label: 'Otro' },
] as const
export type TaskKind = (typeof TASK_KINDS)[number]['value']
export const taskKindLabel = (k: string) => TASK_KINDS.find((x) => x.value === k)?.label ?? k

/** Hora (local) que ponen los atajos "Mañana", "En 3 días"… al crear una tarea. */
export const TASK_DEFAULT_HOUR = 9
/** La Agenda separa "Próximos 7 días"; lo que pasa de ahí va en "Más adelante". */
export const AGENDA_UPCOMING_DAYS = 7

/** Periodos del Resumen: los últimos N días (contando hoy) o lo que va del mes. */
export const PERIODS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'mes', label: 'Este mes' },
] as const
export type Period = (typeof PERIODS)[number]['value']

/** Semáforo de un lead `nuevo` que nadie ha contactado: minutos desde que llegó. */
export const UNCONTACTED_WARN_MIN = 30
export const UNCONTACTED_LATE_MIN = 120
