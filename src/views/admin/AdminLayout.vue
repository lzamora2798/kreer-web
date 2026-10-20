<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ROLES, type Role } from '../../lib/advisors'
import { MANAGER_ROLES, role, signOut, staff, user } from '../../lib/auth'

const route = useRoute()
const router = useRouter()
const open = ref(false)

// Para sumar una sección: agrega aquí el ítem (en su grupo) y su ruta hija en router.ts.
// `roles` limita quién ve el ítem; sin `roles` lo ve todo el equipo. Los grupos sin ítems visibles se ocultan.
interface NavItem { label: string; to: string; icon: string; match: (path: string) => boolean; roles?: Role[] }
const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'CRM',
    items: [
      {
        label: 'Leads', to: '/admin/leads',
        match: (p) => p.startsWith('/admin/leads'),
        icon: 'M4 5h16l-6 8v5l-4 2v-7L4 5Z',
      },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      {
        label: 'Propiedades', to: '/admin/propiedades',
        match: (p) => p.startsWith('/admin/propiedades'),
        icon: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        label: 'Equipo', to: '/admin/equipo', roles: MANAGER_ROLES,
        match: (p) => p.startsWith('/admin/equipo'),
        icon: 'M10 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1M17 11a3 3 0 0 0 0-6M20 19v-1a4 4 0 0 0-3-3.9',
      },
    ],
  },
]

const visibleSections = computed(() =>
  sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || (role.value !== null && i.roles.includes(role.value))) }))
    .filter((s) => s.items.length),
)
const roleLabel = computed(() => ROLES.find((r) => r.value === role.value)?.label ?? '')

watch(() => route.fullPath, () => { open.value = false })

async function out() {
  await signOut()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="min-h-screen bg-paper lg:flex">
    <header class="sticky top-0 z-30 flex h-14 items-center justify-between bg-night px-5 text-paper lg:hidden">
      <router-link to="/admin" class="flex items-center gap-3">
        <img src="/brand/logo-k-white.png" alt="KREER Grupo Inmobiliario" width="30" height="32" class="h-8 w-auto" />
        <span class="font-sans text-[10px] tracking-widest text-greige/80">ADMIN</span>
      </router-link>
      <button aria-label="Abrir menú" @click="open = true">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </header>

    <div v-if="open" class="fixed inset-0 z-40 bg-night/60 lg:hidden" @click="open = false" />

    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-night text-paper transition-transform duration-200 lg:sticky lg:z-auto lg:h-screen lg:shrink-0 lg:self-start lg:translate-x-0"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
        <router-link to="/admin" class="flex items-center gap-3">
          <img src="/brand/logo-k-white.png" alt="KREER Grupo Inmobiliario" width="34" height="36" class="h-9 w-auto" />
          <span class="font-sans text-xs tracking-widest text-greige/80">ADMIN</span>
        </router-link>
        <button class="lg:hidden" aria-label="Cerrar menú" @click="open = false">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-6" aria-label="Panel de administración">
        <div v-for="s in visibleSections" :key="s.label" class="mb-6 last:mb-0">
          <p class="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-greige/80">{{ s.label }}</p>
          <router-link
            v-for="item in s.items" :key="item.to" :to="item.to"
            class="mb-1 flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors"
            :class="item.match(route.path) ? 'border-brand-400 bg-white/10 text-paper' : 'border-transparent text-paper/70 hover:bg-white/5 hover:text-paper'"
            :aria-current="item.match(route.path) ? 'page' : undefined"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path :d="item.icon" /></svg>
            {{ item.label }}
          </router-link>
        </div>
      </nav>

      <div class="shrink-0 border-t border-white/10 px-3 py-4 text-sm">
        <router-link to="/" target="_blank" class="flex items-center gap-3 px-3 py-2.5 text-paper/70 transition-colors hover:bg-white/5 hover:text-paper">
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          Ver sitio
        </router-link>
        <button class="flex w-full items-center gap-3 px-3 py-2.5 text-left text-paper/70 transition-colors hover:bg-white/5 hover:text-paper" @click="out">
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10" /></svg>
          Salir
        </button>
        <p class="mt-2 truncate px-3 text-xs text-greige/80" :title="user?.email">{{ user?.email }}</p>
        <p v-if="staff" class="truncate px-3 text-xs text-greige/80">{{ staff.name }} · {{ roleLabel }}</p>
      </div>
    </aside>

    <main class="min-w-0 flex-1 px-5 py-8 lg:px-10 lg:py-10">
      <div class="mx-auto max-w-6xl">
        <router-view />
      </div>
    </main>
  </div>
</template>
