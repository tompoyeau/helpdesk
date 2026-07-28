/**
 * statsStore.js — Gestionnaire centralisé de statistiques planning
 *
 * Source de vérité unique pour tous les calculs de jours / ratios.
 * Utilisé par : AdminStats, PersonDetail, GlobalStats, CatDetail, forecastStore.
 *
 * Principe :
 *   • Unité de base : le créneau (slot) de 15 min.
 *   • 1 journée complète = SLOTS_PER_DAY (30) créneaux.
 *   • Shifts normaux (site / tlt / agence) : slots accumulés librement → ÷ 30.
 *   • Absences (CP / Indisponible / Récup)  : plafonnées à 1j par date
 *       → min(slotsJour / 30, 1), puis sommées sur la période.
 *
 * Taxonomie canonique — chaque catégorie appartient à :
 *   • un horaire  : 'matin' | 'midi' | 'aprem' | 'soir' | null
 *   • un mode     : 'site' | 'tlt' | 'agence' | 'cp' | 'indispo' | 'recup'
 *                   | 'formation' | 'bo' | 'autre'
 *
 * Familles exclusives pour la distribution (somme = 100 % de workDays) :
 *   site-matin | site-midi | site-aprem | site-soir | tlt | agence
 */

/* ============================================================
   CONSTANTES EXPORTÉES
   ============================================================ */

export const SLOTS_PER_DAY = 30

/**
 * Taxonomie complète des catégories.
 * `capped: true`  → calcul par date (max 1j/jour) — absences
 * `capped: false` → accumulation libre sur la période — shifts
 */
export const CAT_MAP = {
  // ── Site RUN pur ──────────────────────────────────────────
  'Matin':            { horaire: 'matin', mode: 'site',      capped: false },
  'MatinW11':         { horaire: 'matin', mode: 'w11',       capped: false },
  'Midi':             { horaire: 'midi',  mode: 'site',      capped: false },
  'Aprem':            { horaire: 'aprem', mode: 'site',      capped: false },
  'ApremRenf':        { horaire: 'aprem', mode: 'site',      capped: false },
  'Soir':             { horaire: 'soir',  mode: 'site',      capped: false },
  'SoirW11':          { horaire: 'soir',  mode: 'w11',       capped: false },
  // ── Télétravail ───────────────────────────────────────────
  'TLT Matin':        { horaire: 'matin', mode: 'tlt',       capped: false },
  'TLT Midi':         { horaire: 'midi',  mode: 'tlt',       capped: false },
  'TLT APREM':        { horaire: 'aprem', mode: 'tlt',       capped: false },
  'TLT Soir':         { horaire: 'soir',  mode: 'tlt',       capped: false },
  'TLT Agence Matin': { horaire: 'matin', mode: 'tlt_agence', capped: false },
  'TLT Agence Midi':  { horaire: 'midi',  mode: 'tlt_agence', capped: false },
  'TLT Agence APREM': { horaire: 'aprem', mode: 'tlt_agence', capped: false },
  'TLT Agence Soir':  { horaire: 'soir',  mode: 'tlt_agence', capped: false },
  // ── Journées vertes / Agence (site non-RUN) ───────────────
  'Agence Matin':     { horaire: 'matin', mode: 'agence',    capped: false },
  'Agence Midi':      { horaire: 'midi',  mode: 'agence',    capped: false },
  'Agence APREM':     { horaire: 'aprem', mode: 'agence',    capped: false },
  'Agence Soir':      { horaire: 'soir',  mode: 'agence',    capped: false },
  // ── Absences (plafonnées à 1j/date) ──────────────────────
  'CP':               { horaire: null,    mode: 'cp',        capped: true  },
  'Indisponible':     { horaire: null,    mode: 'indispo',   capped: true  },
  'Récup':            { horaire: null,    mode: 'recup',     capped: true  },
  // ── Autres (accumulation libre) ──────────────────────────
  'Formation':        { horaire: 'aprem', mode: 'site',      capped: false },
  'BO':               { horaire: null,    mode: 'bo',        capped: false },
  'PiloteBO':         { horaire: null,    mode: 'bo',        capped: false },
  'BOTLT':            { horaire: null,    mode: 'tlt',       capped: false },
  'Pilote':           { horaire: null,    mode: 'autre',     capped: false },
  'Astreinte':        { horaire: null,    mode: 'autre',     capped: false },
  'RH':               { horaire: null,    mode: 'autre',     capped: false },
}

