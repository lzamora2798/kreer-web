import { ref } from 'vue'

/** Propiedad por la que el visitante pidió información; `ContactForm` la lee y la envía con la consulta. */
export interface ContactProperty {
  id: string
  title: string
}

export const contactProperty = ref<ContactProperty | null>(null)
