import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth } from '@/firebase/config'
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref(null)   // firebase User object ou null
  const loading = ref(true)   // true tant qu'on attend onAuthStateChanged
  const error   = ref('')

  /* ---- Initialisation : écoute l'état d'authentification ---- */

  function init() {
    return new Promise(resolve => {
      onAuthStateChanged(auth, u => {
        user.value    = u
        loading.value = false
        resolve(u)
      })
    })
  }

  /* ---- Connexion ---- */

  async function signIn(email, password) {
    error.value   = ''
    loading.value = true
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // user.value sera mis à jour par onAuthStateChanged
    } catch (e) {
      error.value = mapError(e.code)
    } finally {
      loading.value = false
    }
  }

  /* ---- Déconnexion ---- */

  async function signOut() {
    await fbSignOut(auth)
    user.value = null
  }

  /* ---- Traduction des codes d'erreur Firebase ---- */

  function mapError(code) {
    const msgs = {
      'auth/invalid-email':         'Adresse email invalide.',
      'auth/user-not-found':        'Aucun compte trouvé pour cet email.',
      'auth/wrong-password':        'Mot de passe incorrect.',
      'auth/invalid-credential':    'Email ou mot de passe incorrect.',
      'auth/too-many-requests':     'Trop de tentatives. Réessayez plus tard.',
      'auth/network-request-failed':'Erreur réseau. Vérifiez votre connexion.',
    }
    return msgs[code] || 'Une erreur est survenue. Réessayez.'
  }

  return { user, loading, error, init, signIn, signOut }
})