/* ── Jours fériés français — calcul algorithmique ── */

/** Dimanche de Pâques (algorithme anonyme grégorien) */
function computeEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Retourne le Set des 11 jours fériés métropole pour une année donnée */
function feriesForYear(year) {
  const e   = computeEaster(year)
  const add = (date, n) => { const r = new Date(date); r.setDate(r.getDate() + n); return r }
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return new Set([
    `${year}-01-01`,   // Jour de l'An
    iso(add(e,  1)),   // Lundi de Pâques
    `${year}-05-01`,   // Fête du Travail
    `${year}-05-08`,   // Victoire 1945
    iso(add(e, 39)),   // Ascension
    iso(add(e, 50)),   // Lundi de Pentecôte
    `${year}-07-14`,   // Fête Nationale
    `${year}-08-15`,   // Assomption
    `${year}-11-01`,   // Toussaint
    `${year}-11-11`,   // Armistice
    `${year}-12-25`,   // Noël
  ])
}

/** Cache par année pour éviter de recalculer plusieurs fois */
const _feriesCache = new Map()

/**
 * Retourne true si la date ISO donnée est un jour férié français (métropole).
 * Couvre n'importe quelle année sans mise à jour manuelle.
 */
export function isFerie(isoDate) {
  const year = +isoDate.slice(0, 4)
  if (!_feriesCache.has(year)) _feriesCache.set(year, feriesForYear(year))
  return _feriesCache.get(year).has(isoDate)
}

/* ============================================================
   HELPERS INTERNES
   ============================================================ */

const HORAIRES    = ['matin', 'midi', 'aprem', 'soir']
const MODES_WORK  = ['site', 'tlt', 'tlt_agence', 'agence', 'w11']
const MODES_ABS   = ['cp', 'indispo', 'recup']

/** Crée un objet horaire × mode vide (slots = 0) */
function emptyHm() {
  return {
    matin: { site: 0, tlt: 0, tlt_agence: 0, agence: 0, w11: 0 },
    midi:  { site: 0, tlt: 0, tlt_agence: 0, agence: 0, w11: 0 },
    aprem: { site: 0, tlt: 0, tlt_agence: 0, agence: 0, w11: 0 },
    soir:  { site: 0, tlt: 0, tlt_agence: 0, agence: 0, w11: 0 },
  }
}

/** Arrondi à 1 décimale */
function r1(v) { return Math.round(v * 10) / 10 }

/** Catégories plafonnées à 1j/date (dérivé de CAT_MAP) */
const CAPPED_CATS_SET = new Set(
  Object.entries(CAT_MAP).filter(([, v]) => v.capped).map(([k]) => k)
)

/**
 * Calcule les statistiques finales à partir des slots bruts.
 * Utilisé aussi bien pour une personne que pour l'agrégat équipe.
 *
 * @param {object} hm        - slots par { horaire × mode }
 * @param {object} capped    - { cp, indispo, recup } — déjà en jours (plafonnés)
 * @param {number} [n=1]     - nombre de personnes (pour les moyennes équipe)
 */
