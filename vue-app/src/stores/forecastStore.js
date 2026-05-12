import { defineStore } from 'pinia'
import { ref } from 'vue'
import { read, utils } from 'xlsx'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { useAdminStore } from '@/stores/adminStore'

/* ============================================================
   CONSTANTES
   ============================================================ */

export const ETP_TABLE = {
  21: { matin: 4, midi: 5, aprem: 5, soir: 7 },
  20: { matin: 4, midi: 4, aprem: 5, soir: 7 },
  19: { matin: 4, midi: 4, aprem: 4, soir: 7 },
  18: { matin: 4, midi: 4, aprem: 4, soir: 6 },
  17: { matin: 3, midi: 4, aprem: 4, soir: 6 },
  16: { matin: 3, midi: 3, aprem: 4, soir: 6 },
  15: { matin: 3, midi: 3, aprem: 3, soir: 6 },
  14: { matin: 3, midi: 3, aprem: 3, soir: 5 },
  13: { matin: 3, midi: 3, aprem: 3, soir: 4 },
  12: { matin: 3, midi: 3, aprem: 3, soir: 3 },
  11: { matin: 2, midi: 3, aprem: 3, soir: 3 },
  10: { matin: 2, midi: 2, aprem: 3, soir: 3 },
}

// [startSlot, endSlot] — endSlot exclusif, slots 15min de 8h00 (0) à 19h00 (44)
const SHIFT_PATTERNS = {
  'Matin':     { code: '0',  blocks: [[0, 17], [22, 36]] },
  'Midi':      { code: '1',  blocks: [[2, 18], [21, 36]] },
  'Aprem':     { code: '15', blocks: [[4, 18], [22, 38]] },
  'Soir':      { code: '2',  blocks: [[5, 21], [26, 40]] },
  'TLT Matin': { code: '20', blocks: [[0, 17], [22, 36]] },
  'TLT Midi':  { code: '21', blocks: [[2, 18], [21, 36]] },
  'TLT APREM': { code: '22', blocks: [[4, 18], [22, 38]] },
  'TLT Soir':  { code: '23', blocks: [[5, 21], [26, 40]] },
  'BO':        { code: 'BO', blocks: [[4, 40]] },  // 9h00–18h00
}

const TLT_VARIANT = {
  'matin': 'TLT Matin',
  'midi':  'TLT Midi',
  'aprem': 'TLT APREM',
  'soir':  'TLT Soir',
}
const SITE_NAME = {
  'matin': 'Matin',
  'midi':  'Midi',
  'aprem': 'Aprem',
  'soir':  'Soir',
}

// Famille d'horaire par catégorie Firestore
const SHIFT_FAMILY_MAP = {
  'Matin':            'matin',
  'TLT Matin':        'matin',
  'TLT Agence Matin': 'matin',
  'Agence Matin':     'matin',
  'MatinW11':         'matin',
  'Midi':             'midi',
  'TLT Midi':         'midi',
  'TLT Agence Midi':  'midi',
  'Agence Midi':      'midi',
  'Aprem':            'aprem',
  'TLT APREM':        'aprem',
  'TLT Agence APREM': 'aprem',
  'Agence APREM':     'aprem',
  'ApremRenf':        'aprem',
  'Soir':             'soir',
  'TLT Soir':         'soir',
  'TLT Agence Soir':  'soir',
  'Agence Soir':      'soir',
  'SoirW11':          'soir',
}

