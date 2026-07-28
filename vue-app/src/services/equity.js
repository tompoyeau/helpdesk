/**
 * equity.js — Analyse d'équité des répartitions de planning.
 *
 * But : mettre en évidence les répartitions les plus injustes sur une période,
 * et désigner les personnes à prioriser pour rétablir l'équilibre.
 *
 * Principe : pour chaque dimension (soirs, jours verts, télétravail, samedis),
 * on compare la valeur de chaque personne à la moyenne d'équipe (la « part juste »
 * si tout était réparti équitablement). L'écart, normalisé, donne un score
 * d'injustice qui sert au classement des priorités et à la suggestion de paires.
 *
 * Fonction pure : aucune dépendance au store Pinia → facilement testable.
 */

import {
  computePersonStats,
  computeTeamStats,
  arriveeToIso,
  isFerie,
} from '@/stores/statsStore'

// Nombre minimal de jours travaillés pour qu'une personne soit prise en compte
// (évite le bruit statistique des retours d'absence).
const MIN_WORK_DAYS = 8

// Ancienneté minimale (mois) pour être analysé. Les nouveaux arrivants ont un
// historique forcément déséquilibré (formation, montée en charge) → on les écarte
// pour ne pas les faire ressortir en « lésés ». Aligné sur le seuil junior du forecast.
const MIN_TENURE_MONTHS = 3

// Seuils de multiplicateur pour qualifier le déséquilibre d'une dimension.
const MULT_WATCH = 1.4   // en-dessous : équilibré
const MULT_ALERT = 2.0   // au-dessus : déséquilibré

// Seuil d'écart relatif pour retenir une personne dans les priorités (25 %).
const PRIORITY_THRESHOLD = 0.25

// Catégories d'absence (un samedi en absence n'est pas un samedi travaillé)
const ABSENCE_CATS = new Set(['CP', 'Indisponible', 'Récup'])

/**
 * Définition des dimensions analysées.
 * direction 'burden' : plus la valeur est haute, plus la personne est lésée (à soulager).
 * direction 'reward' : plus la valeur est basse, plus la personne est lésée (à prioriser).
 * metric    'rate'   : taux en % des jours travaillés · 'count' : nombre de jours.
 * unitLabel : libellé des jours bruts (survol).
 */
export const EQUITY_DIMENSIONS = [
  { key: 'soir',   label: 'Soirs',       direction: 'burden', metric: 'rate',  unitLabel: 'soirs',
    color: 'rgba(86,166,233,1)',  reco: 'À soulager sur les soirs' },
  { key: 'agence', label: 'Jours verts', direction: 'reward', metric: 'rate',  unitLabel: 'jours verts',
    color: '#65a30d',             reco: 'À prioriser sur les jours verts' },
  { key: 'tlt',    label: 'Télétravail', direction: 'reward', metric: 'rate',  unitLabel: 'jours de TLT',
    color: 'rgba(167,139,250,1)', reco: 'À prioriser sur le télétravail' },
  { key: 'samedi', label: 'Samedis travaillés', direction: 'burden', metric: 'count', unitLabel: 'samedis',
    color: 'rgba(244,114,94,1)',  reco: 'À soulager sur les samedis travaillés' },
  { key: 'samedi_astreinte', label: "Samedis d'astreinte", direction: 'burden', metric: 'count', unitLabel: "samedis d'astreinte",
    color: 'rgba(234,179,8,1)',   reco: "À soulager sur les astreintes du samedi" },
]

const DIM_BY_KEY = Object.fromEntries(EQUITY_DIMENSIONS.map(d => [d.key, d]))

// Éligibilité d'une personne à une dimension.
// TLT              : exclut peutTLT === false ET les personnes de BO (peutBO === true).
// SAMEDI TRAVAILLÉ : exclut peutTLT === false (samedis = TLT Matin ; les BO en font).
// SAMEDI ASTREINTE : aucune restriction TLT (l'astreinte n'est pas liée au télétravail).
// Dans tous les cas, les exclus ne sont ni signalés, ni comptés dans la moyenne.
function dimEligible(key, person) {
  if (key === 'tlt')    return person?.peutTLT !== false && person?.peutBO !== true
  if (key === 'samedi') return person?.peutTLT !== false
  return true
}

/* ── Helpers ── */

function round1(v) { return Math.round(v * 10) / 10 }

// « Soir » au sens de toute l'app : Site + TLT + TLT Agence, SANS les journées
// vertes (Agence Soir). Les Agence sont comptées dans la dimension « Jours verts »,
// pas comme un fardeau du soir (sinon double comptage). soirDays/tauxSoir bruts
// incluent l'Agence, on ne les utilise donc pas ici.
function soirConsDays(stats) {
  const d = stats.detail?.soir || {}
  return (d.site || 0) + (d.tlt || 0) + (d.tlt_agence || 0)
}