function statsFromRaw(hm, capped, extra = {}, n = 1) {
  const otherTlt   = extra.tlt   || 0   // BOTLT : télétravail sans horaire → compte comme TLT
  const otherAutre = extra.autre || 0   // BO / Pilote / Astreinte / RH : travaillé mais « autre »

  // ── Slots travaillés par horaire ──────────────────────────────
  const matinS  = hm.matin.site + hm.matin.tlt + hm.matin.tlt_agence + hm.matin.agence + hm.matin.w11
  const midiS   = hm.midi.site  + hm.midi.tlt  + hm.midi.tlt_agence  + hm.midi.agence
  const apremS  = hm.aprem.site + hm.aprem.tlt + hm.aprem.tlt_agence + hm.aprem.agence
  const soirS   = hm.soir.site  + hm.soir.tlt  + hm.soir.tlt_agence  + hm.soir.agence  + hm.soir.w11
  const horaireS = matinS + midiS + apremS + soirS       // slots avec horaire
  // Total travaillé = horaires + BOTLT + autre (BO, Pilote, Astreinte, RH)
  const workS   = horaireS + otherTlt + otherAutre

  // ── Slots travaillés par mode ─────────────────────────────────
  const tltHoraireS = HORAIRES.reduce((s, h) => s + hm[h].tlt + hm[h].tlt_agence, 0)
  const tltS    = tltHoraireS + otherTlt      // TLT total (domicile + agence + BOTLT)
  const agenceS = HORAIRES.reduce((s, h) => s + hm[h].agence, 0)
  const siteS   = horaireS - tltHoraireS - agenceS   // « site » = horaires hors TLT/Agence

  // ── Absences (déjà en jours, plafonnées par date) ─────────────
  const cpJ      = capped.cp      || 0
  const indispoJ = capped.indispo || 0
  const recupJ   = capped.recup   || 0
  const absentJ  = cpJ + indispoJ + recupJ

  // ── Conversion slots → jours (pas d'arrondi intermédiaire) ────
  const spd   = SLOTS_PER_DAY
  const wDays = workS  / spd      // jours travaillés (float)

  // ── Taux : base = slots travaillés (pas d'erreur d'arrondi) ───
  const rate = (slots) => workS > 0 ? Math.round(slots / workS * 100) : 0

  // ── Distribution exclusive → somme = 100 % workDays ─
  // site-matin + site-midi + site-aprem + site-soir + tlt + agence + autre = 100 %
  const dist = {
    matin:  rate(hm.matin.site + hm.matin.w11),  // w11 inclus pour que dist somme à 100 %
    midi:   rate(hm.midi.site),
    aprem:  rate(hm.aprem.site),
    soir:   rate(hm.soir.site  + hm.soir.w11),
    tlt:    rate(tltS),
    agence: rate(agenceS),
    autre:  rate(otherAutre),   // BO / Pilote / Astreinte / RH
  }

  return {
    // ── Jours par horaire (toutes variantes confondues) ──────────
    workDays:    r1(wDays),
    matinDays:   r1(matinS  / spd),
    midiDays:    r1(midiS   / spd),
    apremDays:   r1(apremS  / spd),
    soirDays:    r1(soirS   / spd),

    // ── Jours par mode ───────────────────────────────────────────
    siteDays:    r1(siteS   / spd),
    tltDays:     r1(tltS    / spd),
    agenceDays:  r1(agenceS / spd),
    otherDays:   r1(otherAutre / spd),   // BO / Pilote / Astreinte / RH (hors BOTLT, compté en TLT)

    // ── Absences ─────────────────────────────────────────────────
    cpDays:      r1(cpJ),
    indispoDays: r1(indispoJ),
    recupDays:   r1(recupJ),
    absentDays:  r1(absentJ),

    // ── Taux (% de workDays) ─────────────────────────────────────
    tauxTlt:    rate(tltS),
    tauxAgence: rate(agenceS),
    tauxMatin:  rate(matinS),
    tauxMidi:   rate(midiS),
    tauxAprem:  rate(apremS),
    tauxSoir:   rate(soirS),

    // ── Distribution exclusive (AdminStats) ──────────────────────
    dist,

    // ── Détail horaire × mode (PersonDetail, CatDetail) ──────────
    // Valeurs en jours
    detail: {
      matin: { site: r1(hm.matin.site/spd), tlt: r1(hm.matin.tlt/spd), tlt_agence: r1(hm.matin.tlt_agence/spd), agence: r1(hm.matin.agence/spd), w11: r1(hm.matin.w11/spd) },
      midi:  { site: r1(hm.midi.site/spd),  tlt: r1(hm.midi.tlt/spd),  tlt_agence: r1(hm.midi.tlt_agence/spd),  agence: r1(hm.midi.agence/spd)  },
      aprem: { site: r1(hm.aprem.site/spd), tlt: r1(hm.aprem.tlt/spd), tlt_agence: r1(hm.aprem.tlt_agence/spd), agence: r1(hm.aprem.agence/spd) },
      soir:  { site: r1(hm.soir.site/spd),  tlt: r1(hm.soir.tlt/spd),  tlt_agence: r1(hm.soir.tlt_agence/spd),  agence: r1(hm.soir.agence/spd),  w11: r1(hm.soir.w11/spd)  },
    },

    // ── Moyennes par personne (pour computeTeamStats) ───────────
    // Divisé par n — identiques à workDays etc. quand n=1
    avgWorkDays:   r1(wDays       / n),
    avgMatinDays:  r1(matinS/spd  / n),
    avgMidiDays:   r1(midiS/spd   / n),
    avgApremDays:  r1(apremS/spd  / n),
    avgSoirDays:   r1(soirS/spd   / n),
    avgTltDays:    r1(tltS/spd    / n),
    avgAgenceDays: r1(agenceS/spd / n),
    avgOtherDays:  r1(otherAutre/spd / n),
    avgAbsentDays: r1(absentJ     / n),
  }
}

