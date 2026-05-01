<template>
  <aside
    class="app-sidebar sidebar-right flex flex-col min-h-0"
    :class="{ open: ui.rightDrawerOpen }"
    id="sidebarRight"
  >
    <div class="drawer-header desktop-only-none">
      <span class="drawer-title">Catégories</span>
      <button class="btn-icon btn-icon-sm" @click="ui.closeAllDrawers()">
        <X :size="14" />
      </button>
    </div>

    <!-- ── Skeleton chargement ── -->
    <template v-if="data.loading">
      <div style="padding:12px 12px 6px">
        <div class="sk-bar" style="width:60%;height:10px"></div>
      </div>
      <div style="padding:0 8px;display:flex;flex-direction:column;gap:4px">
        <div v-for="i in 5" :key="i" class="sk-bar" style="height:28px;border-radius:8px"></div>
      </div>
      <div style="padding:14px 12px 6px">
        <div class="sk-bar" style="width:55%;height:10px"></div>
      </div>
      <div style="padding:0 8px;display:flex;flex-direction:column;gap:4px">
        <div v-for="i in 4" :key="i" class="sk-bar" style="height:28px;border-radius:8px"></div>
      </div>
    </template>

    <!-- ── Contenu chargé ── -->
    <div v-else class="scroll-area flex-1">
      <ul class="px-2 pb-2">

        <!-- Horaires consolidés -->
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
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">{{ obj.label }}</span>
          </div>
        </li>

        <!-- Samedi -->
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

        <!-- Groupes par catégorie -->
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
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">{{ cat }}</span>
            </div>
          </li>
        </template>

      </ul>
    </div>
  </aside>
</template>

<style scoped>
@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}

.sk-bar {
  background: var(--border);
  border-radius: 6px;
  animation: sk-pulse 1.4s ease-in-out infinite;
}
</style>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/uiStore'
import { useDataStore } from '@/stores/dataStore'
import { X } from 'lucide-vue-next'

const ui     = useUiStore()
const data   = useDataStore()
const router = useRouter()
const route  = useRoute()

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
