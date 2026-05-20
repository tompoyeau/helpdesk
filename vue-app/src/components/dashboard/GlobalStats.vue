<template>
  <div id="center" class="content-card" style="font-size:0.75rem">

    <!-- ── Chargement ── -->
    <div v-if="data.loading" style="padding:32px;text-align:center">
      <div class="gs-spinner"></div>
      <p style="margin-top:16px;color:var(--text-muted);font-size:0.875rem">Chargement…</p>
    </div>

    <template v-else-if="data.filtered">

      <!-- ── KPI cards ── -->
      <div class="kpi-grid">

        <div class="kpi-card">
          <div class="kpi-icon" style="background:rgba(99,102,241,0.10)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="kpi-body">
            <span class="kpi-label">Collaborateurs</span>
            <span class="kpi-value">{{ kpis.nbPersons }}</span>
            <span class="kpi-sub">actifs sur la période</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon" style="background:rgba(34,211,238,0.10)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div class="kpi-body">
            <span class="kpi-label">Jours-présence</span>
            <span class="kpi-value">{{ kpis.totalWorkDays.toLocaleString('fr-FR') }}</span>
            <span class="kpi-sub">{{ periode }}</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon" style="background:rgba(167,139,250,0.12)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :stroke="tltColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="kpi-body">
            <span class="kpi-label">Taux télétravail</span>
            <span class="kpi-value" :style="{ color: tltColor }">{{ kpis.tauxTlt }}%</span>
            <span class="kpi-sub">des jours travaillés</span>
          </div>
        </div>

      </div>

      <!-- ── Tableau récapitulatif ── -->
      <h2 style="font-size:0.9375rem;font-weight:700;margin-bottom:12px">Récapitulatif</h2>

      <table class="w-full">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="gs-th-sortable"
              :class="{ 'gs-th-active': sortKey === col.key }"
              @click="setSort(col.key)"
            >
              <span style="display:inline-flex;align-items:center;gap:4px">
                {{ col.label }}
                <span class="gs-sort-icon">
                  <svg v-if="sortKey === col.key && sortDir === 'asc'"  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5l7 7H5z"/></svg>
                  <svg v-else-if="sortKey === col.key && sortDir === 'desc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 19l7-7H5z"/></svg>
                  <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.35"><path d="M12 5l7 7H5z"/><path d="M12 19l7-7H5z"/></svg>
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sortedPersons"
            :key="row.name"
            class="tr-link"
            @click="router.push(`/person/${encodeURIComponent(row.name)}`)"
          >
            <td>
              <div style="display:flex;align-items:center;gap:7px">
                <div class="person-avatar" style="width:22px;height:22px;font-size:0.5625rem">
                  {{ row.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }}
                </div>
                {{ row.name }}
              </div>
            </td>
            <td>{{ row.work }}</td>
            <td>{{ row.tlt }}</td>
            <td>{{ row.client }}</td>
            <td>{{ row.cp }}</td>
          </tr>
        </tbody>
      </table>

    </template>
  </div>
</template>

<style scoped>
.gs-spinner {
  display: inline-block;
  width: 48px; height: 48px;
  border: 4px solid #6366F1;
  border-top-color: transparent;
  border-radius: 50%;
  animation: gs-spin 1s linear infinite;
}
@keyframes gs-spin { to { transform: rotate(360deg); } }

.gs-th-sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: color 0.15s;
}

.gs-th-sortable:hover {
  color: var(--accent) !important;
}

.gs-th-active {
  color: var(--accent) !important;
}

.gs-sort-icon {
  display: inline-flex;
  align-items: center;
  color: currentColor;
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/dataStore'
import { computePersonStats, computeTeamStats } from '@/stores/statsStore'

const data   = useDataStore()
const router = useRouter()

/* ── Colonnes ── */
const columns = [
  { key: 'name',   label: 'Collaborateur'  },
  { key: 'work',   label: 'Jours présence' },
  { key: 'tlt',    label: 'Jours TLT'      },
  { key: 'client', label: 'Jours client'   },
  { key: 'cp',     label: 'CP'             },
]

/* ── Tri ── */
const sortKey = ref('name')
const sortDir = ref('asc')

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}

/* ── Fenêtre temporelle (header) ── */
const win = computed(() => ({
  startIso: data.filterStart || '2000-01-01',
  endIso:   data.filterEnd   || new Date().toISOString().slice(0, 10),
}))

/* ── Stats par collaborateur via statsStore ── */
const personStatsList = computed(() => {
  const w = win.value
  return data.activePersons().map(name => ({
    name,
    s: computePersonStats(data.planning, name, w),
  }))
})

/* ── Stats équipe (KPIs) ── */
const teamStats = computed(() => computeTeamStats(personStatsList.value.map(p => p.s)))

const kpis = computed(() => {
  if (data.loading) return { nbPersons: 0, totalWorkDays: 0, tauxTlt: 0 }
  const team = teamStats.value
  if (!team) return { nbPersons: 0, totalWorkDays: 0, tauxTlt: 0 }
  const nbPersons = personStatsList.value.filter(p => p.s.workDays > 0).length
  return {
    nbPersons,
    totalWorkDays: Math.round(team.workDays),
    tauxTlt:       team.tauxTlt,
  }
})

const tltColor = computed(() => {
  const t = kpis.value.tauxTlt
  return t >= 50 ? '#22D3EE' : t >= 30 ? '#A78BFA' : '#6366F1'
})

const periode = computed(() => {
  const fs = data.filterStart, fe = data.filterEnd
  if (!fs || !fe) return '—'
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt(fs)} → ${fmt(fe)}`
})

/* ── Liste triée ── */
const sortedPersons = computed(() => {
  const persons = personStatsList.value.map(({ name, s }) => ({
    name,
    work:   s.workDays,
    tlt:    s.tltDays,
    client: s.siteDays,
    cp:     s.cpDays,
  }))

  return persons.sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    if (typeof av === 'string') {
      return sortDir.value === 'asc' ? av.localeCompare(bv, 'fr') : bv.localeCompare(av, 'fr')
    }
    return sortDir.value === 'asc' ? av - bv : bv - av
  })
})
</script>
