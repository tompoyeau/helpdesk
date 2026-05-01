<template>
  <div class="drp-wrapper" ref="wrapperRef">

    <!-- Trigger -->
    <button class="drp-trigger" @click="toggle">
      <CalendarRange :size="13" />
      <span>{{ triggerLabel }}</span>
      <ChevronDown :size="12" style="opacity:0.6" />
    </button>

    <!-- Dropdown -->
    <Transition name="drp-drop">
      <div v-if="open" class="drp-dropdown" @mousedown.prevent>

        <!-- Chips start / end -->
        <div class="drp-range-chips">
          <button class="drp-chip" :class="{ 'drp-chip-active': editing === 'start' }" @click="selectChip('start')">
            <span class="drp-chip-label">Du</span>
            <span class="drp-chip-value">{{ tempStart ? fmtHuman(tempStart) : '—' }}</span>
          </button>
          <span class="drp-chip-arrow">→</span>
          <button class="drp-chip" :class="{ 'drp-chip-active': editing === 'end' }" @click="selectChip('end')">
            <span class="drp-chip-label">Au</span>
            <span class="drp-chip-value">{{ tempEnd ? fmtHuman(tempEnd) : '—' }}</span>
          </button>
        </div>

        <!-- ── Vue CALENDRIER ── -->
        <template v-if="view === 'calendar'">
          <div class="drp-month-nav">
            <button class="drp-nav-btn" @click="prevMonth"><ChevronLeft :size="13" /></button>
            <button class="drp-month-label-btn" @click="view = 'year'">
              {{ monthLabel }}
              <ChevronsUpDown :size="11" style="opacity:0.5;margin-left:3px" />
            </button>
            <button class="drp-nav-btn" @click="nextMonth"><ChevronRight :size="13" /></button>
          </div>

          <div class="drp-days-header">
            <span v-for="d in DAY_LABELS" :key="d">{{ d }}</span>
          </div>

          <div class="drp-grid">
            <div
              v-for="cell in cells"
              :key="cell.iso"
              class="drp-cell"
              :class="{
                'drp-cell-other':    cell.otherMonth,
                'drp-cell-today':    cell.isToday,
                'drp-cell-start':    cell.isStart,
                'drp-cell-end':      cell.isEnd,
                'drp-cell-in-range': cell.inRange,
              }"
              @mouseenter="hoverDate = cell.iso"
              @mouseleave="hoverDate = null"
              @click="onCellClick(cell.iso)"
            >{{ cell.day }}</div>
          </div>
        </template>

        <!-- ── Vue ANNÉES ── -->
        <template v-else>
          <div class="drp-month-nav">
            <button class="drp-nav-btn" @click="yearRangeStart -= 12"><ChevronLeft :size="13" /></button>
            <span class="drp-month-label">{{ yearRangeStart }} – {{ yearRangeStart + 11 }}</span>
            <button class="drp-nav-btn" @click="yearRangeStart += 12"><ChevronRight :size="13" /></button>
          </div>
          <div class="drp-year-grid">
            <button
              v-for="y in yearRange"
              :key="y"
              class="drp-year-btn"
              :class="{ 'drp-year-current': y === new Date().getFullYear(), 'drp-year-active': y === viewYear }"
              @click="selectYear(y)"
            >{{ y }}</button>
          </div>
        </template>

        <!-- Raccourcis -->
        <div class="drp-shortcuts">
          <button class="drp-shortcut" @click="setPreset('month')">Ce mois</button>
          <button class="drp-shortcut" @click="setPreset('prevMonth')">Mois préc.</button>
          <button class="drp-shortcut" @click="setPreset('3months')">3 mois</button>
          <button class="drp-shortcut" @click="setPreset('year')">Cette année</button>
          <button class="drp-shortcut drp-shortcut-full" @click="setPreset('rolling')">Année glissante</button>
        </div>

        <!-- Actions -->
        <div class="drp-actions">
          <button class="drp-btn-cancel" @click="cancel">Annuler</button>
          <button class="drp-btn-apply" :disabled="!canApply" @click="apply">
            <Check :size="12" /> Appliquer
          </button>
        </div>

      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { CalendarRange, ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, Check } from 'lucide-vue-next'

const data = useDataStore()

const open       = ref(false)
const wrapperRef = ref(null)
const hoverDate  = ref(null)
const view       = ref('calendar')   // 'calendar' | 'year'

const editing   = ref('start')
const tempStart = ref('')
const tempEnd   = ref('')

const viewYear       = ref(new Date().getFullYear())
const viewMonth      = ref(new Date().getMonth())
const yearRangeStart = ref(new Date().getFullYear() - 4)

const MONTHS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const MONTHS_SH  = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.']
const DAY_LABELS = ['L','M','M','J','V','S','D']