/* ============================================================
   API PUBLIQUE
   ============================================================ */

/**
 * Calcule les statistiques d'une personne sur une période donnée.
 *
 * @param {object} planningData  - data.planning du dataStore
 * @param {string} personName    - "NOM Prenom"
 * @param {object} opts
 * @param {string} opts.startIso - 'YYYY-MM-DD' (borne incluse)
 * @param {string} opts.endIso   - 'YYYY-MM-DD' (borne incluse)
 * @returns {object} stats + _raw (pour agrégation équipe)
 */
export function computePersonStats(planningData, personName, { startIso, endIso }) {
  const hm      = emptyHm()
  const capped  = { cp: 0, indispo: 0, recup: 0 }
  let   otherTltS   = 0   // BOTLT : télétravail sans horaire (compté en TLT)
  let   otherAutreS = 0   // BO, Pilote, Astreinte, RH : travaillé mais « autre »

  const pData = planningData[personName] || {}

  for (const [iso, entries] of Object.entries(pData)) {
    // Filtre fenêtre temporelle
    if (iso < startIso || iso > endIso) continue
    // Filtre week-end et jours fériés
    const dt = new Date(iso + 'T12:00:00')
    if (dt.getDay() === 0 || isFerie(iso)) continue   // exclut dimanche + fériés (samedi compté)

    // Accumulation des absences plafonnées par date
    const dayAbsSlots = { cp: 0, indispo: 0, recup: 0 }

    for (const e of entries) {
      const map = CAT_MAP[e.categorie]
      if (!map) continue
      const s = e.slots || 0
      if (s <= 0) continue

      if (map.capped) {
        // Absence : accumulation intra-jour, plafonnée après
        dayAbsSlots[map.mode] += s
      } else if (map.horaire) {
        // Shift avec horaire (site/tlt/agence + Formation) : accumulation directe
        hm[map.horaire][map.mode] += s
      } else if (map.mode === 'tlt') {
        // BOTLT : télétravail sans horaire → compté comme TLT
        otherTltS += s
      } else {
        // Travaillé sans horaire (BO, PiloteBO, Pilote, Astreinte, RH)
        otherAutreS += s
      }
    }

    // Plafonnement des absences à 1j/date : min(slots / 30, 1)
    for (const mode of MODES_ABS) {
      if (dayAbsSlots[mode] > 0) {
        capped[mode] += Math.min(dayAbsSlots[mode] / SLOTS_PER_DAY, 1)
      }
    }
  }

  const stats = statsFromRaw(hm, capped, { tlt: otherTltS, autre: otherAutreS })

  return {
    ...stats,
    // Slots bruts conservés pour l'agrégation équipe (computeTeamStats)
    _raw: { hm, otherTlt: otherTltS, otherAutre: otherAutreS, cp: capped.cp, indispo: capped.indispo, recup: capped.recup },
  }
}

/**
 * Calcule les statistiques agrégées d'une équipe.
 * Prend en entrée un tableau de résultats de computePersonStats.
 *
 * Les taux (tauxTlt, dist.*, …) sont calculés sur la somme des slots
 * de toute l'équipe — pas une moyenne des taux individuels.
 *
 * @param {object[]} personStatsList - résultats de computePersonStats
 * @returns {object|null}
 */
export function computeTeamStats(personStatsList) {
  const list = personStatsList.filter(Boolean)
  if (!list.length) return null

  // Sommation des slots bruts
  const sumHm  = emptyHm()
  const sumCap = { cp: 0, indispo: 0, recup: 0 }
  let   sumOtherTlt = 0
  let   sumOtherAutre = 0

  for (const ps of list) {
    const r = ps._raw
    for (const h of HORAIRES) {
      for (const m of MODES_WORK) sumHm[h][m] += r.hm[h][m]
    }
    sumOtherTlt    += r.otherTlt   || 0
    sumOtherAutre  += r.otherAutre || 0
    sumCap.cp      += r.cp
    sumCap.indispo += r.indispo
    sumCap.recup   += r.recup
  }

  return {
    ...statsFromRaw(sumHm, sumCap, { tlt: sumOtherTlt, autre: sumOtherAutre }, list.length),
    count: list.length,
  }
}

