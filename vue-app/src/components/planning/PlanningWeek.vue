<template>
  <div class="planning-card">

    <!-- ── Header navigation ── -->
    <div class="planning-header">
      <div class="planning-nav">

        <!-- Semaine : flèches + picker -->
        <template v-if="viewMode === 'week'">
          <button class="btn-icon" @click="weekOffset--"><ChevronLeft :size="16" /></button>
          <WeekPicker :week-offset="weekOffset" :week-dates="weekDates" @update:week-offset="weekOffset = $event" />
          <button class="btn-icon" @click="weekOffset++"><ChevronRight :size="16" /></button>
        </template>

        <!-- Mois : flèches + label -->
        <template v-else>
          <button class="btn-icon" @click="monthOffset--"><ChevronLeft :size="16" /></button>
          <span class="month-nav-label">{{ monthLabel }}</span>
          <button class="btn-icon" @click="monthOffset++"><ChevronRight :size="16" /></button>
        </template>

        <!-- Aujourd'hui (commun) -->
        <button class="btn-primary" style="font-size:0.8125rem;padding:6px 12px" @click="goToday">
          <CalendarCheck :size="12" /> Aujourd'hui
        </button>

        <!-- Toggle Semaine / Mois -->
        <div class="view-mode-toggle">
          <button :class="['vm-btn', { 'vm-active': viewMode === 'week' }]" @click="switchToWeek">Semaine</button>
          <button :class="['vm-btn', { 'vm-active': viewMode === 'month' }]" @click="switchToMonth">
            <LayoutGrid :size="11" /> Mois
          </button>
        </div>

        <!-- Tri alphabétique/horaire (vue semaine uniquement) -->
        <button
          v-if="!filterPerson && viewMode === 'week'"
          class="btn-sort"
          :class="{ 'btn-sort-active': sortByHoraire }"
          style="margin-left:auto"
          @click="sortByHoraire = !sortByHoraire"
        >
          <ArrowUpDown :size="12" />
          {{ sortByHoraire ? 'Catégorie' : 'Alphabétique' }}
        </button>

      </div>
    </div>

    <!-- ══ Vue Semaine ══ -->
    <template v-if="viewMode === 'week'">

      <!-- Days header -->
      <div class="planning-grid-header">
        <div class="planning-name-col">Collaborateur</div>
        <div
          v-for="date in weekDates"
          :key="formatDate(date)"
          class="planning-day-col"
          :class="{ 'planning-day-today': isToday(date) }"
        >
          <div class="planning-day-label">{{ formatDateLabel(date).day }}</div>
          <div class="planning-day-date">{{ formatDateLabel(date).date }} {{ formatDateLabel(date).month }}</div>
        </div>
      </div>

      <!-- Skeleton -->
      <div v-if="data.loading" class="planning-grid-body">
        <div v-for="i in 10" :key="i" class="planning-row">
          <div class="planning-name-cell" style="gap:10px;padding:10px 12px">
            <div class="sk-circle" style="width:34px;height:34px;flex-shrink:0;border-radius:50%"></div>
            <div class="sk-bar" :style="`width:${40 + (i * 13) % 45}%;height:11px`"></div>
          </div>
          <div class="planning-days-mobile">
            <div v-for="j in 6" :key="j" class="planning-cell" style="padding:8px">
              <div v-if="(i + j) % 4 !== 0" class="sk-bar" style="height:100%;min-height:38px;border-radius:8px"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Données -->
      <div v-else class="planning-grid-body">
        <template v-if="filterPerson">
          <PlanningRow
            :person="filterPerson"
            :week-dates="weekDates"
            :is-favorite="favorites.includes(filterPerson)"
            @toggle-favorite="toggleFavorite"
            @open-modal="openModal"
          />
        </template>
        <template v-else>
          <div v-if="favoritePeople.length" class="planning-section">
            <div class="planning-section-header">
              <Star :size="14" style="fill:currentColor" />
              <span>Favoris ({{ favoritePeople.length }})</span>
            </div>
            <PlanningRow v-for="person in favoritePeople" :key="person"
              :person="person" :week-dates="weekDates" :is-favorite="true"
              @toggle-favorite="toggleFavorite" @open-modal="openModal" />
          </div>
          <div v-if="otherPeople.length" class="planning-section" :class="{ 'planning-section-others': favoritePeople.length > 0 }">
            <div v-if="favoritePeople.length > 0" class="planning-section-header">
              <Users :size="14" />
              <span>Autres collaborateurs ({{ otherPeople.length }})</span>
            </div>
            <PlanningRow v-for="person in otherPeople" :key="person"
              :person="person" :week-dates="weekDates" :is-favorite="false"
              @toggle-favorite="toggleFavorite" @open-modal="openModal" />
          </div>

          <!-- Équipe Covéa (MACA, ALRE) -->
          <div v-if="fixedPeopleWeek.length" class="planning-section planning-section-others">
            <div class="planning-section-header">
              <Anchor :size="13" />
              <span>Équipe Covéa ({{ fixedPeopleWeek.length }})</span>
            </div>
            <PlanningRow v-for="person in fixedPeopleWeek" :key="person"
              :person="person" :week-dates="weekDates"
              :is-favorite="favorites.includes(person)"
              @toggle-favorite="toggleFavorite"
              @open-modal="openModal" />
          </div>
        </template>
      </div>

    </template>

    <!-- ══ Vue Mois ══ -->
    <template v-else>
      <div class="pm-scroll">
        <table class="pm-table">
          <colgroup>
            <col style="width:160px;min-width:140px;max-width:180px">
            <col v-for="iso in monthWorkDates" :key="iso" style="min-width:32px">
          </colgroup>
          <thead>
            <tr>
              <th class="pm-th-name">Collaborateur</th>
              <th
                v-for="iso in monthWorkDates"
                :key="iso"
                class="pm-th-day"
                :class="{
                  'pm-today-col':  isTodayIso(iso),
                  'pm-week-sep':   monthWeekStarts.has(iso),
                  'pm-sam-col':    isSam(iso),
                  'pm-sorted-col': monthSortDay === iso,
                }"
                :title="monthSortDay === iso ? 'Annuler le tri' : 'Trier par cet horaire'"
                @click="toggleMonthSort(iso)"
              >
                <div class="pm-dow">{{ getDow(iso) }}</div>
                <div class="pm-dm">{{ getDM(iso) }}</div>
                <ArrowUpDown v-if="monthSortDay === iso" :size="7" class="pm-sort-icon" />
              </th>
            </tr>
          </thead>
          <tbody>

            <!-- Mode fiche perso -->
            <template v-if="filterPerson">
              <tr>
                <td class="pm-td-name">{{ filterPerson }}</td>
                <td
                  v-for="iso in monthWorkDates"
                  :key="iso"
                  class="pm-cell"
                  :class="{ 'pm-week-sep': monthWeekStarts.has(iso), 'pm-sam-col': isSam(iso) }"
                  :style="getCellStyle(filterPerson, iso)"
                  @click="openModal(filterPerson, iso)"
                >
                  <span v-if="getCellLabel(filterPerson, iso)" class="pm-label">{{ getCellLabel(filterPerson, iso) }}</span>
                </td>
              </tr>
            </template>

            <!-- Mode normal -->
            <template v-else>

              <!-- Favoris -->
              <template v-if="favoritePeopleMonth.length">
                <tr class="pm-section-row">
                  <td :colspan="monthWorkDates.length + 1" class="pm-section-cell">
                    <Star :size="11" style="fill:currentColor" />
                    Favoris
                  </td>
                </tr>
                <tr v-for="person in favoritePeopleMonth" :key="person" class="pm-row-fav">
                  <td class="pm-td-name">
                    <router-link :to="{ name: 'person', params: { name: person } }" class="pm-name-link">{{ person }}</router-link>
                  </td>
                  <td
                    v-for="iso in monthWorkDates"
                    :key="iso"
                    class="pm-cell"
                    :class="{ 'pm-week-sep': monthWeekStarts.has(iso), 'pm-sam-col': isSam(iso) }"
                    :style="getCellStyle(person, iso)"
                    @click="openModal(person, iso)"
                  >
                    <span v-if="getCellLabel(person, iso)" class="pm-label">{{ getCellLabel(person, iso) }}</span>
                  </td>
                </tr>
              </template>

              <!-- Autres collaborateurs -->
              <tr v-if="favoritePeopleMonth.length && otherPeopleMonth.length" class="pm-section-row pm-section-others">
                <td :colspan="monthWorkDates.length + 1" class="pm-section-cell">
                  <Users :size="11" />
                  Autres collaborateurs
                </td>
              </tr>
              <tr v-for="person in otherPeopleMonth" :key="person">
                <td class="pm-td-name">
                  <router-link :to="{ name: 'person', params: { name: person } }" class="pm-name-link">{{ person }}</router-link>
                </td>
                <td
                  v-for="iso in monthWorkDates"
                  :key="iso"
                  class="pm-cell"
                  :class="{ 'pm-week-sep': monthWeekStarts.has(iso), 'pm-sam-col': isSam(iso) }"
                  :style="getCellStyle(person, iso)"
                  @click="openModal(person, iso)"
                >
                  <span v-if="getCellLabel(person, iso)" class="pm-label">{{ getCellLabel(person, iso) }}</span>
                </td>
              </tr>

              <!-- Équipe Covéa -->
              <template v-if="fixedPeopleMonth.length">
                <tr class="pm-section-row pm-section-others">
                  <td :colspan="monthWorkDates.length + 1" class="pm-section-cell">
                    <Anchor :size="11" />
                    Équipe Covéa
                  </td>
                </tr>
                <tr v-for="person in fixedPeopleMonth" :key="person">
                  <td class="pm-td-name pm-td-name-fav">
                    <span>{{ person }}</span>
                    <button class="pm-fav-btn" :class="{ active: favorites.includes(person) }" @click.stop="toggleFavorite(person)">
                      <Star :size="11" :style="favorites.includes(person) ? 'fill:currentColor' : ''" />
                    </button>
                  </td>
                  <td
                    v-for="iso in monthWorkDates"
                    :key="iso"
                    class="pm-cell"
                    :class="{ 'pm-week-sep': monthWeekStarts.has(iso), 'pm-sam-col': isSam(iso) }"
                    :style="getCellStyle(person, iso)"
                    @click="openModal(person, iso)"
                  >
                    <span v-if="getCellLabel(person, iso)" class="pm-label">{{ getCellLabel(person, iso) }}</span>
                  </td>
                </tr>
              </template>

            </template>
          </tbody>
        </table>
      </div>
    </template>

  </div>

  <!-- Day Modal (shared) -->
  <DayModal v-model="modalOpen" :person="modalPerson" :date-str="modalDate" />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  filterPerson: { type: String, default: null },
})

