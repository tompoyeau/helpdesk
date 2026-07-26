<template>
  <header class="app-header flex items-center justify-between px-4 py-0" style="height:52px;flex-shrink:0;position:sticky;top:0;z-index:100">
    <div class="flex items-center gap-3">
      <div class="app-logo">
        <svg width="38" height="38" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(256,256)" stroke="white" stroke-linecap="round" stroke-width="36" opacity="0.75">
            <line x1="0" y1="-148" x2="0" y2="-108"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(45)"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(90)"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(135)"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(180)"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(225)"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(270)"/>
            <line x1="0" y1="-148" x2="0" y2="-108" transform="rotate(315)"/>
          </g>
          <circle cx="256" cy="256" r="82" fill="white"/>
        </svg>
      </div>
      <div class="header-title-block">
        <h1 class="text-sm font-semibold tracking-tight leading-tight">Helio</h1>
      </div>
    </div>

    <nav class="header-nav desktop-only">
      <RouterLink to="/planning" class="header-nav-btn" :class="{ active: route.path === '/planning' }">
        <CalendarDays :size="13" />
        <span class="hide-xs">Planning</span>
      </RouterLink>
      <RouterLink to="/dashboard" class="header-nav-btn" :class="{ active: route.path.startsWith('/dashboard') || route.path.startsWith('/person') || route.path.startsWith('/cat') }">
        <LayoutDashboard :size="13" />
        <span class="hide-xs">Tableau de bord</span>
      </RouterLink>
      <RouterLink v-if="userStore.isAdmin" to="/equite" class="header-nav-btn" :class="{ active: route.path === '/equite' }">
        <Scale :size="13" />
        <span class="hide-xs">Équité</span>
      </RouterLink>
      <RouterLink v-if="userStore.isAdmin" to="/admin" class="header-nav-btn" :class="{ active: route.path === '/admin' }">
        <Shield :size="13" />
        <span class="hide-xs">Admin</span>
      </RouterLink>
    </nav>

    <div class="flex items-center gap-2">
      <DateRangePicker class="desktop-only" />
      <div class="header-sep desktop-only"></div>
      <NotificationBell />
      <button class="btn-icon" @click="ui.toggleDark()">
        <Moon v-if="!ui.darkMode" :size="15" />
        <Sun v-else :size="15" />
      </button>

      <!-- Bouton profil + menu dropdown -->
      <div class="user-menu" v-click-outside="() => menuOpen = false">
        <button class="btn-icon user-menu-trigger" @click="menuOpen = !menuOpen" :title="`${userStore.prenom} ${userStore.nom}`">
          <span v-if="initials" class="user-initials">{{ initials }}</span>
          <User v-else :size="15" />
        </button>
        <div v-if="menuOpen" class="user-dropdown" @click="menuOpen = false">
          <RouterLink
            v-if="userStore.nom && userStore.prenom"
            :to="{ name: 'person', params: { name: `${userStore.nom} ${userStore.prenom}` } }"
            class="user-dropdown-item"
          >
            <UserCircle :size="14" />
            <span>Mon profil</span>
          </RouterLink>
          <button class="user-dropdown-item user-dropdown-item--danger" @click="auth.signOut()">
            <LogOut :size="14" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { CalendarDays, LayoutDashboard, Moon, Sun, LogOut, Shield, Scale, User, UserCircle } from 'lucide-vue-next'
import DateRangePicker   from '@/components/layout/DateRangePicker.vue'
import NotificationBell  from '@/components/layout/NotificationBell.vue'

const route     = useRoute()
const ui        = useUiStore()
const auth      = useAuthStore()
const userStore = useUserStore()

const menuOpen = ref(false)

const initials = computed(() => {
  const p = userStore.prenom?.[0] ?? ''
  const n = userStore.nom?.[0] ?? ''
  return (p + n).toUpperCase()
})

// Directive v-click-outside
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value(e) }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  },
}
</script>

<style scoped>
.user-menu { position: relative; }

.user-initials {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.9);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 160px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 200;
}

.user-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 14px;
  font-size: 0.8125rem;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.12s;
}
.user-dropdown-item:hover { background: var(--bg-hover); }
.user-dropdown-item--danger { color: #ef4444; }
.user-dropdown-item--danger:hover { background: color-mix(in srgb, #ef4444 10%, var(--bg-card)); }
</style>
