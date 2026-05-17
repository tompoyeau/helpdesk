import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { db } from '@/firebase/config'
import { collection, onSnapshot } from 'firebase/firestore'

/* ============================================================
   ACTIVITY MAPPING
   ============================================================ */

export const ACTIVITY_MAPPING = {
  '0':  { categorie: 'Matin',            couleur: 'rgba(174, 219, 255, 1)' },
  '1':  { categorie: 'Midi',             couleur: 'rgba(149, 207, 255, 1)' },
  '15': { categorie: 'Aprem',            couleur: 'rgba(89,  180, 254, 1)' },
  '2':  { categorie: 'Soir',             couleur: 'rgba(86,  166, 233, 1)' },
  '20': { categorie: 'TLT Matin',        couleur: 'rgba(215, 190, 158, 1)' },
  '21': { categorie: 'TLT Midi',         couleur: 'rgba(201, 167, 123, 1)' },
  '22': { categorie: 'TLT APREM',        couleur: 'rgba(188, 145, 87,  1)' },
  '23': { categorie: 'TLT Soir',         couleur: 'rgba(163, 121, 64,  1)' },
  '12': { categorie: 'TLT Agence Matin', couleur: 'rgba(225, 213, 253, 1)' },
  '13': { categorie: 'TLT Agence Midi',  couleur: 'rgba(210, 192, 251, 1)' },
  '17': { categorie: 'TLT Agence APREM', couleur: 'rgba(182, 153, 244, 1)' },
  '14': { categorie: 'TLT Agence Soir',  couleur: 'rgba(156, 116, 243, 1)' },
  '9':  { categorie: 'Agence Matin',     couleur: 'rgba(227, 255, 171, 1)' },
  '10': { categorie: 'Agence Midi',      couleur: 'rgba(209, 243, 142, 1)' },
  '16': { categorie: 'Agence APREM',     couleur: 'rgba(185, 231, 94,  1)' },
  '11': { categorie: 'Agence Soir',      couleur: 'rgba(154, 192, 77,  1)' },
  '30': { categorie: 'CP',              couleur: 'rgba(68,  0,   255, 1)' },
  '6':  { categorie: 'Indisponible',    couleur: 'rgba(176, 176, 176, 1)' },
  '8':  { categorie: 'Récup',           couleur: 'rgba(230, 172, 216, 1)' },
  '24': { categorie: 'Pilote',          couleur: 'rgba(226, 53,  73,  1)' },
  '26': { categorie: 'PiloteBO',        couleur: 'rgba(253, 224, 71,  1)' },
  '28': { categorie: 'MatinW11',        couleur: 'rgba(53,  225, 167, 1)' },
  '29': { categorie: 'SoirW11',         couleur: 'rgba(22,  114, 83,  1)' },
  '5':  { categorie: 'Formation',       couleur: 'rgba(254, 228, 191, 1)' },
  '7':  { categorie: 'Astreinte',       couleur: 'rgba(238, 138, 138, 1)' },
  '27': { categorie: 'ApremRenf',       couleur: 'rgba(255, 0,   255, 1)' },
  '31': { categorie: 'RH',              couleur: 'rgba(255, 165, 0,   1)' },
}

/* ============================================================
   TIME SLOTS (15 min, 8h00 → 19h00)
   ============================================================ */

export const HORAIRE_RANK = {
  'Matin': 0, 'TLT Matin': 1, 'TLT Agence Matin': 2, 'Agence Matin': 3, 'MatinW11': 4,
  'Midi': 10, 'TLT Midi': 11, 'TLT Agence Midi': 12, 'Agence Midi': 13,
  'Aprem': 20, 'TLT APREM': 21, 'TLT Agence APREM': 22, 'Agence APREM': 23, 'ApremRenf': 24, 'Formation': 25,
  'Soir': 30, 'TLT Soir': 31, 'TLT Agence Soir': 32, 'Agence Soir': 33, 'SoirW11': 34,
  'PiloteBO': 40, 'BO': 40,
  'Pilote': 80,
  'Récup': 85, 'Astreinte': 86, 'RH': 87,
  'CP': 90, 'Indisponible': 91,
}

export const TIME_SLOTS = []
for (let i = 0; i <= 44; i++) {
  const totalMin = 8 * 60 + i * 15
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}

/* ============================================================
   HELPERS
   ============================================================ */

// Formatage local (évite le décalage UTC de toISOString)
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateFromId(id) {
  if (!id || id.length !== 8) return null
  return `${id.slice(4, 8)}-${id.slice(2, 4)}-${id.slice(0, 2)}`
}