import { useDataStore, HORAIRE_RANK } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, CalendarCheck, Star, Users, ArrowUpDown, LayoutGrid, Anchor } from 'lucide-vue-next'
import PlanningRow from './PlanningRow.vue'
import DayModal    from './DayModal.vue'
import WeekPicker  from './WeekPicker.vue'

const data = useDataStore()
const auth = useAuthStore()

/* ── Modes de vue ── */
const viewMode    = ref('week')   // 'week' | 'month'
const weekOffset  = ref(0)
const monthOffset = ref(0)

/* ── Modal ── */
const modalOpen   = ref(false)
const modalPerson = ref('')
const modalDate   = ref('')

/* ── Favoris Firestore ── */
const favorites = ref([])

onMounted(async () => {
  const uid = auth.user?.uid
  if (!uid) return
  const snap = await getDoc(doc(db, 'personnes', uid))
  if (snap.exists()) favorites.value = snap.data().planningFavorites || []
})

async function persistFavorites() {
  const uid = auth.user?.uid
  if (!uid) return
  await setDoc(doc(db, 'personnes', uid), { planningFavorites: favorites.value }, { merge: true })
}

function toggleFavorite(person) {
  const idx = favorites.value.indexOf(person)
  if (idx > -1) favorites.value.splice(idx, 1)
  else favorites.value.push(person)
  persistFavorites()
}

