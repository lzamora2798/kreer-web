// Datos de ejemplo — pendientes de confirmar con KREER (precios, cantidades, ubicaciones).
/** Token de color del degradado que simula la foto cuando la propiedad no tiene imagen. */
export type Tone = 'brand-300' | 'brand-400' | 'sage' | 'greige'
// Clases completas (no armadas con plantillas) para que Tailwind las detecte.
export const toneFrom: Record<Tone, string> = {
  'brand-300': 'from-brand-300', 'brand-400': 'from-brand-400', sage: 'from-sage', greige: 'from-greige',
}

export interface Property {
  id: number; title: string; zone: string; operation: 'Venta' | 'Alquiler'
  price: string; beds: number; baths: number; area: number; tone: Tone
}
export const featured: Property[] = [
  { id: 1, title: 'Casa familiar con jardín', zone: '[Zona norte]', operation: 'Venta', price: '$ [185.000]', beds: 4, baths: 3, area: 220, tone: 'brand-300' },
  { id: 2, title: 'Departamento con vista', zone: '[Centro]', operation: 'Venta', price: '$ [98.500]', beds: 2, baths: 2, area: 84, tone: 'sage' },
  { id: 3, title: 'Suite amoblada', zone: '[Zona financiera]', operation: 'Alquiler', price: '$ [650] /mes', beds: 1, baths: 1, area: 52, tone: 'greige' },
  { id: 4, title: 'Terreno para inversión', zone: '[Vía a la costa]', operation: 'Venta', price: '$ [72.000]', beds: 0, baths: 0, area: 450, tone: 'brand-400' },
  { id: 5, title: 'Casa en urbanización cerrada', zone: '[Samborondón]', operation: 'Venta', price: '$ [240.000]', beds: 3, baths: 3, area: 190, tone: 'brand-300' },
  { id: 6, title: 'Local comercial', zone: '[Centro]', operation: 'Alquiler', price: '$ [1.200] /mes', beds: 0, baths: 1, area: 95, tone: 'sage' },
]