export function analyzeActivities(activites) {
  if (!Array.isArray(activites) || !activites.length) return []

  const entries = []
  let currentActivity = null
  let startIndex = null

  for (let i = 0; i < activites.length; i++) {
    const activity = activites[i]
    if (activity && activity !== '') {
      if (currentActivity === null || currentActivity !== activity) {
        if (currentActivity !== null && startIndex !== null) {
          const mapping = ACTIVITY_MAPPING[currentActivity]
          if (mapping) entries.push({
            categorie: mapping.categorie,
            horaire:   `${TIME_SLOTS[startIndex] || '08:00'}-${TIME_SLOTS[i] || TIME_SLOTS[TIME_SLOTS.length - 1]}`,
            couleur:   mapping.couleur,
            slots:     i - startIndex
          })
        }
        currentActivity = activity
        startIndex = i
      }
    } else {
      if (currentActivity !== null && startIndex !== null) {
        const mapping = ACTIVITY_MAPPING[currentActivity]
        if (mapping) entries.push({
          categorie: mapping.categorie,
          horaire:   `${TIME_SLOTS[startIndex] || '08:00'}-${TIME_SLOTS[i] || TIME_SLOTS[TIME_SLOTS.length - 1]}`,
          couleur:   mapping.couleur,
          slots:     i - startIndex
        })
        currentActivity = null
        startIndex = null
      }
    }
  }

  if (currentActivity !== null && startIndex !== null) {
    const mapping = ACTIVITY_MAPPING[currentActivity]
    if (mapping) {
      const endIdx = Math.min(activites.length, TIME_SLOTS.length - 1)
      entries.push({
        categorie: mapping.categorie,
        horaire:   `${TIME_SLOTS[startIndex] || '08:00'}-${TIME_SLOTS[endIdx]}`,
        couleur:   mapping.couleur,
        slots:     endIdx - startIndex
      })
    }
  }

  return entries
}

/* ============================================================
   STORE
   ============================================================ */

