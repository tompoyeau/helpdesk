/**
 * userStore.js — Données du collaborateur connecté et liste des comptes
 *
 * Responsabilités :
 *  - Charger le rôle (isAdmin) depuis Firestore après connexion
 *  - Fournir la liste complète des collaborateurs à la vue Admin
 *  - Permettre de basculer le rôle admin d'un utilisateur
 *  - Se réinitialiser proprement à la déconnexion
 *
 * Collection Firestore : `personnes/{uid}` → { nom, prenom, email, isAdmin }
 * Le UID Firebase Auth correspond directement à l'ID du document.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/firebase/config'
import { doc, getDoc, getDocs, collection, updateDoc } from 'firebase/firestore'

export const useUserStore = defineStore('user', () => {
  const isAdmin = ref(false)
  const nom     = ref('')
  const prenom  = ref('')
  const users   = ref([])
  const loading = ref(false)

  /* ── Chargement au login ── */
  // Le UID Firebase Auth = ID du document personnes → lookup direct
  async function loadUser(uid) {
    const snap = await getDoc(doc(db, 'personnes', uid))
    if (snap.exists()) {
      const d = snap.data()
      isAdmin.value = d.isAdmin === true
      nom.value     = d.nom    || ''
      prenom.value  = d.prenom || ''
    } else {
      isAdmin.value = false
      nom.value     = ''
      prenom.value  = ''
    }
  }

  /* ── Liste de tous les collaborateurs (vue admin) ── */
  async function loadAllUsers() {
    loading.value = true
    try {
      const snap = await getDocs(collection(db, 'personnes'))
      users.value = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) =>
          `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')
        )
    } finally {
      loading.value = false
    }
  }

  /* ── Basculer le rôle admin ── */
  async function setAdmin(uid, value) {
    await updateDoc(doc(db, 'personnes', uid), { isAdmin: value })
    const u = users.value.find(u => u.uid === uid)
    if (u) u.isAdmin = value
  }

  /* ── Réinitialisation à la déconnexion ── */
  function reset() {
    isAdmin.value = false
    nom.value     = ''
    prenom.value  = ''
    users.value   = []
  }

  return { isAdmin, nom, prenom, users, loading, loadUser, loadAllUsers, setAdmin, reset }
})
