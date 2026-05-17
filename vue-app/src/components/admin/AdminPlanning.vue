<template>
  <div>
    <!-- Navigation semaine -->
    <div class="planning-nav" style="margin-bottom:8px">
      <button class="btn-icon" @click="weekOffset--"><ChevronLeft :size="16" /></button>
      <WeekPicker :week-offset="weekOffset" :week-dates="weekDates" @update:week-offset="weekOffset = $event" />
      <button class="btn-icon" @click="weekOffset++"><ChevronRight :size="16" /></button>
      <button class="btn-primary" style="font-size:0.8125rem;padding:6px 12px" @click="weekOffset = 0">
        <CalendarCheck :size="12" /> Aujourd'hui
      </button>
      <button
        class="btn-test-collection"
        :class="{ 'btn-test-active': admin.collectionName !== 'plannings' }"
        style="margin-left:auto"
        @click="toggleTestCollection"
      >
        <FlaskConical :size="12" />
        {{ admin.collectionName !== 'plannings' ? 'Base TEST' : 'Base prod' }}
      </button>
    </div>

    <!-- Bannière mode test -->
    <div v-if="admin.collectionName !== 'plannings'" class="test-banner">
      <FlaskConical :size="11" />
      Vous consultez <strong>plannings_test</strong> — les modifications ici n'affectent pas la production
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
          <span v-if="dayStatus[fmtId(date)].state === 'loading'" style="color:var(--text-muted)">…</span>
          <span v-else-if="dayStatus[fmtId(date)].state === 'exists'" :class="dayStatus[fmtId(date)].filledCount > 0 ? 'badge-filled' : 'badge-exists'">
            <Users :size="10" /> {{ dayStatus[fmtId(date)].filledCount }} / {{ dayStatus[fmtId(date)].total }}
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
          <span v-if="admin.saving" style="font-size:0.75rem;color:var(--text-muted)">Enregistrement…</span>
          <span v-else-if="saveSuccess" class="save-success"><Check :size="12" /> Sauvegardé</span>
          <button
            class="btn-sort"
            :class="{ 'btn-sort-active': sortByHoraire }"
            title="Trier par type d'horaire"
            @click="sortByHoraire = !sortByHoraire"
          >
            <ArrowUpDown :size="12" />
            {{ sortByHoraire ? 'Catégorie' : 'Alphabétique' }}
          </button>
        </div>
      </div>

      <!-- Chargement -->
      <div v-if="loadingDay" style="padding:24px;text-align:center;color:var(--text-muted)">
        Chargement du planning…
      </div>

      <template v-else>
        <!-- Tableau des collaborateurs -->
        <div class="table-scroll-wrap">
        <table class="w-full" style="font-size:0.8125rem;min-width:520px">
          <thead>
            <tr>
              <th style="width:180px">Collaborateur</th>
              <th>Activités prévues</th>
              <th style="width:60px;text-align:center">Heures</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in mergedRessources" :key="r.idPersonne" class="row-clickable" @click="openDayEditor(r)">
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
                  <template v-for="(block, i) in getTimelineBlocks(r.activites)" :key="i">
                    <div
                      v-if="block.empty"
                      class="tl-gap"
                      :style="{ width: block.width + '%' }"
                    />
                    <div
                      v-else
                      class="tl-block"
                      :style="{ width: block.width + '%', background: block.color }"
                      :title="block.label"
                    >
                      <span v-if="block.width >= 10" class="tl-label" :style="{ color: block.textColor }">{{ block.label }}</span>
                    </div>
                  </template>
                </div>
              </td>
              <td style="text-align:center">
                <span v-if="calcHeures(r.activites) > 0" class="heures-badge">
                  {{ fmtHeures(calcHeures(r.activites)) }}
                </span>
                <span v-else style="color:var(--text-subtle)">—</span>
              </td>
              <td>
                <div style="display:flex;gap:4px;align-items:center;justify-content:flex-end">
                  <template v-if="clearTarget === r.idPersonne">
                    <span style="font-size:0.6875rem;color:var(--text-muted);white-space:nowrap">Effacer ?</span>
                    <button class="btn-action btn-action-confirm" title="Confirmer" @click.stop="clearActivites(r)">
                      <Check :size="12" />
                    </button>
                    <button class="btn-action" title="Annuler" @click.stop="clearTarget = null">
                      <X :size="12" />
                    </button>
                  </template>
                  <button
                    v-else-if="r.activites && r.activites.some(a => a && a !== '')"
                    class="btn-action btn-action-danger"
                    title="Effacer toutes les activités"
                    @click.stop="clearTarget = r.idPersonne"
                  >
                    <Eraser :size="12" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div><!-- /table-scroll-wrap -->
      </template>
    </div>

    <!-- Modal édition personne/jour -->
    <DayEditorModal
      v-if="editRessource"
      :ressource="editRessource"
      :date="selectedDate"
      :other-collabs="otherCollabs"
      @close="editRessource = null"
      @saved="onDaySaved"
    />
  </div>