function openModal(person, dateStr) {
  modalPerson.value = person
  modalDate.value   = dateStr
  modalOpen.value   = true
}

/* ── Helpers de date ── */
const MONTHS   = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const DAYS     = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function fmtIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function getWeekDates(offset) {
  const today  = new Date()
  const diff   = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })
}

function formatDate(date) { return fmtIso(date) }

function formatDateLabel(date) {
  return { day: DAYS[date.getDay()], date: date.getDate(), month: MONTHS[date.getMonth()] }
}

function isToday(date) { return fmtIso(date) === fmtIso(new Date()) }

const weekDates    = computed(() => getWeekDates(weekOffset.value))
const activePeople = computed(() => data.activePersons())

/* ── Changement de vue avec synchronisation de date ── */
function goToday() {
  if (viewMode.value === 'week') weekOffset.value = 0
  else monthOffset.value = 0
}

function switchToMonth() {
  const today = new Date()
  const mon   = getWeekDates(weekOffset.value)[0]
  let ref = mon
  for (let i = 0; i < 6; i++) {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)
    if (d.getDate() === 1) { ref = d; break }
  }
  monthOffset.value = (ref.getFullYear() - today.getFullYear()) * 12 + (ref.getMonth() - today.getMonth())
  viewMode.value = 'month'
}

