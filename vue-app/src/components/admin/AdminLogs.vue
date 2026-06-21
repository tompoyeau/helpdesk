<template>
  <div class="logs-root">

    <!-- Barre de filtres -->
    <div class="logs-toolbar">
      <div class="logs-filters">
        <select v-model="filterAction" class="log-select">
          <option value="">Toutes les actions</option>
          <option value="save_day">Save jour</option>
          <option value="save_etp">Save ETP</option>
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
        <input v-model="filterDate" type="date" class="log-select" title="Filtrer par date planif" />
        <input v-model="filterUser" type="text" class="log-select" placeholder="Utilisateur…" style="min-width:130px" />
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="log-count">{{ enriched.length }} / {{ logs.length }}</span>
        <button class="btn-refresh" :disabled="loading" @click="load">
          <RefreshCw :size="13" :class="{ spinning: loading }" />
          Rafraîchir
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="logs-table-wrap">
      <table class="logs-table" v-if="enriched.length">
        <thead>
          <tr>
            <th style="width:28px"></th>
            <th>Horodatage</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Collection</th>
            <th>Date planif</th>
            <th>Résumé</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="log in enriched" :key="log.id">

            <!-- Ligne principale -->
            <tr
              class="log-row"
              :class="[`action-${log.action}`, { expandable: log.hasDetail }]"
              @click="log.hasDetail && toggleExpand(log.id)"
            >
              <td class="col-expand">
                <ChevronDown
                  v-if="log.hasDetail"
                  :size="13"
                  :class="['expand-icon', { open: expanded.has(log.id) }]"
                />
              </td>
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
              <td class="col-summary">{{ log.summary }}</td>
            </tr>

            <!-- Détail expansible -->
            <tr v-if="expanded.has(log.id)" class="log-detail-row">
              <td colspan="7" class="log-detail-cell">

                <!-- save_day : diff par collaborateur -->
                <template v-if="log.action === 'save_day'">
                  <div v-if="log.ressourcesDiff.length" class="diff-grid">
                    <div class="diff-th">Collaborateur</div>
                    <div class="diff-th">Avant</div>
                    <div class="diff-th"></div>
                    <div class="diff-th">Après</div>
                    <template v-for="d in log.ressourcesDiff" :key="d.id">
                      <div class="diff-cell diff-collab">{{ d.nom }} {{ d.prenom }}</div>
                      <div class="diff-cell diff-blocks">
                        <span v-if="!blocksOf(d.before).length" class="block-empty">—</span>
                        <span v-for="b in blocksOf(d.before)" :key="b.from" class="block-chip before">
                          {{ actLabel(b.code) }}<em>{{ slotToTime(b.from) }} → {{ slotToTime(b.to) }}</em>
                        </span>
                      </div>
                      <div class="diff-cell diff-arrow-cell">
                        <ArrowRight :size="12" />
                      </div>
                      <div class="diff-cell diff-blocks">
                        <span v-if="!blocksOf(d.after).length" class="block-empty">—</span>
                        <span v-for="b in blocksOf(d.after)" :key="b.from" class="block-chip after">
                          {{ actLabel(b.code) }}<em>{{ slotToTime(b.from) }} → {{ slotToTime(b.to) }}</em>
                        </span>
                      </div>
                    </template>
                  </div>
                  <p v-else class="detail-empty">Aucun changement d'activité détecté.</p>
                </template>

                <!-- save_etp / apply_forecast / undo_forecast / publish_month : diff ETP/fixed -->
                <template v-else>
                  <div v-if="log.etpDiff.length" class="etp-diff-list">
                    <div v-for="d in log.etpDiff" :key="d.field" class="etp-diff-row">
                      <span class="etp-field-label">{{ d.label }}</span>
                      <span class="etp-val before">{{ d.before ?? '—' }}</span>
                      <ArrowRight :size="12" class="diff-arrow" />
                      <span class="etp-val after">{{ d.after ?? '—' }}</span>
                    </div>
                  </div>
                  <p v-else class="detail-empty">Aucun changement détecté.</p>
                </template>

              </td>
            </tr>

          </template>
        </tbody>
      </table>
      <div v-else-if="loading" class="log-empty">Chargement…</div>
      <div v-else class="log-empty">Aucun log correspondant.</div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { RefreshCw, ChevronDown, ArrowRight } from 'lucide-vue-next'
import { fetchLogs } from '@/services/planningLogService'
import { TIME_SLOTS } from '@/stores/dataStore'

const logs    = ref([])
const loading = ref(false)