// Valeur comparée (le « taux ») d'une personne pour une dimension
function valueOf(p, key) {
  switch (key) {
    case 'soir':   return p.stats.workDays > 0 ? Math.round(soirConsDays(p.stats) / p.stats.workDays * 100) : 0
    case 'agence': return p.stats.tauxAgence
    case 'tlt':    return p.stats.tauxTlt
    case 'samedi': return p.samedi
    case 'samedi_astreinte': return p.samediAstreinte
    default:       return 0
  }
}

// Jours bruts correspondants (affichés au survol)
function daysOf(p, key) {
  switch (key) {
    case 'soir':   return soirConsDays(p.stats)
    case 'agence': return p.stats.agenceDays
    case 'tlt':    return p.stats.tltDays
    case 'samedi': return p.samedi
    case 'samedi_astreinte': return p.samediAstreinte
    default:       return 0
  }
}

// Mois d'ancienneté d'une personne à une date ISO donnée.
// Infinity si pas de date d'arrivée (considéré comme senior).
function monthsSinceArrival(person, isoDate) {
  const arr = arriveeToIso(person)
  if (!arr) return Infinity
  const a = new Date(arr + 'T12:00:00')
  const d = new Date(isoDate + 'T12:00:00')
  return (d.getFullYear() - a.getFullYear()) * 12
       + (d.getMonth() - a.getMonth())
       + (d.getDate() >= a.getDate() ? 0 : -1)
}

// Nombre total de samedis (hors fériés) dans la période — dénominateur des samedis
function countSaturdaysInPeriod(startIso, endIso) {
  if (!startIso || !endIso || startIso > endIso) return 0
  let n = 0
  const d = new Date(startIso + 'T12:00:00')
  const end = new Date(endIso + 'T12:00:00')
  while (d <= end) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (d.getDay() === 6 && !isFerie(iso)) n++
    d.setDate(d.getDate() + 1)
  }
  return n
}

// Samedis de la période, séparés en « réellement travaillés » (hors astreinte)
// et « d'astreinte ». Un samedi peut compter dans les deux s'il cumule les deux.
function countSaturdays(planningData, name, startIso, endIso) {
  const pData = planningData[name] || {}
  let worked = 0, astreinte = 0
  for (const [iso, entries] of Object.entries(pData)) {
    if (iso < startIso || iso > endIso) continue
    const dt = new Date(iso + 'T12:00:00')
    if (dt.getDay() !== 6 || isFerie(iso)) continue   // samedis uniquement
    if (!Array.isArray(entries)) continue
    const hasAstreinte = entries.some(e => e.categorie === 'Astreinte' && (e.slots || 0) > 0)
    const hasWork = entries.some(e =>
      e.categorie && e.categorie !== 'Astreinte' && !ABSENCE_CATS.has(e.categorie) && (e.slots || 0) > 0)
    if (hasAstreinte) astreinte++
    if (hasWork)      worked++
  }
  return { worked, astreinte }
}

/**
 * Calcule l'analyse d'équité complète.
 *
 * @param {object}   planningData  data.planning ({ 'NOM Prenom': { iso: entries } })
 * @param {string[]} personNames   liste des collaborateurs à analyser
 * @param {object}   personnesData index uid → objet personne (arrivee/depart/flags)
 * @param {object}   nameToUid     'NOM Prenom' → uid
 * @param {object}   window        { startIso, endIso }
 * @returns {{ dimensions: object[], priorities: object[], meta: object }}
 */
