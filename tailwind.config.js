/** @type {import('tailwindcss').Config} */
// Paleta de KREER Grupo Inmobiliario.
//   MARCA     = valor oficial (correo de la cliente) o medido en los logos de brand/.
//   DERIVADO  = lo calculamos nosotros a partir de la marca; NO es marca y se puede ajustar.
// Texto sobre fondos oscuros (night): usar paper o greige, nunca los teals de marca
// (#457d80 da 3,3:1 y #48657a 2,5:1 sobre night; no pasan AA).
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // DERIVADOS de #457d80 (mismo matiz, 183°). 700 es el hover del botón primario.
          300: '#B7D0D1',
          400: '#94B6B8',
          500: '#6AA1A4',
          // MARCA — único color de acción (botones primarios, enlaces, estados activos).
          // Blanco sobre él: 4,67:1; sobre paper: 4,56:1 (AA).
          // Ojo: los PNG del logo miden #457d8b, no #457d80 (ver pendientes con la cliente).
          600: '#457d80',
          700: '#325F62',
          // MARCA — secundario, solo acentos y detalles (eyebrows, íconos decorativos);
          // nunca como segundo color de acción. Blanco sobre él: 6,14:1.
          slate: '#48657a',
          // TODO(marca): el correo repite #457d80 dos veces; puede faltar un tercer color.
          // No inventar uno: confirmar con Mariuxi y agregarlo aquí.
        },
        // MARCA (medido en el círculo beige del logo; no viene en el correo).
        greige: '#CAC5BB',
        // DERIVADOS (no son marca): ink y night en matiz ~193°, entre #457d80 (183°) y #48657a (205°);
        // sand y line cálidos, en la familia del beige del logo. sage no aparece en el logo.
        sage: '#BFC7C3',
        paper: '#F5FEFE',
        sand: '#EDEBE4',
        line: '#E4E2DA',
        night: '#17272C',
        // ink.soft ajustado de #5A6E73 a #586C71: el original daba 4,499:1 sobre sand (AA pide 4,5).
        ink: { DEFAULT: '#1C2A2E', body: '#3D4F54', soft: '#586C71' },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Garamond', '"Times New Roman"', 'serif'],
        sans: ['Jost', '"Century Gothic"', 'Futura', 'system-ui', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '2px', sm: '2px', md: '2px', lg: '2px' },
    },
  },
  plugins: [],
}
