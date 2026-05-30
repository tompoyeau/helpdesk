<template>
  <div class="planning-row" :class="{ 'planning-row-favorite': isFavorite }">
    <div class="planning-name-cell">
      <div class="planning-avatar" style="background:linear-gradient(135deg,#6366F1 0%,#A78BFA 100%)">
        {{ initials }}
      </div>
      <div class="planning-person-info">
        <router-link :to="{ name: 'person', params: { name: person } }" class="planning-person-name">{{ person }}</router-link>
      </div>
      <button
        class="btn-favorite"
        :class="{ active: isFavorite }"
        :title="isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
        @click="$emit('toggle-favorite', person)"
      >
        <Star :size="14" :style="isFavorite ? 'fill:currentColor' : ''" />
      </button>
    </div>
    <div class="planning-days-mobile">
      <div
        v-for="date in weekDates"
        :key="formatDate(date)"
        class="planning-cell"
        :class="cellClass(date)"
        :data-day="dayLabel(date)"
        :style="outerCellStyle(date)"
        @click="handleClick(date)"
      >
        <!-- Activité (travail ou absence) -->
        <template v-if="hasActivity(date)">
          <div class="planning-location" :style="{ color: overlayTextColor(date) }">
            <span class="loc-icon">{{ locationFor(date)?.icon }}</span>
            <span class="loc-slot">{{ slotFor(date) }}</span>
            <span class="loc-time">{{ timeRangeFor(date) }}</span>
            <span class="loc-label">{{ locationFor(date)?.label }}</span>
          </div>
        </template>

        <!-- Vide -->
        <template v-else>
          <span class="planning-rest">—</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Star } from 'lucide-vue-next'
import { useDataStore } from '@/stores/dataStore'

const props = defineProps({
  person:    { type: String, required: true },
  weekDates: { type: Array,  required: true },
  isFavorite:{ type: Boolean, default: false },
})

const emit = defineEmits(['toggle-favorite', 'open-modal'])
const data = useDataStore()

const DAYS   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function dayLabel(date) { return DAYS[date.getDay()] }
function dayData(date)  { return data.planning[props.person]?.[formatDate(date)] }

/* ── Couleur texte contrasté ── */
function textColor(rgba) {
  const m = rgba.match(/\d+/g)
  if (!m) return '#1a1a1a'
  const [r, g, b] = m.map(Number)
  const lum = c => { c /= 255; return c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4 }
  const L = 0.2126*lum(r) + 0.7152*lum(g) + 0.0722*lum(b)
  return L > 0.179 ? '#1a1a1a' : '#ffffff'
}

const ABS_CATS = new Set(['CP','Indisponible','Récup'])

/* ── Entrées triées par heure de début ── */
function sortedEntries(date) {
  const dd = dayData(date)
  if (!dd?.length) return []
  return [...dd]
    .filter(e => e.horaire && e.couleur)
    .sort((a, b) => a.horaire.split('-')[0].localeCompare(b.horaire.split('-')[0]))
}

function hasActivity(date) { return sortedEntries(date).length > 0 }

/* ── Gradient de fond ── */
function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

function gradientBg(date) {
  const entries = sortedEntries(date)
  if (!entries.length) return null

  const colors = entries.map(e => e.couleur.replace(/,\s*1\s*\)/, ', 0.72)'))

  // Une seule activité ou toutes identiques → couleur pleine
  if (entries.length === 1 || new Set(colors).size === 1) return colors[0]

  const starts = entries.map(e => toMin(e.horaire.split('-')[0]))
  const ends   = entries.map(e => toMin(e.horaire.split('-')[1]))
  const totalStart = Math.min(...starts)
  const span = Math.max(...ends) - totalStart
  if (span <= 0) return colors[0]

  const pct = min => ((min - totalStart) / span * 100)
  const FADE = 7  // % de zone de fondu entre deux activités

  const stops = []
  entries.forEach((e, i) => {
    const c  = colors[i]
    const sp = pct(starts[i])
    const ep = pct(ends[i])

    if (i === 0) {
      stops.push(`${c} 0%`)
      stops.push(`${c} ${Math.max(0, ep - FADE).toFixed(1)}%`)
    } else if (i === entries.length - 1) {
      stops.push(`${c} ${Math.min(100, sp + FADE).toFixed(1)}%`)
      stops.push(`${c} 100%`)
    } else {
      stops.push(`${c} ${Math.min(100, sp + FADE).toFixed(1)}%`)
      stops.push(`${c} ${Math.max(0, ep - FADE).toFixed(1)}%`)
    }
  })

  return `linear-gradient(135deg, ${stops.join(', ')})`
}

