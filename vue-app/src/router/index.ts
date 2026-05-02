import { createRouter, createWebHistory } from 'vue-router'
import PlanningView  from '@/views/PlanningView.vue'
import DashboardView from '@/views/DashboardView.vue'
import PersonView    from '@/views/PersonView.vue'
import CatView       from '@/views/CatView.vue'
import AdminView     from '@/views/AdminView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/',             redirect: '/planning' },
    { path: '/planning',     name: 'planning',  component: PlanningView  },
    { path: '/dashboard',    name: 'dashboard', component: DashboardView },
    { path: '/person/:name', name: 'person',    component: PersonView    },
    { path: '/cat/:name',    name: 'cat',       component: CatView       },
    { path: '/admin',        name: 'admin',     component: AdminView     },
  ],
})

// La protection auth est gérée dans App.vue via v-if/v-else-if sur auth.loading / auth.user
// Un guard ici créerait une boucle infinie pendant l'initialisation Firebase

export default router
