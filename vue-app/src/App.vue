<template>
  <!-- Écran de chargement initial (vérification de la session) -->
  <div v-if="auth.loading" id="loginOverlay">
    <div class="login-card" style="align-items:center;gap:16px">
      <div class="login-logo">
        <svg width="56" height="56" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg-splash" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4F46E5"/>
              <stop offset="100%" stop-color="#7C3AED"/>
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="110" ry="110" fill="url(#bg-splash)"/>
          <g transform="translate(256,256)" stroke="white" stroke-linecap="round" stroke-width="26" opacity="0.7">
            <line x1="0" y1="-108" x2="0" y2="-148"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(45)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(90)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(135)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(180)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(225)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(270)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(315)"/>
          </g>
          <circle cx="256" cy="256" r="78" fill="white"/>
        </svg>
      </div>
      <p style="font-size:12px;color:var(--text-muted)">Chargement…</p>
    </div>
  </div>

  <!-- Formulaire de connexion -->
  <LoginOverlay v-else-if="!auth.user" />

  <!-- Application principale -->
  <div v-else class="flex flex-col" style="min-height:100vh">
    <AppHeader />
    <div
      class="layout-body"
      :class="{ 'left-collapsed': ui.leftCollapsed, 'right-collapsed': ui.rightCollapsed }"
    >
      <SidebarLeft />
      <main class="layout-main flex flex-col" style="background:var(--bg-surface)">
        <RouterView />
      </main>
      <SidebarRight />
    </div>
    <!-- Backdrop drawers -->
    <div
      v-if="ui.leftDrawerOpen || ui.rightDrawerOpen"
      class="drawer-backdrop open"
      @click="ui.closeAllDrawers()"
    />
    <!-- Navigation mobile (bottom bar) -->
    <BottomNav />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useDataStore } from '@/stores/dataStore'
import { useUserStore } from '@/stores/userStore'
import { useNotificationStore } from '@/stores/notificationStore'
import LoginOverlay from '@/components/LoginOverlay.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import SidebarLeft from '@/components/layout/SidebarLeft.vue'
import SidebarRight from '@/components/layout/SidebarRight.vue'
import BottomNav from '@/components/layout/BottomNav.vue'

const auth        = useAuthStore()
const ui          = useUiStore()
const data        = useDataStore()
const userStore   = useUserStore()
const notifStore  = useNotificationStore()
const router      = useRouter()
const route       = useRoute()

onMounted(async () => {
  ui.initDark()
  // Attend que Firebase confirme l'état de session
  await auth.init()
  // Le watch ci-dessous prend le relais pour charger les données
})

// Réagit à chaque changement d'état d'authentification
// (connexion initiale, login via LoginOverlay, déconnexion)
watch(() => auth.user, async (newUser, oldUser) => {
  if (newUser && !oldUser) {
    // Connexion : charge le rôle, les données, puis les notifications
    await userStore.loadUser(newUser.uid)
    await data.init()
    notifStore.subscribe(newUser.uid)

    // Redirige vers la fiche perso si l'utilisateur arrive sur /planning ou /
    if (userStore.nom && userStore.prenom && (route.path === '/planning' || route.path === '/')) {
      router.replace({ name: 'person', params: { name: `${userStore.nom} ${userStore.prenom}` } })
    }
  } else if (!newUser && oldUser) {
    // Déconnexion : résilie tous les abonnements Firestore
    data.cleanup()
    notifStore.cleanup()
    userStore.reset()
  }
})
</script>