/* ── Helpers ── */
function fmtISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function fmtHuman(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_SH[d.getMonth()]} ${d.getFullYear()}`
}
function goToDate(iso) {
  if (!iso) return
  const d = new Date(iso + 'T12:00:00')
  viewYear.value  = d.getFullYear()
  viewMonth.value = d.getMonth()
}

/* ── Trigger label ── */
const triggerLabel = computed(() => {
  const s = data.filterStart, e = data.filterEnd
  if (!s && !e) return 'Sélectionner une période'
  return `${fmtHuman(s)} → ${fmtHuman(e)}`
})

/* ── Navigation mois ── */
function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
const monthLabel = computed(() => `${MONTHS_FR[viewMonth.value]} ${viewYear.value}`)

/* ── Vue années ── */
const yearRange = computed(() => Array.from({ length: 12 }, (_, i) => yearRangeStart.value + i))

function selectYear(y) {
  viewYear.value = y
  view.value = 'calendar'
}

/* ── Ouverture/fermeture ── */
function toggle() {
  if (!open.value) {
    tempStart.value = data.filterStart || ''
    tempEnd.value   = data.filterEnd   || ''
    editing.value   = 'start'
    view.value      = 'calendar'
    goToDate(data.filterStart || fmtISO(new Date()))
  }
  open.value = !open.value
}

/* ── Clic sur un chip → scrolle au bon mois ── */
function selectChip(which) {
  editing.value = which
  view.value = 'calendar'
  if (which === 'start' && tempStart.value) goToDate(tempStart.value)
  if (which === 'end'   && tempEnd.value)   goToDate(tempEnd.value)
}

/* ── Grille du mois ── */
const cells = computed(() => {
  const firstDay    = new Date(viewYear.value, viewMonth.value, 1)
  const startDow    = firstDay.getDay()
  const startOffset = startDow === 0 ? -6 : 1 - startDow
  const start       = new Date(firstDay)
  start.setDate(1 + startOffset)
  const today = fmtISO(new Date())

  let rangeS = tempStart.value
  let rangeE = tempEnd.value
  if (editing.value === 'start' && hoverDate.value) rangeS = hoverDate.value
  else if (editing.value === 'end' && hoverDate.value) rangeE = hoverDate.value
  if (rangeS && rangeE && rangeS > rangeE) [rangeS, rangeE] = [rangeE, rangeS]

  const result = []
  for (let i = 0; i < 42; i++) {
    const d   = new Date(start)
    d.setDate(start.getDate() + i)
    d.setHours(12, 0, 0, 0)
    const iso = fmtISO(d)
    result.push({
      iso,
      day:        d.getDate(),
      otherMonth: d.getMonth() !== viewMonth.value,
      isToday:    iso === today,
      isStart:    !!rangeS && iso === rangeS,
      isEnd:      !!rangeE && iso === rangeE && rangeE !== rangeS,
      inRange:    !!rangeS && !!rangeE && iso > rangeS && iso < rangeE,
    })
  }
  if (result.slice(35).every(c => c.otherMonth)) return result.slice(0, 35)
  return result
})

/* ── Clic sur un jour ── */
function onCellClick(iso) {
  if (editing.value === 'start') {
    tempStart.value = iso
    if (tempEnd.value && iso > tempEnd.value) tempEnd.value = ''
    editing.value = 'end'
  } else {
    if (iso < tempStart.value) {
      tempEnd.value   = tempStart.value
      tempStart.value = iso
    } else {
      tempEnd.value = iso
    }
    editing.value = 'end'
  }
}

const canApply = computed(() => !!tempStart.value && !!tempEnd.value)

function apply() {
  if (!canApply.value) return
  data.filterStart = tempStart.value
  data.filterEnd   = tempEnd.value
  data.computeFiltered()
  open.value = false
}

function cancel() { open.value = false }

/* ── Préréglages ── */
function setPreset(type) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  if (type === 'month') {
    tempStart.value = fmtISO(new Date(y, m, 1))
    tempEnd.value   = fmtISO(new Date(y, m + 1, 0))
    viewYear.value = y; viewMonth.value = m
  } else if (type === 'prevMonth') {
    tempStart.value = fmtISO(new Date(y, m - 1, 1))
    tempEnd.value   = fmtISO(new Date(y, m, 0))
    viewMonth.value = m - 1 < 0 ? 11 : m - 1
    viewYear.value  = m - 1 < 0 ? y - 1 : y
  } else if (type === '3months') {
    tempStart.value = fmtISO(new Date(y, m - 2, 1))
    tempEnd.value   = fmtISO(new Date(y, m + 1, 0))
    viewMonth.value = m - 2 < 0 ? 12 + (m - 2) : m - 2
    viewYear.value  = m - 2 < 0 ? y - 1 : y
  } else if (type === 'year') {
    tempStart.value = fmtISO(new Date(y, 0, 1))
    tempEnd.value   = fmtISO(new Date(y, 11, 31))
    viewYear.value = y; viewMonth.value = 0
  } else if (type === 'rolling') {
    const end   = new Date(now)
    const start = new Date(now)
    start.setFullYear(start.getFullYear() - 1)
    start.setDate(start.getDate() + 1)
    tempStart.value = fmtISO(start)
    tempEnd.value   = fmtISO(end)
    viewYear.value  = start.getFullYear(); viewMonth.value = start.getMonth()
  }
  view.value    = 'calendar'
  editing.value = 'end'
}

/* ── Fermeture au clic extérieur ── */
function onOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) open.value = false
}
onMounted(()      => document.addEventListener('mousedown', onOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))
</script>

<style scoped>
.drp-wrapper { position: relative; display: inline-flex; align-items: center; }

/* ── Trigger ── */
.drp-trigger {
  display: flex; align-items: center; gap: 7px;
  height: 32px; padding: 0 12px;
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.18);
  color: #fff; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: background 0.15s;
}
.drp-trigger:hover { background: rgba(255,255,255,0.18); }

/* ── Dropdown ── */
.drp-dropdown {
  position: absolute; top: calc(100% + 10px); right: 0;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  padding: 14px; width: 272px; z-index: 200; color: var(--text);
}
.drp-drop-enter-active, .drp-drop-leave-active { transition: opacity 0.15s, transform 0.15s; }
.drp-drop-enter-from,   .drp-drop-leave-to     { opacity: 0; transform: translateY(-6px); }

/* ── Chips ── */
.drp-range-chips {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 12px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.drp-chip {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start;
  padding: 6px 10px; border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--bg-surface, #f8f9ff);
  cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: left;
}
.drp-chip:hover       { border-color: var(--accent); background: var(--accent-light); }
.drp-chip-active      { border-color: var(--accent) !important; background: var(--accent-light) !important; }
.drp-chip-label {
  font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted); line-height: 1; margin-bottom: 2px;
}
.drp-chip-active .drp-chip-label { color: var(--accent); }
.drp-chip-value { font-size: 0.75rem; font-weight: 600; color: var(--text); white-space: nowrap; }
.drp-chip-active .drp-chip-value { color: var(--accent); }
.drp-chip-arrow { font-size: 0.75rem; color: var(--text-subtle); flex-shrink: 0; }

/* ── Navigation mois ── */
.drp-month-nav {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.drp-month-label { font-size: 0.875rem; font-weight: 700; color: var(--text); }

/* Label mois cliquable */
.drp-month-label-btn {
  display: flex; align-items: center;
  font-size: 0.875rem; font-weight: 700; color: var(--text);
  background: transparent; border: none; cursor: pointer;
  padding: 3px 8px; border-radius: 6px;
  transition: background 0.12s, color 0.12s;
}
.drp-month-label-btn:hover { background: var(--bg-hover); color: var(--accent); }

.drp-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 7px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: background 0.12s, color 0.12s;
}
.drp-nav-btn:hover { background: var(--bg-hover); color: var(--accent); }

/* ── Header jours ── */
.drp-days-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; font-size: 0.6875rem; font-weight: 600;
  color: var(--text-muted); margin-bottom: 4px; letter-spacing: 0.03em;
}

/* ── Grille calendrier ── */
.drp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.drp-cell {
  display: flex; align-items: center; justify-content: center;
  height: 30px; font-size: 0.75rem; border-radius: 6px;
  cursor: pointer; transition: background 0.1s, color 0.1s; color: var(--text);
}
.drp-cell:hover:not(.drp-cell-start):not(.drp-cell-end) { background: var(--bg-hover); }
.drp-cell-other   { color: var(--text-subtle); }
.drp-cell-today   { font-weight: 700; color: var(--accent); }
.drp-cell-in-range { background: var(--accent-light); color: var(--accent); border-radius: 0; }
.drp-cell-start   { background: var(--accent); color: #fff !important; border-radius: 6px 0 0 6px; }
.drp-cell-end     { background: var(--accent); color: #fff !important; border-radius: 0 6px 6px 0; }
.drp-cell-start.drp-cell-end { border-radius: 6px; }

/* ── Grille années ── */
.drp-year-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 5px; margin-bottom: 4px;
}
.drp-year-btn {
  padding: 7px 4px; border-radius: 8px; border: 1px solid transparent;
  background: transparent; color: var(--text); font-size: 0.8125rem;
  font-weight: 500; cursor: pointer; text-align: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.drp-year-btn:hover     { background: var(--bg-hover); color: var(--accent); }
.drp-year-current       { font-weight: 700; color: var(--accent); }
.drp-year-active        { background: var(--accent) !important; color: #fff !important; border-color: transparent; }

/* ── Raccourcis ── */
.drp-shortcuts {
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);
}
.drp-shortcut-full { grid-column: 1 / -1; }
.drp-shortcut {
  font-size: 0.6875rem; font-weight: 600; padding: 5px 6px;
  border-radius: 7px; border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; text-align: center;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.drp-shortcut:hover { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }

/* ── Actions ── */
.drp-actions { display: flex; gap: 8px; margin-top: 8px; }
.drp-btn-cancel {
  flex: 1; padding: 7px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); font-size: 0.75rem; font-weight: 600;
  cursor: pointer; transition: background 0.12s;
}
.drp-btn-cancel:hover { background: var(--bg-hover); }
.drp-btn-apply {
  flex: 2; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 7px; border-radius: 8px; border: none;
  background: var(--accent); color: #fff; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; transition: background 0.12s, opacity 0.12s;
}
.drp-btn-apply:hover:not(:disabled) { background: var(--accent-hover); }
.drp-btn-apply:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
