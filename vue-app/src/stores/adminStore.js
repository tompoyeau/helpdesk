import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/firebase/config'
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore'
import { TIME_SLOTS } from '@/stores/dataStore'

export { TIME_SLOTS }

// Codes d'activité qui comptent dans l'ETP :
// Matin/Midi/Aprem/Soir (site client), TLT, TLT Agence — tout le reste est exclu
export const ETP_CODES = new Set(['0', '1', '15', '2', '20', '21', '22', '23', '12', '13', '17', '14'])

export const useAdminStore = defineStore('admin', () => {
  const saving         = ref(false)
  const error          = ref(null)
  const collectionName = ref('plannings')   // 'plannings' | 'plannings_test'

  /* ── Génération d'IDs ── */
  function generatePersonneId() {
    return `${Date.now()}-${Math.floor(Math.random() * 900000 + 100000)}`
  }

  // "DDMMYYYY" ← format des documents plannings
  function dateToId(date) {
    const d = String(date.getDate()).padStart(2, '0')
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${d}${m}${date.getFullYear()}`
  }

  /* ── Conversion dates ── */
  // "2025-04-18" → "18 04 2025" (format Firestore)
  function inputToFirestore(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d} ${m} ${y}`
  }

  // "18 04 2025" → "2025-04-18" (format input date)
  function firestoreToInput(str) {
    if (!str) return ''
    const p = str.trim().split(' ')
    if (p.length < 3) return ''
    return `${p[2]}-${p[1]}-${p[0]}`
  }

  /* ── Collaborateurs CRUD ── */
  async function createPersonne(data) {
    const id = generatePersonneId()
    await setDoc(doc(db, 'personnes', id), { ...data, id })
    return id
  }

  async function updatePersonne(id, data) {
    await updateDoc(doc(db, 'personnes', id), data)
  }

  async function deletePersonne(id) {
    await deleteDoc(doc(db, 'personnes', id))
  }

  /* ── Planning ── */
  async function loadDayPlanning(date) {
    const id   = dateToId(date)
    const snap = await getDoc(doc(db, collectionName.value, id))
    if (!snap.exists()) return { id, exists: false, filled: false, ressources: [], etp: null, fixed: {}, filledCount: 0, total: 0 }

    const d2         = snap.data()
    const ressources  = d2.ressources || []
    const fixedCount  = Object.keys(d2.fixed || {}).length
    const filledCount = ressources.filter(r =>
      (r.activites || []).some(a => a && ETP_CODES.has(String(a)))
    ).length + fixedCount
    return {
      id, exists: true, filledCount, total: ressources.length, ressources,
      etp:   d2.etp   ?? null,
      fixed: d2.fixed ?? {},
      matin: d2.matin ?? null,
      midi:  d2.midi  ?? null,
      aprem: d2.aprem ?? null,
      soir:  d2.soir  ?? null,
    }
  }

  async function saveDayPlanning(date, ressources) {
    saving.value = true
    error.value  = null
    try {
      await setDoc(doc(db, collectionName.value, dateToId(date)), { ressources }, { merge: true })
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      saving.value = false
    }
  }

  // Sauvegarde ETP, shifts fixes et répartition (sans toucher aux ressources)
  async function saveEtpAndFixed(date, { etp, fixed, matin = null, midi = null, aprem = null, soir = null }) {
    await setDoc(doc(db, collectionName.value, dateToId(date)), { etp, fixed, matin, midi, aprem, soir }, { merge: true })
  }

  // Supprime tous les documents d'une liste de dates ISO (yyyy-mm-dd) — test uniquement
  async function clearMonthPlanning(isoDates) {
    const batch = writeBatch(db)
    for (const iso of isoDates) {
      const [y, m, d] = iso.split('-').map(Number)
      batch.delete(doc(db, collectionName.value, dateToId(new Date(y, m - 1, d))))
    }
    await batch.commit()
  }

  /* ── Activités : parse/build ── */
  // activites[] → [{code, startSlot, endSlot}]
  function parseBlocks(activites) {
    if (!Array.isArray(activites)) return []
    const blocks = []
    let cur = null, si = null
    for (let i = 0; i <= activites.length; i++) {
      const c = i < activites.length ? activites[i] : ''
      if (c && c !== '') {
        if (cur === null)     { cur = c; si = i }
        else if (cur !== c)  { blocks.push({ code: cur, startSlot: si, endSlot: i }); cur = c; si = i }
      } else if (cur !== null) {
        blocks.push({ code: cur, startSlot: si, endSlot: i })
        cur = null; si = null
      }
    }
    return blocks
  }

  // [{code, startSlot, endSlot}] → activites[]
  function buildActivites(blocks) {
    const arr = new Array(45).fill('')
    blocks.forEach(({ code, startSlot, endSlot }) => {
      for (let i = startSlot; i < Math.min(endSlot, 45); i++) arr[i] = String(code)
    })
    return arr
  }

  /* ── Personnes actives à une date donnée ── */
  function isActiveOn(person, date) {
    const parse = str => {
      if (!str) return null
      const p = str.trim().split(' ')
      return p.length >= 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : null
    }
    const d0 = new Date(date); d0.setHours(0, 0, 0, 0)
    const arrivee = parse(person.arrivee)
    const depart  = parse(person.depart)
    if (!arrivee || d0 < arrivee) return false
    if (depart && d0 > depart)   return false
    return true
  }

  return {
    saving, error, collectionName,
    TIME_SLOTS,
    generatePersonneId, dateToId,
    inputToFirestore, firestoreToInput,
    createPersonne, updatePersonne, deletePersonne,
    loadDayPlanning, saveDayPlanning, saveEtpAndFixed, clearMonthPlanning,
    parseBlocks, buildActivites, isActiveOn,
  }
})
