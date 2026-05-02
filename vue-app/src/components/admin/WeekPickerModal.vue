<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box">

      <div class="modal-header">
        <h3>Choisir une semaine</h3>
        <button class="btn-close" @click="$emit('close')"><X :size="14" /></button>
      </div>

      <!-- Navigation mois -->
      <div class="month-nav">
        <button class="btn-month-nav" @click="prevMonth"><ChevronLeft :size="15" /></button>
        <span class="month-label">{{ MONTHS[displayMonth] }} {{ displayYear }}</span>
        <button class="btn-month-nav" @click="nextMonth"><ChevronRight :size="15" /></button>
      </div>

      <!-- Grille calendrier -->
      <div class="cal-wrap">
        <!-- En-têtes jours -->
        <div class="cal-grid cal-head">
          <span v-for="d in DAY_HEADERS" :key="d">{{ d }}</span>
        </div>

        <!-- Semaines -->
        <div
          v-for="(week, wi) in calendarWeeks"
          :key="wi"
          class="cal-grid cal-week"
          :class="{
            'week-selected': isSelectedWeek(week),
            'week-current':  isCurrentWeek(week),
          }"
          @click="pickWeek(week)"
        >
          <div
            v-for="day in week"
            :key="day ? day.toISOString() : wi + '-empty'"
            class="cal-day"
            :class="{
              'day-other-month': day && day.getMonth() !== displayMonth,
              'day-today':       day && isToday(day),
              'day-empty':       !day,
            }"
          >
            {{ day ? day.getDate() : '' }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal-box {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  width: 100%; max-width: 360px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 12px;
  border-bottom: 1px solid var(--border);
}
.modal-header h3 { font-size: 0.9375rem; font-weight: 700; margin: 0; }

.btn-close {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.btn-close:hover { background: var(--bg-hover); color: var(--text); }

/* Navigation mois */
.month-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
}
.month-label {
  font-weight: 700; font-size: 0.875rem;
  text-transform: capitalize;
}
.btn-month-nav {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.btn-month-nav:hover { background: var(--bg-hover); color: var(--text); }

/* Grille calendrier */
.cal-wrap { padding: 0 12px 16px; }

.cal-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
}

.cal-head {
  margin-bottom: 4px;
}
.cal-head span {
  text-align: center;
  font-size: 0.6875rem; font-weight: 700;
  color: var(--text-muted); text-transform: uppercase;
  padding: 4px 0;
}

/* Semaine (ligne) */
.cal-week {
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s;
  padding: 2px;
}
.cal-week:hover { background: var(--bg-hover); }
.week-current   { background: var(--accent-light); }
.week-current:hover { background: var(--bg-active); }
.week-selected  { background: var(--accent) !important; }
.week-selected .cal-day { color: #fff !important; }

/* Cellule jour */
.cal-day {
  text-align: center;
  font-size: 0.8125rem; font-weight: 500;
  padding: 6px 2px;
  border-radius: 6px;
}
.day-other-month { color: var(--text-subtle); }
.day-today { font-weight: 800; color: var(--accent); }
.week-selected .day-today { color: #fff; }
.day-empty { visibility: hidden; }
</style>

<script setup>
import { ref, computed } from 'vue'
import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  currentOffset: { type: Number, default: 0 },
})
const emit = defineEmits(['pick', 'close'])

const MONTHS      = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_HEADERS = ['Lun','Mar','Mer','Jeu','Ven','Sam']

/* ── Mois affiché ── */
const today = new Date()
const displayYear  = ref(today.getFullYear())
const displayMonth = ref(today.getMonth())

function prevMonth() {
  if (displayMonth.value === 0) { displayMonth.value = 11; displayYear.value-- }
  else displayMonth.value--
}
function nextMonth() {
  if (displayMonth.value === 11) { displayMonth.value = 0; displayYear.value++ }
  else displayMonth.value++
}

/* ── Semaines du mois (lun → sam, 6 colonnes) ── */
const calendarWeeks = computed(() => {
  const weeks = []
  // Premier lundi ≤ 1er du mois
  const first = new Date(displayYear.value, displayMonth.value, 1)
  const dow = first.getDay() // 0=dim
  const startOffset = dow === 0 ? -6 : 1 - dow
  const start = new Date(first)
  start.setDate(first.getDate() + startOffset)

  for (let w = 0; w < 6; w++) {
    const week = []
    for (let d = 0; d < 6; d++) { // lun–sam (pas dimanche)
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      week.push(day)
    }
    // N'inclut la semaine que si elle contient au moins un jour du mois affiché
    if (week.some(d => d.getMonth() === displayMonth.value)) {
      weeks.push(week)
    }
  }
  return weeks
})

/* ── Utilitaires ── */
function mondayOf(offset) {
  const d = new Date(today)
  const diff = today.getDay() === 0 ? -6 : 1 - today.getDay()
  d.setDate(today.getDate() + diff + offset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekOffsetOf(week) {
  const mon = week[0]
  mon.setHours(0, 0, 0, 0)
  const currentMon = mondayOf(0)
  return Math.round((mon - currentMon) / (7 * 86400000))
}

function isToday(d) {
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
}

function isCurrentWeek(week) {
  return weekOffsetOf([new Date(week[0])]) === props.currentOffset
}

function isSelectedWeek(week) {
  return isCurrentWeek(week)
}

function pickWeek(week) {
  emit('pick', weekOffsetOf([new Date(week[0])]))
}
</script>
