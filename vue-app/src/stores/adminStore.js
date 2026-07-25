import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, auth, authSecondary } from '@/firebase/config'
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collection,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { TIME_SLOTS } from '@/stores/dataStore'
import { logPlanningWrite } from '@/services/planningLogService'

export { TIME_SLOTS }

/* ── Presets créneaux partagés (DayEditorModal + mode rapide) ── */
const S_MATIN    = [{ startSlot: 0, endSlot: 16 }, { startSlot: 20, endSlot: 34 }]
const S_MIDI     = [{ startSlot: 2, endSlot: 18 }, { startSlot: 22, endSlot: 36 }]
const S_APREM    = [{ startSlot: 4, endSlot: 18 }, { startSlot: 22, endSlot: 38 }]
const S_SOIR     = [{ startSlot: 5, endSlot: 21 }, { startSlot: 26, endSlot: 40 }]
const S_PILOTEBO = [{ startSlot: 3, endSlot: 19 }, { startSlot: 22, endSlot: 36 }]
const S_FULL_DAY = [{ startSlot: 0, endSlot: 44 }]

export const QUICK_PRESETS = {
  '0': S_MATIN, '9': S_MATIN, '20': S_MATIN, '12': S_MATIN, '28': S_MATIN,
  '1': S_MIDI,  '10': S_MIDI, '21': S_MIDI,  '13': S_MIDI,
  '15': S_APREM,'16': S_APREM,'22': S_APREM, '17': S_APREM,'27': S_APREM,
  '2': S_SOIR,  '11': S_SOIR, '23': S_SOIR,  '14': S_SOIR, '29': S_SOIR,
  '26': S_PILOTEBO,
  '32': S_PILOTEBO,
  '30': S_FULL_DAY,  // CP
  '6':  S_FULL_DAY,  // Indisponible
  '8':  S_FULL_DAY,  // Récup
}

// Codes d'activité qui comptent dans l'ETP :
// Matin/Midi/Aprem/Soir (site client), TLT, TLT Agence — tout le reste est exclu
export const ETP_CODES = new Set(['0', '1', '15', '2', '20', '21', '22', '23', '12', '13', '17', '14'])

// Collection dédiée aux données ETP + Équipe Covéa (etp, fixed, répartition).
// Isolée de `plannings` pour qu'aucune autre application réécrivant le doc jour
// ne puisse effacer ces champs. Prod uniquement — le mode test conserve ces
// champs embarqués dans le doc `plannings_test`.
export const ETP_COLLECTION = 'planning_etp'

// Où lire/écrire les champs ETP/Covéa selon la collection de travail :
// prod ('plannings') → collection dédiée ; test → le doc jour lui-même (legacy).
function etpColFor(col) {
  return col === 'plannings' ? ETP_COLLECTION : col
}

const ETP_FIELDS = ['etp', 'fixed', 'matin', 'midi', 'aprem', 'soir']

