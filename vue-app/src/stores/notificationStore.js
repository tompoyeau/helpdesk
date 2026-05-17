/**
 * notificationStore.js — Notifications temps réel par utilisateur
 *
 * Écoute en temps réel la sous-collection Firestore :
 *   `personnes/{uid}/notifications` (50 dernières, triées par date desc)
 *
 * Cycle de vie :
 *  - subscribe(uid) : appelé dans App.vue après connexion
 *  - cleanup()      : appelé dans App.vue à la déconnexion (résilie le listener)
 *
 * Chaque notification : { id, title, message, createdAt, read }
 * Le badge affiche `unreadCount` (notifications non lues).
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/firebase/config'
import { collection, doc, onSnapshot, updateDoc, writeBatch, query, orderBy, limit } from 'firebase/firestore'

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([])
  const unreadCount = computed(() => items.value.filter(n => !n.read).length)

  let _unsub = null
  let _uid   = null

  function subscribe(uid) {
    if (_unsub) _unsub()
    _uid = uid
    const q = query(
      collection(db, 'personnes', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
    _unsub = onSnapshot(q, snap => {
      items.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    }, err => {
      if (import.meta.env.DEV) console.warn('⚠️ notifications :', err)
    })
  }

  function cleanup() {
    if (_unsub) { _unsub(); _unsub = null }
    items.value = []
    _uid = null
  }

  async function markRead(notifId) {
    if (!_uid) return
    await updateDoc(doc(db, 'personnes', _uid, 'notifications', notifId), { read: true })
  }

  async function markAllRead() {
    if (!_uid) return
    const unread = items.value.filter(n => !n.read)
    if (!unread.length) return
    const batch = writeBatch(db)
    unread.forEach(n => batch.update(doc(db, 'personnes', _uid, 'notifications', n.id), { read: true }))
    await batch.commit()
  }

  return { items, unreadCount, subscribe, cleanup, markRead, markAllRead }
})
