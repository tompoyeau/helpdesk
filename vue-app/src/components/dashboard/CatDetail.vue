<template>
  <div class="content-card" style="font-size:0.75rem">

    <!-- ── En-tête ── -->
    <h2 style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <span v-if="!isConsolidated && !isSamedi" class="color-dot" :style="{ background: data.colors[catName] }"></span>
      {{ title }}
    </h2>

    <!-- ── Table ── -->
    <table class="w-full">
      <thead>
        <tr>
          <th>#</th>
          <th>Collaborateur</th>
          <th>Jours</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="([person, jours, sub], i) in personRows"
          :key="person"
          class="tr-link"
          @click="router.push(`/person/${encodeURIComponent(person)}`)"
        >
          <td class="rank-cell">{{ i + 1 }}</td>
          <td>
            <div>{{ person }}</div>
            <!-- Sous-barre répartition pour horaires consolidés -->
            <template v-if="sub">
              <div class="repartition-bar-track" style="margin-top:3px">
                <div
                  v-for="seg in subSegs(sub)"
                  :key="seg.type"
                  class="repartition-bar-seg"
                  :style="{ width: seg.pct + '%', background: seg.color }"
                  :title="seg.type + ' : ' + seg.value + 'j'"
                ></div>
              </div>
              <div class="rep-legend" style="margin-top:2px">
                <span v-for="seg in subSegs(sub)" :key="seg.type" class="rep-legend-item">
                  <span class="rep-dot" :style="{ background: seg.color }"></span>
                  <span>{{ seg.type }}</span>
                  <span class="rep-val">{{ seg.value }}j</span>
                </span>
              </div>
            </template>
          </td>
          <td>{{ fmtJ(jours) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="personRows.length === 0" style="padding:16px 0;color:var(--text-muted);text-align:center">
      Aucune donnée sur la période.
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '@/stores/dataStore'
import { computePersonStats, countCatDays } from '@/stores/statsStore'

const props  = defineProps({ catName: { type: String, required: true } })
const data   = useDataStore()
const router = useRouter()

/* ── Catégories consolidées ── */
const CONSOLIDATED = {
  CONS_MATIN:  { label: 'Matin',           getDays: s => s.detail.matin.site + s.detail.matin.tlt,  getSub: s => ({ 'Client': s.detail.matin.site, 'TLT': s.detail.matin.tlt }) },
  CONS_MIDI:   { label: 'Midi',            getDays: s => s.detail.midi.site  + s.detail.midi.tlt,   getSub: s => ({ 'Client': s.detail.midi.site,  'TLT': s.detail.midi.tlt  }) },
  CONS_APREM:  { label: 'Aprem',           getDays: s => s.detail.aprem.site + s.detail.aprem.tlt,  getSub: s => ({ 'Client': s.detail.aprem.site, 'TLT': s.detail.aprem.tlt }) },
  CONS_SOIR:   { label: 'Soir',            getDays: s => s.detail.soir.site  + s.detail.soir.tlt,   getSub: s => ({ 'Client': s.detail.soir.site,  'TLT': s.detail.soir.tlt  }) },
  CONS_AGENCE: { label: 'Journées vertes', getDays: s => s.agenceDays,                              getSub: null },
}
const SUBTYPE_COLORS = { 'Client': '#6366F1', 'TLT': '#22D3EE' }

const isConsolidated = computed(() => props.catName in CONSOLIDATED)
const isSamedi       = computed(() => props.catName === 'samedi')

const title = computed(() => {
  if (isConsolidated.value) return CONSOLIDATED[props.catName].label
  if (isSamedi.value)       return 'Samedis travaillés'
  return props.catName
})

function fmtJ(v) { return typeof v === 'number' ? (Number.isInteger(v) ? v : +v.toFixed(1)) : v }

/* ── Calcul des lignes ── */
const personRows = computed(() => {
  if (!data.filtered) return []

  // Samedis
  if (isSamedi.value) {
    const persons = data.filtered.byCategory?.samedi?.persons
    if (!persons) return []
    return Object.entries(persons)
      .map(([p, v]) => [p, v.days.size, null])
      .sort(([, a], [, b]) => b - a)
  }

  const win = {
    startIso: data.filterStart || '2000-01-01',
    endIso:   data.filterEnd   || new Date().toISOString().slice(0, 10),
  }

  // Catégorie consolidée — via computePersonStats
  if (isConsolidated.value) {
    const { getDays, getSub } = CONSOLIDATED[props.catName]
    const arr = []
    for (const name of data.activePersons()) {
      const s    = computePersonStats(data.planning, name, win)
      const days = getDays(s)
      if (days <= 0) continue
      arr.push([name, Math.round(days * 10) / 10, getSub ? getSub(s) : null])
    }
    return arr.sort(([, a], [, b]) => b - a)
  }

  // Catégorie normale
  return data.activePersons().map(name => [
    name,
    countCatDays(data.planning, name, props.catName, win),
    null,
  ])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
})

/* ── Segments de sous-barre ── */
function subSegs(sub) {
  if (!sub) return []
  const total = Object.values(sub).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  return Object.entries(sub)
    .filter(([, v]) => v > 0)
    .map(([type, v]) => ({
      type,
      value: fmtJ(v),
      pct:   Math.round(v / total * 100),
      color: SUBTYPE_COLORS[type] || '#94A3B8',
    }))
}
</script>