// Extrait les champs ETP/Covéa d'un doc jour. Retourne null si aucun n'est présent.
function extractEtpData(data) {
  if (!data) return null
  const out = {}
  for (const k of ETP_FIELDS) {
    if (k in data && data[k] != null) out[k] = data[k]
  }
  return Object.keys(out).length ? out : null
}

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

  /**
   * Crée un compte Firebase Auth + doc Firestore (ID = UID Auth).
   * Utilise l'app secondaire pour ne pas déconnecter l'admin.
   * Envoie un email "définissez votre mot de passe" au nouveau collab.
   */
  /**
   * Crée un compte Firebase Auth + doc Firestore (ID = UID Auth).
   * Utilise l'app secondaire pour ne pas déconnecter l'admin.
   * Envoie toujours un email "définissez votre mot de passe" au nouveau collab.
   */
  async function createPersonneWithAuth(data) {
    // Mot de passe temporaire aléatoire — jamais communiqué, remplacé via reset email
    const tempPwd = `Tmp${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}!`

    // 1. Créer le compte Auth via l'app secondaire (session admin intacte)
    const cred = await createUserWithEmailAndPassword(authSecondary, data.email, tempPwd)
    const uid  = cred.user.uid

    // 2. Déconnecter l'app secondaire immédiatement
    await fbSignOut(authSecondary)

    // 3. Envoyer l'email "définissez votre mot de passe"
    await sendPasswordResetEmail(auth, data.email)

    // 4. Créer le doc Firestore avec l'UID Auth comme clé
    await setDoc(doc(db, 'personnes', uid), { ...data, id: uid })

    return uid
  }

  async function updatePersonne(id, data) {
    await updateDoc(doc(db, 'personnes', id), data)
  }

  async function deletePersonne(id) {
    await deleteDoc(doc(db, 'personnes', id))
  }

  /* ── Planning ── */
  async function loadDayPlanning(date) {
    const id     = dateToId(date)
    const col    = collectionName.value
    const etpCol = etpColFor(col)

    const [snap, etpSnap] = await Promise.all([
      getDoc(doc(db, col, id)),
      etpCol === col ? Promise.resolve(null) : getDoc(doc(db, etpCol, id)),
    ])

    // Champs ETP/Covéa : depuis la collection dédiée en prod, sinon depuis le doc jour
    const meta = etpCol === col
      ? (snap.exists() ? snap.data() : {})
      : (etpSnap?.exists() ? etpSnap.data() : {})

    const etpExists = etpCol === col ? snap.exists() : !!etpSnap?.exists()
    if (!snap.exists() && !etpExists) {
      return { id, exists: false, filled: false, ressources: [], etp: null, fixed: {}, filledCount: 0, total: 0 }
    }

    const ressources  = snap.exists() ? (snap.data().ressources || []) : []
    const fixedCount  = Object.keys(meta.fixed || {}).length
    const filledCount = ressources.filter(r =>
      (r.activites || []).some(a => a && ETP_CODES.has(String(a)))
    ).length + fixedCount
    return {
      id, exists: true, filledCount, total: ressources.length, ressources,
      etp:   meta.etp   ?? null,
      fixed: meta.fixed ?? {},
      matin: meta.matin ?? null,
      midi:  meta.midi  ?? null,
      aprem: meta.aprem ?? null,
      soir:  meta.soir  ?? null,
    }
  }

  async function saveDayPlanning(date, ressources) {
    saving.value = true
    error.value  = null
    const col   = collectionName.value
    const dayId = dateToId(date)
    try {
      const prevSnap     = await getDoc(doc(db, col, dayId))
      const prevRessources = prevSnap.exists() ? (prevSnap.data().ressources || []) : []
      await setDoc(doc(db, col, dayId), { ressources }, { merge: true })
      logPlanningWrite({
        action:  'save_day',
        col,
        dayId,
        before:  { ressources: prevRessources },
        after:   { ressources },
        keepRaw: true,
      })
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      saving.value = false
    }
  }

  // Sauvegarde ETP, shifts fixes et répartition (sans toucher aux ressources)
  async function saveEtpAndFixed(date, { etp, fixed, matin = null, midi = null, aprem = null, soir = null }) {
    const col      = collectionName.value
    const etpCol   = etpColFor(col)
    const dayId    = dateToId(date)
    const prevSnap = await getDoc(doc(db, etpCol, dayId))
    const prevData = prevSnap.exists() ? prevSnap.data() : {}
    await setDoc(doc(db, etpCol, dayId), { etp, fixed, matin, midi, aprem, soir }, { merge: true })
    logPlanningWrite({
      action: 'save_etp',
      col,
      dayId,
      before: {
        etp:   prevData.etp   ?? null,
        fixed: prevData.fixed ?? null,
        matin: prevData.matin ?? null,
        midi:  prevData.midi  ?? null,
        aprem: prevData.aprem ?? null,
        soir:  prevData.soir  ?? null,
      },
      after: { etp, fixed, matin, midi, aprem, soir },
    })
  }

  // Supprime tous les documents d'une liste de dates ISO (yyyy-mm-dd) — test uniquement
  async function clearMonthPlanning(isoDates) {
    const batch = writeBatch(db)
    const col   = collectionName.value
    for (const iso of isoDates) {
      const [y, m, d] = iso.split('-').map(Number)
      batch.delete(doc(db, col, dateToId(new Date(y, m - 1, d))))
    }
    await batch.commit()
    for (const iso of isoDates) {
      const [y, m, d] = iso.split('-').map(Number)
      logPlanningWrite({ action: 'clear_month', col, dayId: dateToId(new Date(y, m - 1, d)) })
    }
  }

  /**
   * Copie les documents de plannings_test vers plannings pour un mois donné.
   * mode: 'overwrite' → écrase tout, 'empty_only' → ne touche que les jours absents de prod
   * Retourne le nombre de jours copiés.
   */
  async function copyMonthToProd(isoDates, mode = 'overwrite') {
    // 1. Lire tous les docs source (plannings_test) en parallèle
    const sourceDocs = await Promise.all(
      isoDates.map(async iso => {
        const [y, m, d] = iso.split('-').map(Number)
        const id   = dateToId(new Date(y, m - 1, d))
        const snap = await getDoc(doc(db, 'plannings_test', id))
        return { id, exists: snap.exists(), data: snap.exists() ? snap.data() : null }
      })
    )

    // 2. En mode empty_only, vérifier quels jours existent déjà en prod
    let prodExisting = new Set()
    if (mode === 'empty_only') {
      const checks = await Promise.all(
        sourceDocs
          .filter(s => s.exists)
          .map(async s => {
            const snap = await getDoc(doc(db, 'plannings', s.id))
            return snap.exists() ? s.id : null
          })
      )
      prodExisting = new Set(checks.filter(Boolean))
    }

    // 3. Écrire en batch. Les docs source (plannings_test) embarquent ressources + ETP/Covéa ;
    //    en prod on éclate : ressources → plannings, ETP/Covéa → planning_etp.
    //    2 ops/jour → BATCH_SIZE 200 pour rester sous la limite de 500 ops/batch Firestore.
    const toCopy = sourceDocs.filter(s => s.exists && (mode === 'overwrite' || !prodExisting.has(s.id)))
    const BATCH_SIZE = 200
    for (let i = 0; i < toCopy.length; i += BATCH_SIZE) {
      const slice = toCopy.slice(i, i + BATCH_SIZE)
      const batch = writeBatch(db)
      for (const { id, data } of slice) {
        batch.set(doc(db, 'plannings', id), { ressources: data.ressources || [] }, { merge: true })
        const etpData = extractEtpData(data)
        if (etpData) batch.set(doc(db, ETP_COLLECTION, id), etpData, { merge: true })
      }
      await batch.commit()
      for (const { id, data } of slice) {
        logPlanningWrite({ action: 'publish_month', col: 'plannings', dayId: id, after: data })
      }
    }

    return toCopy.length
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

  /**
   * Migration one-shot : copie etp/fixed/répartition de tous les docs `plannings`
   * vers la collection dédiée `planning_etp` (même ID de jour). Non destructif —
   * les anciens champs restent dans `plannings` mais ne sont plus lus par l'app.
   * À lancer une seule fois, connecté en admin. Idempotent (merge).
   */
  async function migrateEtpToDedicated(onProgress) {
    const snap = await getDocs(collection(db, 'plannings'))
    const docs = snap.docs
    let migrated = 0, skipped = 0
    let batch = writeBatch(db), ops = 0

    for (const d of docs) {
      const etpData = extractEtpData(d.data())
      if (!etpData) { skipped++; continue }
      batch.set(doc(db, ETP_COLLECTION, d.id), etpData, { merge: true })
      ops++; migrated++
      if (ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0 }
      if (onProgress) onProgress(migrated + skipped, docs.length)
    }
    if (ops) await batch.commit()

    return { migrated, skipped, total: docs.length }
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
    createPersonne, createPersonneWithAuth, updatePersonne, deletePersonne,
    loadDayPlanning, saveDayPlanning, saveEtpAndFixed, clearMonthPlanning, copyMonthToProd,
    migrateEtpToDedicated,
    parseBlocks, buildActivites, isActiveOn,
  }
})
