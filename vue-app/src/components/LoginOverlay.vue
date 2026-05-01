<template>
  <div id="loginOverlay">
    <div class="login-card">

      <!-- Logo -->
      <div class="login-logo">
        <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.95"/>
          <rect x="11" y="1" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.55"/>
          <rect x="1" y="11" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.55"/>
          <rect x="11" y="11" width="6" height="6" rx="1.5" fill="white" fill-opacity="0.95"/>
        </svg>
      </div>

      <h2 class="login-title">Dashboard CAI</h2>
      <p class="login-subtitle">Connectez-vous pour accéder au pilotage de l'activité.</p>

      <form class="login-form" @submit.prevent="handleSubmit" novalidate>

        <!-- Email -->
        <div class="login-field">
          <Mail class="login-field-icon" :size="15" />
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            class="login-input"
            autocomplete="email"
            required
          >
        </div>

        <!-- Mot de passe -->
        <div class="login-field">
          <Lock class="login-field-icon" :size="15" />
          <input
            v-model="password"
            :type="showPwd ? 'text' : 'password'"
            placeholder="Mot de passe"
            class="login-input"
            autocomplete="current-password"
            required
          >
          <button type="button" class="login-pwd-toggle" @click="showPwd = !showPwd" tabindex="-1">
            <EyeOff v-if="showPwd" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>

        <!-- Erreur -->
        <div v-if="auth.error" class="login-error">
          <AlertCircle :size="13" />
          {{ auth.error }}
        </div>

        <!-- Bouton -->
        <button type="submit" class="login-btn" :disabled="auth.loading">
          <template v-if="auth.loading">
            <Loader2 :size="14" class="login-spinner" />
            Connexion…
          </template>
          <template v-else>
            Se connecter
          </template>
        </button>

      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-vue-next'

const auth     = useAuthStore()
const email    = ref('')
const password = ref('')
const showPwd  = ref(false)

async function handleSubmit() {
  if (!email.value || !password.value) return
  await auth.signIn(email.value, password.value)
}
</script>
