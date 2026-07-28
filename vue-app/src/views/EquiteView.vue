<template>
  <section style="padding:12px">
    <div class="content-card equity-card">

      <!-- En-tête -->
      <div class="eq-head">
        <div>
          <h1 class="eq-title">
            <Scale :size="18" /> Équité des répartitions
          </h1>
          <p class="eq-subtitle">
            Écarts à la moyenne d'équipe sur la période. Plus le multiplicateur est élevé, plus la répartition est injuste.
          </p>
        </div>
        <div class="eq-period">
          <CalendarRange :size="13" />
          <span>{{ periodLabel }}</span>
        </div>
      </div>

      <!-- Chargement -->
      <div v-if="data.loading" class="eq-empty">
        <div class="gs-spinner"></div>
        <p>Chargement…</p>
      </div>

      <!-- Données insuffisantes -->
      <div v-else-if="!equity || equity.meta.nbPersons < 2" class="eq-empty">
        <Info :size="22" />
        <p>Pas assez de données sur cette période pour analyser l'équité.</p>
        <span class="eq-empty-sub">Élargis la plage de dates dans l'en-tête.</span>
      </div>

      <template v-else>

        <!-- ── Cartes par dimension (cliquables → drill-down) ── -->
        <div class="eq-dim-grid">
          <div
            v-for="dim in displayDims"
            :key="dim.isSamedi ? 'samedi-merged' : dim.key"
            class="eq-dim-card"
            :class="[`eq-status-${dim.status}`, { 'eq-dim-open': expandedDim === dim.key }]"
            role="button"
            tabindex="0"
            @click="toggleDim(dim.key)"
            @keydown.enter="toggleDim(dim.key)"
          >
            <div class="eq-dim-top">
              <span class="eq-dim-icon" :style="{ background: fade(dim.color) }">
                <component :is="dimIcon(dim.key)" :size="15" :style="{ color: dim.color }" />
              </span>
              <span class="eq-dim-label">{{ dim.label }}</span>
              <span class="eq-badge" :class="`eq-badge-${dim.status}`">{{ statusLabel(dim.status) }}</span>
            </div>

            <!-- Toggle Travaillés / Astreinte (carte Samedis) -->
            <div v-if="dim.isSamedi" class="eq-sam-toggle" @click.stop>
              <button :class="{ active: samediMode === 'samedi' }" @click="setSamediMode('samedi')">Travaillés</button>
              <button :class="{ active: samediMode === 'samedi_astreinte' }" @click="setSamediMode('samedi_astreinte')">Astreinte</button>
            </div>

            <div class="eq-dim-team">Part juste : <strong>{{ fmtVal(dim.teamRate, dim) }}</strong></div>

            <template v-if="dim.worst">
              <div class="eq-dim-worst" :title="rawTip(dim.worst.days, dim.worst.denom, dim.teamDaysAvg, dim.unitLabel)">
                <router-link
                  :to="{ name: 'person', params: { name: dim.worst.name } }"
                  class="eq-worst-name eq-link"
                  @click.stop
                >{{ dim.worst.name }}</router-link>
                <span class="eq-worst-mult" :style="{ color: dim.color }">
                  {{ multText(dim.worst.unfairMult, dim.direction) }}
                </span>
              </div>
              <div class="eq-bar-track" :title="rawTip(dim.worst.days, dim.worst.denom, dim.teamDaysAvg, dim.unitLabel)">
                <div class="eq-bar-fill" :style="{ width: barW(dim.worst.rate, dim) + '%', background: dim.color }"></div>
                <div class="eq-bar-avg" :style="{ left: barW(dim.teamRate, dim) + '%' }" title="Moyenne d'équipe"></div>
              </div>
              <div class="eq-bar-legend">
                <span>{{ firstName(dim.worst.name) }} {{ fmtVal(dim.worst.rate, dim) }}</span>
                <span class="eq-muted">moy. {{ fmtVal(dim.teamRate, dim) }}</span>
              </div>
            </template>
            <div v-else class="eq-dim-ok">
              <Check :size="13" /> Réparti équitablement
            </div>

            <div class="eq-dim-expand">
              <ChevronDown :size="14" :style="expandedDim === dim.key ? 'transform:rotate(180deg)' : ''" />
            </div>
          </div>
        </div>

        <!-- ── Drill-down : classement complet de la dimension sélectionnée ── -->
        <div v-if="expandedDimObj" class="eq-drill">
          <div class="eq-drill-head">
            <span><strong>{{ expandedDimObj.label }}</strong> — classement complet ({{ expandedDimObj.rows.length }})</span>
            <button class="eq-drill-close" @click="expandedDim = null"><X :size="14" /></button>
          </div>
          <div class="eq-drill-rows">
            <div v-for="r in expandedDimObj.rows" :key="r.name" class="eq-drill-row"
              :title="rawTip(r.days, r.denom, expandedDimObj.teamDaysAvg, expandedDimObj.unitLabel)">
              <router-link :to="{ name: 'person', params: { name: r.name } }" class="eq-drill-name eq-link">
                {{ r.name }}
              </router-link>
              <div class="eq-bar-track eq-drill-bar">
                <div class="eq-bar-fill" :style="{ width: barW(r.rate, expandedDimObj) + '%', background: rowColor(r, expandedDimObj) }"></div>
                <div class="eq-bar-avg" :style="{ left: barW(expandedDimObj.teamRate, expandedDimObj) + '%' }"></div>
              </div>
              <span class="eq-drill-val">{{ fmtVal(r.rate, expandedDimObj) }}</span>
              <span class="eq-drill-dev" :class="devClass(r, expandedDimObj)">{{ devText(r, expandedDimObj) }}</span>
            </div>
          </div>
          <div class="eq-drill-note">La barre grise marque la moyenne d'équipe · survolez une ligne pour les jours bruts.</div>
        </div>

        <!-- ── Priorités à rétablir ── -->
        <div class="eq-prio-head">
          <h2>Priorités à rétablir</h2>
          <span class="eq-muted">{{ equity.priorities.length }} situation(s) à corriger</span>
        </div>

        <div v-if="!equity.priorities.length" class="eq-all-good">
          <Check :size="16" /> Aucune répartition franchement injuste sur cette période. 👏
        </div>

        <ol v-else class="eq-prio-list">
          <li v-for="(p, i) in equity.priorities" :key="p.name + p.dimKey" class="eq-prio-item">
            <span class="eq-rank">{{ i + 1 }}</span>
            <span class="eq-dot" :style="{ background: p.color }"></span>
            <div class="eq-prio-body">
              <div class="eq-prio-line1">
                <router-link :to="{ name: 'person', params: { name: p.name } }" class="eq-prio-name eq-link">
                  {{ p.name }}
                </router-link>
                <span class="eq-prio-dim" :style="{ background: fade(p.color), color: p.color }">{{ p.dimLabel }}</span>
              </div>
              <div class="eq-prio-headline" :title="rawTip(p.days, p.denom, p.teamDaysAvg, p.unitLabel)">
                {{ priorityHeadline(p) }}
              </div>
              <div class="eq-prio-reco">→ {{ p.reco }}</div>
              <div v-if="p.counterpart" class="eq-prio-swap">
                <ArrowLeftRight :size="11" />
                Rééquilibrer avec
                <router-link :to="{ name: 'person', params: { name: p.counterpart.name } }" class="eq-link eq-swap-name">
                  {{ p.counterpart.name }}
                </router-link>
                <span class="eq-muted">({{ p.counterpart.days }} {{ p.unitLabel }})</span>
              </div>
            </div>
            <span v-if="p.unfairMult" class="eq-prio-mult" :style="{ color: p.color }">×{{ p.unfairMult }}</span>
          </li>
        </ol>

      </template>

    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { computeEquity } from '@/services/equity'
