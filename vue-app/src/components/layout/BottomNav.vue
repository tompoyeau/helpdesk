<template>
  <Teleport to="body">
  <nav class="bottom-nav" aria-label="Navigation principale">
    <RouterLink to="/planning" class="bottom-nav-item" :class="{ active: route.path === '/planning' }">
      <CalendarDays :size="20" />
      <span>Planning</span>
    </RouterLink>
    <RouterLink
      to="/dashboard"
      class="bottom-nav-item"
      :class="{ active: route.path.startsWith('/dashboard') || route.path.startsWith('/person') || route.path.startsWith('/cat') }"
    >
      <LayoutDashboard :size="20" />
      <span>Tableau de bord</span>
    </RouterLink>
    <RouterLink
      v-if="userStore.isAdmin"
      to="/equite"
      class="bottom-nav-item"
      :class="{ active: route.path === '/equite' }"
    >
      <Scale :size="20" />
      <span>Équité</span>
    </RouterLink>
    <button
      class="bottom-nav-item"
      :class="{ active: ui.leftDrawerOpen }"
      @click="ui.leftDrawerOpen = !ui.leftDrawerOpen"
    >
      <Search :size="20" />
      <span>Rechercher</span>
    </button>
  </nav>
  </Teleport>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'
import { useUserStore } from '@/stores/userStore'
import { CalendarDays, LayoutDashboard, Search, Scale } from 'lucide-vue-next'

const route     = useRoute()
const ui        = useUiStore()
const userStore = useUserStore()
</script>

<style scoped>
.bottom-nav {
  display: none;
}

@media (max-width: 1024px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 60px;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
    z-index: 300;
    box-shadow: 0 -4px 16px rgba(0,0,0,0.08);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .bottom-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--text-muted);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 4px;
    transition: color 0.15s;
  }

  .bottom-nav-item:hover { color: var(--text); }

  .bottom-nav-item.active {
    color: var(--accent);
  }

  .bottom-nav-item.active svg {
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 50%, transparent));
  }
}
</style>
