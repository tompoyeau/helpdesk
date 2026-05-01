import { createRouter, createWebHistory } from 'vue-router'
import { getAuth } from 'firebase/auth'
import PlanningView  from '@/views/PlanningView.vue'
import DashboardView from '@/views/DashboardView.vue'
import PersonView    from '@/views/PersonView.vue'
import CatView       from '@/views/CatView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/',             redirect: '/planning' },
    { path: '/planning',     name: 'planning',  component: PlanningView,  meta: { requiresAuth: true } },
    { path: '/dashboard',    name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/person/:name', name: 'person',    component: PersonView,    meta: { requiresAuth: true } },
    { path: '/cat/:name',    name: 'cat',       component: CatView,       meta: { requiresAuth: true } },
  ],
})

// Guard : redirige vers la racine si non authentifié
// App.vue affiche alors LoginOverlay
router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true
  const auth = getAuth()
  if (!auth.currentUser) return '/'
  return true
})

export default router