/**
 * Construit la fenêtre temporelle pour une personne selon le mode choisi.
 *
 * @param {object} person       - objet personne (avec .arrivee 'DD MM YYYY')
 * @param {string} mode         - 'header' | 'since-arrival'
 * @param {string} filterStart  - data.filterStart (YYYY-MM-DD)
 * @param {string} filterEnd    - data.filterEnd   (YYYY-MM-DD)
 * @returns {{ startIso: string, endIso: string }}
 */
export function personWindow(person, mode, filterStart, filterEnd) {
  const endIso = filterEnd || new Date().toISOString().slice(0, 10)

  if (mode === 'since-arrival') {
    const startIso = arriveeToIso(person) || filterStart || '2000-01-01'
    return { startIso, endIso }
  }

  // 'header' : période du header pour tout le monde
  return { startIso: filterStart || '2000-01-01', endIso }
}

/**
 * Convertit la date d'arrivée Firestore ('DD MM YYYY') en ISO ('YYYY-MM-DD').
 * Retourne null si le champ est absent ou mal formé.
 */
export function arriveeToIso(person) {
  if (!person?.arrivee) return null
  const p = person.arrivee.trim().split(' ')
  if (p.length < 3) return null
  return `${p[2]}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`
}

/**
 * Vérifie si une personne est active à la date donnée.
 * Utilise les champs .arrivee et .depart (format 'DD MM YYYY').
 *
 * @param {object} person
 * @param {Date}   [date=today]
 */
export function isActiveOn(person, date) {
  const today = date || new Date()
  today.setHours(0, 0, 0, 0)

  const parse = str => {
    if (!str) return null
    const p = str.trim().split(' ')
    return p.length >= 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : null
  }

  const arrivee = parse(person.arrivee)
  const depart  = parse(person.depart)

  if (!arrivee || today < arrivee) return false
  if (depart   && today > depart)  return false
  return true
}

/**
 * Compte les jours par catégorie individuelle pour une personne sur une période.
 * Exclut week-ends et jours fériés.
 * Plafonne à 1j/date pour les absences (CP, Indisponible, Récup).
 *
 * @returns {Object} { [catName]: days } — valeurs arrondies à 1 décimale
 */
export function computePersonCatBreakdown(planningData, personName, { startIso, endIso }) {
  const pData = planningData[personName] || {}
  const byCat = {}

  for (const [iso, entries] of Object.entries(pData)) {
    if (iso < startIso || iso > endIso) continue
    const dt = new Date(iso + 'T12:00:00')
    if (dt.getDay() === 0 || isFerie(iso)) continue   // exclut dimanche + fériés (samedi compté)

    const catSlots = {}
    for (const e of entries) {
      const s = e.slots || 0
      if (s > 0) catSlots[e.categorie] = (catSlots[e.categorie] || 0) + s
    }
    for (const [cat, slots] of Object.entries(catSlots)) {
      const val = CAPPED_CATS_SET.has(cat)
        ? Math.min(slots / SLOTS_PER_DAY, 1)
        : slots / SLOTS_PER_DAY
      byCat[cat] = (byCat[cat] || 0) + val
    }
  }

  for (const cat in byCat) byCat[cat] = r1(byCat[cat])
  return byCat
}

/**
 * Compte les jours d'une catégorie spécifique pour une personne sur une période.
 * Même règles que computePersonCatBreakdown (week-ends, fériés, plafond absences).
 *
 * @returns {number} jours — arrondi à 1 décimale
 */
export function countCatDays(planningData, personName, catName, { startIso, endIso }) {
  const pData = planningData[personName] || {}
  const capped = CAPPED_CATS_SET.has(catName)
  let total = 0

  for (const [iso, entries] of Object.entries(pData)) {
    if (iso < startIso || iso > endIso) continue
    const dt = new Date(iso + 'T12:00:00')
    if (dt.getDay() === 0 || isFerie(iso)) continue   // exclut dimanche + fériés (samedi compté)

    let daySlots = 0
    for (const e of entries) {
      if (e.categorie === catName) daySlots += e.slots || 0
    }
    if (daySlots > 0)
      total += capped ? Math.min(daySlots / SLOTS_PER_DAY, 1) : daySlots / SLOTS_PER_DAY
  }

  return r1(total)
}

