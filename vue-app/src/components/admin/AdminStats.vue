<template>
  <div style="font-size:0.75rem">

    <!-- Barre de contrôles -->
    <div class="as-controls">
      <div class="as-controls-title">
        <h3 class="as-title">Répartition historique des horaires</h3>
        <span class="as-sub">{{ windowLabel }} · {{ rows.length }} collaborateurs · ratios sur jours avec horaire affecté</span>
      </div>

      <label class="as-toggle">
        <input type="checkbox" v-model="sinceArrival" />
        <span class="as-toggle-track"></span>
        <span class="as-toggle-label">Depuis l'arrivée</span>
      </label>

      <label class="as-toggle">
        <input type="checkbox" v-model="onlyActive" />
        <span class="as-toggle-track"></span>
        <span class="as-toggle-label">Actifs uniquement</span>
      </label>

      <!-- Sélecteur de colonnes -->
      <div class="as-picker-wrap" ref="pickerRef">
        <button class="as-pick-btn" @click.stop="showPicker = !showPicker">
          ☰ Colonnes <span class="as-pick-badge">{{ cols.length }}</span>
        </button>

        <div v-if="showPicker" class="as-picker-panel" @click.stop>
          <div v-for="grp in GROUPS" :key="grp" class="as-pick-grp">
            <div class="as-pick-grp-title">{{ grp }}</div>
            <label
              v-for="c in catalogByGroup[grp]" :key="c.key"
              class="as-pick-item"
            >
              <input
                type="checkbox"
                :checked="selectedKeys.has(c.key)"
                @change="toggleKey(c.key)"
              />
              <span class="as-pick-dot" :style="{ background: c.color }"></span>
              {{ c.label }}
            </label>
          </div>
          <div class="as-pick-footer">
            <button class="as-pick-reset" @click="resetKeys">Réinitialiser</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Légende dynamique -->
    <div class="as-legend">
      <span v-for="c in cols" :key="c.key" class="as-leg-item">
        <span class="as-leg-dot" :style="{ background: c.color }"></span>
        {{ c.label }}
      </span>
    </div>

    <!-- Table -->
    <div class="as-scroll">
      <table class="as-table">
        <colgroup>
          <col style="min-width:160px;width:160px">
          <col style="min-width:72px;width:72px">
          <col v-for="c in cols" :key="c.key" :style="c.getPct ? 'min-width:170px' : 'min-width:90px'">
        </colgroup>
        <thead>
          <tr>
            <th class="as-th as-th-name" @click="toggleSort('nom')">
              Collaborateur <span class="as-arrow">{{ sortArrow('nom') }}</span>
            </th>
            <th class="as-th as-th-num" @click="toggleSort('workDays')">
              Jours <span class="as-arrow">{{ sortArrow('workDays') }}</span>
            </th>
            <th
              v-for="c in cols" :key="c.key"
              class="as-th as-th-bar"
              :style="{ borderTop: '3px solid ' + c.color }"
              @click="toggleSort(c.key)"
            >
              {{ c.label }} <span class="as-arrow">{{ sortArrow(c.key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Ligne par personne -->
          <tr v-for="row in sortedRows" :key="row.name" class="as-row">
            <td class="as-td as-td-name">{{ row.name }}</td>
            <td class="as-td as-td-num">{{ row.workDays }}<span class="as-unit">j</span></td>
            <td v-for="c in cols" :key="c.key" class="as-td as-td-bar">
              <div class="as-bar-row" :title="colTitle(row, c)">
                <template v-if="c.getPct !== null">
                  <div class="as-bar-track">
                    <div class="as-bar-fill" :style="{ width: c.getPct(row) + '%', background: c.color }"></div>
                  </div>
                  <span class="as-pct" :style="{ color: c.color }">{{ c.getPct(row) }}%</span>
                  <span class="as-abs">({{ c.getDays(row) }}j)</span>
                </template>
                <template v-else>
                  <span class="as-abs-only" :style="{ color: c.color }">{{ c.getDays(row) }}j</span>
                </template>
              </div>
            </td>
          </tr>

          <!-- Ligne moyenne équipe -->
          <tr v-if="team" class="as-row as-row-avg">
            <td class="as-td as-td-name"><span class="as-avg-label">Moyenne équipe</span></td>
            <td class="as-td as-td-num">{{ team.avgWorkDays }}<span class="as-unit">j</span></td>
            <td v-for="c in cols" :key="c.key" class="as-td as-td-bar">
              <div class="as-bar-row">
                <template v-if="c.getPct !== null">
                  <div class="as-bar-track">
                    <div class="as-bar-fill" :style="{ width: c.getPct(team) + '%', background: c.color, opacity: 0.6 }"></div>
                  </div>
                  <span class="as-pct" :style="{ color: c.color }">{{ c.getPct(team) }}%</span>
                </template>
                <template v-else>
                  <span class="as-abs-only" style="color:var(--text-muted)">—</span>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<style scoped>
.as-controls {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  margin-bottom: 14px; padding: 12px 14px;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md);
}
.as-controls-title { flex: 1; min-width: 180px; }
.as-title { margin: 0 0 2px; font-size: 0.875rem; font-weight: 700; color: var(--text); }
.as-sub   { font-size: 0.6875rem; color: var(--text-muted); }

.as-toggle {
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  white-space: nowrap; flex-shrink: 0; padding: 5px 10px;
  border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card);
}
.as-toggle input { display: none; }
.as-toggle-track {
  width: 28px; height: 16px; border-radius: 8px; background: var(--border);
  position: relative; flex-shrink: 0; transition: background 0.15s;
}
.as-toggle-track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform 0.15s;
}
.as-toggle input:checked ~ .as-toggle-track { background: var(--accent); }
.as-toggle input:checked ~ .as-toggle-track::after { transform: translateX(12px); }
.as-toggle-label { font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); }

