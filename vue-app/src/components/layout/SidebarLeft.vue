<template>
  <aside
    class="app-sidebar sidebar-left flex flex-col min-h-0"
    :class="{ open: ui.leftDrawerOpen }"
    id="sidebarLeft"
  >
    <!-- Handle pill (mobile bottom sheet uniquement) -->
    <div class="drawer-handle-wrap mobile-only" aria-hidden="true">
      <div class="drawer-handle"></div>
    </div>

    <div class="drawer-header desktop-only-none">
      <span class="drawer-title">Collaborateurs</span>
      <button class="btn-icon btn-icon-sm" @click="ui.closeAllDrawers()">
        <X :size="14" />
      </button>
    </div>

    <!-- ── Skeleton chargement ── -->
    <template v-if="data.loading">
      <div class="sk-controls">
        <div class="sk-bar" style="width:80%;height:18px;border-radius:999px"></div>
      </div>
      <div class="sk-controls" style="border-bottom:1px solid var(--border)">
        <div class="sk-bar" style="width:100%;height:30px;border-radius:8px"></div>
      </div>
      <div style="padding:12px 12px 6px">
        <div class="sk-bar" style="width:50%;height:10px"></div>
      </div>
      <div style="padding:0 8px;display:flex;flex-direction:column;gap:4px">
        <div v-for="i in 8" :key="i" class="sk-bar" style="height:30px;border-radius:8px"></div>
      </div>
    </template>

    <!-- ── Contenu chargé ── -->
    <template v-else>
      <div class="p-3" style="border-bottom:1px solid var(--border)">
        <label class="toggle-label flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="data.filterActive" class="toggle-input" @change="data.computeFiltered()">
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          <span class="toggle-text">Actifs seulement</span>
        </label>
      </div>

      <div class="px-3 py-2" style="border-bottom:1px solid var(--border)">
        <div class="search-wrapper">
          <Search class="search-icon" :size="12" />
          <input v-model="ui.personSearch" placeholder="Rechercher…" class="search-input">
        </div>
      </div>

      <div class="px-3 pt-3 pb-1">
        <span class="sidebar-section-label">Collaborateurs</span>
      </div>

      <div class="scroll-area flex-1">
        <ul class="px-2 pb-2">
          <li
            v-for="person in filteredPersons"
            :key="person"
            class="sidebar-item"
            :class="{ active: currentPerson === person }"
            @click="selectPerson(person)"
          >
            <div class="flex items-center gap-2" style="min-width:0">
              <div class="person-avatar">{{ initials(person) }}</div>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">{{ person }}</span>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sk-controls {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.drawer-handle-wrap {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  flex-shrink: 0;
}
.drawer-handle {
  width: 36px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
}
</style>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'
import { useDataStore } from '@/stores/dataStore'
import { X, Search } from 'lucide-vue-next'

const ui     = useUiStore()
const data   = useDataStore()
const router = useRouter()
const route  = useRoute()

const currentPerson = computed(() =>
  route.path.startsWith('/person/')
    ? decodeURIComponent(String(route.params.name || ''))
    : ''
)

const filteredPersons = computed(() =>
  data.activePersons().filter(n =>
    n.toLowerCase().includes(ui.personSearch.toLowerCase())
  )
)

function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function selectPerson(name) {
  router.push(`/person/${encodeURIComponent(name)}`)
  ui.closeAllDrawers()
}
</script>
