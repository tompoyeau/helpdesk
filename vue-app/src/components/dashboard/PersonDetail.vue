<template>
  <template v-if="d && ready">

  <!-- ── Bloc 1 : En-tête + KPI ── -->
  <div class="content-card" style="font-size:0.75rem;margin-bottom:12px">

    <!-- ── En-tête personne ── -->
    <div class="person-header">
      <div class="person-avatar-lg">{{ initials }}</div>
      <div style="flex:1;min-width:0">
        <h2 style="margin-bottom:2px">{{ personName }}</h2>
        <span class="person-period">
          {{ fmtJ(stats.workDays) }} jours
          {{ firstDay ? '· ' + formatFR(firstDay) + ' → ' + formatFR(lastDay) : '' }}
        </span>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button v-if="isOwnProfile" class="btn-ics" title="Exporter mon planning dans mon agenda (.ics)" @click="exportICS">
          <Download :size="13" />
          <span class="hide-xs">Agenda</span>
        </button>
        <a
          v-if="userStore.isAdmin && personEmail"
          :href="`mailto:${personEmail}`"
          class="btn-email"
          :title="`Envoyer un mail à ${personEmail}`"
        >
          <Mail :size="13" />
          <span class="hide-xs">Envoyer un mail</span>
        </a>
      </div>
    </div>

    <!-- ── KPI cards ── -->
    <div class="person-stats-grid">
      <div class="person-stat-card">
        <div class="person-stat-icon" style="background:#6366F118">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="person-stat-body">
          <span class="person-stat-label">Jours travaillés</span>
          <span class="person-stat-value" style="color:#6366F1">{{ fmtJ(stats.workDays) }}</span>
          <span class="person-stat-sub">{{ firstDay ? formatFR(firstDay) + ' → ' + formatFR(lastDay) : '—' }}</span>
        </div>
      </div>

      <div class="person-stat-card">
        <div class="person-stat-icon" :style="{ background: tltColor + '18' }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="tltColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="person-stat-body">
          <span class="person-stat-label">Taux TLT</span>
          <span class="person-stat-value" :style="{ color: tltColor }">{{ stats.tauxTlt }}%</span>
          <span class="person-stat-sub">{{ fmtJ(stats.tltDays) }}j en télétravail</span>
        </div>
      </div>

      <div class="person-stat-card">
        <div class="person-stat-icon" style="background:#34D39918">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        </div>
        <div class="person-stat-body">
          <span class="person-stat-label">Taux client</span>
          <span class="person-stat-value" style="color:#34D399">{{ stats.tauxClient }}%</span>
          <span class="person-stat-sub">{{ fmtJ(stats.clientDays) }}j chez le client</span>
        </div>
      </div>

      <div class="person-stat-card">
        <div class="person-stat-icon" style="background:#94A3B818">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="person-stat-body">
          <span class="person-stat-label">CP</span>
          <span class="person-stat-value" style="color:#94A3B8">{{ fmtJ(stats.cpDays) }}</span>
          <span class="person-stat-sub">jours de congés</span>
        </div>
      </div>
    </div>

  </div><!-- /Bloc 1 -->

  <!-- ── Bloc 2 : Planning de la semaine ── -->
  <PlanningWeek :filter-person="personName" style="margin-bottom:12px" />

  <!-- ── Bloc 3 : Détails ── -->
  <div class="content-card" style="font-size:0.75rem;margin-top:12px">

    <!-- ── Par catégorie + Répartition par horaire ── -->
    <div class="person-double-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:4px">

      <div>
        <h3>Par catégorie</h3>
        <div class="table-scroll-wrap">
        <table class="w-full" style="min-width:200px">
          <thead><tr><th>Catégorie</th><th>Jours</th></tr></thead>
          <tbody>
            <tr
              v-for="[cat, jours] in byCatRows"
              :key="cat"
              class="tr-link"
              @click="router.push(`/cat/${encodeURIComponent(cat)}`)"
            >
              <td>
                <div style="display:flex;align-items:center;gap:7px">
                  <span class="color-dot" :style="{ background: data.colors[cat] }"></span>
                  {{ cat }}
                </div>
              </td>
              <td>{{ fmtJ(jours) }}</td>
            </tr>
          </tbody>
        </table>
        </div><!-- /table-scroll-wrap -->
      </div>

      <div>
        <h3>Répartition par horaire</h3>
        <div v-if="repartitionRows.length" class="repartition-block">
          <div v-for="row in repartitionRows" :key="row.label" class="repartition-row">
            <div class="rep-label">{{ row.label }}</div>
            <div class="rep-right">
              <div class="rep-total">{{ fmtJ(row.total) }}j</div>
              <div class="repartition-bar-track">
                <div
                  v-for="seg in row.segs"
                  :key="seg.type"
                  class="repartition-bar-seg"
                  :style="{ width: seg.pct + '%', background: seg.color }"
                  :title="seg.type + ' : ' + seg.value + 'j'"
                ></div>
              </div>
              <div class="rep-legend">
                <span v-for="seg in row.segs" :key="seg.type" class="rep-legend-item">
                  <span class="rep-dot" :style="{ background: seg.color }"></span>
                  <span>{{ seg.type }}</span>
                  <span class="rep-val">{{ fmtJ(seg.value) }}j</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Samedi -->
          <div v-if="samediCount > 0" class="repartition-row">
            <div class="rep-label">Samedi</div>
            <div class="rep-right">
              <div class="rep-total">{{ samediCount }}j</div>
              <div class="repartition-bar-track">
                <div class="repartition-bar-seg" style="width:100%;background:#F472B6"></div>
              </div>
              <div class="rep-legend">
                <span class="rep-legend-item">
                  <span class="rep-dot" style="background:#F472B6"></span>
                  <span>Travaillé</span>
                  <span class="rep-val">{{ samediCount }}j</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else style="color:var(--text-subtle);font-size:11px">Aucune donnée</div>
      </div>
    </div>

    <!-- ── Filtres ── -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px;margin-bottom:10px">
      <h3 style="margin:0">Détails</h3>
    </div>

    <div class="details-filter-bar">
      <div class="detail-chips">
        <button
          v-for="chip in chips"
          :key="chip.key"
          class="detail-chip"
          :class="{ active: activeChip === chip.key }"
          @click="toggleChip(chip.key)"
        >{{ chip.label }}</button>
      </div>
      <select v-model="catFilter" class="detail-select">
        <option value="">Toutes catégories</option>
        <option v-for="cat in availableCats" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="monthFilter" class="detail-select">
        <option value="">Tous les mois</option>
        <option v-for="m in availableMonths" :key="m" :value="m">{{ monthLabel(m) }}</option>
      </select>
      <span class="detail-count">{{ visibleDays.length }} entrées</span>
    </div>

    <!-- ── Tableau de détails ── -->
    <div class="table-scroll-wrap">
    <table class="w-full" style="min-width:320px">
      <thead><tr><th>Date</th><th>Catégorie</th><th>Horaires</th></tr></thead>
      <tbody>
        <tr
          v-for="day in visibleDays"
          :key="day"
          class="tr-link"
          :style="rowStyle(day)"
          @click="openModal(day)"
          title="Voir le détail"
        >
          <td style="font-family:var(--font-mono);font-size:11px">
            <span v-if="streakInfo[day]?.isFirst" class="streak-badge" :style="streakBadgeStyle(day)">
              {{ streakInfo[day].length }}j
            </span>
            {{ dayLabel(day) }}&nbsp;· {{ formatFR(day) }}
          </td>
          <td>{{ catsFor(day) }}</td>
          <td style="font-family:var(--font-mono);font-size:11px">{{ horairesFor(day) }}</td>
        </tr>
      </tbody>
    </table>
    </div><!-- /table-scroll-wrap -->

    <DayModal v-model="modalOpen" :person="personName" :date-str="modalDate" />
  </div><!-- /Bloc 3 -->

  </template><!-- /v-if d && ready -->

  <!-- Skeleton premier rendu ou données en cours de chargement -->
  <div v-else-if="!ready || data.loading" class="content-card">
    <div class="pd-sk-header">
      <div class="sk-circle" style="width:44px;height:44px;border-radius:50%;flex-shrink:0"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <div class="sk-bar" style="width:40%;height:14px"></div>
        <div class="sk-bar" style="width:60%;height:10px"></div>
      </div>
    </div>
    <div class="pd-sk-kpis">
      <div v-for="i in 4" :key="i" class="sk-bar" style="height:64px;border-radius:12px"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="sk-bar" style="width:50%;height:11px;margin-bottom:4px"></div>
        <div v-for="i in 5" :key="i" class="sk-bar" style="height:28px;border-radius:8px"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="sk-bar" style="width:55%;height:11px;margin-bottom:4px"></div>
        <div v-for="i in 5" :key="i" class="sk-bar" style="height:36px;border-radius:8px"></div>
      </div>
    </div>
  </div>

  <div v-else class="content-card" style="padding:24px;color:var(--text-muted)">
    Aucune donnée pour ce collaborateur sur la période sélectionnée.
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/dataStore'
import { useUserStore } from '@/stores/userStore'
import { computePersonStats, computePersonCatBreakdown } from '@/stores/statsStore'
import { Mail, Download } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/authStore'
import DayModal from '@/components/planning/DayModal.vue'
import PlanningWeek from '@/components/planning/PlanningWeek.vue'