/* ── Picker ── */
.as-picker-wrap { position: relative; flex-shrink: 0; }

.as-pick-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; font-size: 0.6875rem; font-weight: 600; cursor: pointer;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-card); color: var(--text-muted);
  transition: color 0.15s, border-color 0.15s;
}
.as-pick-btn:hover { color: var(--text); border-color: var(--accent); }
.as-pick-badge {
  background: var(--accent); color: #fff; border-radius: 10px;
  padding: 0 5px; font-size: 0.5625rem; font-weight: 700; line-height: 1.6;
}

.as-picker-panel {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 60;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); box-shadow: 0 8px 28px rgba(0,0,0,0.16);
  padding: 12px 14px; width: 220px; max-height: 480px; overflow-y: auto;
}
.as-pick-grp { margin-bottom: 12px; }
.as-pick-grp-title {
  font-size: 0.5rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-subtle); margin-bottom: 5px; padding-bottom: 3px;
  border-bottom: 1px solid var(--border);
}
.as-pick-item {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 4px; font-size: 0.625rem; color: var(--text-muted);
  cursor: pointer; border-radius: var(--radius-sm); transition: background 0.1s;
}
.as-pick-item:hover { background: var(--bg-hover); color: var(--text); }
.as-pick-item input { width: 12px; height: 12px; cursor: pointer; accent-color: var(--accent); flex-shrink: 0; }
.as-pick-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.as-pick-footer { padding-top: 6px; border-top: 1px solid var(--border); text-align: right; }
.as-pick-reset {
  font-size: 0.5625rem; color: var(--text-muted); background: none;
  border: none; cursor: pointer; text-decoration: underline; padding: 0;
}
.as-pick-reset:hover { color: var(--accent); }

/* ── Légende ── */
.as-legend {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  margin-bottom: 16px; padding: 9px 14px;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.as-leg-item  { display: flex; align-items: center; gap: 5px; font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); }
.as-leg-dot   { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Table ── */
.as-scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-md); }
.as-table  { width: 100%; border-collapse: collapse; }
.as-table thead { position: sticky; top: 0; z-index: 2; }

.as-th {
  padding: 10px 14px; text-align: left; font-size: 0.6875rem; font-weight: 700;
  color: var(--text-muted); background: var(--bg-surface);
  border-bottom: 1px solid var(--border); cursor: pointer; white-space: nowrap; user-select: none;
}
.as-th:hover { color: var(--text); }
.as-th-name { min-width: 160px; }
.as-th-num  { min-width: 70px; text-align: center; }
.as-th-bar  { min-width: 120px; }
.as-arrow   { font-size: 0.5rem; margin-left: 3px; opacity: 0.6; }

.as-row { border-bottom: 1px solid var(--border); transition: background 0.1s; }
.as-row:last-child { border-bottom: none; }
.as-row:hover { background: var(--bg-hover); }
.as-row-avg {
  border-top: 2px solid var(--border);
  background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
}

.as-td       { padding: 9px 14px; vertical-align: middle; }
.as-td-name  { font-weight: 600; font-size: 0.75rem; white-space: nowrap; }
.as-td-num   { text-align: center; font-size: 0.6875rem; color: var(--text-muted); white-space: nowrap; }
.as-unit     { font-size: 0.5625rem; margin-left: 1px; }
.as-td-bar   { min-width: 100px; }
.as-avg-label { font-style: italic; color: var(--text-muted); font-size: 0.6875rem; }