function switchToWeek() {
  const today    = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  const dow      = firstDay.getDay() || 7
  const mon      = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() - dow + 1)
  const curDow   = today.getDay() || 7
  const curMon   = new Date(today.getFullYear(), today.getMonth(), today.getDate() - curDow + 1)
  weekOffset.value = Math.round((mon - curMon) / (7 * 86400000))
  viewMode.value = 'week'
}

/* ── Tri vue semaine ── */
const sortByHoraire = ref(false)

function horaireRank(person) {
  for (const d of weekDates.value) {
    const iso     = fmtIso(d)
    const entries = data.planning?.[person]?.[iso]
    if (!entries?.length) continue
    const cat = entries.find(e => HORAIRE_RANK[e.categorie] !== undefined)?.categorie
    if (cat !== undefined) return HORAIRE_RANK[cat] ?? 99
  }
  return 99
}

function sortedPeople(list) {
  if (!sortByHoraire.value) return list
  return [...list].sort((a, b) => {
    const diff = horaireRank(a) - horaireRank(b)
    return diff !== 0 ? diff : a.localeCompare(b, 'fr')
  })
}

const favoritePeople = computed(() => {
  const reg   = activePeople.value.filter(p => favorites.value.includes(p))
  const fixed = [...(data.fixedPersonNames || [])]
    .filter(n => favorites.value.includes(n) && weekDates.value.some(d => data.planning?.[n]?.[formatDate(d)]?.length))
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return sortedPeople([...reg, ...fixed])
})
const otherPeople = computed(() => sortedPeople(activePeople.value.filter(p => !favorites.value.includes(p))))

// Personnes fixes NON favorites présentes dans la semaine courante
const fixedPeopleWeek = computed(() =>
  [...(data.fixedPersonNames || [])].filter(name =>
    !favorites.value.includes(name) &&
    weekDates.value.some(d => data.planning?.[name]?.[formatDate(d)]?.length)
  ).sort((a, b) => a.localeCompare(b, 'fr'))
)

/* ══════════════════════════════════════════════
   VUE MOIS
   ══════════════════════════════════════════════ */

const CAT_SHORT = {
  'Matin':             'Mat',  'Midi':             'Mid',  'Aprem':            'Apr',  'Soir':            'Soi',
  'TLT Matin':         'TM',   'TLT Midi':         'TMi',  'TLT APREM':        'TA',   'TLT Soir':        'TS',
  'TLT Agence Matin':  'TM',   'TLT Agence Midi':  'TMi',  'TLT Agence APREM': 'TA',   'TLT Agence Soir': 'TS',
  'Agence Matin':      'AM',   'Agence Midi':      'AMi',  'Agence APREM':     'AA',   'Agence Soir':     'AS',
  'BO':                'BO',   'PiloteBO':         'Pil',  'Pilote':           'Pil',
  'CP':                'CP',   'Indisponible':     'Ind',  'Récup':            'Réc',  'Formation':       'For',
  'RH':                'RH',   'Astreinte':        'Ast',
}

const monthLabel = computed(() => {
  const today = new Date()
  const d = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  return `${MONTH_FR[d.getMonth()]} ${d.getFullYear()}`
})

