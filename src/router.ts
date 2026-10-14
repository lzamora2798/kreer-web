import { createRouter, createWebHistory } from 'vue-router'
import { initAuth, user } from './lib/auth'

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
        { path: '', component: () => import('./views/admin/PropertyList.vue') },
        { path: 'equipo', component: () => import('./views/admin/TeamList.vue') },
        { path: 'asesores', redirect: '/admin/equipo' },
        { path: 'propiedades/nueva', component: () => import('./views/admin/PropertyForm.vue') },
        { path: 'propiedades/:id', component: () => import('./views/admin/PropertyForm.vue'), props: true },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: (to) => (to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }),
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true
  await initAuth()
  return user.value ? true : '/admin/login'
})

export default router
