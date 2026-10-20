const dateTime = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateTimeYear = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** "5 oct, 14:30" (con año si no es el actual). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (d.getFullYear() === new Date().getFullYear() ? dateTime : dateTimeYear).format(d)
}

export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

/** "hace 5 min", "hace 2 h", "hace 3 d"; pasada una semana, la fecha. */
export function timeAgo(iso: string, now = Date.now()): string {
  const m = minutesSince(iso, now)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  if (m < 60 * 24) return `hace ${Math.floor(m / 60)} h`
  if (m < 60 * 24 * 7) return `hace ${Math.floor(m / 60 / 24)} d`
  return formatDateTime(iso)
}

const timeOnly = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })

/** Medianoche (hora local) del día de `d`. */
export function startOfDay(d: Date | number = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** `d` movido `n` días (en calendario local, no en múltiplos de 24 h). */
export function addDays(d: Date | number, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** El día de hoy + `offset` días, a las `hour` en punto (hora local). */
export function dayAt(offset: number, hour: number, from: Date | number = new Date()): Date {
  const x = addDays(startOfDay(from), offset)
  x.setHours(hour)
  return x
}

/** Valor para `<input type="datetime-local">` (hora local): "2026-10-20T09:00". */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Fecha límite de una tarea: "Hoy 15:00", "Mañana 09:00", "Ayer 10:30"; otro día, "lun, 20 oct · 09:00". */
export function formatDue(iso: string, now: Date | number = Date.now()): string {
  const d = new Date(iso)
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000)
  const t = timeOnly.format(d)
  if (diff === 0) return `Hoy ${t}`
  if (diff === 1) return `Mañana ${t}`
  if (diff === -1) return `Ayer ${t}`
  return `${dayMonth.format(d)} · ${t}`
}

const numberFmt = new Intl.NumberFormat('es-EC')

export const formatNumber = (n: number) => numberFmt.format(n)

/** "62 %", o "—" si no hay con qué comparar. */
export function formatPercent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)} %` : '—'
}

/** Duración corta: "45 min", "3 h", "2 d". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`
  return `${Math.floor(minutes / 60 / 24)} d`
}
