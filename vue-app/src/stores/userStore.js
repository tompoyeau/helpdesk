import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/firebase/config'
import {
  doc, getDoc, getDocs,
  collection, setDoc, updateDoc,
} from 'firebase/firestore'

export const useUserStore = defineStore('user', () => {
  const isAdmin = ref(false)
  const users   = ref([])
  const loading = ref(false)

  /* ── Chargement au login ── */
  async function loadUser(uid, email) {
    const ref = doc(db, 'users', uid)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      // Première connexion : crée le document avec isAdmin: false
      await setDoc(ref, {
        email,
        isAdmin:   false,
        createdAt: new Date().toISOString(),
      })
      isAdmin.value = false
    } else {
      // Met à jour la date de dernière connexion sans toucher à isAdmin
      await updateDoc(ref, { email, lastLogin: new Date().toISOString() })
      isAdmin.value = snap.data().isAdmin === true
    }
  }

  /* ── Liste de tous les utilisateurs (vue admin) ── */
  async function loadAllUsers() {
    loading.value = true
    try {
      const snap = await getDocs(collection(db, 'users'))
      users.value = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => a.email.localeCompare(b.email, 'fr'))
    } finally {
      loading.value = false
    }
  }

  /* ── Basculer le rôle admin d'un utilisateur ── */
  async function setAdmin(uid, value) {
    await updateDoc(doc(db, 'users', uid), { isAdmin: value })
    // Mise à jour locale immédiate (pas besoin de recharger)
    const u = users.value.find(u => u.uid === uid)
    if (u) u.isAdmin = value
  }

  /* ── Réinitialisation à la déconnexion ── */
  function reset() {
    isAdmin.value = false
    users.value   = []
  }

  return { isAdmin, users, loading, loadUser, loadAllUsers, setAdmin, reset }
})
