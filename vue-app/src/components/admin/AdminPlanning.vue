<template>
  <div>
    <!-- Navigation semaine -->
    <div class="planning-nav" style="margin-bottom:16px">
      <button class="btn-icon" @click="weekOffset--"><ChevronLeft :size="16" /></button>
      <span class="week-label">{{ weekLabel }}</span>
      <button class="btn-icon" @click="weekOffset++"><ChevronRight :size="16" /></button>
      <button class="btn-primary" style="font-size:0.8125rem;padding:6px 12px" @click="weekOffset = 0">
        <CalendarCheck :size="12" /> Aujourd'hui
      </button>
    </div>

    <!-- Cartes jours -->
    <div class="days-grid">
      <div
        v-for="date in weekDates"
        :key="fmtId(date)"
        class="day-card"
        :class="{
          'day-card-active':  selectedDate && fmtId(date) === fmtId(selectedDate),
          'day-card-today':   isToday(date),
          'day-card-weekend': date.getDay() === 6,
        }"
        @click="selectDay(date)"
      >
        <div class="day-header">
          <span class="day-name">{{ DAYS[date.getDay()] }}</span>
          <span class="day-num">{{ date.getDate() }}</span>
        </div>
        <div v-if="dayStatus[fmtId(date)]" class="day-status">
          <span v-if="dayStatus[fmtId(date)] === 'loading'" style="color:var(--text-muted)">…</span>
          <span v-else-if="dayStatus[fmtId(date)] === 'exists'" class="badge-exists">
            <Check :size="10" /> Planifié
          </span>
          <span v-else class="badge-new">
            <Plus :size="10" /> Créer
          </span>
        </div>
      </div>
    </div>

    <!-- Éditeur du jour sélectionné -->
    <div v-if="selectedDate && dayData" class="day-editor">
      <div class="day-editor-header">
        <h3>
          {{ DAYS_FULL[selectedDate.getDay()] }}
          {{ selectedDate.getDate() }} {{ MONTHS[selectedDate.getMonth()] }} {{ selectedDate.getFullYear() }}
        </h3>
        <div style="display:flex;gap:8px;align-items:center">
          <span v-if="saveSuccess" class="save-success"><Check :size="12" /> Sauvegardé</span>
          <button
            class="btn-primary"
            :disabled="admin.saving"
            @click="saveDay"
          >
            <Save :size="12" />
            {{ admin.saving ? 'Enregistrement…' : 'Enregistrer le planning' }}
          </button>
        </div>
      </div>

      <!-- Chargement -->
      <div v-if="loadingDay" style="padding:24px;text-align:center;color:var(--text-muted)">
        Chargement du planning…
      </div>

      <template v-else>
        <!-- Tableau des collaborateurs -->
        <table class="w-full" style="font-size:0.8125rem">
          <thead>
            <tr>
              <th>Collaborateur</th>
              <th>Activités prévues</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in mergedRessources" :key="r.idPersonne">
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="person-avatar" style="width:26px;height:26px;font-size:0.5625rem">
                    {{ `${r.nom?.[0] ?? ''}${r.prenom?.[0] ?? ''}`.toUpperCase() }}
                  </div>
                  {{ r.nom }} {{ r.prenom }}
                </div>
              </td>
              <td>
                <div class="mini-timeline">
                  <div
                    v-for="(code, i) in r.activites"
                    :key="i"
                    class="mini-slot"
                    :style="{ background: slotColor(code) }"
                  />
                </div>
              </td>
              <td>
                <button class="btn-icon btn-icon-sm" title="Modifier" @click="openDayEditor(r)">
                  <Pencil :size="12" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>

    <!-- Modal édition personne/jour -->
    <DayEditorModal
      v-if="editRessource"
      :ressource="editRessource"
      :date="selectedDate"
      @close="editRessource = null"
      @saved="onDaySaved"
    />
  </div>
</template>