const monthWorkDates = computed(() => {
  const today = new Date()
  const base  = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  const y = base.getFullYear(), mo = base.getMonth()
  const dates = []
  const d = new Date(y, mo, 1)
  while (d.getMonth() === mo) {
    if (d.getDay() !== 0) dates.push(fmtIso(d))   // exclure dimanche
    d.setDate(d.getDate() + 1)
  }
  return dates
})

// Lundis = séparateurs de semaine
const monthWeekStarts = computed(() => {
  const s = new Set()
  for (const iso of monthWorkDates.value) {
    if (new Date(iso + 'T12:00:00').getDay() === 1) s.add(iso)
  }
  return s
})

const todayIso = fmtIso(new Date())
function isTodayIso(iso) { return iso === todayIso }
function isSam(iso)      { return new Date(iso + 'T12:00:00').getDay() === 6 }
function getDow(iso)     { return DAYS[new Date(iso + 'T12:00:00').getDay()] }
function getDM(iso) {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function getCellLabel(person, iso) {
  const entries = data.planning?.[person]?.[iso]
  if (!entries?.length) return ''
  const counts = {}
  for (const e of entries) if (e.categorie) counts[e.categorie] = (counts[e.categorie] || 0) + 1
  const cat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  return cat ? (CAT_SHORT[cat] || cat.slice(0, 3)) : ''
}

function getCellStyle(person, iso) {
  const entries = data.planning?.[person]?.[iso]
  if (!entries?.length) return {}
  const counts = {}
  for (const e of entries) if (e.categorie && e.couleur) counts[e.categorie] = (counts[e.categorie] || 0) + 1
  const cat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!cat) return {}
  const entry = entries.find(e => e.categorie === cat)
  if (!entry?.couleur) return {}
  const bg = entry.couleur.replace(/,\s*1\s*\)$/, ', 0.55)')
  return { background: bg, cursor: 'pointer' }
}

/* ── Tri vue mois par jour ── */
const monthSortDay = ref(null)
watch(monthOffset, () => { monthSortDay.value = null })

function toggleMonthSort(iso) {
  monthSortDay.value = monthSortDay.value === iso ? null : iso
}

function horaireRankForDay(person, iso) {
  const entries = data.planning?.[person]?.[iso]
  if (!entries?.length) return 99
  for (const e of entries) {
    const r = HORAIRE_RANK[e.categorie]
    if (r !== undefined) return r
  }
  return 99
}

function monthSortedPeople(list) {
  if (!monthSortDay.value) return list
  return [...list].sort((a, b) =>
    horaireRankForDay(a, monthSortDay.value) - horaireRankForDay(b, monthSortDay.value)
    || a.localeCompare(b, 'fr')
  )
}

const favoritePeopleMonth = computed(() => {
  const reg   = activePeople.value.filter(p => favorites.value.includes(p))
  const fixed = [...(data.fixedPersonNames || [])]
    .filter(n => favorites.value.includes(n) && monthWorkDates.value.some(iso => data.planning?.[n]?.[iso]?.length))
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return monthSortedPeople([...reg, ...fixed])
})
const otherPeopleMonth = computed(() => monthSortedPeople(activePeople.value.filter(p => !favorites.value.includes(p))))

// Personnes fixes NON favorites présentes dans le mois courant
const fixedPeopleMonth = computed(() =>
  [...(data.fixedPersonNames || [])].filter(name =>
    !favorites.value.includes(name) &&
    monthWorkDates.value.some(iso => data.planning?.[name]?.[iso]?.length)
  ).sort((a, b) => a.localeCompare(b, 'fr'))
)
</script>

<style scoped>
/* ── Label mois ── */
.month-nav-label {
  font-family: var(--font-sans);
  font-size: 0.875rem; font-weight: 700;
  min-width: 130px; text-align: center;
}

