import { createRouter, createWebHistory } from 'vue-router'
import type { Role } from './lib/advisors'
import { MANAGER_ROLES, initAuth, signOut, staff, user } from './lib/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    /** Roles que pueden entrar; sin esto, cualquier persona activa del equipo. */
    roles?: Role[]
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/admin/login', component: () => import('./views/admin/LoginView.vue') },
    {
      path: '/admin',
      component: () => import('./views/admin/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', component: () => import('./views/admin/DashboardView.vue') },
        { path: 'leads', component: () => import('./views/admin/LeadBoard.vue') },
        { path: 'leads/nuevo', component: () => import('./views/admin/LeadForm.vue') },
        { path: 'leads/:id', component: () => import('./views/admin/LeadDetail.vue'), props: true },
        { path: 'agenda', component: () => import('./views/admin/AgendaView.vue') },
        { path: 'propiedades', component: () => import('./views/admin/PropertyList.vue') },
        { path: 'propiedades/nueva', component: () => import('./views/admin/PropertyForm.vue'), meta: { roles: MANAGER_ROLES } },
        { path: 'propiedades/:id', component: () => import('./views/admin/PropertyForm.vue'), props: true, meta: { roles: MANAGER_ROLES } },
        { path: 'equipo', component: () => import('./views/admin/TeamList.vue'), meta: { roles: MANAGER_ROLES } },
        { path: 'asesores', redirect: '/admin/equipo' },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (to) => (to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }),
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  await initAuth()
  if (!user.value) return '/admin/login'
  // Con sesión pero sin una fila activa en Equipo: no es parte del equipo.
  if (!staff.value) {
    await signOut()
    return '/admin/login'
  }
  if (to.meta.roles && !to.meta.roles.includes(staff.value.role)) return '/admin'
  return true
})

export default router
