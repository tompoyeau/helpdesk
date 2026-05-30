<template>
  <div class="planning-card">
    <!-- Header navigation -->
    <div class="planning-header">
      <div class="planning-nav">
        <button class="btn-icon" @click="weekOffset--">
          <ChevronLeft :size="16" />
        </button>

        <WeekPicker
          :week-offset="weekOffset"
          :week-dates="weekDates"
          @update:week-offset="weekOffset = $event"
        />

        <button class="btn-icon" @click="weekOffset++">
          <ChevronRight :size="16" />
        </button>
        <button class="btn-primary" style="font-size:0.8125rem;padding:6px 12px" @click="weekOffset = 0">
          <CalendarCheck :size="12" />
          Aujourd'hui
        </button>
        <button
          v-if="!filterPerson"
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

    <!-- Grid body — Skeleton -->
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

    <!-- Grid body — Données -->
    <div v-else class="planning-grid-body">

      <!-- ── Mode fiche perso : une seule ligne ── -->
      <template v-if="filterPerson">
        <PlanningRow
          :person="filterPerson"
          :week-dates="weekDates"
          :is-favorite="favorites.includes(filterPerson)"
          @toggle-favorite="toggleFavorite"
          @open-modal="openModal"
        />
      </template>

      <!-- ── Mode normal : tous les collaborateurs ── -->
      <template v-else>
        <div v-if="favoritePeople.length" class="planning-section">
          <div class="planning-section-header">
            <Star :size="14" style="fill:currentColor" />
            <span>Favoris ({{ favoritePeople.length }})</span>
          </div>
          <PlanningRow
            v-for="person in favoritePeople"
            :key="person"
            :person="person"
            :week-dates="weekDates"
            :is-favorite="true"
            @toggle-favorite="toggleFavorite"
            @open-modal="openModal"
          />
        </div>

        <div v-if="otherPeople.length" class="planning-section" :class="{ 'planning-section-others': favoritePeople.length > 0 }">
          <div v-if="favoritePeople.length > 0" class="planning-section-header">
            <Users :size="14" />
            <span>Autres collaborateurs ({{ otherPeople.length }})</span>
          </div>
          <PlanningRow
            v-for="person in otherPeople"
            :key="person"
            :person="person"
            :week-dates="weekDates"
            :is-favorite="false"
            @toggle-favorite="toggleFavorite"
            @open-modal="openModal"
          />
        </div>
      </template>

    </div>
  </div>

  <!-- Day Modal -->
  <DayModal
    v-model="modalOpen"
    :person="modalPerson"
    :date-str="modalDate"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  /** Quand fourni, n'affiche que cette personne (vue fiche collab) */
  filterPerson: { type: String, default: null },
})
import { useDataStore, HORAIRE_RANK } from '@/stores/dataStore'
import { useAuthStore } from '@/stores/authStore'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, CalendarCheck, Star, Users, ArrowUpDown } from 'lucide-vue-next'
import PlanningRow from './PlanningRow.vue'
import DayModal    from './DayModal.vue'
import WeekPicker  from './WeekPicker.vue'

const data = useDataStore()
const auth = useAuthStore()

const weekOffset  = ref(0)
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

const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const DAYS   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function getWeekDates(offset) {
  const today  = new Date()
  const diff   = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateLabel(date) {
  return { day: DAYS[date.getDay()], date: date.getDate(), month: MONTHS[date.getMonth()] }
}

function isToday(date) {
  return formatDate(date) === formatDate(new Date())
}

const weekDates    = computed(() => getWeekDates(weekOffset.value))
const activePeople = computed(() => data.activePersons())

/* ── Tri par catégorie d'horaire ── */
const sortByHoraire = ref(false)

function horaireRank(person) {
  const days = weekDates.value
  for (const d of days) {
    const iso     = formatDate(d)
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

const favoritePeople = computed(() => sortedPeople(activePeople.value.filter(p =>  favorites.value.includes(p))))
const otherPeople    = computed(() => sortedPeople(activePeople.value.filter(p => !favorites.value.includes(p))))
</script>

<style scoped>
.btn-sort {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-sort:hover    { background: var(--bg-hover); color: var(--text); }
.btn-sort-active   { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
</style>
