import { db, auth } from '@/firebase/config'
import { addDoc, collection, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { useUserStore } from '@/stores/userStore'

// "DDMMYYYY" → "YYYY-MM-DD"
function dayIdToIso(dayId) {
  if (!dayId || dayId.length !== 8) return dayId
  return `${dayId.slice(4)}-${dayId.slice(2, 4)}-${dayId.slice(0, 2)}`
}

// Extrait seulement les champs ETP/fixed d'un snapshot Firestore
export function extractEtpFields(data) {
  if (!data) return null
  const out = {}
  if ('etp'   in data) out.etp   = data.etp   ?? null
  if ('fixed' in data) out.fixed = data.fixed  ?? null
  if ('matin' in data) out.matin = data.matin  ?? null
  if ('midi'  in data) out.midi  = data.midi   ?? null
  if ('aprem' in data) out.aprem = data.aprem  ?? null
  if ('soir'  in data) out.soir  = data.soir   ?? null
  return Object.keys(out).length ? out : null
}

/**
 * Écrit une entrée de log dans la collection `planning_logs`.
 * Non-bloquant : ne pas await dans les hot paths.
 *
 * action : 'apply_forecast' | 'undo_forecast' | 'publish_month' | 'clear_month' | 'import_etp'
 * col    : 'plannings' | 'plannings_test'
 * dayId  : "DDMMYYYY"
 * before/after : données brutes du doc Firestore (on extrait etp/fixed ici)
 */
/**
 * keepRaw=true : stocke before/after tels quels (pour les ressources)
 * keepRaw=false (défaut) : extrait seulement les champs ETP/fixed
 */
export function logPlanningWrite({ action, col, dayId, before = null, after = null, meta = {}, keepRaw = false }) {
  try {
    const userStore  = useUserStore()
    const userName   = `${userStore.nom} ${userStore.prenom}`.trim() || auth.currentUser?.email || ''
    const userId     = auth.currentUser?.uid || ''
    const isoDate    = dayIdToIso(dayId)

    addDoc(collection(db, 'planning_logs'), {
      ts:       serverTimestamp(),
      userId,
      userName,
      action,
      col,
      dayId,
      isoDate,
      before:   keepRaw ? before : extractEtpFields(before),
      after:    keepRaw ? after  : extractEtpFields(after),
      ...meta,
    }).catch(() => {})
  } catch { /* non-fatal */ }
}

/**
 * Récupère les N derniers logs triés par date décroissante.
 */
export async function fetchLogs(n = 300) {
  const snap = await getDocs(
    query(collection(db, 'planning_logs'), orderBy('ts', 'desc'), limit(n))
  )
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id:        d.id,
      ts:        data.ts?.toDate?.() ?? null,
      userId:    data.userId    || '',
      userName:  data.userName  || '',
      action:    data.action    || '',
      col:       data.col       || '',
      dayId:     data.dayId     || '',
      isoDate:   data.isoDate   || '',
      before:    data.before    ?? null,
      after:     data.after     ?? null,
    }
  })
}