export const SHIFT_COLORS = {
  'Matin':        { bg: 'rgba(174,219,255,0.18)', text: 'rgba(174,219,255,1)' },
  'Midi':         { bg: 'rgba(149,207,255,0.18)', text: 'rgba(149,207,255,1)' },
  'Aprem':        { bg: 'rgba(89,180,254,0.18)',  text: 'rgba(89,180,254,1)'  },
  'Soir':         { bg: 'rgba(86,166,233,0.18)',  text: 'rgba(86,166,233,1)'  },
  'TLT Matin':    { bg: 'rgba(215,190,158,0.18)', text: 'rgba(215,190,158,1)' },
  'TLT Midi':     { bg: 'rgba(201,167,123,0.18)', text: 'rgba(201,167,123,1)' },
  'TLT APREM':    { bg: 'rgba(188,145,87,0.18)',  text: 'rgba(188,145,87,1)'  },
  'TLT Soir':     { bg: 'rgba(163,121,64,0.18)',  text: 'rgba(163,121,64,1)'  },
  'BO':           { bg: 'rgba(253,224,71,0.2)',    text: 'rgba(253,224,71,1)'  },
  'CP':           { bg: 'rgba(68,0,255,0.12)',     text: 'rgba(68,0,255,1)'    },
  'Indisponible': { bg: 'rgba(176,176,176,0.18)',  text: 'rgba(176,176,176,1)' },
  'Récup':        { bg: 'rgba(230,172,216,0.2)',   text: 'rgba(230,172,216,1)' },
  'Maladie':      { bg: 'rgba(238,138,138,0.2)',   text: 'rgba(238,138,138,1)' },
  'Formation':    { bg: 'rgba(254,228,191,0.25)',  text: 'rgba(254,228,191,1)' },
  '':             { bg: 'transparent',             text: 'var(--text-subtle)'  },
}

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/* ============================================================
   HELPERS
   ============================================================ */

function buildActivites(shiftName) {
  const pattern = SHIFT_PATTERNS[shiftName]
  if (!pattern) return new Array(45).fill('')
  const arr = new Array(45).fill('')
  for (const [start, end] of pattern.blocks) {
    for (let i = start; i < Math.min(end, 45); i++) arr[i] = pattern.code
  }
  return arr
}

function resolveEtpDist(etpNum) {
  if (ETP_TABLE[etpNum]) return ETP_TABLE[etpNum]
  const keys = Object.keys(ETP_TABLE).map(Number).sort((a, b) => b - a)
  const found = keys.find(k => k <= etpNum)
  return ETP_TABLE[found] || ETP_TABLE[10]
}

// Retourne la clé ISO de la semaine : 'YYYY-WXX'
function isoWeekKey(iso) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/* ============================================================
   ANALYSE DE L'HISTORIQUE
   Retourne { 'NOM Prenom': { matin, midi, aprem, soir, total } }
   — en comptant les semaines, pas les jours
   ============================================================ */
export function analyzeHistory(planningData) {
  const stats = {}

  for (const [person, days] of Object.entries(planningData)) {
    // Groupe les activités par semaine ISO
    const weekFamilies = {}   // { 'YYYY-WXX': { matin: n, midi: n, ... } }

    for (const [iso, entries] of Object.entries(days)) {
      const wk = isoWeekKey(iso)
      if (!weekFamilies[wk]) weekFamilies[wk] = { matin: 0, midi: 0, aprem: 0, soir: 0 }
      for (const e of entries) {
        const fam = SHIFT_FAMILY_MAP[e.categorie]
        if (fam) weekFamilies[wk][fam]++
      }
    }

    // Pour chaque semaine, le shift dominant = famille la plus représentée
    let matin = 0, midi = 0, aprem = 0, soir = 0
    for (const wk of Object.values(weekFamilies)) {
      const max = Math.max(wk.matin, wk.midi, wk.aprem, wk.soir)
      if (max === 0) continue
      // Tiebreak : soir > aprem > midi > matin (shift les plus contraignants prioritaires)
      if      (wk.soir  === max) soir++
      else if (wk.aprem === max) aprem++
      else if (wk.midi  === max) midi++
      else                       matin++
    }

    const total = matin + midi + aprem + soir
    stats[person] = { matin, midi, aprem, soir, total }
  }

  return stats
}

/* ============================================================
   ASSIGNATION HEBDOMADAIRE ÉQUITABLE
   ============================================================ */

const ABSENCE_CATS = new Set(['CP', 'Indisponible', 'Récup', 'Maladie', 'Formation'])

function getAbsenceForDay(planningData, personName, iso) {
  const entries = planningData?.[personName]?.[iso]
  if (!entries) return null
  for (const e of entries) {
    if (ABSENCE_CATS.has(e.categorie)) return e.categorie
  }
  return null
}

