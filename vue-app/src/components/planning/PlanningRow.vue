<template>
  <div class="planning-row" :class="{ 'planning-row-favorite': isFavorite }">
    <div class="planning-name-cell">
      <div class="planning-avatar" style="background:linear-gradient(135deg,#6366F1 0%,#A78BFA 100%)">
        {{ initials }}
      </div>
      <div class="planning-person-info">
        <div class="planning-person-name">{{ person }}</div>
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
        v-bind="cellStyle(date)"
        @click="handleClick(date)"
      >
        <!-- Absence -->
        <template v-if="absenceFor(date)">
          <div class="planning-absence-fill" :style="{ background: absenceBg(date), color: textColor(absenceBg(date)) }">
            <span class="planning-absence" style="font-weight:600">{{ absenceFor(date).categorie }}</span>
          </div>
        </template>

        <!-- Work -->
        <template v-else-if="hoursFor(date)">
          <div
            class="planning-location"
            :style="{ background: workBg(date), color: textColor(workBg(date)) }"
          >
            <span class="loc-icon">{{ locationFor(date)?.icon }}</span>
            <span class="loc-slot">{{ slotFor(date) }}</span>
            <span class="loc-time">{{ hoursFor(date)?.debut }} – {{ hoursFor(date)?.fin }}</span>
            <span class="loc-label">{{ locationFor(date)?.label }}</span>
          </div>
        </template>

        <!-- Empty -->
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
const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function dayLabel(date) { return DAYS[date.getDay()] }

function dayData(date) { return data.planning[props.person]?.[formatDate(date)] }

function textColor(rgba) {
  const [r, g, b] = rgba.match(/\d+/g).map(Number)
  const lum = c => { c /= 255; return c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4 }
  const L = 0.2126*lum(r) + 0.7152*lum(g) + 0.0722*lum(b)
  return L > 0.179 ? '#1a1a1a' : '#ffffff'
}

const ABS_CATS = new Set(['CP','Indisponible','Récup'])

function hoursFor(date) {
  const dd = dayData(date)
  if (!dd) return null
  const work = dd.filter(e => !ABS_CATS.has(e.categorie))
  if (!work.length) return null
  const starts = work.map(e => e.horaire.split('-')[0]).sort()
  const ends   = work.map(e => e.horaire.split('-')[1]).sort()
  return { debut: starts[0], fin: ends[ends.length-1], couleur: work[0].couleur }
}

function absenceFor(date) {
  const dd = dayData(date)
  if (!dd) return null
  if (hoursFor(date)) return null
  return dd.find(e => ABS_CATS.has(e.categorie)) || null
}

function absenceBg(date) {
  return absenceFor(date)?.couleur.replace(', 1)', ', 0.7)') || ''
}

function workBg(date) {
  return hoursFor(date)?.couleur.replace(', 1)', ', 0.7)') || ''
}

function locationFor(date) {
  const dd = dayData(date)
  if (!dd) return null
  const work = dd.filter(e => !ABS_CATS.has(e.categorie))
  if (!work.length) return null
  const cat = work[0].categorie
  if (cat.includes('TLT Agence')) return { icon: '💼', label: 'TLT Agence' }
  if (cat.includes('TLT'))        return { icon: '🏠', label: 'Domicile'   }
  if (cat.includes('Agence'))     return { icon: '🏢', label: 'Agence'     }
  return                                  { icon: '👤', label: 'Client'     }
}

function slotFor(date) {
  const dd = dayData(date)
  if (!dd) return ''
  const work = dd.filter(e => !ABS_CATS.has(e.categorie))
  if (!work.length) return ''
  const cats = new Set(work.map(e => e.categorie))
  const slots = []
  if (['Matin','TLT Matin','TLT Agence Matin','Agence Matin'].some(c => cats.has(c)))             slots.push('Mat')
  if (['Midi','TLT Midi','TLT Agence Midi','Agence Midi'].some(c => cats.has(c)))                 slots.push('Midi')
  if (['Aprem','TLT APREM','TLT Agence APREM','Agence APREM','ApremRenf'].some(c => cats.has(c))) slots.push('Apr')
  if (['Soir','TLT Soir','TLT Agence Soir','Agence Soir'].some(c => cats.has(c)))                slots.push('Soir')
  return slots.length ? slots.join('+') : work[0].categorie.slice(0, 4)
}

function cellClass(date) {
  if (absenceFor(date)) return 'planning-cell-absence'
  if (hoursFor(date))   return 'planning-cell-work'
  return 'planning-cell-empty'
}

function cellStyle(date) {
  if (hoursFor(date)) return { style: 'cursor:pointer' }
  return {}
}

function handleClick(date) {
  if (hoursFor(date)) emit('open-modal', props.person, formatDate(date))
}

const initials = props.person.split(' ').map(n => n[0]).join('')
</script>
