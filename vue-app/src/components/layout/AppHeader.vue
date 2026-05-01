<template>
  <header class="app-header flex items-center justify-between px-4 py-0" style="height:52px;flex-shrink:0;position:sticky;top:0;z-index:100">
    <div class="flex items-center gap-3">
      <button class="btn-icon mobile-only" @click="ui.leftDrawerOpen = true">
        <Users :size="15" />
      </button>
      <div class="app-logo">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.9"/>
          <rect x="11" y="1" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.55"/>
          <rect x="1" y="11" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.55"/>
          <rect x="11" y="11" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.9"/>
        </svg>
      </div>
      <div class="header-title-block">
        <h1 class="text-sm font-semibold tracking-tight leading-tight">Dashboard - CAI</h1>
        <p class="text-xs leading-tight hide-xs" style="color:rgba(255,255,255,0.4)">Pilotage de l'activité</p>
      </div>
    </div>

    <nav class="header-nav">
      <RouterLink to="/planning" class="header-nav-btn" :class="{ active: route.path === '/planning' }">
        <CalendarDays :size="13" />
        <span class="hide-xs">Planning</span>
      </RouterLink>
      <RouterLink to="/dashboard" class="header-nav-btn" :class="{ active: route.path.startsWith('/dashboard') || route.path.startsWith('/person') || route.path.startsWith('/cat') }">
        <LayoutDashboard :size="13" />
        <span class="hide-xs">Tableau de bord</span>
      </RouterLink>
    </nav>

    <div class="flex items-center gap-2">
      <DateRangePicker class="desktop-only" />
      <button class="btn-icon mobile-only" @click="ui.dateSheetOpen = true">
        <Calendar :size="15" />
      </button>
      <div class="header-sep desktop-only"></div>
      <button class="btn-icon" @click="ui.toggleDark()">
        <Moon v-if="!ui.darkMode" :size="15" />
        <Sun v-else :size="15" />
      </button>
      <button class="btn-icon mobile-only" @click="ui.rightDrawerOpen = true">
        <Tag :size="15" />
      </button>
      <button class="btn-icon" @click="auth.signOut()" title="Déconnexion">
        <LogOut :size="15" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { Users, CalendarDays, LayoutDashboard, Calendar, Moon, Sun, Tag, LogOut } from 'lucide-vue-next'
import DateRangePicker from '@/components/layout/DateRangePicker.vue'

const route = useRoute()
const ui    = useUiStore()
const auth  = useAuthStore()
</script>