.as-bar-row   { display: flex; align-items: center; gap: 7px; }
.as-bar-track { flex: 1; height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; min-width: 55px; max-width: 110px; }
.as-bar-fill  { height: 100%; border-radius: 4px; transition: width 0.3s; }
.as-pct       { font-size: 0.6875rem; font-weight: 700; min-width: 30px; white-space: nowrap; }
.as-abs       { font-size: 0.5625rem; color: var(--text-muted); white-space: nowrap; }
.as-abs-only  { font-size: 0.6875rem; font-weight: 700; white-space: nowrap; }
</style>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useDataStore }   from '@/stores/dataStore'
import { useUserStore }   from '@/stores/userStore'
import {
  computePersonStats,
  computeTeamStats,
  personWindow,
  isActiveOn,
  CATALOG,
  CATALOG_GROUPS,
  CATALOG_DEFAULTS,
} from '@/stores/statsStore'

const data      = useDataStore()
const userStore = useUserStore()

/* ─── Catalogue importé depuis statsStore (source de vérité) ── */
const GROUPS       = CATALOG_GROUPS
const DEFAULT_KEYS = CATALOG_DEFAULTS
const STORAGE_KEY  = 'adminStats:selectedCols:v2'

/* ─── Sélection persistée ───────────────────────────────────── */
function loadKeys() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length)
      return new Set(saved.filter(k => CATALOG.some(c => c.key === k)))
  } catch {}
  return new Set(DEFAULT_KEYS)
}

const selectedKeys = ref(loadKeys())

function toggleKey(key) {
  const next = new Set(selectedKeys.value)
  if (next.has(key)) { if (next.size > 1) next.delete(key) }  // garder au moins 1
  else next.add(key)
  selectedKeys.value = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
}

function resetKeys() {
  selectedKeys.value = new Set(DEFAULT_KEYS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_KEYS))
}

const catalogByGroup = computed(() => {
  const m = {}
  for (const grp of GROUPS) m[grp] = CATALOG.filter(c => c.group === grp)
  return m
})

const cols = computed(() => CATALOG.filter(c => selectedKeys.value.has(c.key)))

/* ─── Ouverture / fermeture du picker ──────────────────────── */
const showPicker = ref(false)
const pickerRef  = ref(null)

function onDocClick(e) {
  if (pickerRef.value && !pickerRef.value.contains(e.target))
    showPicker.value = false
}
onMounted(()   => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

/* ─── État ─────────────────────────────────────────────────── */
const sinceArrival = ref(false)
const onlyActive   = ref(true)
const sort         = ref({ key: 'nom', dir: 1 })

/* ─── Calcul des lignes ────────────────────────────────────── */
const rows = computed(() => {
  let persons = (userStore.users || []).filter(p => p.onRun !== false)
  if (onlyActive.value) persons = persons.filter(p => isActiveOn(p))

  const mode         = sinceArrival.value ? 'since-arrival' : 'header'
  const planningData = data.planning

  return persons.map(p => {
    const name  = `${p.nom} ${p.prenom}`
    const win   = personWindow(p, mode, data.filterStart, data.filterEnd)
    const stats = computePersonStats(planningData, name, win)
    return { name, ...stats }
  })
})

/* ─── Stats équipe ─────────────────────────────────────────── */
const team = computed(() => computeTeamStats(rows.value))

/* ─── Tri ──────────────────────────────────────────────────── */
function toggleSort(key) {
  if (sort.value.key === key) sort.value = { key, dir: sort.value.dir * -1 }
  else sort.value = { key, dir: key === 'nom' ? 1 : -1 }
}
function sortArrow(key) {
  if (sort.value.key !== key) return '↕'
  return sort.value.dir === 1 ? '↑' : '↓'
}

const sortedRows = computed(() => {
  const { key, dir } = sort.value
  return [...rows.value].sort((a, b) => {
    let va, vb
    if (key === 'nom') {
      return dir * a.name.localeCompare(b.name, 'fr')
    } else if (key === 'workDays') {
      va = a.workDays; vb = b.workDays
    } else {
      const col = CATALOG.find(c => c.key === key)
      if (col) {
        va = col.getPct ? col.getPct(a) : col.getDays(a)
        vb = col.getPct ? col.getPct(b) : col.getDays(b)
      } else { va = 0; vb = 0 }
    }
    if (va < vb) return -dir
    if (va > vb) return  dir
    return a.name.localeCompare(b.name, 'fr')
  })
})

/* ─── Helpers affichage ────────────────────────────────────── */
function colTitle(row, col) {
  const days = col.getDays(row)
  if (col.getPct === null) return `${col.label} : ${days}j`
  return `${col.label} : ${days}j — ${col.getPct(row)}%`
}

/* ─── Libellé fenêtre ──────────────────────────────────────── */
function fmtDMY(iso) {
  if (!iso) return '…'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const windowLabel = computed(() => {
  if (sinceArrival.value) return `Depuis l'arrivée → ${fmtDMY(data.filterEnd)}`
  return `${fmtDMY(data.filterStart)} → ${fmtDMY(data.filterEnd)}`
})
</script>