export const useDataStore = defineStore('data', () => {
  // shallowRef : Vue ne proxy pas récursivement les données volumineuses
  const _planning       = shallowRef({})
  const _persons        = ref([])
  const _personnesData  = shallowRef({})
  const _nameToPersonId = shallowRef({})
  const _nameToUid      = shallowRef({}) // "NOM Prenom" → Firebase Auth UID

  const categories = ref([])
  const colors     = ref({})
  const loading    = ref(false)
  const error      = ref(null)

  // Filtres
  const filterStart  = ref('')
  const filterEnd    = ref('')
  const filterActive = ref(true)

  // Données filtrées — shallowRef : évite le proxy récursif de byPerson (milliers d'objets)
  const filtered = shallowRef(null)

  // Abonnements Firestore temps-réel
  let _unsubPlanning  = null
  let _unsubPersonnes = null

  // Debounce pour computeFiltered (évite les recalculs en rafale lors d'un forecast)
  let _computeTimer = null
  function _scheduleComputeFiltered() {
    if (_computeTimer) clearTimeout(_computeTimer)
    _computeTimer = setTimeout(() => { _computeTimer = null; computeFiltered() }, 300)
  }

  /* ── Personnes actives (computed — mis en cache automatiquement) ── */
  const activePersonsList = computed(() => {
    // Source de vérité : uniquement la collection personnes.
    // On ignore _persons (construit depuis les plannings) pour éviter les fantômes
    // (collabs présents dans d'anciens plannings mais absents/supprimés de personnes).
    const parseDate = str => {
      if (!str) return null
      const parts = str.trim().split(' ')
      if (parts.length < 3) return null
      const [d, m, y] = parts
      return new Date(+y, +m - 1, +d)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const allPersonnes = Object.values(_personnesData.value)
      .filter(p => p.nom && p.prenom)

    const list = (filterActive.value
      ? allPersonnes.filter(p => {
          const arrivee = parseDate(p.arrivee)
          const depart  = parseDate(p.depart)
          if (!arrivee || today < arrivee) return false
          if (depart && today > depart)    return false
          return true
        })
      : allPersonnes
    ).map(p => `${p.nom} ${p.prenom}`)

    return list.sort((a, b) => a.localeCompare(b, 'fr'))
  })

  // Compatibilité : garde activePersons() comme fonction pour les composants existants
  function activePersons() { return activePersonsList.value }

  /* ── Helpers de traitement des snapshots ── */

  function _processPlanning(snapshot) {
    const newPlanning       = {}
    const allCategories     = new Set()
    const allColors         = {}
    const newNameToPersonId = {}

    snapshot.forEach(docSnap => {
      const day  = docSnap.data()
      const date = parseDateFromId(docSnap.id)
      if (!date || !Array.isArray(day.ressources)) return

      day.ressources.forEach(person => {
        const fullName = `${person.nom} ${person.prenom}`
        if (!newPlanning[fullName]) newPlanning[fullName] = {}
        if (person.idPersonne) newNameToPersonId[fullName] = person.idPersonne

        const entries = analyzeActivities(person.activites || [])
        if (entries.length > 0) {
          newPlanning[fullName][date] = entries
          entries.forEach(e => {
            allCategories.add(e.categorie)
            if (!allColors[e.categorie]) allColors[e.categorie] = e.couleur
          })
        }
      })
    })

    _nameToPersonId.value = newNameToPersonId
    _planning.value       = newPlanning
    _persons.value        = Object.keys(newPlanning).sort()
    categories.value      = [...allCategories].sort()
    colors.value          = allColors

    if (import.meta.env.DEV)
      console.log(`✅ Planning : ${_persons.value.length} collaborateurs, ${snapshot.size} jours`)
  }

  function _processPersonnes(snapshot) {
    const newData     = {}
    const newNameToUid = {}
    snapshot.forEach(docSnap => {
      const d  = docSnap.data()
      const id = d.id || docSnap.id
      newData[id] = d
      // docSnap.id = Firebase Auth UID (clé du document personnes)
      if (d.nom && d.prenom) newNameToUid[`${d.nom} ${d.prenom}`] = docSnap.id
    })
    _personnesData.value = newData
    _nameToUid.value     = newNameToUid
    if (import.meta.env.DEV)
      console.log(`✅ Personnes : ${Object.keys(newData).length}`)
  }

  /* ── Abonnements temps-réel ── */

  function cleanup() {
    if (_unsubPlanning)  { _unsubPlanning();  _unsubPlanning  = null }
    if (_unsubPersonnes) { _unsubPersonnes(); _unsubPersonnes = null }
    if (_computeTimer)   { clearTimeout(_computeTimer); _computeTimer = null }
  }

  async function init() {
    // Plage par défaut : 1 an glissant
    const today      = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    oneYearAgo.setDate(oneYearAgo.getDate() + 1)
    filterStart.value = fmtDate(oneYearAgo)
    filterEnd.value   = fmtDate(today)

    // Résilie les abonnements précédents avant d'en créer de nouveaux
    cleanup()

    error.value   = null
    loading.value = true

    await Promise.all([
      // ── plannings ──
      new Promise(resolve => {
        let first = true
        _unsubPlanning = onSnapshot(
          collection(db, 'plannings'),
          snapshot => {
            _processPlanning(snapshot)
            if (first) { first = false; resolve() }
            else _scheduleComputeFiltered()
          },
          err => {
            error.value = err.message
            if (import.meta.env.DEV) console.error('❌ plannings :', err)
            if (first) { first = false; resolve() }
          }
        )
      }),
      // ── personnes ──
      new Promise(resolve => {
        let first = true
        _unsubPersonnes = onSnapshot(
          collection(db, 'personnes'),
          snapshot => {
            _processPersonnes(snapshot)
            if (first) { first = false; resolve() }
            else _scheduleComputeFiltered()
          },
          err => {
            if (import.meta.env.DEV) console.warn('⚠️ personnes :', err)
            if (first) { first = false; resolve() }
          }
        )
      }),
    ])

    loading.value = false
    computeFiltered()
  }

  /* ── Calcul des données filtrées ── */

  function computeFiltered() {
    const fs = filterStart.value
    const fe = filterEnd.value
    const byCat = {}, byMonth = {}, byPerson = {}
    const ABS_CATS = new Set(['CP', 'Indisponible', 'Récup'])

    for (const p of activePersonsList.value) {
      const pData = _planning.value[p]
      if (!pData) continue
      for (const d in pData) {
        if (fs && d < fs) continue
        if (fe && d > fe) continue
        const isSaturday = new Date(d + 'T12:00:00').getDay() === 6

        pData[d].forEach(e => {
          if (isSaturday && ABS_CATS.has(e.categorie)) return
          byCat[e.categorie]     = (byCat[e.categorie] || 0) + 1
          byMonth[d.slice(0, 7)] = (byMonth[d.slice(0, 7)] || 0) + 1
          byPerson[p] = byPerson[p] || { details: {} }
          ;(byPerson[p].details[d] = byPerson[p].details[d] || []).push(e)
        })
      }
    }

    const result = { byCat, byMonth, byPerson }

    // Samedis travaillés
    result.byCategory = { samedi: { d: new Set(), persons: {} } }
    for (const p in byPerson) {
      for (const day in byPerson[p].details) {
        if (new Date(day + 'T12:00:00').getDay() !== 6) continue
        const entries = byPerson[p].details[day].filter(e => {
          const cat = e.categorie.toLowerCase()
          return !cat.includes('astreinte') && cat !== 'cp' && cat !== 'indisponible'
        })
        if (!entries.length) continue
        result.byCategory.samedi.d.add(day)
        if (!result.byCategory.samedi.persons[p])
          result.byCategory.samedi.persons[p] = { days: new Set() }
        result.byCategory.samedi.persons[p].days.add(day)
      }
    }

    filtered.value = result
  }

  return {
    planning:     _planning,
    persons:      _persons,
    personnesData: _personnesData,
    nameToUid:    _nameToUid,
    categories,
    colors,
    loading,
    error,
    filtered,
    filterStart,
    filterEnd,
    filterActive,
    init,
    cleanup,
    computeFiltered,
    activePersons,
  }
})
