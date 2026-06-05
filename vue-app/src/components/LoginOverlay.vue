<template>
  <div id="loginOverlay">
    <div class="login-card">

      <!-- Logo + Titre -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <svg width="56" height="56" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" rx="110" ry="110" fill="url(#bg-login)"/>
          <defs>
            <linearGradient id="bg-login" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#4F46E5"/>
              <stop offset="100%" stop-color="#7C3AED"/>
            </linearGradient>
          </defs>
          <g transform="translate(256,256)" stroke="white" stroke-linecap="round" stroke-width="26" opacity="0.7">
            <line x1="0" y1="-108" x2="0" y2="-148"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(45)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(90)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(135)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(180)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(225)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(270)"/>
            <line x1="0" y1="-108" x2="0" y2="-148" transform="rotate(315)"/>
          </g>
          <circle cx="256" cy="256" r="78" fill="white"/>
        </svg>
        <h2 class="login-title" style="margin:0">Helio</h2>
      </div>
      <p class="login-subtitle">Connectez-vous pour continuer.</p>

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

        <!-- Accès expiré -->
        <div v-if="auth.expiredSession" class="login-expired">
          <ShieldOff :size="13" />
          Votre accès à Helio a expiré. Contactez votre responsable.
        </div>

        <!-- Erreur -->
        <div v-else-if="auth.error" class="login-error">
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
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldOff } from 'lucide-vue-next'

const auth     = useAuthStore()
const email    = ref('')
const password = ref('')
const showPwd  = ref(false)

async function handleSubmit() {
  if (!email.value || !password.value) return
  await auth.signIn(email.value, password.value)
}
</script>
