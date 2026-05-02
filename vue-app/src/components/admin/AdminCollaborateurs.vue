<template>
  <div>
    <!-- Barre d'actions -->
    <div class="collab-toolbar">
      <div class="search-wrapper" style="max-width:260px">
        <Search class="search-icon" :size="12" />
        <input v-model="search" placeholder="Rechercher…" class="search-input" />
      </div>
      <button class="btn-primary" @click="openCreate">
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
    <table v-else class="w-full" style="font-size:0.8125rem">
      <thead>
        <tr>
          <th>Collaborateur</th>
          <th class="desktop-only">Email</th>
          <th class="desktop-only">Arrivée</th>
          <th class="desktop-only">Départ</th>
          <th>Admin</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in filtered" :key="u.uid">
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div
                class="person-avatar"
                style="width:28px;height:28px;font-size:0.625rem;flex-shrink:0"
                :style="u.isAdmin ? 'background:linear-gradient(135deg,#6366F1,#A78BFA)' : ''"
              >
                {{ `${u.nom?.[0] ?? ''}${u.prenom?.[0] ?? ''}`.toUpperCase() }}
              </div>
              <div>
                <div style="font-weight:600">{{ u.nom }} {{ u.prenom }}</div>
                <div style="font-size:0.6875rem;color:var(--text-muted)">{{ u.niveau }} · {{ u.role }}</div>
              </div>
            </div>
          </td>
          <td class="desktop-only" style="color:var(--text-muted)">{{ u.email || '—' }}</td>
          <td class="desktop-only" style="font-family:var(--font-mono);font-size:0.75rem">{{ fmtDate(u.arrivee) }}</td>
          <td class="desktop-only" style="font-family:var(--font-mono);font-size:0.75rem">{{ fmtDate(u.depart) }}</td>
          <td>
            <span :class="u.isAdmin ? 'badge-admin' : 'badge-user'">
              {{ u.isAdmin ? 'Admin' : 'User' }}
            </span>
          </td>
          <td>
            <div style="display:flex;gap:4px;justify-content:flex-end">
              <button class="btn-icon btn-icon-sm" title="Modifier" @click="openEdit(u)">
                <Pencil :size="12" />
              </button>
              <button
                class="btn-icon btn-icon-sm"
                style="color:#EF4444"
                title="Supprimer"
                @click="confirmDelete(u)"
              >
                <Trash2 :size="12" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

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
.collab-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
}
.badge-admin, .badge-user {
  display: inline-block;
  font-size: 0.6875rem; font-weight: 600;
  padding: 2px 8px; border-radius: 999px;
}
.badge-admin { background: var(--accent-light); color: var(--accent); }
.badge-user  { background: var(--bg-surface); color: var(--text-muted); }

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
import { Search, UserPlus, Pencil, Trash2, AlertTriangle } from 'lucide-vue-next'
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

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return userStore.users.filter(u =>
    `${u.nom} ${u.prenom} ${u.email ?? ''}`.toLowerCase().includes(q)
  )
})

function fmtDate(str) {
  // "18 04 2025" → "18/04/2025"
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
