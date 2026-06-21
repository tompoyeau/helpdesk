<template>
  <div class="logs-root">

    <!-- Barre de filtres -->
    <div class="logs-toolbar">
      <div class="logs-filters">
        <select v-model="filterAction" class="log-select">
          <option value="">Toutes les actions</option>
          <option value="apply_forecast">Apply forecast</option>
          <option value="undo_forecast">Undo forecast</option>
          <option value="publish_month">Publication</option>
          <option value="clear_month">Suppression</option>
        </select>
        <select v-model="filterCol" class="log-select">
          <option value="">Toutes collections</option>
          <option value="plannings">prod</option>
          <option value="plannings_test">test</option>
        </select>
        <input
          v-model="filterDate"
          type="date"
          class="log-select"
          title="Filtrer par date planif"
          placeholder="Date planif"
        />
        <input
          v-model="filterUser"
          type="text"
          class="log-select"
          placeholder="Utilisateur…"
          style="min-width:130px"
        />
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="log-count">{{ filtered.length }} / {{ logs.length }}</span>
        <button class="btn-refresh" :disabled="loading" @click="load">
          <RefreshCw :size="13" :class="{ spinning: loading }" />
          Rafraîchir
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="logs-table-wrap">
      <table class="logs-table" v-if="filtered.length">
        <thead>
          <tr>
            <th>Horodatage</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Collection</th>
            <th>Date planif</th>
            <th>ETP avant → après</th>
            <th>Fixed avant → après</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in filtered" :key="log.id" :class="['log-row', `action-${log.action}`]">
            <td class="col-ts">{{ fmtTs(log.ts) }}</td>
            <td class="col-user">{{ log.userName || '—' }}</td>
            <td class="col-action">
              <span :class="['action-badge', log.action]">{{ ACTION_LABELS[log.action] || log.action }}</span>
            </td>
            <td class="col-col">
              <span :class="['col-badge', log.col === 'plannings' ? 'prod' : 'test']">
                {{ log.col === 'plannings' ? 'prod' : 'test' }}
              </span>
            </td>
            <td class="col-date">{{ fmtIso(log.isoDate) }}</td>
            <td class="col-etp">{{ fmtEtp(log.before, log.after) }}</td>
            <td class="col-fixed">{{ fmtFixed(log.before, log.after) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="loading" class="log-empty">Chargement…</div>
      <div v-else class="log-empty">Aucun log correspondant.</div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { fetchLogs } from '@/services/planningLogService'

const logs    = ref([])
const loading = ref(false)

const filterAction = ref('')
const filterCol    = ref('')
const filterDate   = ref('')
const filterUser   = ref('')

const ACTION_LABELS = {
  apply_forecast: 'Apply forecast',
  undo_forecast:  'Undo forecast',
  publish_month:  'Publication',
  clear_month:    'Suppression',
  import_etp:     'Import ETP',
}

async function load() {
  loading.value = true
  try { logs.value = await fetchLogs(400) } finally { loading.value = false }
}
onMounted(load)

const filtered = computed(() => logs.value.filter(l => {
  if (filterAction.value && l.action !== filterAction.value) return false
  if (filterCol.value    && l.col    !== filterCol.value)    return false
  if (filterDate.value   && l.isoDate !== filterDate.value)  return false
  if (filterUser.value) {
    const q = filterUser.value.toLowerCase()
    if (!l.userName?.toLowerCase().includes(q)) return false
  }
  return true
}))

function fmtTs(ts) {
  if (!ts) return '—'
  return ts.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtIso(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtEtp(before, after) {
  const b = before?.etp ?? null
  const a = after?.etp  ?? null
  if (b === null && a === null) return '—'
  if (b === null) return `→ ${a}`
  if (a === null) return `${b} →`
  if (b === a)    return `${a}`
  return `${b} → ${a}`
}

function fmtFixed(before, after) {
  const fmt = obj => {
    if (!obj?.fixed || !Object.keys(obj.fixed).length) return '∅'
    return Object.entries(obj.fixed).map(([k, v]) => `${k}:${v?.slice(0, 3) ?? '?'}`).join(' ')
  }
  const b = before ? fmt(before) : null
  const a = after  ? fmt(after)  : null
  if (!b && !a) return '—'
  if (!b) return `→ ${a}`
  if (!a) return `${b} →`
  if (b === a) return a
  return `${b} → ${a}`
}
</script>

<style scoped>
.logs-root { display: flex; flex-direction: column; gap: 12px; }

.logs-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 10px;
}
.logs-filters { display: flex; gap: 8px; flex-wrap: wrap; }

.log-select {
  padding: 5px 10px; border-radius: 7px;
  border: 1px solid var(--border); background: var(--bg-card);
  color: var(--text); font-size: 0.8rem; outline: none;
}
.log-select:focus { border-color: var(--accent); }

.log-count { font-size: 0.78rem; color: var(--text-muted); }

.btn-refresh {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 7px; font-size: 0.8rem; font-weight: 500;
  border: 1px solid var(--border); background: var(--bg-card); color: var(--text);
  cursor: pointer; transition: background 0.15s;
}
.btn-refresh:hover:not(:disabled) { background: var(--bg-hover); }
.btn-refresh:disabled { opacity: 0.5; cursor: default; }
.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.logs-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }

.logs-table {
  width: 100%; border-collapse: collapse; font-size: 0.8rem;
}
.logs-table thead tr { background: var(--bg-hover); }
.logs-table th {
  padding: 9px 12px; text-align: left; font-weight: 600; font-size: 0.75rem;
  color: var(--text-muted); white-space: nowrap; border-bottom: 1px solid var(--border);
}
.logs-table td {
  padding: 7px 12px; border-bottom: 1px solid var(--border);
  vertical-align: middle; white-space: nowrap;
}
.log-row:last-child td { border-bottom: none; }
.log-row:hover td { background: var(--bg-hover); }

.action-badge {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  font-size: 0.72rem; font-weight: 600;
}
.action-badge.apply_forecast  { background: rgba(99,102,241,0.15);  color: #818cf8; }
.action-badge.undo_forecast   { background: rgba(245,158,11,0.15);  color: #f59e0b; }
.action-badge.publish_month   { background: rgba(34,197,94,0.15);   color: #22c55e; }
.action-badge.clear_month     { background: rgba(239,68,68,0.15);   color: #ef4444; }
.action-badge.import_etp      { background: rgba(168,85,247,0.15);  color: #a855f7; }

.col-badge {
  display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 0.72rem; font-weight: 600;
}
.col-badge.prod { background: rgba(34,197,94,0.12); color: #22c55e; }
.col-badge.test { background: rgba(99,102,241,0.12); color: #818cf8; }

.col-ts   { color: var(--text-muted); font-size: 0.75rem; }
.col-user { font-weight: 500; }
.col-date { font-variant-numeric: tabular-nums; }
.col-etp  { font-variant-numeric: tabular-nums; font-family: monospace; }
.col-fixed { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); }

.log-empty {
  padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem;
}
</style>