const props     = defineProps({ personName: { type: String, required: true } })
const data      = useDataStore()
const userStore = useUserStore()
const auth      = useAuthStore()
const router    = useRouter()

// Nom complet de l'utilisateur connecté (uid → personnesData)
const currentUserName = computed(() => {
  const uid = auth.user?.uid
  if (!uid) return ''
  const p = data.personnesData?.[uid]
  return p ? `${p.nom} ${p.prenom}` : ''
})

const isOwnProfile = computed(() => currentUserName.value === props.personName)

// Email du collaborateur (depuis la collection personnes)
const personEmail = computed(() => {
  const entry = Object.values(data.personnesData).find(
    p => `${p.nom} ${p.prenom}` === props.personName
  )
  return entry?.email || ''
})

// Laisse le navigateur peindre le skeleton avant de lancer les computed lourds
const ready = ref(false)
onMounted(() => nextTick(() => { ready.value = true }))

const modalOpen  = ref(false)
const modalDate  = ref('')
const activeChip = ref('')
const catFilter  = ref('')
const monthFilter = ref('')

/* ── Données de base ── */
const d    = computed(() => data.filtered?.byPerson[props.personName])
const days = computed(() => d.value ? Object.keys(d.value.details).sort().reverse() : [])
const firstDay = computed(() => days.value[days.value.length - 1])
const lastDay  = computed(() => days.value[0])
const initials = computed(() => props.personName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase())

