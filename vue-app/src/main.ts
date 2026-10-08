/**
 * main.ts — Point d'entrée de l'application Helio
 *
 * Initialise Vue 3 avec :
 *  - Pinia  : gestion d'état global (stores/)
 *  - Router : navigation entre les vues (router/index.ts)
 *  - VueApexCharts : composant graphique global (utilisé dans ChartsBlock)
 *  - Analytics : statistiques d'usage anonymes (analytics.ts)
 *
 * L'authentification Firebase est gérée dans App.vue via authStore.init()
 * et non ici pour éviter une course entre le montage du DOM et Firebase.
 */
import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import App from './App.vue'
import router from './router'
import { analyticsPinia, setupAnalytics } from './analytics'

const app = createApp(App)
const pinia = createPinia()
pinia.use(analyticsPinia)
app.use(pinia)
app.use(router)
setupAnalytics(router)
app.use(VueApexCharts)
app.mount('#app')
