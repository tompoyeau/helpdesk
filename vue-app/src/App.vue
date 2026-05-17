<template>
  <!-- Écran de chargement initial (vérification de la session) -->
  <div v-if="auth.loading" id="loginOverlay">
    <div class="login-card" style="align-items:center;gap:16px">
      <div class="login-logo">
        <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.95"/>
          <rect x="11" y="1" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.55"/>
          <rect x="1" y="11" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.55"/>
          <rect x="11" y="11" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.95"/>
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
    <div class="layout-body">
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
  } else if (!newUser && oldUser) {
    // Déconnexion : résilie tous les abonnements Firestore
    data.cleanup()
    notifStore.cleanup()
    userStore.reset()
  }
})
</script>