/* ── Style de la cellule ── */
function outerCellStyle(date) {
  const bg = gradientBg(date)
  if (!bg) return {}
  return { background: bg, cursor: 'pointer' }
}

/* ── Entrée dominante en durée (parmi les entrées de travail si possible) ── */
function dominantEntry(date) {
  const entries = sortedEntries(date)
  if (!entries.length) return null
  // Préférer les entrées de travail (non-absence) pour le calcul dominant
  const workEntries = entries.filter(e => !ABS_CATS.has(e.categorie))
  const pool = workEntries.length ? workEntries : entries
  let best = pool[0], bestDur = 0
  for (const e of pool) {
    const dur = toMin(e.horaire.split('-')[1]) - toMin(e.horaire.split('-')[0])
    if (dur > bestDur) { bestDur = dur; best = e }
  }
  return best
}

function overlayTextColor(date) {
  const entry = dominantEntry(date)
  return entry ? textColor(entry.couleur) : '#1a1a1a'
}

/* ── Plage horaire totale du jour (uniquement les entrées de travail) ── */
function timeRangeFor(date) {
  const entries = sortedEntries(date)
  if (!entries.length) return ''
  const work = entries.filter(e => !ABS_CATS.has(e.categorie))
  const pool = work.length ? work : entries
  const debut = pool[0].horaire.split('-')[0]
  const fin   = pool[pool.length - 1].horaire.split('-')[1]
  return `${debut} – ${fin}`
}

/* ── Icône et label de localisation (basé sur la catégorie dominante) ── */
function locationFor(date) {
  const entry = dominantEntry(date)
  if (!entry) return null
  const cat = entry.categorie
  if (cat.includes('TLT Agence')) return { icon: '💼', label: 'TLT Agence' }
  if (cat.includes('TLT'))        return { icon: '🏠', label: 'Domicile'   }
  if (cat.includes('Agence'))     return { icon: '🏢', label: 'Agence'     }
  if (cat === 'RH')               return { icon: '🏢', label: 'Agence'     }
  if (ABS_CATS.has(cat))          return { icon: '📅', label: cat          }
  return                                  { icon: '👤', label: 'Client'     }
}

/* ── Labels de slots (Mat, Midi, Apr, Soir) ── */
function slotFor(date) {
  const entries = sortedEntries(date)
  if (!entries.length) return ''
  const cats = new Set(entries.map(e => e.categorie))
  const slots = []
  if (['Matin','TLT Matin','TLT Agence Matin','Agence Matin'].some(c => cats.has(c)))             slots.push('Mat')
  if (['Midi','TLT Midi','TLT Agence Midi','Agence Midi'].some(c => cats.has(c)))                 slots.push('Midi')
  if (['Aprem','TLT APREM','TLT Agence APREM','Agence APREM','ApremRenf'].some(c => cats.has(c))) slots.push('Apr')
  if (['Soir','TLT Soir','TLT Agence Soir','Agence Soir'].some(c => cats.has(c)))                slots.push('Soir')
  if (slots.length) return slots.join('+')
  // Fallback : affiche le label de l'absence ou la catégorie courte
  const first = entries[0]
  return ABS_CATS.has(first.categorie) ? first.categorie : first.categorie.slice(0, 4)
}

/* ── Classe CSS ── */
function cellClass(date) {
  const entries = sortedEntries(date)
  if (!entries.length) return 'planning-cell-empty'
  const allAbsence = entries.every(e => ABS_CATS.has(e.categorie))
  if (allAbsence) return 'planning-cell-absence'
  return 'planning-cell-work'
}

function handleClick(date) {
  if (hasActivity(date)) emit('open-modal', props.person, formatDate(date))
}

const initials = props.person.split(' ').map(n => n[0]).join('')
</script>

<style scoped>
.planning-person-name {
  color: inherit;
  text-decoration: none;
  font-weight: inherit;
}
.planning-person-name:hover {
  text-decoration: underline;
  color: var(--accent);
}
</style>

