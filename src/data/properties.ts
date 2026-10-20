// Datos de ejemplo — pendientes de confirmar con KREER (precios, cantidades, ubicaciones).
export interface Property {
  id: number; title: string; zone: string; operation: 'Venta' | 'Alquiler'
  price: string; beds: number; baths: number; area: number
}
export const featured: Property[] = [
  { id: 1, title: 'Casa familiar con jardín', zone: '[Zona norte]', operation: 'Venta', price: '$ [185.000]', beds: 4, baths: 3, area: 220 },
  { id: 2, title: 'Departamento con vista', zone: '[Centro]', operation: 'Venta', price: '$ [98.500]', beds: 2, baths: 2, area: 84 },
  { id: 3, title: 'Suite amoblada', zone: '[Zona financiera]', operation: 'Alquiler', price: '$ [650] /mes', beds: 1, baths: 1, area: 52 },
  { id: 4, title: 'Terreno para inversión', zone: '[Vía a la costa]', operation: 'Venta', price: '$ [72.000]', beds: 0, baths: 0, area: 450 },
  { id: 5, title: 'Casa en urbanización cerrada', zone: '[Samborondón]', operation: 'Venta', price: '$ [240.000]', beds: 3, baths: 3, area: 190 },
  { id: 6, title: 'Local comercial', zone: '[Centro]', operation: 'Alquiler', price: '$ [1.200] /mes', beds: 0, baths: 1, area: 95 },
]