import { Scale, CalendarRange, Info, Check, Moon, Sprout, Laptop, CalendarDays, BellRing, ChevronDown, X, ArrowLeftRight } from 'lucide-vue-next'

const data = useDataStore()

const MONTHS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
function fmtFr(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${+d} ${MONTHS[+m - 1]} ${y}`
}
const periodLabel = computed(() => `${fmtFr(data.filterStart)} → ${fmtFr(data.filterEnd)}`)

const equity = computed(() => {
  if (data.loading || !data.filtered) return null
  const persons = data.activePersons()
  if (!persons?.length) return null
  return computeEquity(
    data.planning,
    persons,
    data.personnesData,
    data.nameToUid,
    { startIso: data.filterStart, endIso: data.filterEnd },
  )
})

/* ── Carte Samedis fusionnée (toggle Travaillés / Astreinte) ── */
const samediMode = ref('samedi')   // 'samedi' | 'samedi_astreinte'
function setSamediMode(key) {
  // Si le drill-down est ouvert sur un samedi, il suit le toggle
  if (expandedDim.value === 'samedi' || expandedDim.value === 'samedi_astreinte') expandedDim.value = key
  samediMode.value = key
}

// Dimensions affichées : les 3 régulières + une carte « Samedis » fusionnée (sous-dim sélectionnée)
const displayDims = computed(() => {
  const dims = equity.value?.dimensions || []
  const regular = dims.filter(d => d.key !== 'samedi' && d.key !== 'samedi_astreinte')
  const sel = dims.find(d => d.key === samediMode.value)
  return sel ? [...regular, { ...sel, label: 'Samedis', isSamedi: true }] : regular
})

/* ── Drill-down ── */
const expandedDim = ref(null)
function toggleDim(key) { expandedDim.value = expandedDim.value === key ? null : key }
const expandedDimObj = computed(() => equity.value?.dimensions.find(d => d.key === expandedDim.value) || null)

/* ── Helpers d'affichage ── */
const DIM_ICONS = { soir: Moon, agence: Sprout, tlt: Laptop, samedi: CalendarDays, samedi_astreinte: BellRing }
function dimIcon(key) { return DIM_ICONS[key] || Scale }

function statusLabel(s) {
  return s === 'alert' ? 'Déséquilibré' : s === 'watch' ? 'À surveiller' : 'Équilibré'
}

function firstName(name) { return name.split(' ').slice(1).join(' ') || name }

// Formate une valeur selon la métrique de la dimension (% ou nombre de jours)
function fmtVal(val, dim) {
  return dim.metric === 'count' ? `${round1(val)} ${dim.unitLabel}` : `${round1(val)}%`
}

// Infobulle chiffres bruts : « 12 / 45 soirs · moy. 6 »
function rawTip(days, denom, avg, unitLabel) {
  return `${round1(days)} / ${round1(denom)} ${unitLabel} · moy. ${round1(avg)}`
}

function fade(color) {
  if (color.startsWith('rgba')) return color.replace(/,\s*[\d.]+\s*\)$/, ', 0.14)')
  return `color-mix(in srgb, ${color} 14%, transparent)`
}

// Largeur de barre normalisée (échelle = 1,3 × max entre valeur et moyenne)
function barW(rate, dim) {
  const maxRate = Math.max(dim.worst?.rate || 0, dim.rows?.[0]?.rate || 0, dim.teamRate, 1)
  const scale = maxRate * 1.3
  return Math.min(100, Math.round(rate / scale * 100))
}

function multText(mult, direction) {
  if (mult == null) return direction === 'reward' ? 'aucun' : 'extrême'
  const verb = direction === 'burden' ? 'plus' : 'moins'
  return `×${round1(mult)} ${verb} que la moyenne`
}

function round1(v) { return Math.round(v * 10) / 10 }

/* ── Drill-down : couleur/écart par ligne ── */
function rowColor(r, dim) {
  if (r.disadvantage > 0) return dim.color          // lésé
  if (r.disadvantage < 0) return 'var(--text-subtle)' // sur-servi
  return 'var(--border)'
}
function devClass(r) {
  return r.disadvantage > 0 ? 'eq-dev-bad' : r.disadvantage < 0 ? 'eq-dev-good' : 'eq-dev-neutral'
}
function devText(r, dim) {
  const sign = r.disadvantage > 0 ? '+' : ''
  const v = round1(dim.direction === 'burden' ? r.rate - dim.teamRate : r.rate - dim.teamRate)
  const suffix = dim.metric === 'count' ? '' : ' pts'
  return `${sign}${v}${suffix}`
}

function priorityHeadline(p) {
  const t = `${fmtVal(p.rate, p)} vs ${fmtVal(p.teamRate, p)} en moyenne`
  if (p.dimKey === 'soir')   return p.unfairMult ? `×${p.unfairMult} plus de soirs — ${t}` : `Beaucoup plus de soirs — ${t}`
  if (p.dimKey === 'agence') return p.unfairMult ? `×${p.unfairMult} moins de jours verts — ${t}` : `Aucun jour vert — ${t}`
  if (p.dimKey === 'tlt')    return p.unfairMult ? `×${p.unfairMult} moins de télétravail — ${t}` : `Aucun télétravail — ${t}`
  if (p.dimKey === 'samedi') return p.unfairMult ? `×${p.unfairMult} plus de samedis travaillés — ${t}` : `Beaucoup plus de samedis travaillés — ${t}`
  if (p.dimKey === 'samedi_astreinte') return p.unfairMult ? `×${p.unfairMult} plus d'astreintes le samedi — ${t}` : `Beaucoup plus d'astreintes le samedi — ${t}`
  return t
}
</script>

<style scoped>
.equity-card { font-size: 0.8125rem; }

/* En-tête */
.eq-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; flex-wrap: wrap; margin-bottom: 18px;
}
.eq-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em;
}
.eq-subtitle { margin-top: 4px; font-size: 0.8125rem; color: var(--text-muted); max-width: 640px; }
.eq-period {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
  background: var(--bg-surface); border: 1px solid var(--border);
  padding: 5px 10px; border-radius: 999px; white-space: nowrap;
}

/* Empty / loading */
.eq-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px 16px; text-align: center; color: var(--text-muted);
}
.eq-empty-sub { font-size: 0.75rem; }
.gs-spinner {
  width: 28px; height: 28px; border-radius: 50%;
  border: 3px solid var(--border); border-top-color: var(--accent);
  animation: eq-spin 0.8s linear infinite;
}
@keyframes eq-spin { to { transform: rotate(360deg); } }

/* Liens personnes */
.eq-link { color: inherit; text-decoration: none; }
.eq-link:hover { color: var(--accent); text-decoration: underline; }

/* Grille dimensions */
.eq-dim-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px;
}
@media (max-width: 520px) { .eq-dim-grid { grid-template-columns: 1fr; } }

.eq-dim-card {
  position: relative;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 14px 14px 22px;
  border-left-width: 3px; cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
}
.eq-dim-card:hover { box-shadow: var(--shadow-sm); }
.eq-dim-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.eq-dim-open { box-shadow: var(--shadow-sm); border-color: var(--accent); }
.eq-status-balanced { border-left-color: #22c55e; }
.eq-status-watch    { border-left-color: #f59e0b; }
.eq-status-alert    { border-left-color: #ef4444; }

.eq-dim-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.eq-dim-icon {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.eq-dim-label { font-weight: 700; font-size: 0.875rem; }
.eq-badge {
  margin-left: auto; font-size: 0.625rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.03em;
  padding: 3px 8px; border-radius: 999px; white-space: nowrap;
}
.eq-badge-balanced { background: rgba(34,197,94,0.14);  color: #16a34a; }
.eq-badge-watch    { background: rgba(245,158,11,0.16); color: #d97706; }
.eq-badge-alert    { background: rgba(239,68,68,0.15);  color: #dc2626; }

.eq-dim-team { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 10px; }
.eq-dim-team strong { color: var(--text); font-variant-numeric: tabular-nums; }

/* Toggle Travaillés / Astreinte */
.eq-sam-toggle {
  display: flex; gap: 3px; margin-bottom: 10px;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 2px;
}
.eq-sam-toggle button {
  flex: 1; padding: 3px 6px; font-size: 0.6875rem; font-weight: 700;
  border: none; border-radius: 5px; background: transparent;
  color: var(--text-muted); cursor: pointer; transition: background 0.12s, color 0.12s;
}
.eq-sam-toggle button:hover { color: var(--text); }
.eq-sam-toggle button.active { background: var(--accent); color: #fff; }

.eq-dim-worst { display: flex; flex-direction: column; gap: 1px; margin-bottom: 8px; }
.eq-worst-name { font-weight: 700; font-size: 0.8125rem; }
.eq-worst-mult { font-size: 0.75rem; font-weight: 700; }

.eq-bar-track {
  position: relative; height: 8px; border-radius: 999px;
  background: var(--bg-surface); overflow: hidden; margin-bottom: 4px;
}
.eq-bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; }
.eq-bar-avg {
  position: absolute; top: -2px; bottom: -2px; width: 2px;
  background: var(--text); opacity: 0.55; transform: translateX(-1px);
}
.eq-bar-legend { display: flex; justify-content: space-between; font-size: 0.6875rem; }

.eq-dim-ok {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.75rem; color: #16a34a; font-weight: 600; margin-top: 6px;
}
.eq-dim-expand {
  position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
  color: var(--text-subtle); display: flex; pointer-events: none;
}

/* Drill-down */
.eq-drill {
  border: 1px solid var(--accent); border-radius: var(--radius-md);
  padding: 12px 14px; margin-bottom: 24px; background: var(--bg);
}
.eq-drill-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.8125rem; margin-bottom: 10px;
}
.eq-drill-close {
  background: none; border: none; cursor: pointer; color: var(--text-muted);
  display: flex; padding: 2px; border-radius: 4px;
}
.eq-drill-close:hover { color: var(--text); background: var(--bg-hover); }
.eq-drill-rows { display: flex; flex-direction: column; gap: 6px; }
.eq-drill-row {
  display: grid; grid-template-columns: 150px 1fr 64px 54px; align-items: center; gap: 10px;
}
@media (max-width: 560px) { .eq-drill-row { grid-template-columns: 110px 1fr 52px 44px; gap: 6px; } }
.eq-drill-name { font-size: 0.75rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.eq-drill-bar { margin-bottom: 0; height: 10px; }
.eq-drill-val { font-size: 0.75rem; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.eq-drill-dev { font-size: 0.6875rem; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.eq-dev-bad     { color: #dc2626; }
.eq-dev-good    { color: #16a34a; }
.eq-dev-neutral { color: var(--text-subtle); }
.eq-drill-note { font-size: 0.6875rem; color: var(--text-subtle); margin-top: 10px; }

/* Priorités */
.eq-prio-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  margin-bottom: 12px;
}
.eq-prio-head h2 { font-size: 0.95rem; font-weight: 800; }
.eq-muted { color: var(--text-muted); font-size: 0.75rem; }

.eq-all-good {
  display: flex; align-items: center; gap: 8px;
  padding: 16px; border-radius: var(--radius-md);
  background: rgba(34,197,94,0.08); color: #16a34a; font-weight: 600; font-size: 0.8125rem;
}

.eq-prio-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.eq-prio-item {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 10px 12px;
}
.eq-rank {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-surface); font-size: 0.75rem; font-weight: 800; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.eq-dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; }
.eq-prio-body { flex: 1; min-width: 0; }
.eq-prio-line1 { display: flex; align-items: center; gap: 8px; }
.eq-prio-name { font-weight: 700; font-size: 0.8125rem; }
.eq-prio-dim { font-size: 0.625rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
.eq-prio-headline { font-size: 0.75rem; color: var(--text); margin-top: 2px; }
.eq-prio-reco { font-size: 0.6875rem; color: var(--text-muted); margin-top: 1px; }
.eq-prio-swap {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  font-size: 0.6875rem; color: var(--text-muted); margin-top: 4px;
}
.eq-swap-name { font-weight: 700; color: var(--text); }
.eq-prio-mult { flex-shrink: 0; font-size: 1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
</style>
