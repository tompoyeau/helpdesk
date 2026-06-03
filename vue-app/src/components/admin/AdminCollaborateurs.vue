<template>
  <div>
    <!-- Barre d'actions -->
    <div class="collab-toolbar">
      <div class="search-wrapper" style="max-width:260px">
        <Search class="search-icon" :size="12" />
        <input v-model="search" placeholder="Rechercher…" class="search-input" />
      </div>
      <div class="toolbar-right">
        <label class="toggle-label flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="filterActive" class="toggle-input">
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          <span class="toggle-text">Actifs seulement</span>
        </label>
        <button class="btn-add" @click="openCreate">
          <UserPlus :size="13" /> Nouveau collaborateur
        </button>
      </div>
    </div>

    <!-- Compteur -->
    <div style="margin-bottom:10px;color:var(--text-muted);font-size:0.75rem">
      {{ filtered.length }} collaborateur{{ filtered.length > 1 ? 's' : '' }}
    </div>

    <!-- Chargement -->
    <div v-if="userStore.loading" style="padding:24px;text-align:center;color:var(--text-muted)">
      Chargement…
    </div>

    <!-- Tableau -->
    <div v-else class="table-wrap">
      <table class="collab-table">
        <thead>
          <tr>
            <th>Collaborateur</th>
            <th class="col-extra">Niveau</th>
            <th class="col-extra">Rôle</th>
            <th class="col-extra">Email</th>
            <th class="col-extra">Arrivée</th>
            <th class="col-extra">Départ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filtered" :key="u.uid" class="row-clickable" @click="openEdit(u)">
            <!-- Collaborateur : avatar + nom prénom coloré si présent aujourd'hui -->
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div
                  class="person-avatar"
                  style="width:28px;height:28px;font-size:0.625rem;flex-shrink:0"
                  :class="{ 'avatar-active': isActiveToday(u) }"
                >
                  {{ `${u.nom?.[0] ?? ''}${u.prenom?.[0] ?? ''}`.toUpperCase() }}
                </div>
                <div style="display:flex;flex-direction:column;gap:2px">
                  <span class="collab-name">{{ u.nom }} {{ u.prenom }}</span>
                  <div style="display:flex;gap:4px;flex-wrap:wrap">
                    <span class="badge-run" :class="u.onRun === false ? 'badge-hors-run' : 'badge-on-run'">
                      {{ u.onRun === false ? 'Hors Run' : 'Run' }}
                    </span>
                    <span v-if="u.peutTLT !== false" class="badge-cap badge-tlt">TLT</span>
                    <span v-if="u.peutBO" class="badge-cap badge-bo">BO</span>
                    <span v-if="u.isAdmin" class="badge-cap badge-admin">Admin</span>
                  </div>
                </div>
              </div>
            </td>

            <!-- Niveau -->
            <td class="col-extra">
              <span v-if="u.niveau" class="badge-niveau">{{ u.niveau }}</span>
              <span v-else style="color:var(--text-subtle)">—</span>
            </td>

            <!-- Rôle -->
            <td class="col-extra" style="color:var(--text-muted);white-space:nowrap">
              {{ u.role || '—' }}
            </td>

            <!-- Email -->
            <td class="col-extra" style="color:var(--text-muted);font-size:0.75rem">
              {{ u.email || '—' }}
            </td>

            <!-- Arrivée -->
            <td class="col-extra" style="font-family:var(--font-mono);font-size:0.75rem;white-space:nowrap">
              {{ fmtDate(u.arrivee) }}
            </td>

            <!-- Départ -->
            <td class="col-extra" style="font-family:var(--font-mono);font-size:0.75rem;white-space:nowrap">
              {{ fmtDate(u.depart) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal création/édition -->
    <CollaborateurModal
      v-if="modalOpen"
      :person="editTarget"
      @close="modalOpen = false"
      @saved="modalOpen = false"
    />
  </div>
</template>

<style scoped>
/* Toolbar */
.collab-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
}
.toolbar-right {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}

/* Bouton "Nouveau collaborateur" */
.btn-add {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  background: var(--accent);
  color: #fff;
  font-size: 0.8125rem; font-weight: 600;
  border: none; border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  white-space: nowrap;
}
.btn-add:hover  { background: var(--accent-hover); }
.btn-add:active { transform: scale(0.97); }

/* Tableau */
.table-wrap { overflow-x: auto; }
.collab-table {
  width: 100%;
  font-size: 0.8125rem;
  border-collapse: collapse;
}

/* Colonnes masquées sur mobile */
.col-extra { display: table-cell; }
@media (max-width: 768px) { .col-extra { display: none; } }

/* Nom collaborateur */
.collab-name {
  font-weight: 600;
  white-space: nowrap;
}

/* Avatar coloré si présent aujourd'hui */
.avatar-active {
  background: linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%) !important;
  color: #fff !important;
}

/* Badge Run / Hors Run */
.badge-run {
  display: inline-block;
  font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.04em;
  padding: 1px 5px; border-radius: 4px; text-transform: uppercase;
}
.badge-on-run   { background: rgba(34,197,94,0.12); color: #22c55e; }
.badge-hors-run { background: rgba(176,176,176,0.15); color: var(--text-muted); }

.badge-cap {
  display: inline-block;
  font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.04em;
  padding: 1px 5px; border-radius: 4px; text-transform: uppercase;
}
.badge-tlt   { background: rgba(215,190,158,0.2);  color: rgba(201,167,123,1); }
.badge-bo    { background: rgba(253,224,71,0.2);   color: rgba(180,155,20,1);  }
.badge-admin { background: rgba(239,68,68,0.12);   color: #ef4444;             }

/* Badge niveau */
.badge-niveau {
  display: inline-block;
  font-size: 0.6875rem; font-weight: 600;
  padding: 2px 8px; border-radius: 999px;
  background: var(--bg-surface); color: var(--text-muted);
  white-space: nowrap;
}

/* Ligne cliquable */
.row-clickable { cursor: pointer; }
.row-clickable:hover td { background: var(--bg-hover); }

</style>

<script setup>
import { ref, computed } from 'vue'
import { Search, UserPlus } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useAdminStore } from '@/stores/adminStore'
import CollaborateurModal from './CollaborateurModal.vue'

const userStore = useUserStore()
const admin     = useAdminStore()

const search        = ref('')
const filterActive  = ref(true)
const modalOpen     = ref(false)
const editTarget    = ref(null)
const today = new Date()

function isActiveToday(u) {
  return admin.isActiveOn(u, today)
}

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return userStore.users.filter(u => {
    if (filterActive.value && !admin.isActiveOn(u, today)) return false
    return `${u.nom} ${u.prenom} ${u.email ?? ''}`.toLowerCase().includes(q)
  })
})

function fmtDate(str) {
  return str ? str.split(' ').join('/') : '—'
}

function openCreate() {
  editTarget.value = null
  modalOpen.value  = true
}

function openEdit(u) {
  editTarget.value = u
  modalOpen.value  = true
}


</script>