/* ── Toggle vue ── */
.view-mode-toggle {
  display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
}
.vm-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
  border: none; background: transparent; cursor: pointer;
  color: var(--text-muted); transition: background 0.12s, color 0.12s;
}
.vm-btn:hover  { background: var(--bg-hover); color: var(--text); }
.vm-active { background: var(--accent); color: #fff; }

/* ── Tri (vue semaine) ── */
.btn-sort {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-sort:hover    { background: var(--bg-hover); color: var(--text); }
.btn-sort-active   { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }

/* ══ Vue Mois ══ */
.pm-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  max-height: 75vh;
  margin-top: 4px;
}
.pm-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  table-layout: fixed;
}
.pm-table th, .pm-table td {
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
}
.pm-table tr:last-child td { border-bottom: none; }

/* En-tête nom */
.pm-th-name {
  position: sticky; left: 0; top: 0; z-index: 4;
  background: var(--bg-surface); padding: 6px 10px;
  font-family: var(--font-sans); font-weight: 700;
  text-align: left; white-space: nowrap;
  border-right: 2px solid var(--border) !important;
  font-size: 0.6875rem; color: var(--text-muted);
}

/* En-tête jour */
.pm-th-day {
  position: sticky; top: 0; z-index: 2;
  background: var(--bg-surface); padding: 5px 2px; text-align: center;
  border-bottom: 2px solid var(--border) !important;
  cursor: pointer; user-select: none; transition: background 0.12s;
}
.pm-th-day:hover { background: var(--bg-hover); }
.pm-dow {
  font-family: var(--font-sans);
  font-size: 0.5625rem; font-weight: 700;
  text-transform: uppercase; color: var(--text-muted);
}
.pm-dm  {
  font-family: var(--font-sans);
  font-size: 0.625rem; font-weight: 600; color: var(--text);
}
.pm-sort-icon { display: block; margin: 1px auto 0; color: var(--accent); opacity: 0.8; }

/* Colonne aujourd'hui */
.pm-today-col { background: color-mix(in srgb, var(--bg-surface) 75%, var(--accent) 25%) !important; }
.pm-today-col .pm-dow,
.pm-today-col .pm-dm { color: var(--accent) !important; font-weight: 800; }

/* Colonne triée */
.pm-sorted-col { background: var(--accent-light) !important; border-bottom-color: var(--accent) !important; }

/* Colonne samedi */
.pm-sam-col { background: color-mix(in srgb, var(--bg-card) 80%, #94a3b8 20%); }

/* Séparateur de semaine (lundi) */
.pm-week-sep { border-left: 2px solid var(--text-muted) !important; }

/* Cellule nom */
.pm-td-name {
  position: sticky; left: 0; z-index: 1;
  background: var(--bg-card); padding: 5px 10px;
  font-family: var(--font-sans); font-weight: 600;
  white-space: nowrap; font-size: 0.75rem;
  border-right: 2px solid var(--border) !important;
}
.pm-name-link { color: inherit; text-decoration: none; }
.pm-name-link:hover { text-decoration: underline; color: var(--accent); }

.pm-td-name-fav { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.pm-fav-btn {
  display: none; align-items: center; justify-content: center;
  width: 16px; height: 16px; flex-shrink: 0;
  background: none; border: none; cursor: pointer; border-radius: 3px;
  color: var(--text-muted); transition: color 0.12s;
  padding: 0;
}
.pm-fav-btn.active { color: #f59e0b; display: flex; }
.pm-fav-btn:hover  { color: #f59e0b; }
.pm-td-name-fav:hover .pm-fav-btn { display: flex; }

/* Cellule jour */
.pm-cell {
  height: 28px; text-align: center; vertical-align: middle;
  padding: 0; transition: filter 0.1s; cursor: pointer;
}
.pm-cell:hover { filter: brightness(0.88); }

.pm-label {
  font-family: var(--font-sans);
  font-size: 0.5625rem; font-weight: 800;
  letter-spacing: 0.01em; pointer-events: none;
}

/* Section headers */
.pm-section-row td { padding: 0; }
.pm-section-cell {
  padding: 5px 10px !important;
  font-family: var(--font-sans);
  font-size: 0.625rem; font-weight: 700;
  color: var(--text-muted); background: var(--bg-surface) !important;
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 5px;
}
.pm-section-others { opacity: 0.7; }
.pm-row-fav .pm-td-name { background: color-mix(in srgb, var(--bg-card) 90%, var(--accent) 10%); }
</style>