<style scoped>
.week-label {
  font-weight: 600; font-size: 0.875rem;
  min-width: 200px; text-align: center;
}
.days-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px; margin-bottom: 16px;
}
.day-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
  min-height: 70px;
  display: flex; flex-direction: column; gap: 6px;
}
.day-card:hover { border-color: var(--accent); box-shadow: var(--shadow-sm); }
.day-card-active { border-color: var(--accent); background: var(--accent-light); }
.day-card-today .day-num { color: var(--accent); font-weight: 700; }
.day-card-weekend { opacity: 0.7; }
.day-header { display: flex; justify-content: space-between; align-items: baseline; }
.day-name { font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
.day-num  { font-size: 1rem; font-weight: 700; }
.day-status { display: flex; }
.badge-exists, .badge-new {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.625rem; font-weight: 600;
  padding: 2px 6px; border-radius: 999px;
}
.badge-exists { background: rgba(52,211,153,0.15); color: #059669; }
.badge-new    { background: rgba(99,102,241,0.1);  color: var(--accent); }

/* Day editor */
.day-editor {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.day-editor-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  flex-wrap: wrap; gap: 8px;
}
.day-editor-header h3 { font-size: 0.875rem; font-weight: 700; margin: 0; }

.mini-timeline {
  display: flex; height: 14px; border-radius: 4px; overflow: hidden;
  border: 1px solid var(--border); width: 100%; max-width: 240px;
}
.mini-slot { flex: 1; }

.save-success {
  font-size: 0.75rem; color: #059669;
  display: inline-flex; align-items: center; gap: 4px;
}

@media (max-width: 768px) {
  .days-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  ChevronLeft, ChevronRight, CalendarCheck,
  Check, Plus, Pencil, Save,
} from 'lucide-vue-next'
import { useAdminStore } from '@/stores/adminStore'
import { useUserStore } from '@/stores/userStore'
import { useDataStore } from '@/stores/dataStore'
import { ACTIVITY_MAPPING } from '@/stores/dataStore'
import DayEditorModal from './DayEditorModal.vue'

const admin     = useAdminStore()
const userStore = useUserStore()
const data      = useDataStore()

const DAYS      = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const DAYS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS    = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

/* ── Semaine ── */
const weekOffset = ref(0)

function getMondayOf(offset) {
  const today = new Date()
  const diff  = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff + offset * 7)
  return mon
}

const weekDates = computed(() => {
  const mon = getMondayOf(weekOffset.value)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d
  })
})

const weekLabel = computed(() => {
  const [first, last] = [weekDates.value[0], weekDates.value[5]]
  return `${first.getDate()} ${MONTHS[first.getMonth()]} → ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
})

function fmtId(date) { return admin.dateToId(date) }
function isToday(date) { return fmtId(date) === fmtId(new Date()) }

/* ── Statut des jours ── */
const dayStatus = ref({})

async function checkWeekStatus() {
  for (const date of weekDates.value) {
    const id = fmtId(date)
    dayStatus.value[id] = 'loading'
    const result = await admin.loadDayPlanning(date)
    dayStatus.value = { ...dayStatus.value, [id]: result.exists ? 'exists' : 'empty' }
  }
}

watch(weekDates, checkWeekStatus, { immediate: true })

/* ── Sélection d'un jour ── */
const selectedDate  = ref(null)
const dayData       = ref(null)
const loadingDay    = ref(false)
const editRessource = ref(null)
const saveSuccess   = ref(false)

async function selectDay(date) {
  if (selectedDate.value && fmtId(date) === fmtId(selectedDate.value)) {
    selectedDate.value = null; dayData.value = null; return
  }
  selectedDate.value = date
  loadingDay.value   = true
  dayData.value      = await admin.loadDayPlanning(date)
  loadingDay.value   = false
}

/* ── Merge personnes + ressources ── */
const mergedRessources = computed(() => {
  if (!dayData.value || !userStore.users.length) return []

  const existing    = dayData.value.ressources || []
  const existingIds = new Set(existing.map(r => r.idPersonne))

  const activePeople = userStore.users
    .filter(p => admin.isActiveOn(p, selectedDate.value))

  const fromPersonnes = activePeople
    .filter(p => !existingIds.has(p.id || p.uid))
    .map(p => ({
      nom: p.nom, prenom: p.prenom,
      idPersonne: p.id || p.uid,
      activites: new Array(45).fill(''),
    }))

  return [...existing, ...fromPersonnes]
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
})

/* ── Couleur slot timeline ── */
function slotColor(code) {
  return code ? (ACTIVITY_MAPPING[code]?.couleur.replace(', 1)', ', 0.5)') || '#ccc') : 'transparent'
}

/* ── Éditeur personne/jour ── */
function openDayEditor(r) {
  editRessource.value = JSON.parse(JSON.stringify(r)) // deep copy
}

function onDaySaved(newActivites) {
  // Met à jour la ressource dans dayData
  const r = mergedRessources.value.find(r => r.idPersonne === editRessource.value.idPersonne)
  if (r) r.activites = newActivites

  // Met aussi à jour dayData.ressources
  const existing = dayData.value.ressources.find(r => r.idPersonne === editRessource.value.idPersonne)
  if (existing) {
    existing.activites = newActivites
  } else {
    dayData.value.ressources.push({ ...editRessource.value, activites: newActivites })
  }

  editRessource.value = null
}

/* ── Sauvegarde du jour ── */
async function saveDay() {
  saveSuccess.value = false
  await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
  // Rafraîchit le dataStore pour refléter les changements dans la vue Planning
  await data.loadPlanning()
  // Met à jour le statut du jour
  dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: 'exists' }
  saveSuccess.value = true
  setTimeout(() => { saveSuccess.value = false }, 3000)
}
</script>
