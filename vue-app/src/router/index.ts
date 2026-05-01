import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/planning' },
    { path: '/planning', name: 'planning', component: () => import('@/views/PlanningView.vue') },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
    { path: '/person/:name', name: 'person', component: () => import('@/views/PersonView.vue') },
    { path: '/cat/:name', name: 'cat', component: () => import('@/views/CatView.vue') },
  ],
})

export default router
