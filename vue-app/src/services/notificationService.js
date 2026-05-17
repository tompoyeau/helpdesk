import { db } from '@/firebase/config'
import { doc, setDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore'

const DAYS_FR   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

export function isWithin15Days(isoDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate + 'T12:00:00')
  const diff = (target - today) / 86400000
  return diff >= 0 && diff <= 15
}

export function formatDateFr(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

// Notification unique par (uid, date) — setDoc avec la date comme ID évite les doublons
export async function notifyPlanningChange(uid, isoDate) {
  if (!uid || !isWithin15Days(isoDate)) return
  await setDoc(
    doc(db, 'personnes', uid, 'notifications', isoDate),
    {
      date:      isoDate,
      message:   `Ton planning du ${formatDateFr(isoDate)} a été modifié`,
      read:      false,
      createdAt: serverTimestamp(),
    }
  )
}

// Écriture groupée (forecast) — évite 400+ writes individuels
// changes = [{ uid, isoDate }, ...]
export async function batchNotifyPlanningChanges(changes) {
  const filtered = changes.filter(c => c.uid && isWithin15Days(c.isoDate))
  if (!filtered.length) return

  const BATCH_SIZE = 490
  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    for (const { uid, isoDate } of filtered.slice(i, i + BATCH_SIZE)) {
      batch.set(
        doc(db, 'personnes', uid, 'notifications', isoDate),
        {
          date:      isoDate,
          message:   `Ton planning du ${formatDateFr(isoDate)} a été modifié`,
          read:      false,
          createdAt: serverTimestamp(),
        }
      )
    }
    await batch.commit()
  }
}
