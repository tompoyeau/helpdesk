<template>
  <div>
    <!-- Barre d'actions -->
    <div class="collab-toolbar">
      <div class="search-wrapper" style="max-width:260px">
        <Search class="search-icon" :size="12" />
        <input v-model="search" placeholder="Rechercher…" class="search-input" />
      </div>
      <button class="btn-add" @click="openCreate">
        <UserPlus :size="13" /> Nouveau collaborateur
      </button>
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
            <th></th>
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
                <span class="collab-name">{{ u.nom }} {{ u.prenom }}</span>
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

            <!-- Actions -->
            <td>
              <div style="display:flex;gap:4px;justify-content:flex-end">
                <button
                  class="btn-action btn-action-danger"
                  title="Supprimer"
                  @click.stop="confirmDelete(u)"
                >
                  <Trash2 :size="12" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Confirmation suppression -->
    <div v-if="deleteTarget" class="delete-confirm">
      <AlertTriangle :size="14" style="color:#F59E0B;flex-shrink:0" />
      <span>
        Supprimer <strong>{{ deleteTarget.nom }} {{ deleteTarget.prenom }}</strong> ?
        Cette action est irréversible.
      </span>
      <div style="display:flex;gap:6px">
        <button class="btn-ghost-sm" @click="deleteTarget = null">Annuler</button>
        <button class="btn-danger-sm" :disabled="deleting" @click="doDelete">
          {{ deleting ? '…' : 'Supprimer' }}
        </button>
      </div>
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

/* Badge niveau */
.badge-niveau {
  display: inline-block;
  font-size: 0.6875rem; font-weight: 600;
  padding: 2px 8px; border-radius: 999px;
  background: var(--bg-surface); color: var(--text-muted);
  white-space: nowrap;
}

/* Boutons d'action icône */
.btn-action {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.btn-action:hover { background: var(--bg-hover); color: var(--text); border-color: var(--border-input); }
.btn-action-danger:hover { background: rgba(239,68,68,0.08); color: #EF4444; border-color: rgba(239,68,68,0.3); }

/* Ligne cliquable */
.row-clickable { cursor: pointer; }
.row-clickable:hover td { background: var(--bg-hover); }

/* Confirmation suppression */
.delete-confirm {
  display: flex; align-items: center; gap: 10px;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.3);
  border-radius: 10px; padding: 10px 14px;
  font-size: 0.8125rem; margin-top: 12px; flex-wrap: wrap;
}
.btn-ghost-sm {
  padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;
  border: 1px solid var(--border); cursor: pointer;
  background: transparent; color: var(--text); white-space: nowrap;
}
.btn-danger-sm {
  padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;
  background: #EF4444; color: white; border: none; cursor: pointer; white-space: nowrap;
}
.btn-danger-sm:disabled { opacity: 0.5; cursor: default; }
</style>

<script setup>
import { ref, computed } from 'vue'
import { Search, UserPlus, Trash2, AlertTriangle } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useAdminStore } from '@/stores/adminStore'
import CollaborateurModal from './CollaborateurModal.vue'

const userStore = useUserStore()
const admin     = useAdminStore()

const search       = ref('')
const modalOpen    = ref(false)
const editTarget   = ref(null)
const deleteTarget = ref(null)
const deleting     = ref(false)

const today = new Date()

function isActiveToday(u) {
  return admin.isActiveOn(u, today)
}

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return userStore.users.filter(u =>
    `${u.nom} ${u.prenom} ${u.email ?? ''}`.toLowerCase().includes(q)
  )
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

function confirmDelete(u) {
  deleteTarget.value = u
}

async function doDelete() {
  deleting.value = true
  try {
    await admin.deletePersonne(deleteTarget.value.uid)
    await userStore.loadAllUsers()
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}
</script>