/* ── Formatage ── */
const DAYS_FR   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const MONTHS_FR = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

function dayLabel(day) { return DAYS_FR[new Date(day + 'T12:00:00').getDay()] }
function formatFR(day) {
  const d = new Date(day + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_FR[d.getMonth()]}. ${d.getFullYear()}`
}
function monthLabel(m) { return new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
function fmtJ(v) { return typeof v === 'number' ? (Number.isInteger(v) ? v : +v.toFixed(1)) : v }

/* ── KPI stats ── */
const win = computed(() => ({
  startIso: data.filterStart || '2000-01-01',
  endIso:   data.filterEnd   || new Date().toISOString().slice(0, 10),
}))

const psStats = computed(() => {
  if (!data.planning) return null
  return computePersonStats(data.planning, props.personName, win.value)
})

const stats = computed(() => {
  const s = psStats.value
  if (!s || s.workDays === 0) return { workDays: 0, tltDays: 0, clientDays: 0, cpDays: 0, tauxTlt: 0, tauxClient: 0 }
  return {
    workDays:   s.workDays,
    tltDays:    s.tltDays,
    clientDays: s.siteDays,
    cpDays:     s.cpDays,
    tauxTlt:    s.tauxTlt,
    tauxClient: s.workDays > 0 ? Math.round(s.siteDays / s.workDays * 100) : 0,
  }
})

const tltColor = computed(() => {
  const t = stats.value.tauxTlt
  return t >= 50 ? '#22D3EE' : t >= 30 ? '#A78BFA' : '#6366F1'
})

/* ── Par catégorie ── */
const byCatRows = computed(() => {
  if (!data.planning) return []
  const breakdown = computePersonCatBreakdown(data.planning, props.personName, win.value)
  return Object.entries(breakdown).sort((a, b) => b[1] - a[1])
})

/* ── Répartition par horaire ── */
const HREP = [
  { label: 'Matin', h: 'matin' },
  { label: 'Midi',  h: 'midi'  },
  { label: 'Aprem', h: 'aprem' },
  { label: 'Soir',  h: 'soir'  },
]
const HREP_COLORS = { 'Client': '#6366F1', 'TLT': '#22D3EE', 'Agence': '#34D399' }

const repartitionRows = computed(() => {
  const s = psStats.value
  if (!s) return []
  const rows = []
  for (const { label, h } of HREP) {
    const site  = s.detail[h].site
    const tlt   = s.detail[h].tlt   // inclut TLT Domicile + TLT Agence (mode: 'tlt')
    const total = Math.round((site + tlt) * 10) / 10
    if (total === 0) continue
    const segs = []
    if (site > 0) segs.push({ type: 'Client', value: site, pct: Math.round(site / total * 100), color: HREP_COLORS['Client'] })
    if (tlt  > 0) segs.push({ type: 'TLT',    value: tlt,  pct: Math.round(tlt  / total * 100), color: HREP_COLORS['TLT']    })
    rows.push({ label, total, segs })
  }
  if (s.agenceDays > 0) {
    rows.push({ label: 'Journées vertes', total: s.agenceDays, segs: [{ type: 'Agence', value: s.agenceDays, pct: 100, color: HREP_COLORS['Agence'] }] })
  }
  return rows
})

const samediCount = computed(() => {
  return data.filtered?.byCategory?.samedi?.persons[props.personName]?.days?.size || 0
})

/* ── Séries consécutives (streaks) ── */
const PROFILE_COLORS = { matin:'#6366F1', midi:'#60A5FA', aprem:'#A78BFA', soir:'#22D3EE', agence:'#34D399', autre:'#94A3B8' }

function getDayProfile(entries) {
  const cats = new Set(entries.map(e => e.categorie))
  const parts = []
  if (['Matin','TLT Matin','TLT Agence Matin','Agence Matin'].some(c => cats.has(c)))             parts.push('matin')
  if (['Midi','TLT Midi','TLT Agence Midi','Agence Midi'].some(c => cats.has(c)))                 parts.push('midi')
  if (['Aprem','TLT APREM','TLT Agence APREM','Agence APREM','ApremRenf'].some(c => cats.has(c))) parts.push('aprem')
  if (['Soir','TLT Soir','TLT Agence Soir','Agence Soir'].some(c => cats.has(c)))                parts.push('soir')
  if (parts.length > 0) return parts.join('+')
  return entries[0]?.categorie || 'autre'
}

function isNextWorkDay(a, b) {
  const da = new Date(a + 'T12:00:00'), db = new Date(b + 'T12:00:00')
  const diff = Math.round((db - da) / 86400000)
  if (diff === 1 && da.getDay() !== 6 && db.getDay() !== 0) return true
  if (da.getDay() === 5 && diff === 3) return true
  if (da.getDay() === 6 && diff === 2) return true
  return false
}

const streakInfo = computed(() => {
  if (!d.value) return {}
  const chronoDays = [...days.value].reverse()
  const info = {}
  let ci = 0
  while (ci < chronoDays.length) {
    const profile = getDayProfile(d.value.details[chronoDays[ci]])
    let cj = ci + 1
    while (
      cj < chronoDays.length &&
      isNextWorkDay(chronoDays[cj - 1], chronoDays[cj]) &&
      getDayProfile(d.value.details[chronoDays[cj]]) === profile
    ) cj++
    const len = cj - ci
    if (len >= 2) {
      for (let k = ci; k < cj; k++) {
        const mainProfile = profile.split('+')[0]
        const firstCat    = d.value.details[chronoDays[k]]?.[0]?.categorie
        const color = (mainProfile !== 'autre' && PROFILE_COLORS[mainProfile])
          ? PROFILE_COLORS[mainProfile]
          : (data.colors[firstCat] || PROFILE_COLORS.autre)
        info[chronoDays[k]] = { length: len, color, isFirst: k === cj - 1, isLast: k === ci }
      }
    }
    ci = cj
  }
  return info
})

function rowStyle(day) {
  const streak = streakInfo.value[day]
  return (streak ? `border-left:3px solid ${streak.color}` : 'border-left:3px solid transparent') + ';cursor:pointer'
}
function streakBadgeStyle(day) {
  const c = streakInfo.value[day]?.color
  return `background:${c}22;color:${c};border-color:${c}55`
}

/* ── Filtres ── */
const chips = [
  { key: 'matin',           label: 'Matin',           cats: ['matin','tlt matin','tlt agence matin','agence matin'] },
  { key: 'midi',            label: 'Midi',            cats: ['midi','tlt midi','tlt agence midi','agence midi'] },
  { key: 'aprem',           label: 'Aprem',           cats: ['aprem','tlt aprem','tlt agence aprem','agence aprem'] },
  { key: 'soir',            label: 'Soir',            cats: ['soir','tlt soir','tlt agence soir','agence soir'] },
  { key: 'journees-vertes', label: 'Journées vertes', cats: ['agence matin','agence midi','agence aprem','agence soir'] },
  { key: 'samedi',          label: 'Samedi',          cats: ['samedi'] },
]

function toggleChip(key) { activeChip.value = activeChip.value === key ? '' : key }

function catsFor(day)    { return [...new Set(d.value.details[day].map(e => e.categorie))].join(', ') }
function horairesFor(day){ return d.value.details[day].map(e => e.horaire).join(', ') }

const availableCats   = computed(() => { const s = new Set(); days.value.forEach(day => d.value.details[day].forEach(e => s.add(e.categorie))); return [...s].sort() })
const availableMonths = computed(() => [...new Set(days.value.map(d => d.slice(0, 7)))].sort().reverse())

const visibleDays = computed(() => {
  return days.value.filter(day => {
    const cats  = catsFor(day).toLowerCase()
    const isSat = new Date(day + 'T12:00:00').getDay() === 6
    let matchChip = true
    if (activeChip.value === 'samedi') matchChip = isSat
    else if (activeChip.value) {
      const chip = chips.find(c => c.key === activeChip.value)
      matchChip = chip ? chip.cats.some(c => cats.includes(c)) : true
    }
    const matchCat   = !catFilter.value   || cats.includes(catFilter.value.toLowerCase())
    const matchMonth = !monthFilter.value || day.slice(0, 7) === monthFilter.value
    return matchChip && matchCat && matchMonth
  })
})

function openModal(day) { modalDate.value = day; modalOpen.value = true }

/* ── Export ICS ── */
function exportICS() {
  // Utilise le planning complet (non filtré) pour couvrir les 2 prochaines semaines
  const details = data.planning?.[props.personName]
  if (!details) return

  // Scope : aujourd'hui + 13 jours (2 semaines)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 13)
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const scopeStart = fmt(today)
  const scopeEnd   = fmt(limit)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dashboard CAI//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const slug = props.personName.toLowerCase().replace(/\s+/g, '-')

  for (const dateISO of Object.keys(details).sort()) {
    if (dateISO < scopeStart || dateISO > scopeEnd) continue
    for (const entry of details[dateISO]) {
      if (!entry.horaire) continue
      const parts = entry.horaire.split('-')
      if (parts.length !== 2) continue
      const dtDate  = dateISO.replace(/-/g, '')
      const dtStart = `${dtDate}T${parts[0].replace(':', '')}00`
      const dtEnd   = `${dtDate}T${parts[1].replace(':', '')}00`
      const uid     = `cai-${slug}-${dateISO}-${parts[0].replace(':','')}@dashboard`

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${entry.categorie}`,
        `DESCRIPTION:${entry.horaire} — ${entry.categorie}`,
        'END:VEVENT',
      )
    }
  }

  lines.push('END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `planning-${slug}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.btn-email, .btn-ics {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: var(--radius-md);
  font-size: 0.8125rem; font-weight: 600;
  white-space: nowrap; flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;
  cursor: pointer; text-decoration: none;
}
.btn-email {
  background: var(--accent); color: #fff;
  border: none;
}
.btn-email:hover  { background: var(--accent-hover); }
.btn-email:active { transform: scale(0.97); }

.btn-ics {
  background: var(--bg); color: var(--text);
  border: 1.5px solid var(--border);
}
.btn-ics:hover  { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }
.btn-ics:active { transform: scale(0.97); }
</style>
