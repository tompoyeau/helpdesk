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

    <!-- ── Section : Prochaines arrivées ── -->
    <div v-if="futureCollabs.length" class="future-section">
      <button class="future-header" @click="futureOpen = !futureOpen">
        <div style="display:flex;align-items:center;gap:8px">
          <CalendarClock :size="14" style="color:var(--accent)" />
          <span class="future-title">Prochaines arrivées</span>
          <span class="future-count">{{ futureCollabs.length }}</span>
        </div>
        <ChevronDown :size="14" class="future-chevron" :class="{ 'future-chevron-open': futureOpen }" />
      </button>

      <div v-if="futureOpen" class="future-body">
        <div
          v-for="u in futureCollabs"
          :key="u.uid"
          class="future-row"
          @click="openEdit(u)"
        >
          <!-- Avatar + nom -->
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <div class="person-avatar future-avatar">
              {{ `${u.nom?.[0] ?? ''}${u.prenom?.[0] ?? ''}`.toUpperCase() }}
            </div>
            <div style="min-width:0">
              <div class="collab-name" style="font-size:0.8125rem">{{ u.nom }} {{ u.prenom }}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">
                <span class="badge-run" :class="u.onRun === false ? 'badge-hors-run' : 'badge-on-run'">
                  {{ u.onRun === false ? 'Hors Run' : 'Run' }}
                </span>
                <span v-if="u.peutTLT !== false" class="badge-cap badge-tlt">TLT</span>
                <span v-if="u.peutBO"            class="badge-cap badge-bo">BO</span>
              </div>
            </div>
          </div>

          <!-- Date d'arrivée + jours restants -->
          <div class="future-date-block">
            <span class="future-date">{{ fmtDate(u.arrivee) }}</span>
            <span class="future-countdown">dans {{ daysUntil(u.arrivee) }}j</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast : confirmation après création -->
    <Transition name="toast-slide">
      <div v-if="emailSentToast" class="email-toast">
        <Mail :size="13" />
        Compte créé — email d'invitation envoyé.
      </div>
    </Transition>

    <!-- Modal création/édition -->
    <CollaborateurModal
      v-if="modalOpen"
      :person="editTarget"
      @close="modalOpen = false"
      @saved="onSaved"
      @deleted="modalOpen = false"
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
.badge-bo     { background: rgba(253,224,71,0.2);   color: rgba(180,155,20,1);  }
.badge-admin  { background: rgba(239,68,68,0.12);   color: #ef4444;             }

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

/* ── Toast email envoyé ── */
.email-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px; border-radius: var(--radius-md);
  background: #ecfdf5; border: 1px solid #6ee7b7;
  color: #065f46; font-size: 0.8125rem; font-weight: 500;
  box-shadow: var(--shadow-md); z-index: 300; white-space: nowrap;
}
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.25s ease; }
.toast-slide-enter-from, .toast-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ── Section Prochaines arrivées ── */
.future-section {
  margin-top: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.future-header {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 10px 14px;
  background: var(--bg-surface);
  border: none; cursor: pointer;
  transition: background 0.15s;
}
.future-header:hover { background: var(--bg-hover); }
.future-title { font-size: 0.8125rem; font-weight: 600; color: var(--text); }
.future-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: var(--accent-light); color: var(--accent);
  font-size: 0.6875rem; font-weight: 700;
  border-radius: 999px;
}
.future-chevron {
  color: var(--text-muted);
  transition: transform 0.2s;
  flex-shrink: 0;
}
.future-chevron-open { transform: rotate(180deg); }

.future-body { border-top: 1px solid var(--border); }
.future-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 10px 14px;
  cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid var(--border);
}
.future-row:last-child { border-bottom: none; }
.future-row:hover { background: var(--bg-hover); }

.future-avatar {
  width: 28px; height: 28px; font-size: 0.625rem; flex-shrink: 0;
  background: color-mix(in srgb, var(--accent) 15%, var(--bg-surface));
  color: var(--accent);
}
.future-date-block {
  display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0;
}
.future-date {
  font-family: var(--font-mono); font-size: 0.75rem; color: var(--text);
  white-space: nowrap;
}
.future-countdown {
  font-size: 0.6875rem; font-weight: 600; color: var(--accent);
  white-space: nowrap;
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { Search, UserPlus, CalendarClock, ChevronDown, Mail } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useAdminStore } from '@/stores/adminStore'
import CollaborateurModal from './CollaborateurModal.vue'

const userStore = useUserStore()
const admin     = useAdminStore()

const search        = ref('')
const filterActive  = ref(true)
const modalOpen     = ref(false)
const editTarget    = ref(null)
const futureOpen      = ref(true)
const emailSentToast  = ref(false)
const today         = new Date()
today.setHours(0, 0, 0, 0)

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

// Collaborateurs dont la date d'arrivée est dans le futur, triés par arrivée croissante
const futureCollabs = computed(() => {
  const parseD = str => {
    if (!str) return null
    const p = str.trim().split(' ')
    if (p.length < 3) return null
    const d = new Date(+p[2], +p[1] - 1, +p[0])
    d.setHours(0, 0, 0, 0)
    return d
  }
  return userStore.users
    .filter(u => {
      const arrivee = parseD(u.arrivee)
      return arrivee && arrivee > today
    })
    .sort((a, b) => {
      const da = parseD(a.arrivee), db = parseD(b.arrivee)
      return da - db
    })
})

function daysUntil(str) {
  if (!str) return '?'
  const p = str.trim().split(' ')
  if (p.length < 3) return '?'
  const d = new Date(+p[2], +p[1] - 1, +p[0])
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d - today) / 86400000)
}

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

function onSaved(wasCreation) {
  modalOpen.value = false
  if (wasCreation) {
    emailSentToast.value = true
    setTimeout(() => { emailSentToast.value = false }, 5000)
  }
}


</script>
