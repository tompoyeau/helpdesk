<template>
  <section style="padding:12px">

    <!-- Accès refusé -->
    <div v-if="!userStore.isAdmin" class="content-card" style="text-align:center;padding:48px 24px">
      <ShieldOff :size="36" style="margin:0 auto 12px;color:var(--text-muted)" />
      <h2 style="margin-bottom:6px">Accès restreint</h2>
      <p style="color:var(--text-muted)">Vous n'avez pas les droits administrateur.</p>
    </div>

    <template v-else>
      <div class="content-card" style="font-size:0.8125rem">

        <!-- En-tête -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
          <div class="admin-icon-wrap">
            <Shield :size="16" />
          </div>
          <div>
            <h2 style="margin:0 0 2px;font-size:0.9375rem">Administration</h2>
            <p style="margin:0;color:var(--text-muted);font-size:0.75rem">
              Gérez les droits d'accès des utilisateurs
            </p>
          </div>
        </div>

        <!-- Info premier admin -->
        <div class="admin-info-box">
          <Info :size="13" style="flex-shrink:0;margin-top:1px;color:var(--accent)" />
          <span>
            Le premier administrateur doit être activé manuellement dans la
            <a href="https://console.firebase.google.com" target="_blank">console Firebase</a>
            : <code>Firestore → users → {uid} → isAdmin: true</code>
          </span>
        </div>

        <!-- Chargement -->
        <div v-if="userStore.loading" style="padding:32px;text-align:center;color:var(--text-muted)">
          Chargement…
        </div>

        <template v-else>
          <!-- Compteur -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="color:var(--text-muted)">
              {{ userStore.users.length }} utilisateur{{ userStore.users.length > 1 ? 's' : '' }}
              · {{ adminCount }} admin{{ adminCount > 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Tableau -->
          <table class="w-full">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th class="desktop-only">Inscription</th>
                <th class="desktop-only">Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in userStore.users" :key="u.uid" :class="{ 'admin-row': u.isAdmin }">
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div
                      class="person-avatar"
                      style="width:26px;height:26px;font-size:0.5625rem"
                      :style="u.isAdmin ? 'background:linear-gradient(135deg,#6366F1,#A78BFA)' : ''"
                    >
                      {{ initials(u.email) }}
                    </div>
                    <div>
                      <div style="font-weight:500">{{ u.email }}</div>
                      <div v-if="u.uid === auth.user?.uid" style="font-size:0.6875rem;color:var(--accent)">
                        Vous
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <label class="toggle-label flex items-center gap-2" :class="u.uid === auth.user?.uid ? '' : 'cursor-pointer'">
                    <input
                      type="checkbox"
                      :checked="u.isAdmin"
                      :disabled="u.uid === auth.user?.uid"
                      class="toggle-input"
                      @change="toggleAdmin(u)"
                    >
                    <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    <span class="toggle-text" :style="u.isAdmin ? 'color:var(--accent);font-weight:600' : ''">
                      {{ u.isAdmin ? 'Admin' : 'Utilisateur' }}
                    </span>
                  </label>
                </td>
                <td class="desktop-only" style="color:var(--text-muted)">{{ fmtDate(u.createdAt) }}</td>
                <td class="desktop-only" style="color:var(--text-muted)">{{ fmtDate(u.lastLogin) }}</td>
              </tr>
            </tbody>
          </table>

          <div v-if="!userStore.users.length" style="text-align:center;padding:32px;color:var(--text-muted)">
            Aucun utilisateur trouvé.
          </div>
        </template>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-info-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--accent-light);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 20px;
  line-height: 1.5;
}

.admin-info-box a {
  color: var(--accent);
  text-decoration: underline;
}

.admin-info-box code {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  background: rgba(99,102,241,0.1);
  padding: 1px 5px;
  border-radius: 4px;
}

.admin-row {
  background: rgba(99,102,241,0.03);
}
</style>

<script setup>
import { computed, onMounted } from 'vue'
import { Shield, ShieldOff, Info } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useAuthStore } from '@/stores/authStore'

const userStore = useUserStore()
const auth      = useAuthStore()

onMounted(() => {
  if (userStore.isAdmin) userStore.loadAllUsers()
})

const adminCount = computed(() => userStore.users.filter(u => u.isAdmin).length)

function initials(email) {
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

async function toggleAdmin(u) {
  await userStore.setAdmin(u.uid, !u.isAdmin)
}
</script>