function equityScore(history, personName, shift, lastWeekShift, noAssignStreak) {
  const h = history[personName] || { matin: 0, midi: 0, aprem: 0, soir: 0, total: 0 }
  const total = Math.max(h.total, 1)
  let score = 0.25 - h[shift] / total
  // Pénalité forte si même shift que la semaine précédente
  if (lastWeekShift?.[personName] === shift) score -= 0.4
  // Bonus si la personne n'a pas eu de shift les semaines précédentes
  if ((noAssignStreak?.[personName] || 0) > 0) score += noAssignStreak[personName] * 0.2
  return score
}

// Retourne { name: 'matin'|'midi'|'aprem'|'soir'|'' } — famille uniquement, sans TLT
function assignWeekFamilies(activePeople, shiftNeeds, history, lastWeekShift, noAssignStreak) {
  const assignments = {}
  const remaining   = new Set(activePeople.map(p => `${p.nom} ${p.prenom}`))

  for (const shift of ['soir', 'aprem', 'midi', 'matin']) {
    const count = shiftNeeds[shift]
    if (!count) continue

    const candidates = [...remaining]
      .map(name => ({ name, score: equityScore(history, name, shift, lastWeekShift, noAssignStreak) }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))

    for (let i = 0; i < Math.min(count, candidates.length); i++) {
      assignments[candidates[i].name] = shift
      remaining.delete(candidates[i].name)
    }
  }

  for (const name of remaining) assignments[name] = ''
  return assignments
}


/* ============================================================
   STORE
   ============================================================ */