const filterAction = ref('')
const filterCol    = ref('')
const filterDate   = ref('')
const filterUser   = ref('')

const expanded = ref(new Set())
function toggleExpand(id) {
  const s = new Set(expanded.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expanded.value = s
}

const ACTION_LABELS = {
  save_day:       'Save jour',
  save_etp:       'Save ETP',
  apply_forecast: 'Apply forecast',
  undo_forecast:  'Undo forecast',
  publish_month:  'Publication',
  clear_month:    'Suppression',
  import_etp:     'Import ETP',
}

const ACT_LABELS = {
  '0': 'Matin',      '1': 'Midi',       '2': 'Soir',      '15': 'Aprem',
  '20': 'Matin TLT', '21': 'Midi TLT',  '22': 'Aprem TLT','23': 'Soir TLT',
  '12': 'Matin Ag.', '13': 'Midi Ag.',  '14': 'Soir Ag.', '17': 'Aprem Ag.',
  '26': 'Pilote BO', '32': 'Pilote TLT','24': 'Pilote M',
  '9': 'Matin TT',  '10': 'Midi TT',   '11': 'Soir TT',
  '28': 'Matin Alt', '27': 'Aprem Alt', '29': 'Soir Alt',
  '6': 'Indispo',    '8': 'Récup',      '30': 'CP',
}
function actLabel(code) { return ACT_LABELS[String(code)] || `Code ${code}` }

function slotToTime(slot) {
  return TIME_SLOTS[slot] ?? `slot${slot}`
}

function blocksOf(activites) {
  if (!activites?.length) return []
  const blocks = []
  let cur = null, si = null
  for (let i = 0; i <= activites.length; i++) {
    const c = i < activites.length ? activites[i] : ''
    if (c && c !== '') {
      if (cur === null)    { cur = c; si = i }
      else if (cur !== c) { blocks.push({ code: cur, from: si, to: i }); cur = c; si = i }
    } else if (cur !== null) {
      blocks.push({ code: cur, from: si, to: i }); cur = null; si = null
    }
  }
  return blocks
}

function computeRessourcesDiff(before, after) {
  const bMap = new Map((before?.ressources || []).map(r => [r.idPersonne, r]))
  const aMap = new Map((after?.ressources  || []).map(r => [r.idPersonne, r]))
  const changes = []
  for (const id of new Set([...bMap.keys(), ...aMap.keys()])) {
    const b = bMap.get(id)
    const a = aMap.get(id)
    if (JSON.stringify(b?.activites || []) !== JSON.stringify(a?.activites || [])) {
      changes.push({
        id,
        nom:    a?.nom    || b?.nom    || id,
        prenom: a?.prenom || b?.prenom || '',
        before: b?.activites || [],
        after:  a?.activites || [],
      })
    }
  }
  return changes
}

function computeEtpDiff(before, after) {
  const rows = []
  const scalars = [
    { field: 'etp',   label: 'ETP total' },
    { field: 'matin', label: 'Matin' },
    { field: 'midi',  label: 'Midi' },
    { field: 'aprem', label: 'Après-midi' },
    { field: 'soir',  label: 'Soir' },
  ]
  for (const { field, label } of scalars) {
    const b = before?.[field] ?? null
    const a = after?.[field]  ?? null
    if (b !== a) rows.push({ field, label, before: b, after: a })
  }
  const bFixed = before?.fixed || {}
  const aFixed = after?.fixed  || {}
  for (const k of new Set([...Object.keys(bFixed), ...Object.keys(aFixed)])) {
    const b = bFixed[k] ?? null
    const a = aFixed[k] ?? null
    if (b !== a) rows.push({ field: `fixed.${k}`, label: `Fixé · ${k}`, before: b, after: a })
  }
  return rows
}

function fmtSummary(log, rDiff, eDiff) {
  if (log.action === 'save_day') {
    if (!rDiff.length) return 'Aucun changement'
    return `${rDiff.length} collab${rDiff.length > 1 ? 's' : ''} modifié${rDiff.length > 1 ? 's' : ''}`
  }
  if (['save_etp', 'apply_forecast', 'undo_forecast'].includes(log.action)) {
    const b = log.before?.etp ?? null
    const a = log.after?.etp  ?? null
    if (b !== null || a !== null) return `ETP : ${b ?? '—'} → ${a ?? '—'}`
    if (eDiff.length) return `${eDiff.length} champ${eDiff.length > 1 ? 's' : ''} modifié${eDiff.length > 1 ? 's' : ''}`
    return '—'
  }
  if (log.action === 'publish_month') return 'Copie vers prod'
  if (log.action === 'clear_month')   return 'Suppression'
  return '—'
}

async function load() {
  loading.value = true
  try { logs.value = await fetchLogs(400) } finally { loading.value = false }
}
load()

const enriched = computed(() => {
  const filtered = logs.value.filter(l => {
    if (filterAction.value && l.action !== filterAction.value) return false
    if (filterCol.value    && l.col    !== filterCol.value)    return false
    if (filterDate.value   && l.isoDate !== filterDate.value)  return false
    if (filterUser.value && !l.userName?.toLowerCase().includes(filterUser.value.toLowerCase())) return false
    return true
  })
  return filtered.map(log => {
    const rDiff = log.action === 'save_day' ? computeRessourcesDiff(log.before, log.after) : []
    const eDiff = log.action !== 'save_day' ? computeEtpDiff(log.before, log.after) : []
    return { ...log, ressourcesDiff: rDiff, etpDiff: eDiff, hasDetail: rDiff.length > 0 || eDiff.length > 0, summary: fmtSummary(log, rDiff, eDiff) }
  })
})

function fmtTs(ts) {
  if (!ts) return '—'
  return ts.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtIso(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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

/* Table principale */
.logs-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
.logs-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.logs-table thead tr { background: var(--bg-hover); }
.logs-table th {
  padding: 9px 12px; text-align: left; font-weight: 600; font-size: 0.75rem;
  color: var(--text-muted); white-space: nowrap; border-bottom: 1px solid var(--border);
}
.logs-table td {
  padding: 7px 12px; border-bottom: 1px solid var(--border);
  vertical-align: middle; white-space: nowrap;
}
.log-row:hover td { background: var(--bg-hover); }
.log-row.expandable { cursor: pointer; }

.col-expand { padding: 0 4px 0 8px; }
.expand-icon { color: var(--text-muted); transition: transform 0.2s; display: block; }
.expand-icon.open { transform: rotate(180deg); }

.col-ts      { color: var(--text-muted); font-size: 0.75rem; }
.col-user    { font-weight: 500; }
.col-date    { font-variant-numeric: tabular-nums; }
.col-summary { color: var(--text-muted); font-size: 0.78rem; }

/* Badges action */
.action-badge {
  display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 600;
}
.action-badge.save_day        { background: rgba(14,165,233,0.15);  color: #38bdf8; }
.action-badge.save_etp        { background: rgba(20,184,166,0.15);  color: #2dd4bf; }
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

/* Zone de détail */
.log-detail-row td { background: color-mix(in srgb, var(--bg-hover) 60%, transparent); }
.log-detail-cell { padding: 14px 16px 14px 44px !important; text-align: left !important; }

/* Diff save_day — grille unique, header + cellules alignés */
.diff-grid {
  display: grid;
  grid-template-columns: 190px 1fr 24px 1fr;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.diff-th {
  padding: 6px 12px;
  background: var(--bg-hover);
  font-size: 0.7rem; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
}

.diff-cell {
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.diff-grid > .diff-cell:nth-last-child(-n+4) { border-bottom: none; }

.diff-collab { font-weight: 600; font-size: 0.82rem; display: flex; align-items: flex-start; padding-top: 9px; }

.diff-blocks { display: flex; flex-direction: column; gap: 4px; }

.diff-arrow-cell { display: flex; align-items: flex-start; padding-top: 10px; color: var(--text-muted); }

.block-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;
  width: fit-content;
}
.block-chip em { font-style: normal; font-weight: 400; opacity: 0.75; font-size: 0.7rem; }
.block-chip.before { background: rgba(220,38,38,0.1);  color: #dc2626; }
.block-chip.after  { background: rgba(22,163,74,0.1);  color: #16a34a; }
.block-empty { font-size: 0.78rem; color: var(--text-muted); padding: 5px 0; }

/* Diff ETP */
.etp-diff-list { display: flex; flex-direction: column; gap: 4px; }
.etp-diff-row {
  display: flex; align-items: center; gap: 10px;
  padding: 5px 10px; border-radius: 7px;
  background: var(--bg-card); border: 1px solid var(--border);
  width: fit-content;
}
.etp-field-label { font-size: 0.78rem; color: var(--text-muted); min-width: 100px; }
.etp-val { font-size: 0.82rem; font-weight: 600; font-variant-numeric: tabular-nums; min-width: 30px; text-align: center; }
.etp-val.before { color: #dc2626; }
.etp-val.after  { color: #16a34a; }

.detail-empty { margin: 0; color: var(--text-muted); font-size: 0.8rem; }
.log-empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
</style>
