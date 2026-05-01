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

const props  = defineProps({ catName: { type: String, required: true } })
const data   = useDataStore()
const router = useRouter()

/* ── Catégories consolidées ── */
const CONSOLIDATED = {
  CONS_MATIN:  { label: 'Matin',           cats: ['Matin', 'TLT Matin', 'TLT Agence Matin'],                           subtypes: { 'Client': ['Matin'],  'TLT Domicile': ['TLT Matin'],  'TLT Agence': ['TLT Agence Matin']  } },
  CONS_MIDI:   { label: 'Midi',            cats: ['Midi',  'TLT Midi',  'TLT Agence Midi'],                            subtypes: { 'Client': ['Midi'],   'TLT Domicile': ['TLT Midi'],   'TLT Agence': ['TLT Agence Midi']   } },
  CONS_APREM:  { label: 'Aprem',           cats: ['Aprem', 'TLT APREM', 'TLT Agence APREM'],                           subtypes: { 'Client': ['Aprem'],  'TLT Domicile': ['TLT APREM'],  'TLT Agence': ['TLT Agence APREM']  } },
  CONS_SOIR:   { label: 'Soir',            cats: ['Soir',  'TLT Soir',  'TLT Agence Soir'],                            subtypes: { 'Client': ['Soir'],   'TLT Domicile': ['TLT Soir'],   'TLT Agence': ['TLT Agence Soir']   } },
  CONS_AGENCE: { label: 'Journées vertes', cats: ['Agence Matin','Agence Midi','Agence APREM','Agence Soir'], subtypes: null },
}
const SUBTYPE_COLORS = { 'Client': '#6366F1', 'TLT Domicile': '#22D3EE', 'TLT Agence': '#A78BFA' }

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

  // Catégorie consolidée
  if (isConsolidated.value) {
    const { cats, subtypes } = CONSOLIDATED[props.catName]
    const arr = []
    for (const p in data.filtered.byPerson) {
      let days = 0
      const sub = subtypes ? Object.fromEntries(Object.keys(subtypes).map(k => [k, 0])) : null
      for (const day in data.filtered.byPerson[p].details) {
        const entries = data.filtered.byPerson[p].details[day]
        const count   = entries.filter(e => cats.includes(e.categorie)).length
        if (count === 1) days += 0.5
        if (count >= 2)  days += 1
        if (subtypes) {
          for (const [type, typeCats] of Object.entries(subtypes)) {
            const tc = entries.filter(e => typeCats.includes(e.categorie)).length
            if (tc === 1) sub[type] += 0.5
            else if (tc >= 2) sub[type] += 1
          }
        }
      }
      if (days > 0) arr.push([p, days, sub])
    }
    return arr.sort(([, a], [, b]) => b - a)
  }

  // Catégorie normale
  return Object.entries(data.filtered.byPerson)
    .map(([person, d]) => {
      const days = new Set()
      for (const day in d.details)
        d.details[day].forEach(e => { if (e.categorie === props.catName) days.add(day) })
      return [person, days.size, null]
    })
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