/* ============================================================
   CATALOGUE DE COLONNES — source de vérité partagée
   Importé par AdminStats, PersonDetail, GlobalStats, CatDetail…

   Définition de chaque entrée :
     key     : identifiant unique
     group   : 'Site' | 'TLT' | 'Agence' | 'Consolidé' | 'Absences'
     label   : libellé affiché dans l'UI
     color   : couleur CSS (barre, légende, en-tête)
     getPct  : (stats) => number | null
                 number → % sur workDays (base de la barre)
                 null   → pas de barre (absences)
     getDays : (stats) => number  — valeur en jours

   Règle des consolidés :
     Horaire consolidé = Site + TLT (incl. TLT Agence).
     Les Agence (journées vertes) sont comptées séparément.
     → site-matin + tlt-matin (contient TLT Matin + TLT Agence Matin)
   ============================================================ */

/** % d'une valeur en jours sur les jours travaillés d'une ligne de stats */
function _jPct(days, r) {
  return r.workDays > 0 ? Math.round(days / r.workDays * 100) : 0
}

export const CATALOG = [
  // ── Consolidés par horaire : Site + TLT (hors Agence/journées vertes) ──
  // TLT Matin + TLT Agence Matin sont tous les deux dans detail.matin.tlt (via CAT_MAP)
  { key: 'h-matin',       group: 'Consolidé',  label: 'Matin (consolidé)', color: 'rgba(174,219,255,0.65)',
    getPct: r => _jPct(r.detail.matin.site + r.detail.matin.tlt, r),
    getDays: r => r1(r.detail.matin.site + r.detail.matin.tlt)            },
  { key: 'h-midi',        group: 'Consolidé',  label: 'Midi (consolidé)',  color: 'rgba(149,207,255,0.65)',
    getPct: r => _jPct(r.detail.midi.site  + r.detail.midi.tlt,  r),
    getDays: r => r1(r.detail.midi.site  + r.detail.midi.tlt)             },
  { key: 'h-aprem',       group: 'Consolidé',  label: 'Aprem (consolidé)', color: 'rgba(89,180,254,0.65)',
    getPct: r => _jPct(r.detail.aprem.site + r.detail.aprem.tlt, r),
    getDays: r => r1(r.detail.aprem.site + r.detail.aprem.tlt)            },
  { key: 'h-soir',        group: 'Consolidé',  label: 'Soir (consolidé)',  color: 'rgba(86,166,233,0.65)',
    getPct: r => _jPct(r.detail.soir.site  + r.detail.soir.tlt,  r),
    getDays: r => r1(r.detail.soir.site  + r.detail.soir.tlt)             },

  // ── Site ──────────────────────────────────────────────────
  { key: 'site-matin',    group: 'Site',       label: 'Matin',             color: 'rgba(174,219,255,1)',
    getPct: r => r.dist.matin,                    getDays: r => r.detail.matin.site    },
  { key: 'site-midi',     group: 'Site',       label: 'Midi',              color: 'rgba(149,207,255,1)',
    getPct: r => r.dist.midi,                     getDays: r => r.detail.midi.site     },
  { key: 'site-aprem',    group: 'Site',       label: 'Aprem',             color: 'rgba(89,180,254,1)',
    getPct: r => r.dist.aprem,                    getDays: r => r.detail.aprem.site    },
  { key: 'site-soir',     group: 'Site',       label: 'Soir',              color: 'rgba(86,166,233,1)',
    getPct: r => r.dist.soir,                     getDays: r => r.detail.soir.site     },

  // ── TLT (tous + par horaire) ─────────────────────────────
  { key: 'tlt',           group: 'TLT',        label: 'TLT (tous)',         color: 'rgba(167,139,250,1)',
    getPct: r => r.tauxTlt,                       getDays: r => r.tltDays               },
  { key: 'tlt-matin',     group: 'TLT',        label: 'TLT Matin',         color: 'rgba(215,190,158,1)',
    getPct: r => _jPct(r.detail.matin.tlt,  r),  getDays: r => r.detail.matin.tlt      },
  { key: 'tlt-midi',      group: 'TLT',        label: 'TLT Midi',          color: 'rgba(201,167,123,1)',
    getPct: r => _jPct(r.detail.midi.tlt,   r),  getDays: r => r.detail.midi.tlt       },
  { key: 'tlt-aprem',     group: 'TLT',        label: 'TLT Aprem',         color: 'rgba(188,145,87,1)',
    getPct: r => _jPct(r.detail.aprem.tlt,  r),  getDays: r => r.detail.aprem.tlt      },
  { key: 'tlt-soir',      group: 'TLT',        label: 'TLT Soir',          color: 'rgba(163,121,64,1)',
    getPct: r => _jPct(r.detail.soir.tlt,   r),  getDays: r => r.detail.soir.tlt       },

  // ── TLT Agence (tous + par horaire) ─────────────────────────
  { key: 'tlt-agence',       group: 'TLT Agence', label: 'TLT Agence (tous)',  color: 'rgba(245,158,11,1)',
    getPct: r => _jPct(HORAIRES.reduce((s, h) => s + r.detail[h].tlt_agence, 0), r),
    getDays: r => r1(HORAIRES.reduce((s, h) => s + r.detail[h].tlt_agence, 0)) },
  { key: 'tlt-agence-matin', group: 'TLT Agence', label: 'TLT Agence Matin',  color: 'rgba(251,191,36,1)',
    getPct: r => _jPct(r.detail.matin.tlt_agence, r), getDays: r => r.detail.matin.tlt_agence },
  { key: 'tlt-agence-midi',  group: 'TLT Agence', label: 'TLT Agence Midi',   color: 'rgba(245,158,11,0.85)',
    getPct: r => _jPct(r.detail.midi.tlt_agence,  r), getDays: r => r.detail.midi.tlt_agence  },
  { key: 'tlt-agence-aprem', group: 'TLT Agence', label: 'TLT Agence Aprem',  color: 'rgba(245,158,11,0.75)',
    getPct: r => _jPct(r.detail.aprem.tlt_agence, r), getDays: r => r.detail.aprem.tlt_agence },
  { key: 'tlt-agence-soir',  group: 'TLT Agence', label: 'TLT Agence Soir',   color: 'rgba(245,158,11,0.65)',
    getPct: r => _jPct(r.detail.soir.tlt_agence,  r), getDays: r => r.detail.soir.tlt_agence  },

  // ── Agence / Journées vertes (tous + par horaire) ─────────
  { key: 'agence',        group: 'Agence',     label: 'Jours verts (tous)', color: '#65a30d',
    getPct: r => r.tauxAgence,                    getDays: r => r.agenceDays            },
  { key: 'agence-matin',  group: 'Agence',     label: 'Agence Matin',      color: 'rgba(130,185,60,1)',
    getPct: r => _jPct(r.detail.matin.agence, r), getDays: r => r.detail.matin.agence   },
  { key: 'agence-midi',   group: 'Agence',     label: 'Agence Midi',       color: 'rgba(115,170,50,1)',
    getPct: r => _jPct(r.detail.midi.agence,  r), getDays: r => r.detail.midi.agence    },
  { key: 'agence-aprem',  group: 'Agence',     label: 'Agence Aprem',      color: 'rgba(100,155,40,1)',
    getPct: r => _jPct(r.detail.aprem.agence, r), getDays: r => r.detail.aprem.agence   },
  { key: 'agence-soir',   group: 'Agence',     label: 'Agence Soir',       color: 'rgba(85,140,30,1)',
    getPct: r => _jPct(r.detail.soir.agence,  r), getDays: r => r.detail.soir.agence    },

  // ── Absences (jours uniquement, pas de %) ────────────────
  { key: 'cp',            group: 'Absences',   label: 'CP',                color: 'rgba(68,0,255,0.85)',
    getPct: null,                                  getDays: r => r.cpDays                },
  { key: 'indispo',       group: 'Absences',   label: 'Indisponible',      color: 'rgba(176,176,176,1)',
    getPct: null,                                  getDays: r => r.indispoDays           },
  { key: 'recup',         group: 'Absences',   label: 'Récup',             color: 'rgba(230,172,216,1)',
    getPct: null,                                  getDays: r => r.recupDays             },
]

/** Ordre des groupes dans le picker — Consolidé en premier */
export const CATALOG_GROUPS = ['Consolidé', 'Site', 'TLT', 'TLT Agence', 'Agence', 'Absences']

/** Colonnes affichées par défaut (horaires consolidés + TLT + Agence) */
export const CATALOG_DEFAULTS = ['h-matin', 'h-midi', 'h-aprem', 'h-soir', 'tlt', 'agence']
