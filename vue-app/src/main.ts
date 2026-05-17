/**
 * main.ts — Point d'entrée de l'application Helio
 *
 * Initialise Vue 3 avec :
 *  - Pinia  : gestion d'état global (stores/)
 *  - Router : navigation entre les vues (router/index.ts)
 *  - VueApexCharts : composant graphique global (utilisé dans ChartsBlock)
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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueApexCharts)
app.mount('#app')
