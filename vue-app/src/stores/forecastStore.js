import { defineStore } from 'pinia'
import { ref } from 'vue'
import { read, utils } from 'xlsx'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { useAdminStore } from '@/stores/adminStore'
import { isFerie } from '@/stores/statsStore'

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

// [startSlot, endSlot] — endSlot exclusif, slots de 15 min depuis 8h00
// slot = (heure*60 + minutes - 480) / 15
// 8h00=0  8h30=2  8h45=3  9h00=4  9h15=5
// 12h00=16 12h30=18 12h45=19 13h00=20 13h15=21 13h30=22
// 16h30=34 17h00=36 17h30=38 18h00=40
const SHIFT_PATTERNS = {
  'Matin':     { code: '0',  blocks: [[0, 16], [20, 34]] },  // 8h00-12h00 / 13h00-16h30
  'Midi':      { code: '1',  blocks: [[2, 18], [22, 36]] },  // 8h30-12h30 / 13h30-17h00
  'Aprem':     { code: '15', blocks: [[4, 18], [22, 38]] },  // 9h00-12h30 / 13h30-17h30
  'Soir':      { code: '2',  blocks: [[5, 21], [26, 40]] },  // 9h15-13h15 / 14h30-18h00
  'TLT Matin':    { code: '20', blocks: [[0, 16], [20, 34]] },
  'TLT Midi':     { code: '21', blocks: [[2, 18], [22, 36]] },
  'TLT APREM':    { code: '22', blocks: [[4, 18], [22, 38]] },
  'TLT Soir':     { code: '23', blocks: [[5, 21], [26, 40]] },
  'Agence Matin': { code: '9',  blocks: [[0, 16], [20, 34]] },
  'Agence Midi':  { code: '10', blocks: [[2, 18], [22, 36]] },
  'Agence APREM': { code: '16', blocks: [[4, 18], [22, 38]] },
  'Agence Soir':  { code: '11', blocks: [[5, 21], [26, 40]] },
  'BO':           { code: '26', blocks: [[3, 19], [22, 36]] },  // PiloteBO — 8h45-12h45 / 13h30-17h00
  // Absences journée complète (code Firestore → slots 0–44)
  'CP':           { code: '30', blocks: [[0, 45]] },
  'Indisponible': { code: '6',  blocks: [[0, 45]] },
  'Récup':        { code: '8',  blocks: [[0, 45]] },
  'Formation':    { code: '5',  blocks: [[4, 18], [22, 38]] },  // 9h00-12h30 / 13h30-17h30
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

// Codes d'activité Firestore à ne jamais écraser (congés, absences, indisponibilités)
// '5' (Formation) exclu : le forecast réécrit Formation avec les créneaux corrects (9h-12h30 / 13h30-17h30)
const PROTECTED_CODES = new Set(['30', '6', '8', '7', '31'])

function hasProtectedActivity(activites) {
  if (!Array.isArray(activites)) return false
  return activites.some(a => a && PROTECTED_CODES.has(a))
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
  'Agence Matin': { bg: 'rgba(227,255,171,0.22)', text: 'rgba(130,185,60,1)'  },
  'Agence Midi':  { bg: 'rgba(209,243,142,0.22)', text: 'rgba(115,170,50,1)'  },
  'Agence APREM': { bg: 'rgba(185,231,94,0.22)',  text: 'rgba(100,155,40,1)'  },
  'Agence Soir':  { bg: 'rgba(154,192,77,0.22)',  text: 'rgba(85,140,30,1)'   },
  'BO':           { bg: 'rgba(253,224,71,0.2)',    text: 'rgba(253,224,71,1)'  },
  'CP':           { bg: 'rgba(68,0,255,0.12)',     text: 'rgba(68,0,255,1)'    },
  'Indisponible': { bg: 'rgba(176,176,176,0.18)',  text: 'rgba(176,176,176,1)' },
  'Récup':        { bg: 'rgba(230,172,216,0.2)',   text: 'rgba(230,172,216,1)' },
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
   RATIO JOURNÉES VERTES (Agence) PAR PERSONNE
   Fenêtre : max(arrivée, 1 an glissant) → hier
   agenceRatio = agenceDays / totalActiveDays
   Objectif : égaliser ce ratio entre tous les collabs.
   Lors d'un surplus, ceux qui ont le ratio le plus élevé
   (plus de jours Agence au compteur) partent en repos en premier,
   pour laisser les autres cumuler davantage de jours Agence.
   ============================================================ */

const AGENCE_CATS = new Set(['Agence Matin', 'Agence Midi', 'Agence APREM', 'Agence Soir'])

function fmtIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function countWorkingDays(start, end) {
  let n = 0
  const d = new Date(start); d.setHours(12, 0, 0, 0)
  const e = new Date(end);   e.setHours(12, 0, 0, 0)
  while (d <= e) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6 && !isFerie(fmtIso(d))) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

// Retourne { 'NOM Prenom': { totalActiveDays, agenceDays, agenceRatio } }
function computePersonStats(planningData, persons) {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const oneYearAgo = new Date(today); oneYearAgo.setFullYear(today.getFullYear() - 1)
  const yesterday  = new Date(today); yesterday.setDate(today.getDate() - 1)

  const result = {}

  for (const p of persons) {
    const name = `${p.nom} ${p.prenom}`

    // Fenêtre : max(date d'arrivée, 1 an glissant) → hier
    let arrivee = null
    if (p.arrivee) {
      const parts = p.arrivee.trim().split(' ')
      if (parts.length >= 3) {
        arrivee = new Date(+parts[2], +parts[1] - 1, +parts[0])
        arrivee.setHours(12, 0, 0, 0)
      }
    }
    const windowStart = (arrivee && arrivee > oneYearAgo) ? arrivee : oneYearAgo

    // Aucun historique pertinent si la fenêtre est dans le futur
    if (windowStart > yesterday) {
      result[name] = { totalActiveDays: 0, agenceDays: 0, agenceRatio: 0 }
      continue
    }

    const totalActiveDays = countWorkingDays(windowStart, yesterday)
    const startIso = fmtIso(windowStart)
    const endIso   = fmtIso(yesterday)

    // Compter les journées vertes (shifts Agence) dans la fenêtre
    let agenceDays = 0
    const pData = planningData[name] || {}
    for (const [iso, entries] of Object.entries(pData)) {
      if (iso < startIso || iso > endIso) continue
      const dt = new Date(iso + 'T12:00:00')
      if (dt.getDay() === 0 || dt.getDay() === 6 || isFerie(iso)) continue
      if (entries.some(e => AGENCE_CATS.has(e.categorie))) agenceDays++
    }

    const agenceRatio = totalActiveDays > 0 ? agenceDays / totalActiveDays : 0

    result[name] = { totalActiveDays, agenceDays, agenceRatio }
  }

  return result
}

/* ============================================================
   ASSIGNATION HEBDOMADAIRE ÉQUITABLE
   ============================================================ */

const ABSENCE_CATS = new Set(['CP', 'Indisponible', 'Récup', 'Formation'])

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

// Assignation ETP-stricte par jour avec cohérence hebdo
// weekFamilies = { name: fam } — shift établi au J1, sert de référence pour les jours suivants
function assignShifts(pool, dayNeeds, history, lastWeekShift, noAssignStreak, weekFamilies) {
  const assignments = {}
  const remaining   = new Set(pool.map(p => `${p.nom} ${p.prenom}`))
  const poolSize    = remaining.size
  const SHIFTS      = ['soir', 'aprem', 'midi', 'matin']
  const totalNeeded = SHIFTS.reduce((s, k) => s + (dayNeeds[k] || 0), 0)

  // Redimensionnement proportionnel si pool insuffisant (méthode des plus grandes restes)
  let effectiveNeeds = { soir: dayNeeds.soir || 0, aprem: dayNeeds.aprem || 0, midi: dayNeeds.midi || 0, matin: dayNeeds.matin || 0 }
  if (poolSize < totalNeeded && totalNeeded > 0) {
    const exact = {}
    let floored = 0
    for (const s of SHIFTS) {
      exact[s]          = (dayNeeds[s] || 0) * poolSize / totalNeeded
      effectiveNeeds[s] = Math.floor(exact[s])
      floored          += effectiveNeeds[s]
    }
    const leftover = poolSize - floored
    SHIFTS
      .map(s => ({ s, frac: exact[s] - effectiveNeeds[s] }))
      .sort((a, b) => b.frac - a.frac)
      .slice(0, leftover)
      .forEach(({ s }) => effectiveNeeds[s]++)
  }

  for (const shift of SHIFTS) {
    const count = effectiveNeeds[shift]
    if (!count) continue

    const candidates = [...remaining].map(name => {
      let score = equityScore(history, name, shift, lastWeekShift, noAssignStreak)
      const wf = weekFamilies?.[name]
      if      (wf === shift) score += 0.8   // même shift que J1 → fort bonus de cohérence
      else if (wf != null)   score -= 0.6   // shift différent de J1 → pénalité modérée
      return { name, score }
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))

    for (let i = 0; i < Math.min(count, candidates.length); i++) {
      assignments[candidates[i].name] = shift
      remaining.delete(candidates[i].name)
    }
  }

  for (const name of remaining) assignments[name] = ''
  return assignments
}


/* ============================================================
   PARSE ETP + FIXES DEPUIS EXCEL (sans toucher au store)
   Retourne { [iso]: { etp: number, fixed: { 'MACA': 'matin', ... } } }
   ============================================================ */

export async function parseEtpFromExcel(file) {
  const buffer = await file.arrayBuffer()
  const wb = read(buffer, { type: 'array', cellDates: true })

  let yearRef = parseInt(file.name.match(/20\d{2}/)?.[0]) || 0
  if (!yearRef) {
    const prevSheet = wb.SheetNames.find(n => n.toLowerCase().replace(/\s/g, '').includes('pr'))
    if (prevSheet) {
      const rows = utils.sheet_to_json(wb.Sheets[prevSheet], { header: 1, defval: null })
      for (let i = 9; i < rows.length; i++) {
        const dr = rows[i]?.[3]
        const d  = dr instanceof Date ? dr
          : (typeof dr === 'number' && dr > 30000 ? new Date(Math.round((dr - 25569) * 86400000)) : null)
        if (d && d.getFullYear() > 2000) { yearRef = d.getFullYear(); break }
      }
    }
    if (!yearRef) yearRef = new Date().getFullYear()
  }

  const weekSheets = wb.SheetNames.filter(n => /semaine/i.test(n))
  if (!weekSheets.length) throw new Error('Aucune feuille "semaine XX" trouvée dans le fichier')

  const DOW_PREFIX = { LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6, DIM: 0 }
  const FIXED_IDS  = ['MACA', 'ALRE']
  const result     = {}

  for (const sheetName of weekSheets) {
    const wRows = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })
    for (let i = 0; i < wRows.length; i++) {
      const row = wRows[i]
      if (!row || row[1] !== 'PREV') continue

      const etpRaw = row[6]
      let equipeRow = null
      for (let j = i + 1; j <= i + 4 && j < wRows.length; j++) {
        if (wRows[j]?.[0] === 'Equipe') { equipeRow = wRows[j]; break }
      }
      if (!equipeRow) continue

      const dateStr = typeof equipeRow[1] === 'string' ? equipeRow[1] : ''
      const match   = dateStr.match(/(\d{2})\/(\d{2})/)
      if (!match) continue

      const iso    = `${yearRef}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
      const prefix = dateStr.slice(0, 3).toUpperCase()
      const dow    = DOW_PREFIX[prefix] ?? new Date(iso + 'T12:00:00').getDay()
      if (dow === 0 || dow === 6 || isFerie(iso)) continue

      const etpNum = Math.round(Number(etpRaw))
      if (!etpRaw || isNaN(etpNum) || etpNum <= 0) continue

      // Personnes fixes (MACA, ALRE)
      const fixed = {}
      let blockEnd = wRows.length
      for (let k = i + 1; k < wRows.length; k++) {
        if (wRows[k]?.[1] === 'PREV') { blockEnd = k; break }
      }
      for (let j = i + 1; j < blockEnd; j++) {
        const r = wRows[j]
        if (!r) continue
        for (let col = 0; col < Math.min(r.length, 6); col++) {
          const cell = String(r[col] || '').trim().toUpperCase()
          if (!FIXED_IDS.includes(cell)) continue
          const rowText = r.map(c => String(c || '')).join(' ').toLowerCase()
          const fam = /soir/.test(rowText) ? 'soir'
                    : /apr/.test(rowText)  ? 'aprem'
                    : /midi/.test(rowText) ? 'midi'
                    : /mat/.test(rowText)  ? 'matin'
                    : null
          if (fam) fixed[cell] = fam
          break
        }
      }

      const dist = resolveEtpDist(etpNum)
      result[iso] = { etp: etpNum, fixed, matin: dist.matin, midi: dist.midi, aprem: dist.aprem, soir: dist.soir }
    }
  }

  if (!Object.keys(result).length) throw new Error('Aucune donnée valide trouvée dans les feuilles "semaine XX"')
  return result
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
  const appliedDayIds   = ref([])   // IDs Firestore écrits lors du dernier apply
  const appliedBackup   = ref({})   // { dayId: previousData | null } pour restauration
  const appliedCollection = ref('plannings') // collection utilisée lors du dernier apply

  // Prévisualisation en mémoire
  // preview.dates   = ['2026-05-01', ...]
  // preview.persons = ['NOM Prenom', ...]
  // preview.matrix[person][iso] = shiftName
  // preview.history[person]     = { matin, midi, aprem, soir, total }
  const preview    = ref(null)
  const previewing = ref(false)

  /* ── Parse le fichier Excel ── */
  //
  // Structure des fichiers XLSM de planning :
  //   - Feuilles "semaine XX" : une par semaine, avec pour chaque jour ouvré :
  //       • ligne PREV (col B = 'PREV', col G = ETP attendu pour ce jour)
  //       • ligne Equipe (col A = 'Equipe', col B = 'LUN 06/07' — date du jour)
  //   - L'ETP est lu en col G de chaque ligne PREV (valeur saisie directement
  //     par les managers, indépendante des formules complexes de la feuille Prévisions)
  //
  async function parseExcel(file) {
    parsing.value    = true
    parseError.value = ''
    forecast.value   = null
    preview.value    = null
    fileName.value   = file.name

    try {
      const buffer = await file.arrayBuffer()
      const wb = read(buffer, { type: 'array', cellDates: true })

      // ── Déterminer l'année de référence ──
      // Source 1 : nom du fichier (ex: "Planning FO Juillet 2026.xlsm")
      // Source 2 : première date lisible dans la feuille Prévisions
      // Source 3 : année courante
      let yearRef = parseInt(file.name.match(/20\d{2}/)?.[0]) || 0
      if (!yearRef) {
        const prevSheet = wb.SheetNames.find(n =>
          n.toLowerCase().replace(/\s/g, '').includes('pr')
        )
        if (prevSheet) {
          const prevRows = utils.sheet_to_json(wb.Sheets[prevSheet], { header: 1, defval: null })
          for (let i = 9; i < prevRows.length; i++) {
            const dr = prevRows[i]?.[3]
            const d  = dr instanceof Date ? dr
              : (typeof dr === 'number' && dr > 30000
                  ? new Date(Math.round((dr - 25569) * 86400000))
                  : null)
            if (d && d.getFullYear() > 2000) { yearRef = d.getFullYear(); break }
          }
        }
        if (!yearRef) yearRef = new Date().getFullYear()
      }

      // ── Lire les feuilles "semaine XX" ──
      // Chaque feuille contient N blocs jour, chacun composé de :
      //   • une ligne PREV  → col B = 'PREV',   col G = ETP du jour
      //   • une ligne Equipe → col A = 'Equipe', col B = 'LUN 06/07' (date)
      const weekSheets = wb.SheetNames.filter(n => /semaine/i.test(n))
      if (!weekSheets.length)
        throw new Error('Aucune feuille "semaine XX" trouvée dans le fichier')

      const DOW_PREFIX  = { LUN: 1, MAR: 2, MER: 3, JEU: 4, VEN: 5, SAM: 6, DIM: 0 }
      const FIXED_IDS   = ['MACA', 'ALRE']   // personnes fixes pré-remplies dans l'Excel
      const result = {}

      for (const sheetName of weekSheets) {
        const wRows = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })

        for (let i = 0; i < wRows.length; i++) {
          const row = wRows[i]
          if (!row || row[1] !== 'PREV') continue   // chercher les lignes PREV

          const etpRaw = row[6]   // col G = ETP (R Run)

          // Trouver la ligne "Equipe" suivante (dans les 4 lignes qui suivent)
          let equipeRow = null
          for (let j = i + 1; j <= i + 4 && j < wRows.length; j++) {
            if (wRows[j]?.[0] === 'Equipe') { equipeRow = wRows[j]; break }
          }
          if (!equipeRow) continue

          // Extraire la date depuis "LUN 06/07", "SAM 11/07", etc.
          const dateStr = typeof equipeRow[1] === 'string' ? equipeRow[1] : ''
          const match   = dateStr.match(/(\d{2})\/(\d{2})/)
          if (!match) continue

          const day = parseInt(match[1], 10)
          const mon = parseInt(match[2], 10)
          const iso = `${yearRef}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // Jour de la semaine depuis le préfixe ("LUN", "MAR", …)
          const prefix = dateStr.slice(0, 3).toUpperCase()
          const dow    = DOW_PREFIX[prefix] ?? new Date(iso + 'T12:00:00').getDay()

          if (dow === 0 || dow === 6) continue  // skip dimanche et samedi
          if (isFerie(iso)) continue      // skip jours fériés

          const etpNum = Math.round(Number(etpRaw))
          if (!etpRaw || isNaN(etpNum) || etpNum <= 0) continue

          // ── Détecter les personnes fixes (MACA, ALRE) dans ce bloc jour ──
          // On scanne toutes les lignes du bloc jusqu'à la prochaine ligne PREV.
          // Pour chaque personne fixe trouvée, on lit le shift dans les cellules de la même ligne.
          const fixed = {}
          let blockEnd = wRows.length
          for (let k = i + 1; k < wRows.length; k++) {
            if (wRows[k]?.[1] === 'PREV') { blockEnd = k; break }
          }
          for (let j = i + 1; j < blockEnd; j++) {
            const r = wRows[j]
            if (!r) continue
            for (let col = 0; col < Math.min(r.length, 6); col++) {
              const cell = String(r[col] || '').trim().toUpperCase()
              if (!FIXED_IDS.includes(cell)) continue
              // Lire le shift depuis le contenu textuel de toute la ligne
              const rowText = r.map(c => String(c || '')).join(' ').toLowerCase()
              const fam = /soir/.test(rowText)  ? 'soir'
                        : /apr/.test(rowText)   ? 'aprem'
                        : /midi/.test(rowText)  ? 'midi'
                        : /mat/.test(rowText)   ? 'matin'
                        : null
              if (fam) fixed[cell] = fam
              break
            }
          }

          const dist = resolveEtpDist(etpNum)
          result[iso] = {
            jourSemaine: JOURS[dow],
            etp:   etpNum,
            matin: dist.matin,
            midi:  dist.midi,
            aprem: dist.aprem,
            soir:  dist.soir,
            isSam: dow === 6,
            fixed,   // { 'MACA': 'matin', 'ALRE': 'soir' } — peut être vide
          }
        }
      }

      if (!Object.keys(result).length)
        throw new Error('Aucune donnée valide trouvée dans les feuilles "semaine XX"')

      forecast.value = result
    } catch (e) {
      parseError.value = e.message
    } finally {
      parsing.value = false
    }
  }

  /* ── Prévisualisation : assignation journalière ETP-stricte ── */
  async function previewPlanningWeekly({ persons, planningData }) {
    if (!forecast.value || !persons.length) return
    const admin = useAdminStore()

    previewing.value = true
    preview.value    = null

    const runPersons = persons.filter(p => p.onRun !== false)
    const history    = analyzeHistory(planningData)
    const dates      = Object.keys(forecast.value).sort()

    // Groupement par semaine ISO
    const weekGroups = {}
    for (const iso of dates) {
      const wk = isoWeekKey(iso)
      if (!weekGroups[wk]) weekGroups[wk] = []
      weekGroups[wk].push(iso)
    }

    const matrix         = {}
    const allNames       = new Set()
    const activeByDate   = {}   // { iso: Set<name> } — personnes actives par jour
    const lastWeekShift  = {}   // { name: fam } — pour l'équité inter-semaines
    const noAssignStreak = {}
    const boWeeksUsed    = {}

    // ── Stats historiques (visualisation uniquement — ne servent pas au tri) ──
    const personStats   = computePersonStats(planningData, runPersons)

    // ── Compteur jours Agence intra-calcul (round-robin équitable) ──
    // Un slot vide dans le forecast = journée Agence en pratique.
    // Tri primaire  : monthRestDays croissant → round-robin (1 Agence chacun avant 2)
    // Tri secondaire : agenceRatio CROISSANT → à égalité, celui qui a le MOINS d'Agence
    //   historiquement passe en premier (pour rattraper son retard et égaliser le ratio)
    // Tri tertiaire : alphabétique pour la stabilité
    const monthRestDays = {}   // { name: n } — jours Agence attribués dans ce calcul

    const sortedWeeks = Object.entries(weekGroups).sort(([a], [b]) => a.localeCompare(b))

    for (const [, weekDates] of sortedWeeks) {
      const workDates = weekDates  // plus de samedis dans le forecast

      const refDate      = new Date((workDates[0] || weekDates[0]) + 'T12:00:00')
      const activePeople = runPersons
        .filter(p => admin.isActiveOn(p, refDate))
        .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
      activePeople.forEach(p => allNames.add(`${p.nom} ${p.prenom}`))

      // Enregistrer les personnes actives pour chaque jour de cette semaine
      const activeNames = new Set(activePeople.map(p => `${p.nom} ${p.prenom}`))
      for (const iso of weekDates) activeByDate[iso] = activeNames

      // ── 1. Absences jour par jour ──
      const dayAbsences = {}   // { name: { iso: categorie } }
      for (const p of activePeople) {
        const name = `${p.nom} ${p.prenom}`
        dayAbsences[name] = {}
        for (const iso of workDates) {
          const cat = getAbsenceForDay(planningData, name, iso)
          if (cat) dayAbsences[name][iso] = cat
        }
      }
      for (const [name, absMap] of Object.entries(dayAbsences)) {
        if (!matrix[name]) matrix[name] = {}
        for (const [iso, cat] of Object.entries(absMap)) matrix[name][iso] = cat
      }

      // ── 2. Pool disponible (toutes les personnes actives, les absences sont gérées jour par jour) ──
      const available    = activePeople
      const weekRestDays = {}   // { name: n } — jours Agence/vides cette semaine (max 2)

      // ── 3. Attribution BO (hebdomadaire, par rotation équitable) ──
      const boNames = new Set()
      if (maxBO.value > 0 && workDates.length) {
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

      if (workDates.length) {
        // ── 4. Assignation JOURNALIÈRE ETP-stricte ──
        // weekFamilies = référence cohérence établie au 1er jour ouvré
        const weekFamilies = {}    // { name: fam }
        const dayFamilyMap = {}    // { iso: { name: fam } }

        for (const iso of workDates) {
          const fc       = forecast.value[iso]
          const dayNeeds = { matin: fc.matin, midi: fc.midi, aprem: fc.aprem, soir: fc.soir }

          // ── Personnes fixes (MACA, ALRE) : écrire leur shift et réduire le besoin ETP ──
          for (const [fixedName, fam] of Object.entries(fc.fixed || {})) {
            if (!matrix[fixedName]) matrix[fixedName] = {}
            matrix[fixedName][iso] = SITE_NAME[fam] || fam
            if (dayNeeds[fam] > 0) dayNeeds[fam]--
          }

          const totalNeeded = dayNeeds.matin + dayNeeds.midi + dayNeeds.aprem + dayNeeds.soir

          // Pool du jour : disponibles, non absents, non BO
          const pool = available.filter(p => {
            const name = `${p.nom} ${p.prenom}`
            return !boNames.has(name) && !dayAbsences[name]?.[iso]
          })

          // ── Rotation équitable des jours Agence (slots vides) ──
          // Limite : 2 jours vides max par personne par semaine.
          // Les CP / Indisponibles sont déjà exclus du pool en amont → aucun risque de conflit.
          const surplus = pool.length - totalNeeded
          let assignPool = pool

          if (surplus > 0) {
            // Seuls ceux qui n'ont pas encore atteint 2 jours vides cette semaine sont éligibles
            const restEligible = pool.filter(p => (weekRestDays[`${p.nom} ${p.prenom}`] || 0) < 2)
            const restCount    = Math.min(surplus, restEligible.length)

            const sorted = [...restEligible].sort((a, b) => {
              const na = `${a.nom} ${a.prenom}`, nb = `${b.nom} ${b.prenom}`
              // 1. Moins de jours Agence ce calcul → passe en premier (round-robin mensuel)
              const offDiff = (monthRestDays[na] || 0) - (monthRestDays[nb] || 0)
              if (offDiff !== 0) return offDiff
              // 2. Moins d'Agence historique → passe en premier (rattrapage du ratio)
              const agenceDiff = (personStats[na]?.agenceRatio ?? 0) - (personStats[nb]?.agenceRatio ?? 0)
              if (agenceDiff !== 0) return agenceDiff
              // 3. Alphabétique pour la stabilité
              return na.localeCompare(nb, 'fr')
            })

            const resting     = sorted.slice(0, restCount)
            const restingNames = new Set(resting.map(p => `${p.nom} ${p.prenom}`))
            assignPool        = pool.filter(p => !restingNames.has(`${p.nom} ${p.prenom}`))

            for (const p of resting) {
              const name = `${p.nom} ${p.prenom}`
              if (!matrix[name]) matrix[name] = {}
              if (!matrix[name][iso]) {
                matrix[name][iso] = ''
                monthRestDays[name] = (monthRestDays[name] || 0) + 1
                weekRestDays[name]  = (weekRestDays[name]  || 0) + 1
              }
            }
          }

          dayFamilyMap[iso] = assignShifts(assignPool, dayNeeds, history, lastWeekShift, noAssignStreak, weekFamilies)

          // Le 1er jour ouvré fixe la référence de cohérence pour le reste de la semaine
          if (iso === workDates[0]) {
            for (const [name, fam] of Object.entries(dayFamilyMap[iso])) {
              if (fam) weekFamilies[name] = fam
            }
          }
        }

        // ── 5. TLT : 2 jours max/personne/semaine, pas mercredi, ≤50%/famille/jour ──
        const nonWedDays = workDates.filter(iso => new Date(iso + 'T12:00:00').getDay() !== 3)
        const tltAllowed = new Set(
          available
            .filter(p => p.peutTLT !== false && !boNames.has(`${p.nom} ${p.prenom}`))
            .map(p => `${p.nom} ${p.prenom}`)
        )

        // Comptage famille par jour (pour le cap TLT)
        const famCountPerDay = {}
        for (const iso of workDates) {
          famCountPerDay[iso] = {}
          for (const fam of Object.values(dayFamilyMap[iso])) {
            if (fam) famCountPerDay[iso][fam] = (famCountPerDay[iso][fam] || 0) + 1
          }
        }

        const tltDays        = new Set()   // 'name|iso'
        const personTltCount = {}
        const dayTltFamCount = {}
        for (const iso of nonWedDays) dayTltFamCount[iso] = {}

        for (let pass = 0; pass < 2; pass++) {
          const eligible = [...tltAllowed]
            .sort((a, b) => (personTltCount[a] || 0) - (personTltCount[b] || 0) || a.localeCompare(b, 'fr'))

          for (const name of eligible) {
            if ((personTltCount[name] || 0) !== pass) continue
            const day = nonWedDays.find(iso => {
              const fam = dayFamilyMap[iso]?.[name]
              if (!fam || tltDays.has(`${name}|${iso}`)) return false
              const total = famCountPerDay[iso][fam] || 1
              return (dayTltFamCount[iso][fam] || 0) < Math.max(1, Math.floor(total / 2))
            })
            if (!day) continue
            const fam = dayFamilyMap[day][name]
            tltDays.add(`${name}|${day}`)
            dayTltFamCount[day][fam] = (dayTltFamCount[day][fam] || 0) + 1
            personTltCount[name]     = (personTltCount[name] || 0) + 1
          }
        }

        // ── 6. Écriture dans la matrice ──
        for (const iso of workDates) {
          for (const p of available) {
            const name = `${p.nom} ${p.prenom}`
            if (!matrix[name]) matrix[name] = {}
            if (matrix[name][iso]) continue   // ne pas écraser absences / BO
            const fam = dayFamilyMap[iso]?.[name]
            if (!fam) { matrix[name][iso] = ''; continue }
            matrix[name][iso] = tltDays.has(`${name}|${iso}`) ? TLT_VARIANT[fam] : SITE_NAME[fam]
          }
        }

        // ── 7. Mise à jour historique inter-semaines ──
        // On comptabilise le shift dominant réellement attribué cette semaine
        const weekCounts = {}   // { name: { fam: n } }
        for (const iso of workDates) {
          for (const [name, fam] of Object.entries(dayFamilyMap[iso])) {
            if (!fam) continue
            if (!weekCounts[name]) weekCounts[name] = {}
            weekCounts[name][fam] = (weekCounts[name][fam] || 0) + 1
          }
        }
        for (const p of activePeople) {
          const name = `${p.nom} ${p.prenom}`
          if (boNames.has(name)) continue
          const counts   = weekCounts[name] || {}
          const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
          if (dominant) {
            if (!history[name]) history[name] = { matin: 0, midi: 0, aprem: 0, soir: 0, total: 0 }
            history[name][dominant]++
            history[name].total++
            lastWeekShift[name]  = dominant
            noAssignStreak[name] = 0
          } else if (!Object.keys(dayAbsences[name] || {}).length) {
            noAssignStreak[name] = (noAssignStreak[name] || 0) + 1
          }
        }
      }

    }

    // ── Collecter les noms des personnes fixes présentes dans le forecast ──
    const fixedPersons = new Set()
    for (const fc of Object.values(forecast.value)) {
      for (const name of Object.keys(fc.fixed || {})) fixedPersons.add(name)
    }

    // ── Sauvegarde ETP + répartition + fixes en base AVANT d'afficher la preview ──
    // (merge:true → ne touche pas aux ressources existantes)
    await Promise.all(
      Object.entries(forecast.value).map(([iso, fcDay]) => {
        const [y, m, d] = iso.split('-').map(Number)
        return admin.saveEtpAndFixed(new Date(y, m - 1, d), {
          etp:   fcDay.etp   ?? 0,
          fixed: fcDay.fixed ?? {},
          matin: fcDay.matin ?? null,
          midi:  fcDay.midi  ?? null,
          aprem: fcDay.aprem ?? null,
          soir:  fcDay.soir  ?? null,
        }).catch(() => {})
      })
    )

    preview.value = {
      dates,
      // Personnes fixes en tête (toujours visibles), puis pool trié alphabétiquement
      persons:  [...fixedPersons, ...[...allNames].sort((a, b) => a.localeCompare(b, 'fr'))],
      matrix,
      activeByDate,
      fixedPersons,  // Set<name> — lignes non-éditables dans la prévisualisation
      history:  analyzeHistory(
        Object.fromEntries(
          Object.entries(planningData).filter(([name]) =>
            runPersons.some(p => `${p.nom} ${p.prenom}` === name)
          )
        )
      ),
      personStats,  // { 'NOM Prenom': { totalActiveDays, workedDays, absenceDays, offDays, offRatio } }
    }

    previewing.value = false
  }

  /* ── Applique la prévisualisation en Firestore ── */
  async function applyPreview({ persons, overwrite = false, collection = 'plannings', onProgress }) {
    if (!preview.value || !forecast.value) return
    const admin = useAdminStore()
    const { useDataStore } = await import('./dataStore')

    generating.value    = true
    genResults.value    = null
    appliedDayIds.value = []
    appliedBackup.value = {}

    let done = 0, skipped = 0, errors = 0
    const writtenIds   = []
    const backup       = {}
    const notifChanges = []  // { uid, isoDate } pour les notifications groupées
    const { dates, matrix } = preview.value
    const nameToUid = useDataStore().nameToUid
    let processed = 0

    for (const iso of dates) {
      processed++
      if (onProgress) onProgress(processed, dates.length)

      try {
        const date  = new Date(iso + 'T12:00:00')
        const dayId = admin.dateToId(date)

        // Toujours charger le doc existant : sert au check overwrite ET au backup undo
        const snap = await getDoc(doc(db, collection, dayId))

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

        // Index des ressources existantes par nom (pour préserver les absences)
        const existingByName = {}
        if (snap.exists()) {
          for (const r of snap.data().ressources || []) {
            existingByName[`${r.nom} ${r.prenom}`] = r
          }
        }

        const ressources = activePeople.map(p => {
          const name     = `${p.nom} ${p.prenom}`
          const shift    = matrix[name]?.[iso] || ''
          const existing = existingByName[name]
          // Ne jamais écraser CP, Indispo, Récup, Formation, Astreinte, RH
          if (existing && hasProtectedActivity(existing.activites)) {
            return existing
          }
          return {
            nom:        p.nom,
            prenom:     p.prenom,
            idPersonne: p.uid || p.id || '',
            activites:  shift ? buildActivites(shift) : new Array(45).fill(''),
          }
        })

        // Conserver l'ETP Excel et les horaires fixes (MACA/ALRE) dans le document
        const fcDay = forecast.value[iso]
        const etp   = fcDay?.etp   ?? 0
        const fixed = fcDay?.fixed ?? {}

        await setDoc(doc(db, collection, dayId), { ressources, etp, fixed })
        writtenIds.push(dayId)
        done++

        // Collecte les notifications (prod uniquement, dans les 15 jours)
        if (collection === 'plannings') {
          for (const p of activePeople) {
            const name   = `${p.nom} ${p.prenom}`
            const uid    = nameToUid[name]
            const shift  = matrix[name]?.[iso] || ''
            if (uid) notifChanges.push({ uid, isoDate: iso, detail: shift || 'Non affecté' })
          }
        }
      } catch (e) {
        console.error(`Erreur application ${iso}:`, e)
        errors++
      }
    }

    appliedDayIds.value     = writtenIds
    appliedBackup.value     = backup
    appliedCollection.value = collection
    genResults.value    = { done, skipped, errors, total: dates.length, collection }
    generating.value    = false

    // Envoi groupé des notifications après la fin de l'écriture
    if (notifChanges.length) {
      const { batchNotifyPlanningChanges } = await import('@/services/notificationService')
      batchNotifyPlanningChanges(notifChanges)
    }
  }

  /* ── Annule le dernier apply (supprime les documents écrits) ── */
  async function undoApply({ onProgress } = {}) {
    if (!appliedDayIds.value.length) return
    undoing.value = true
    const ids   = [...appliedDayIds.value]
    const backup = appliedBackup.value
    const coll  = appliedCollection.value
    let n = 0
    for (const dayId of ids) {
      try {
        const previous = backup[dayId]
        if (previous) {
          await setDoc(doc(db, coll, dayId), previous)
        } else {
          await deleteDoc(doc(db, coll, dayId))
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

  /* ── Modifie une cellule de la matrice à la volée ── */
  function setMatrixCell(person, iso, shift) {
    if (!preview.value) return
    if (!preview.value.matrix[person]) preview.value.matrix[person] = {}
    preview.value.matrix[person][iso] = shift
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
    parseExcel, previewPlanningWeekly, applyPreview, undoApply, setMatrixCell, reset,
  }
})