export function computeEquity(planningData, personNames, personnesData, nameToUid, { startIso, endIso }) {
  const totalSaturdays = countSaturdaysInPeriod(startIso, endIso)

  // 1. Stats par personne — hors personnes qui ne sont pas sur le run
  const perPerson = []   // { name, person, stats, workDays, samedi }

  for (const name of personNames) {
    const uid     = nameToUid?.[name]
    const person  = uid ? personnesData?.[uid] : null

    // Exclure les personnes hors run (onRun === false)
    if (person && person.onRun === false) continue

    // Exclure les nouveaux arrivants (< 3 mois d'ancienneté à la fin de période)
    if (person && monthsSinceArrival(person, endIso) < MIN_TENURE_MONTHS) continue

    const stats = computePersonStats(planningData, name, { startIso, endIso })
    if (!stats || stats.workDays < MIN_WORK_DAYS) continue

    const sat = countSaturdays(planningData, name, startIso, endIso)
    perPerson.push({ name, person, stats, workDays: stats.workDays, samedi: sat.worked, samediAstreinte: sat.astreinte })
  }

  // 2. Analyse par dimension — moyenne d'équipe calculée sur les seuls éligibles
  const dimensions = EQUITY_DIMENSIONS.map(dim => {
    const eligible = perPerson.filter(p => dimEligible(dim.key, p.person))
    const n = eligible.length

    // Part juste = valeur agrégée de l'équipe éligible
    let teamRate = 0
    if (dim.metric === 'count') {
      teamRate = n ? round1(eligible.reduce((s, p) => s + valueOf(p, dim.key), 0) / n) : 0
    } else if (dim.key === 'soir') {
      // Soir consolidé (hors Agence) agrégé : Σ soirs ÷ Σ jours travaillés
      const sumSoir = eligible.reduce((s, p) => s + soirConsDays(p.stats), 0)
      const sumWork = eligible.reduce((s, p) => s + p.stats.workDays, 0)
      teamRate = sumWork > 0 ? Math.round(sumSoir / sumWork * 100) : 0
    } else {
      const team = computeTeamStats(eligible.map(p => p.stats))
      teamRate = team ? (dim.key === 'agence' ? team.tauxAgence : team.tauxTlt) : 0
    }
    const teamDaysAvg = n ? round1(eligible.reduce((s, p) => s + daysOf(p, dim.key), 0) / n) : 0

    const rows = eligible.map(p => {
      const rate = valueOf(p, dim.key)
      const dev  = rate - teamRate
      const disadvantage = dim.direction === 'burden' ? dev : -dev
      const unfairMult = dim.direction === 'burden'
        ? (teamRate > 0 ? rate / teamRate : 1)
        : (rate > 0 ? teamRate / rate : (teamRate > 0 ? Infinity : 1))
      return {
        name: p.name,
        rate: round1(rate),
        days: round1(daysOf(p, dim.key)),
        // Dénominateur du chiffre brut : jours travaillés (taux) ou samedis de la période (count)
        denom: dim.metric === 'count' ? totalSaturdays : round1(p.workDays),
        unfairMult,
        disadvantage: round1(disadvantage),
        workDays: p.workDays,
      }
    }).sort((a, b) => b.disadvantage - a.disadvantage)

    // Statut du déséquilibre : basé sur le pire lésé
    const worst = rows[0]
    const worstMult = worst && worst.unfairMult !== Infinity ? worst.unfairMult
      : (worst ? MULT_ALERT + 1 : 1)
    let status = 'balanced'
    if (worst && worst.disadvantage > 0) {
      if (worstMult >= MULT_ALERT)      status = 'alert'
      else if (worstMult >= MULT_WATCH) status = 'watch'
    }

    // Personne « sur-servie » à l'extrême opposé (pour la suggestion de paire)
    const last = rows[rows.length - 1]
    const privileged = last && last.disadvantage < 0
      ? { name: last.name, rate: last.rate, days: last.days }
      : null

    return {
      key: dim.key,
      label: dim.label,
      color: dim.color,
      direction: dim.direction,
      metric: dim.metric,
      unitLabel: dim.unitLabel,
      teamRate,
      teamDaysAvg,
      status,          // 'balanced' | 'watch' | 'alert'
      rows,
      worst: worst && worst.disadvantage > 0 ? worst : null,
      privileged,
    }
  })

  // 3. Classement des priorités (toutes dimensions confondues) + suggestion de paire
  const priorities = []
  for (const dim of dimensions) {
    const cfg = DIM_BY_KEY[dim.key]
    for (const row of dim.rows) {
      if (row.disadvantage <= 0) continue
      const rel = dim.teamRate > 0 ? row.disadvantage / dim.teamRate : 1
      if (rel < PRIORITY_THRESHOLD) continue
      // Confiance : les personnes avec peu de jours pèsent moins
      const confidence = Math.min(1, row.workDays / 20)
      const severity = rel * confidence
      // Contrepartie = sur-servi de la même dimension (≠ soi-même)
      const counterpart = dim.privileged && dim.privileged.name !== row.name ? dim.privileged : null
      priorities.push({
        name: row.name,
        dimKey: dim.key,
        dimLabel: dim.label,
        color: dim.color,
        reco: cfg.reco,
        rate: row.rate,
        teamRate: dim.teamRate,
        days: row.days,
        denom: row.denom,
        teamDaysAvg: dim.teamDaysAvg,
        unitLabel: dim.unitLabel,
        metric: dim.metric,
        unfairMult: row.unfairMult === Infinity ? null : round1(row.unfairMult),
        direction: dim.direction,
        counterpart,
        severity,
      })
    }
  }
  priorities.sort((a, b) => b.severity - a.severity)

  return {
    dimensions,
    priorities,
    meta: {
      nbPersons: perPerson.length,
      minWorkDays: MIN_WORK_DAYS,
    },
  }
}
