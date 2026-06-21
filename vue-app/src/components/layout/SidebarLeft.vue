<template>
  <aside
    class="app-sidebar sidebar-left flex flex-col min-h-0"
    :class="{ open: ui.leftDrawerOpen }"
    id="sidebarLeft"
  >
    <!-- Bouton collapse (desktop uniquement) -->
    <button class="sb-toggle desktop-only" @click="ui.toggleLeftSidebar()" :title="ui.leftCollapsed ? 'Afficher collaborateurs' : 'Masquer'">
      <ChevronLeft :size="14" :style="ui.leftCollapsed ? 'transform:rotate(180deg)' : ''" />
    </button>

    <!-- Handle pill (mobile bottom sheet uniquement) -->
    <div class="drawer-handle-wrap mobile-only" aria-hidden="true">
      <div class="drawer-handle"></div>
    </div>

    <!-- Onglets mobile : Collaborateurs | Catégories -->
    <div class="sl-tabs mobile-only">
      <button :class="['sl-tab', { active: mode === 'collab' }]" @click="mode = 'collab'">
        <Users :size="13" /> Collaborateurs
      </button>
      <button :class="['sl-tab', { active: mode === 'cat' }]" @click="mode = 'cat'">
        <Layers :size="13" /> Catégories
      </button>
    </div>

    <!-- Header desktop -->
    <div class="drawer-header desktop-only-none">
      <span class="drawer-title">Collaborateurs</span>
      <button class="btn-icon btn-icon-sm" @click="ui.closeAllDrawers()">
        <X :size="14" />
      </button>
    </div>

    <!-- ══ VUE COLLABORATEURS ══ -->
    <template v-if="mode === 'collab'">

      <!-- Skeleton -->
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

    </template>

    <!-- ══ VUE CATÉGORIES (mobile uniquement) ══ -->
    <template v-if="mode === 'cat'">

      <!-- Skeleton -->
      <template v-if="data.loading">
        <div style="padding:12px 12px 6px">
          <div class="sk-bar" style="width:60%;height:10px"></div>
        </div>
        <div style="padding:0 8px;display:flex;flex-direction:column;gap:4px">
          <div v-for="i in 5" :key="i" class="sk-bar" style="height:28px;border-radius:8px"></div>
        </div>
      </template>

      <div v-else class="scroll-area flex-1">
        <ul class="px-2 pb-2">

          <li class="cat-group-title">Horaires consolidés</li>
          <li
            v-for="[key, obj] in Object.entries(CONSOLIDATED)"
            :key="key"
            class="sidebar-item"
            :class="{ active: currentCat === key }"
            @click="selectCat(key)"
          >
            <div class="flex items-center gap-2">
              <div class="color-dot" :style="{ background: key === 'CONS_AGENCE' ? '#34D399' : 'var(--accent)', opacity: '0.85' }"></div>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">{{ obj.label }}</span>
            </div>
          </li>

          <li
            v-if="hasSamedi"
            class="sidebar-item"
            :class="{ active: currentCat === 'samedi' }"
            @click="selectCat('samedi')"
          >
            <div class="flex items-center gap-2">
              <div class="color-dot" style="background:#60A5FA;opacity:0.85"></div>
              <span>Samedi</span>
            </div>
          </li>

          <template v-for="(items, group) in visibleGroups" :key="group">
            <li class="cat-group-title" style="margin-top:8px">{{ group }}</li>
            <li
              v-for="cat in items"
              :key="cat"
              class="sidebar-item"
              :class="{ active: currentCat === cat }"
              @click="selectCat(cat)"
            >
              <div class="flex items-center gap-2">
                <div class="color-dot" :style="{ background: data.colors[cat] }"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">{{ cat }}</span>
              </div>
            </li>
          </template>

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

/* ── Onglets mobile ── */
.sl-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sl-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.sl-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'
import { useDataStore } from '@/stores/dataStore'
import { X, Search, ChevronLeft, Users, Layers } from 'lucide-vue-next'

const ui     = useUiStore()
const data   = useDataStore()
const router = useRouter()
const route  = useRoute()

const mode = ref('collab')

/* ── Collaborateurs ── */
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

/* ── Catégories ── */
const CONSOLIDATED = {
  CONS_MATIN:  { label: 'Matin'           },
  CONS_MIDI:   { label: 'Midi'            },
  CONS_APREM:  { label: 'Aprem'           },
  CONS_SOIR:   { label: 'Soir'            },
  CONS_AGENCE: { label: 'Journées vertes' },
}

const CATEGORY_GROUPS = {
  'Travail chez le client':    ['Matin', 'Midi', 'Aprem', 'Soir'],
  'Journées vertes':           ['Agence Matin', 'Agence Midi', 'Agence APREM', 'Agence Soir'],
  'Télétravail au domicile':   ['TLT Matin', 'TLT Midi', 'TLT APREM', 'TLT Soir'],
  "Télétravail à l'agence":    ['TLT Agence Matin', 'TLT Agence Midi', 'TLT Agence APREM', 'TLT Agence Soir', 'ApremRenf'],
  'Projet / Pilote':           ['Pilote', 'PiloteBO', 'MatinW11', 'SoirW11'],
  'Autres':                    ['Formation', 'Indisponible', 'Astreinte', 'Récup', 'CP'],
}

const hasSamedi    = computed(() => !!data.filtered?.byCategory?.samedi?.d?.size)
const visibleGroups = computed(() => {
  const result = {}
  for (const [group, cats] of Object.entries(CATEGORY_GROUPS)) {
    const items = cats.filter(c => data.categories.includes(c))
    if (items.length) result[group] = items
  }
  return result
})

const currentCat = computed(() =>
  route.path.startsWith('/cat/') ? decodeURIComponent(String(route.params.name || '')) : ''
)

function selectCat(name) {
  router.push(`/cat/${encodeURIComponent(name)}`)
  ui.closeAllDrawers()
}
</script>
