/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: { 300: '#A7C1C8', 400: '#8DA3A7', 500: '#6B8B92', 600: '#537C88', 700: '#3F626C' },
        sage: '#BFC7C3', greige: '#C7C5BC', paper: '#F5FEFE', sand: '#EDEBE4', line: '#E4E2DA', night: '#17272C',
        ink: { DEFAULT: '#1C2A2E', body: '#3D4F54', soft: '#5A6E73' },
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
