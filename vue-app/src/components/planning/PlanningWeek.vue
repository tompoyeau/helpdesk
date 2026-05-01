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

    <!-- Grid body -->
    <div class="planning-grid-body">
      <!-- Favorites -->
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

      <!-- Others -->
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
import { ref, computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { ChevronLeft, ChevronRight, CalendarCheck, Star, Users } from 'lucide-vue-next'
import PlanningRow from './PlanningRow.vue'
import DayModal    from './DayModal.vue'
import WeekPicker  from './WeekPicker.vue'

const data = useDataStore()

const weekOffset  = ref(0)
const modalOpen   = ref(false)
const modalPerson = ref('')
const modalDate   = ref('')

const FAVORITES_KEY = 'planning_favorites'
const favorites = ref(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'))

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.value))
}

function toggleFavorite(person) {
  const idx = favorites.value.indexOf(person)
  if (idx > -1) favorites.value.splice(idx, 1)
  else favorites.value.push(person)
  saveFavorites()
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

const weekDates     = computed(() => getWeekDates(weekOffset.value))
const activePeople  = computed(() => data.activePersons())
const favoritePeople = computed(() => activePeople.value.filter(p => favorites.value.includes(p)))
const otherPeople    = computed(() => activePeople.value.filter(p => !favorites.value.includes(p)))
</script>