</template>

<style scoped>
/* ── Bouton Enregistrer le planning ── */
.btn-save {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 0.8125rem; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: background 0.15s, transform 0.1s;
}
.btn-save:hover   { background: var(--accent-hover); }
.btn-save:active  { transform: scale(0.97); }
.btn-save:disabled { opacity: 0.5; cursor: default; }

/* ── Bouton icône modifier (crayon) ── */
.btn-action {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.heures-badge {
  display: inline-block;
  font-size: 0.75rem; font-weight: 700;
  font-family: var(--font-mono);
  color: var(--accent);
}

.row-clickable { cursor: pointer; }
.row-clickable:hover td { background: var(--bg-hover); }

.btn-action:hover         { background: var(--bg-hover); color: var(--text); }
.btn-action-danger:hover  { background: rgba(239,68,68,0.08); color: #EF4444; border-color: rgba(239,68,68,0.3); }
.btn-action-confirm       { color: #059669; border-color: rgba(52,211,153,0.4); }
.btn-action-confirm:hover { background: rgba(52,211,153,0.1); color: #059669; }

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
.badge-filled, .badge-exists, .badge-new {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.625rem; font-weight: 600;
  padding: 2px 6px; border-radius: 999px;
}
.badge-filled { background: rgba(52,211,153,0.15); color: #059669; }
.badge-exists { background: rgba(245,158,11,0.12); color: #D97706; }
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

.table-scroll-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

.mini-timeline {
  display: flex; height: 24px; border-radius: 6px; overflow: hidden;
  border: 1px solid var(--border); width: 100%;
  background: var(--bg-surface);
  gap: 1px;
}
.tl-gap {
  flex-shrink: 0;
  background: transparent;
}
.tl-block {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 3px;
  overflow: hidden;
  min-width: 0;
}
.tl-label {
  font-size: 0.625rem; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  padding: 0 5px;
  pointer-events: none;
  max-width: 100%;
  letter-spacing: 0.01em;
}

.save-success {
  font-size: 0.75rem; color: #059669;
  display: inline-flex; align-items: center; gap: 4px;
}

.btn-sort {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-sort:hover       { background: var(--bg-hover); color: var(--text); }
.btn-sort-active      { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }

@media (max-width: 768px) {
  .days-grid { grid-template-columns: repeat(3, 1fr); }
}

/* ── Mode test ── */
.btn-test-collection {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-test-collection:hover { background: var(--bg-hover); color: var(--text); }
@media (max-width: 1024px) { .btn-test-collection { display: none !important; } }
.btn-test-active {
  background: rgba(245,158,11,0.1) !important;
  border-color: #f59e0b !important;
  color: #f59e0b !important;
}
.test-banner {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; margin-bottom: 14px;
  background: rgba(245,158,11,0.1); border: 1px solid #f59e0b;
  border-radius: var(--radius-sm); font-size: 0.75rem;
  font-weight: 500; color: #b45309;
}
</style>

<script>
import { ref } from 'vue'
// Variable de module : persiste entre les changements d'onglets, réinitialisée au refresh
const weekOffset = ref(0)
</script>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  ChevronLeft, ChevronRight, CalendarCheck,
  Check, Plus, Users, Eraser, X, ArrowUpDown, FlaskConical,
} from 'lucide-vue-next'
import { useAdminStore } from '@/stores/adminStore'
import { useUserStore } from '@/stores/userStore'
import { useDataStore, ACTIVITY_MAPPING, HORAIRE_RANK } from '@/stores/dataStore'
import { notifyPlanningChange } from '@/services/notificationService'
import DayEditorModal from './DayEditorModal.vue'
import WeekPicker    from '@/components/planning/WeekPicker.vue'

const admin     = useAdminStore()
const userStore = useUserStore()
const data      = useDataStore()

const DAYS      = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const DAYS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS    = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

/* ── Bascule collection test/prod ── */
async function toggleTestCollection() {
  admin.collectionName = admin.collectionName === 'plannings' ? 'plannings_test' : 'plannings'
  dayStatus.value = {}
  dayData.value   = null
  await checkWeekStatus()
  if (selectedDate.value) {
    loadingDay.value = true
    dayData.value    = await admin.loadDayPlanning(selectedDate.value)
    loadingDay.value = false
  }
}

/* ── Semaine (weekOffset défini en module-scope, au-dessus) ── */

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


function fmtId(date) { return admin.dateToId(date) }
function isToday(date) { return fmtId(date) === fmtId(new Date()) }

/* ── Jours fériés français ── */
function easterDate(year) {
  // Algorithme de Butcher
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function isFerie(date) {
  const y = date.getFullYear()
  const easter = easterDate(y)
  const add = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const feries = [
    new Date(y, 0,  1),          // Jour de l'An
    new Date(y, 4,  1),          // Fête du Travail
    new Date(y, 4,  8),          // Victoire 1945
    new Date(y, 6, 14),          // Fête Nationale
    new Date(y, 7, 15),          // Assomption
    new Date(y, 10,  1),         // Toussaint
    new Date(y, 10, 11),         // Armistice
    new Date(y, 11, 25),         // Noël
    add(easter, 1),              // Lundi de Pâques
    add(easter, 39),             // Ascension
    add(easter, 50),             // Lundi de Pentecôte
  ]
  const d0 = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  return feries.some(f => f.getFullYear() * 10000 + (f.getMonth() + 1) * 100 + f.getDate() === d0)
}

/* ── Statut des jours ── */
const dayStatus = ref({})

async function checkWeekStatus() {
  for (const date of weekDates.value) {
    const id = fmtId(date)
    dayStatus.value[id] = { state: 'loading' }
    const result = await admin.loadDayPlanning(date)
    dayStatus.value = {
      ...dayStatus.value,
      [id]: result.exists
        ? { state: 'exists', filledCount: result.filledCount, total: result.total }
        : { state: 'empty' }
    }
  }
}

// Chargement initial : attend que le composant soit monté
onMounted(() => {
  checkWeekStatus()
  selectDay(weekDates.value[0])
})

// Changement de semaine : re-charge le statut et sélectionne le lundi
watch(weekDates, (newDates) => {
  checkWeekStatus()
  selectDay(newDates[0])
})

/* ── Sélection d'un jour ── */
const selectedDate  = ref(null)
const dayData       = ref(null)
const loadingDay    = ref(false)
const editRessource = ref(null)
const saveSuccess   = ref(false) // affiché après chaque sauvegarde auto
const clearTarget   = ref(null)

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

  const list = [...existing, ...fromPersonnes]

  if (sortByHoraire.value) {
    return list.sort((a, b) => {
      const diff = horaireRank(a.activites) - horaireRank(b.activites)
      if (diff !== 0) return diff
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')
    })
  }

  return list.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
})

/* ── Couleur texte contrastée selon le fond ── */
function contrastColor(rgbaStr) {
  // Parse "rgba(r, g, b, a)"
  const m = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return 'rgba(0,0,0,0.7)'
  const [r, g, b] = [+m[1], +m[2], +m[3]].map(c => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.35 ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.9)'
}

/* ── Blocs timeline groupés ── */
function getTimelineBlocks(activites) {
  if (!Array.isArray(activites)) return []
  const blocks = []
  let i = 0
  while (i < 45) {
    const code = activites[i]
    if (!code || code === '') {
      // Gap vide : regroupe les slots consécutifs vides
      let j = i + 1
      while (j < 45 && (!activites[j] || activites[j] === '')) j++
      blocks.push({ empty: true, width: (j - i) / 45 * 100 })
      i = j
    } else {
      // Bloc d'activité : regroupe les slots consécutifs du même code
      let j = i + 1
      while (j < 45 && activites[j] === code) j++
      const mapping = ACTIVITY_MAPPING[String(code)]
      const color = mapping?.couleur || 'rgba(200,200,200,1)'
      blocks.push({
        empty: false,
        width: (j - i) / 45 * 100,
        color,
        textColor: contrastColor(color),
        label: mapping?.categorie || String(code),
      })
      i = j
    }
  }
  return blocks
}

/* ── Calcul des heures travaillées ── */
// Codes d'absence exclus du décompte
const ABSENCE_CODES = new Set(['30', '6', '8']) // CP, Indisponible, Récup
function calcHeures(activites) {
  if (!Array.isArray(activites)) return 0
  const slots = activites.filter(a => a && a !== '' && !ABSENCE_CODES.has(String(a))).length
  return slots * 0.25 // 1 slot = 15 min = 0.25h
}
function fmtHeures(h) {
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`
}

/* ── Tri par type d'horaire ── */
const sortByHoraire = ref(true)

function horaireRank(activites) {
  if (!Array.isArray(activites)) return 99
  const first = activites.find(a => a && a !== '')
  if (first === undefined) return 99
  const cat = ACTIVITY_MAPPING[String(first)]?.categorie
  return cat !== undefined ? (HORAIRE_RANK[cat] ?? 99) : 99
}

/* ── Éditeur personne/jour ── */
const otherCollabs = computed(() =>
  editRessource.value
    ? mergedRessources.value.filter(r => r.idPersonne !== editRessource.value.idPersonne)
    : []
)

function openDayEditor(r) {
  clearTarget.value = null
  editRessource.value = JSON.parse(JSON.stringify(r)) // deep copy
}

async function clearActivites(r) {
  const empty = new Array(45).fill('')
  applyActivitesToRessource(r.idPersonne, empty)
  clearTarget.value = null
  // Sauvegarde immédiate sans attendre "Enregistrer le planning"
  await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
  const filledCount = mergedRessources.value.filter(r => (r.activites || []).some(a => a && a !== '')).length
  dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { state: 'exists', filledCount, total: mergedRessources.value.length } }
}

function applyActivitesToRessource(idPersonne, activites) {
  const idx = dayData.value.ressources.findIndex(r => r.idPersonne === idPersonne)
  if (idx >= 0) {
    // Réassignation de l'objet entier pour garantir la réactivité Vue
    dayData.value.ressources[idx] = { ...dayData.value.ressources[idx], activites }
  } else {
    const meta = mergedRessources.value.find(r => r.idPersonne === idPersonne)
    if (meta) dayData.value.ressources.push({ ...meta, activites })
  }
}

function fmtIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function uidForId(idPersonne) {
  const r = mergedRessources.value.find(r => r.idPersonne === idPersonne)
  if (!r) return null
  return data.nameToUid[`${r.nom} ${r.prenom}`] || null
}


async function onDaySaved({ activites, toCollabIds, applyWholeWeek, applyCollabsWholeWeek }) {
  try {
    // 1. Applique au collab courant + collabs sélectionnés (même jour)
    applyActivitesToRessource(editRessource.value.idPersonne, activites)
    for (const id of toCollabIds) {
      applyActivitesToRessource(id, activites)
    }

    // Sauvegarde immédiate du jour courant
    await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
    const filledCount = mergedRessources.value.filter(r => (r.activites || []).some(a => a && a !== '')).length
    dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { state: 'exists', filledCount, total: mergedRessources.value.length } }
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)

    const currentId = fmtId(selectedDate.value)
    const otherDays = weekDates.value.filter(d =>
      fmtId(d) !== currentId && d.getDay() !== 6 && !isFerie(d)
    )

    // ── Notifications ──
    const mainUid = data.nameToUid[`${editRessource.value.nom} ${editRessource.value.prenom}`]
    const notifDates = [selectedDate.value, ...(applyWholeWeek ? otherDays : [])]
    for (const date of notifDates)
      notifyPlanningChange(mainUid, fmtIso(date))

    for (const id of toCollabIds) {
      const uid = uidForId(id)
      const collabDates = [selectedDate.value, ...(applyCollabsWholeWeek ? otherDays : [])]
      for (const date of collabDates)
        notifyPlanningChange(uid, fmtIso(date))
    }

    // 2. Applique sur toute la semaine pour le collab courant
    if (applyWholeWeek) {
      const meta = { ...editRessource.value, activites }
      for (const date of otherDays) {
        const result     = await admin.loadDayPlanning(date)
        const ressources = result.ressources.filter(r => r.idPersonne !== meta.idPersonne)
        ressources.push(meta)
        await admin.saveDayPlanning(date, ressources)
        const fc = ressources.filter(r => (r.activites || []).some(a => a && a !== '')).length
        dayStatus.value = { ...dayStatus.value, [fmtId(date)]: { state: 'exists', filledCount: fc, total: ressources.length } }
      }
    }

    // 3. Applique sur toute la semaine pour les collabs sélectionnés
    if (applyCollabsWholeWeek && toCollabIds.length) {
      for (const date of otherDays) {
        const result     = await admin.loadDayPlanning(date)
        const ressources = [...result.ressources]
        for (const id of toCollabIds) {
          const collab = mergedRessources.value.find(r => r.idPersonne === id)
          if (!collab) continue
          const idx = ressources.findIndex(r => r.idPersonne === id)
          const entry = { nom: collab.nom, prenom: collab.prenom, idPersonne: id, activites }
          if (idx >= 0) ressources[idx] = entry
          else ressources.push(entry)
        }
        await admin.saveDayPlanning(date, ressources)
        const fc = ressources.filter(r => (r.activites || []).some(a => a && a !== '')).length
        dayStatus.value = { ...dayStatus.value, [fmtId(date)]: { state: 'exists', filledCount: fc, total: ressources.length } }
      }
    }
  } finally {
    editRessource.value = null
  }
}

</script>
