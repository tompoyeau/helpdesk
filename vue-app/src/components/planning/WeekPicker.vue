<template>
  <div class="wp-wrapper" ref="wrapperRef">

    <!-- Trigger -->
    <div class="planning-period planning-period-picker" @click="toggle">
      <Calendar :size="14" />
      <span>{{ label }}</span>
      <ChevronDown :size="13" style="opacity:0.7;margin-left:2px" />
    </div>

    <!-- Dropdown -->
    <Transition name="wp-drop">
      <div v-if="open" class="wp-dropdown" @mousedown.prevent>

        <!-- En-tête mois -->
        <div class="wp-month-nav">
          <button class="wp-nav-btn" @click="prevMonth"><ChevronLeft :size="14" /></button>
          <span class="wp-month-label">{{ monthLabel }}</span>
          <button class="wp-nav-btn" @click="nextMonth"><ChevronRight :size="14" /></button>
        </div>

        <!-- Jours de la semaine -->
        <div class="wp-days-header">
          <span v-for="d in DAY_LABELS" :key="d">{{ d }}</span>
        </div>

        <!-- Grille des jours -->
        <div class="wp-grid">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="wp-cell"
            :class="{
              'wp-cell-other':    cell.otherMonth,
              'wp-cell-today':    cell.isToday,
              'wp-cell-selected': cell.inSelectedWeek,
              'wp-cell-hover':    cell.inHoverWeek && !cell.inSelectedWeek,
              'wp-cell-mon':      cell.isMonday,
              'wp-cell-sun':      cell.isSunday,
            }"
            @mouseenter="hoverWeek = cell.weekMonday"
            @mouseleave="hoverWeek = null"
            @click="selectWeek(cell.weekMonday)"
          >{{ cell.day }}</div>
        </div>

        <!-- Raccourcis -->
        <div class="wp-shortcuts">
          <button class="wp-shortcut" @click="goToday">Aujourd'hui</button>
          <button class="wp-shortcut" @click="prevWeekBtn">Sem. préc.</button>
          <button class="wp-shortcut" @click="nextWeekBtn">Sem. suiv.</button>
        </div>

      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  weekOffset: { type: Number, default: 0 },
  weekDates:  { type: Array,  required: true },
})
const emit = defineEmits(['update:weekOffset'])

const open      = ref(false)
const hoverWeek = ref(null)   // "YYYY-MM-DD" du lundi survolé
const wrapperRef = ref(null)

/* ── Mois affiché dans le picker (initialisé sur le lundi de la semaine courante) ── */
const viewYear  = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())   // 0-11

const MONTHS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_SH  = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
const DAY_LABELS = ['L','M','M','J','V','S','D']

function toggle() {
  if (!open.value) {
    // Synchronise le mois affiché avec la semaine visible
    const currentMonday = props.weekDates[0]
    viewYear.value  = currentMonday.getFullYear()
    viewMonth.value = currentMonday.getMonth()
  }
  open.value = !open.value
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

const monthLabel = computed(() => `${MONTHS_FR[viewMonth.value]} ${viewYear.value}`)

/* ── Label dans le trigger ── */
const label = computed(() => {
  const s = props.weekDates[0]
  const e = props.weekDates[4]
  const fmt = d => `${d.getDate()} ${MONTHS_SH[d.getMonth()]}`
  return `Sem. du ${fmt(s)} au ${fmt(e)}`
})

/* ── Calcul du lundi d'une date ── */
function toMonday(date) {
  const d   = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(12, 0, 0, 0)
  return d
}
function fmtISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

/* ── Lundi de la semaine sélectionnée (week offset → date) ── */
const selectedMonday = computed(() => {
  return fmtISO(toMonday(props.weekDates[0]))
})

/* ── Grille du mois ── */
const cells = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  // Commence le lundi avant le 1er
  const startDow = firstDay.getDay()
  const startOffset = startDow === 0 ? -6 : 1 - startDow
  const start = new Date(firstDay)
  start.setDate(1 + startOffset)

  const today = fmtISO(new Date())
  const result = []

  for (let i = 0; i < 42; i++) {
    const d    = new Date(start)
    d.setDate(start.getDate() + i)
    d.setHours(12,0,0,0)
    const iso  = fmtISO(d)
    const mon  = fmtISO(toMonday(d))
    const dow  = d.getDay() // 0=dim, 1=lun … 6=sam

    result.push({
      key:            iso,
      day:            d.getDate(),
      otherMonth:     d.getMonth() !== viewMonth.value,
      isToday:        iso === today,
      isMonday:       dow === 1,
      isSunday:       dow === 0,
      weekMonday:     mon,
      inSelectedWeek: mon === selectedMonday.value,
      inHoverWeek:    hoverWeek.value !== null && mon === hoverWeek.value,
    })
  }

  // Retire la dernière ligne si elle est entièrement dans un autre mois
  if (result.slice(35).every(c => c.otherMonth)) return result.slice(0, 35)
  return result
})

/* ── Sélection ── */
function selectWeek(mondayISO) {
  const pickedMonday  = new Date(mondayISO + 'T12:00:00')
  const currentMonday = toMonday(new Date())
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  emit('update:weekOffset', Math.round((pickedMonday - currentMonday) / msPerWeek))
  open.value = false
}

function goToday()    { emit('update:weekOffset', 0); open.value = false }
function prevWeekBtn(){ emit('update:weekOffset', props.weekOffset - 1) }
function nextWeekBtn(){ emit('update:weekOffset', props.weekOffset + 1) }

/* ── Fermeture au clic extérieur ── */
function onOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) open.value = false
}
onMounted(()      => document.addEventListener('mousedown', onOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))
</script>

<style scoped>
.wp-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* ── Dropdown ── */
.wp-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 14px;
  width: 260px;
  z-index: 200;
  color: var(--text);
}

/* Transition */
.wp-drop-enter-active, .wp-drop-leave-active { transition: opacity 0.15s, transform 0.15s; }
.wp-drop-enter-from, .wp-drop-leave-to       { opacity: 0; transform: translateX(-50%) translateY(-6px); }

/* ── Navigation mois ── */
.wp-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.wp-month-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text);
}
.wp-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.wp-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

/* ── Jours header ── */
.wp-days-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
  letter-spacing: 0.03em;
}

/* ── Grille ── */
.wp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.wp-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  font-size: 0.75rem;
  border-radius: 0;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  color: var(--text);
}
.wp-cell-other   { color: var(--text-subtle); }
.wp-cell-today   { font-weight: 700; color: var(--accent); }

/* Semaine survolée — lun arrondi gauche, dim arrondi droite */
.wp-cell-hover                 { background: var(--accent-light); border-radius: 0; }
.wp-cell-hover.wp-cell-mon     { border-radius: 8px 0 0 8px; }
.wp-cell-hover.wp-cell-sun     { border-radius: 0 8px 8px 0; }

/* Semaine sélectionnée */
.wp-cell-selected              { background: var(--accent); color: #fff !important; border-radius: 0; }
.wp-cell-selected.wp-cell-mon  { border-radius: 8px 0 0 8px; }
.wp-cell-selected.wp-cell-sun  { border-radius: 0 8px 8px 0; }

/* ── Raccourcis ── */
.wp-shortcuts {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.wp-shortcut {
  flex: 1;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 5px 4px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.wp-shortcut:hover {
  background: var(--accent-light);
  color: var(--accent);
  border-color: var(--accent);
}
</style>
