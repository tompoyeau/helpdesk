import { defineStore } from 'pinia'
import { ref } from 'vue'
import { auth } from '@/firebase/config'
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref(null)
  const loading = ref(true)
  const error   = ref('')

  // Référence au listener pour pouvoir le nettoyer
  let _unsubscribe = null

  /* ── Initialisation ── */
  function init() {
    // Nettoie un éventuel listener précédent (évite les fuites mémoire)
    if (_unsubscribe) _unsubscribe()

    return new Promise(resolve => {
      _unsubscribe = onAuthStateChanged(auth, u => {
        user.value    = u
        loading.value = false
        resolve(u)
      })
    })
  }

  /* ── Connexion ── */
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

  /* ── Déconnexion ── */
  async function signOut() {
    try {
      await fbSignOut(auth)
    } catch (e) {
      if (import.meta.env.DEV) console.error('signOut error:', e)
    } finally {
      // Réinitialise l'état local dans tous les cas
      user.value  = null
      error.value = ''
    }
  }

  /* ── Traduction des codes d'erreur Firebase ── */
  function mapError(code) {
    const msgs = {
      'auth/invalid-email':          'Adresse email invalide.',
      'auth/user-not-found':         'Aucun compte trouvé pour cet email.',
      'auth/wrong-password':         'Mot de passe incorrect.',
      'auth/invalid-credential':     'Email ou mot de passe incorrect.',
      'auth/too-many-requests':      'Trop de tentatives. Réessayez plus tard.',
      'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
    }
    return msgs[code] || 'Une erreur est survenue. Réessayez.'
  }

  return { user, loading, error, init, signIn, signOut }
})
