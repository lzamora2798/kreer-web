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

/** Duración corta: "45 min", "3 h", "2 d". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`
  return `${Math.floor(minutes / 60 / 24)} d`
}