export const useForecastStore = defineStore('forecast', () => {
  const forecast      = ref(null)   // { iso → { jourSemaine, etp, matin, midi, aprem, soir, isSam } }
  const fileName      = ref('')
  const parsing       = ref(false)
  const generating    = ref(false)
  const undoing       = ref(false)
  const genResults    = ref(null)
  const parseError    = ref('')
  const maxBO         = ref(3)
  const appliedDayIds  = ref([])   // IDs Firestore écrits lors du dernier apply
  const appliedBackup  = ref({})   // { dayId: previousData | null } pour restauration

  // Prévisualisation en mémoire
  // preview.dates   = ['2026-05-01', ...]
  // preview.persons = ['NOM Prenom', ...]
  // preview.matrix[person][iso] = shiftName
  // preview.history[person]     = { matin, midi, aprem, soir, total }
  const preview    = ref(null)
  const previewing = ref(false)

  /* ── Parse le fichier Excel ── */
  async function parseExcel(file) {
    parsing.value    = true
    parseError.value = ''
    forecast.value   = null
    preview.value    = null
    fileName.value   = file.name

    try {
      const buffer = await file.arrayBuffer()
      const wb = read(buffer, { type: 'array', cellDates: true })

      const wsName = wb.SheetNames.find(n =>
        n.toLowerCase().replace(/\s/g, '').includes('pr')
      )
      if (!wsName) throw new Error('Feuille "Prévisions" introuvable dans le fichier')

      const rows = utils.sheet_to_json(wb.Sheets[wsName], { header: 1, defval: null })
      const result = {}

      for (let i = 9; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        const dateVal = row[3]
        const etpVal  = row[12]

        if (!(dateVal instanceof Date) || etpVal == null) continue
        const dow = dateVal.getDay()
        if (dow === 0) continue

        const iso    = `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`
        const etpNum = Math.round(Number(etpVal))
        if (etpNum <= 0) continue

        const dist = resolveEtpDist(etpNum)
        result[iso] = {
          jourSemaine: JOURS[dow],
          etp:   etpNum,
          matin: dist.matin,
          midi:  dist.midi,
          aprem: dist.aprem,
          soir:  dist.soir,
          isSam: dow === 6,
        }
      }

      if (!Object.keys(result).length)
        throw new Error('Aucune ligne de données valide trouvée dans la feuille Prévisions')

      forecast.value = result
    } catch (e) {
      parseError.value = e.message
    } finally {
      parsing.value = false
    }
  }

  /* ── Prévisualisation hebdomadaire équitable (dry-run) ── */
  async function previewPlanningWeekly({ persons, planningData }) {
    if (!forecast.value || !persons.length) return
    const admin = useAdminStore()

    previewing.value = true
    preview.value    = null

    // 1. Filtre les personnes "On Run" uniquement (onRun absent = true par défaut)
    const runPersons = persons.filter(p => p.onRun !== false)

    // 2. Analyse de l'historique (sur les personnes Run uniquement)
    const history = analyzeHistory(planningData)

    // 3. Groupement des dates par semaine ISO
    const dates      = Object.keys(forecast.value).sort()
    const weekGroups = {}  // { 'YYYY-WXX': [iso, ...] }
    for (const iso of dates) {
      const wk = isoWeekKey(iso)
      if (!weekGroups[wk]) weekGroups[wk] = []
      weekGroups[wk].push(iso)
    }

    const matrix   = {}  // matrix[fullName][iso] = shiftName
    const allNames = new Set()

    // Suivi inter-semaines pour l'équité
    const lastWeekShift  = {}  // { fullName: 'matin'|'midi'|'aprem'|'soir' }
    const noAssignStreak = {}  // { fullName: number } semaines sans shift
    const boWeeksUsed    = {}  // { fullName: number } semaines BO attribuées ce mois

    // 4. Pour chaque semaine, assigner les shifts
    for (const [, weekDates] of Object.entries(weekGroups).sort(([a], [b]) => a.localeCompare(b))) {
      // ETP représentatif = max de la semaine hors samedi (couverture garantie)
      let maxEtp = 0
      for (const iso of weekDates) {
        if (!forecast.value[iso].isSam) maxEtp = Math.max(maxEtp, forecast.value[iso].etp)
      }

      const workDates = weekDates.filter(iso => !forecast.value[iso].isSam)
      const samDates  = weekDates.filter(iso => forecast.value[iso].isSam)

      // Personnes Run actives sur la semaine
      const refDate = new Date((workDates[0] || weekDates[0]) + 'T12:00:00')
      const activePeople = runPersons
        .filter(p => admin.isActiveOn(p, refDate))
        .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))

      activePeople.forEach(p => allNames.add(`${p.nom} ${p.prenom}`))

      // 4a. Repérer les absences pré-existantes (CP, Indispo…) pour cette semaine
      //     — exclus du pool d'assignation si absent sur la majorité des jours ouvrés
      const absentForWeek = new Set()
      const dayAbsences   = {}  // { name: { iso: categorie } }

      for (const p of activePeople) {
        const name  = `${p.nom} ${p.prenom}`
        let absDays = 0
        dayAbsences[name] = {}

        for (const iso of workDates) {
          const cat = getAbsenceForDay(planningData, name, iso)
          if (cat) {
            dayAbsences[name][iso] = cat
            absDays++
          }
        }

        if (workDates.length > 0 && absDays / workDates.length > 0.5) {
          absentForWeek.add(name)
        }
      }

      // Écrire les absences connues dans la matrice
      for (const [name, absMap] of Object.entries(dayAbsences)) {
        if (!matrix[name]) matrix[name] = {}
        for (const [iso, cat] of Object.entries(absMap)) {
          matrix[name][iso] = cat
        }
      }

      if (workDates.length && maxEtp > 0) {
        const available = activePeople.filter(p => !absentForWeek.has(`${p.nom} ${p.prenom}`))

        // ── Assignation BO (avant Run, par rotation équitable) ──
        const boNames = new Set()
        if (maxBO.value > 0) {
          const boEligible = available
            .filter(p => p.peutBO)
            .sort((a, b) => {
              const na = `${a.nom} ${a.prenom}`, nb = `${b.nom} ${b.prenom}`
              return (boWeeksUsed[na] || 0) - (boWeeksUsed[nb] || 0) || na.localeCompare(nb, 'fr')
            })
            .slice(0, maxBO.value)

          for (const p of boEligible) {
            const name = `${p.nom} ${p.prenom}`
            boNames.add(name)
            boWeeksUsed[name] = (boWeeksUsed[name] || 0) + 1
            if (!matrix[name]) matrix[name] = {}
            for (const iso of workDates) {
              if (!matrix[name][iso]) matrix[name][iso] = 'BO'
            }
          }
        }

        // Pool Run = actifs hors absents et hors BO cette semaine
        const pool       = available.filter(p => !boNames.has(`${p.nom} ${p.prenom}`))
        const shiftNeeds = resolveEtpDist(maxEtp)

        // Étape 1 : assigner la famille de shift pour la semaine (sans décision TLT)
        const familyAssign = assignWeekFamilies(pool, shiftNeeds, history, lastWeekShift, noAssignStreak)

        // Étape 2 : cible 2 jours TLT par personne par semaine
        //   • pas de TLT le mercredi
        //   • ≤ 50% de la même famille en TLT le même jour (min 1 si famille de 1)
        const nonWedDays = workDates.filter(iso => new Date(iso + 'T12:00:00').getDay() !== 3)
        const tltAllowed = new Set(pool.filter(p => p.peutTLT !== false).map(p => `${p.nom} ${p.prenom}`))

        // Cap par jour et par famille = floor(n/2), min 1
        const familyCounts = {}
        for (const fam of Object.values(familyAssign)) {
          if (fam) familyCounts[fam] = (familyCounts[fam] || 0) + 1
        }

        const dayTltCount  = {}   // { iso: { fam: n } } — TLT déjà posés ce jour
        for (const iso of nonWedDays) dayTltCount[iso] = {}

        const personTltDays = {}  // { name: number } — jours TLT attribués cette semaine
        const tltDayForPerson = {} // { name: Set<iso> }

        const eligible = Object.entries(familyAssign)
          .filter(([name, fam]) => fam && tltAllowed.has(name))

        // Deux passes pour atteindre 2 jours TLT par personne
        for (let pass = 0; pass < 2; pass++) {
          // Priorité aux personnes qui ont le moins de jours TLT cette semaine
          eligible.sort(([na], [nb]) =>
            (personTltDays[na] || 0) - (personTltDays[nb] || 0) || na.localeCompare(nb, 'fr')
          )
          for (const [name, fam] of eligible) {
            if ((personTltDays[name] || 0) !== pass) continue  // déjà à jour pour ce pass
            const cap = Math.max(1, Math.floor((familyCounts[fam] || 1) / 2))
            if (nonWedDays.length === 0) continue
            const used = tltDayForPerson[name] || new Set()
            // Premier jour non encore utilisé pour cette personne et sous le cap famille
            const day = nonWedDays.find(iso => !used.has(iso) && (dayTltCount[iso][fam] || 0) < cap)
            if (!day) continue
            if (!tltDayForPerson[name]) tltDayForPerson[name] = new Set()
            tltDayForPerson[name].add(day)
            dayTltCount[day][fam] = (dayTltCount[day][fam] || 0) + 1
            personTltDays[name]   = (personTltDays[name]   || 0) + 1
          }
        }

        // Écrire les shifts jour par jour
        for (const iso of workDates) {
          for (const [name, fam] of Object.entries(familyAssign)) {
            if (!matrix[name]) matrix[name] = {}
            if (matrix[name][iso]) continue  // ne pas écraser les absences
            if (!fam) { matrix[name][iso] = ''; continue }
            matrix[name][iso] = tltDayForPerson[name]?.has(iso) ? TLT_VARIANT[fam] : SITE_NAME[fam]
          }
        }

        // Suivi inter-semaines (Run uniquement — BO et absents exclus)
        for (const p of activePeople) {
          const name = `${p.nom} ${p.prenom}`
          if (absentForWeek.has(name) || boNames.has(name)) continue

          const fam = familyAssign[name]
          if (fam) {
            if (!history[name]) history[name] = { matin: 0, midi: 0, aprem: 0, soir: 0, total: 0 }
            history[name][fam]++
            history[name].total++
            lastWeekShift[name] = fam
            noAssignStreak[name] = 0
          } else {
            noAssignStreak[name] = (noAssignStreak[name] || 0) + 1
          }
        }
      }

      // Samedi : 2 premières personnes Run actives en Matin
      if (samDates.length) {
        const samPeople = runPersons
          .filter(p => admin.isActiveOn(p, new Date(samDates[0] + 'T12:00:00')))
          .slice(0, 2)
        samPeople.forEach((p, i) => {
          const name = `${p.nom} ${p.prenom}`
          allNames.add(name)
          if (!matrix[name]) matrix[name] = {}
          if (!matrix[name][samDates[0]]) {
            matrix[name][samDates[0]] = i === 0 ? 'Matin' : 'TLT Matin'
          }
        })
      }
    }

    preview.value = {
      dates,
      persons:  [...allNames].sort((a, b) => a.localeCompare(b, 'fr')),
      matrix,
      history:  analyzeHistory(
        Object.fromEntries(
          Object.entries(planningData).filter(([name]) =>
            runPersons.some(p => `${p.nom} ${p.prenom}` === name)
          )
        )
      ),
    }

    previewing.value = false
  }

  /* ── Applique la prévisualisation en Firestore ── */
  async function applyPreview({ persons, overwrite = false, onProgress }) {
    if (!preview.value || !forecast.value) return
    const admin = useAdminStore()

    generating.value    = true
    genResults.value    = null
    appliedDayIds.value = []
    appliedBackup.value = {}

    let done = 0, skipped = 0, errors = 0
    const writtenIds = []
    const backup     = {}
    const { dates, matrix } = preview.value
    let processed = 0

    for (const iso of dates) {
      processed++
      if (onProgress) onProgress(processed, dates.length)

      try {
        const date  = new Date(iso + 'T12:00:00')
        const dayId = admin.dateToId(date)

        // Toujours charger le doc existant : sert au check overwrite ET au backup undo
        const snap = await getDoc(doc(db, 'plannings', dayId))

        if (!overwrite && snap.exists()) {
          const existing = snap.data().ressources || []
          if (existing.some(r => (r.activites || []).some(a => a && a !== ''))) {
            skipped++; continue
          }
        }

        // Sauvegarde pour restauration éventuelle
        backup[dayId] = snap.exists() ? snap.data() : null

        const activePeople = persons
          .filter(p => admin.isActiveOn(p, date))
          .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))

        const ressources = activePeople.map(p => {
          const name  = `${p.nom} ${p.prenom}`
          const shift = matrix[name]?.[iso] || ''
          return {
            nom:        p.nom,
            prenom:     p.prenom,
            idPersonne: p.uid || p.id || '',
            activites:  shift ? buildActivites(shift) : new Array(45).fill(''),
          }
        })

        await setDoc(doc(db, 'plannings', dayId), { ressources })
        writtenIds.push(dayId)
        done++
      } catch (e) {
        console.error(`Erreur application ${iso}:`, e)
        errors++
      }
    }

    appliedDayIds.value = writtenIds
    appliedBackup.value = backup
    genResults.value    = { done, skipped, errors, total: dates.length }
    generating.value    = false
  }

  /* ── Annule le dernier apply (supprime les documents écrits) ── */
  async function undoApply({ onProgress } = {}) {
    if (!appliedDayIds.value.length) return
    undoing.value = true
    const ids    = [...appliedDayIds.value]
    const backup = appliedBackup.value
    let n = 0
    for (const dayId of ids) {
      try {
        const previous = backup[dayId]
        if (previous) {
          // Restaure l'état exact d'avant l'apply
          await setDoc(doc(db, 'plannings', dayId), previous)
        } else {
          // N'existait pas avant → supprime
          await deleteDoc(doc(db, 'plannings', dayId))
        }
      } catch (e) {
        console.error(`Erreur annulation ${dayId}:`, e)
      }
      n++
      if (onProgress) onProgress(n, ids.length)
    }
    appliedDayIds.value = []
    appliedBackup.value = {}
    genResults.value    = null
    undoing.value       = false
  }

  function reset() {
    forecast.value      = null
    preview.value       = null
    fileName.value      = ''
    parseError.value    = ''
    genResults.value    = null
    appliedDayIds.value = []
    appliedBackup.value = {}
  }

  return {
    forecast, fileName, parsing, generating, undoing, genResults, parseError,
    preview, previewing, maxBO, appliedDayIds,
    parseExcel, previewPlanningWeekly, applyPreview, undoApply, reset,
  }
})
