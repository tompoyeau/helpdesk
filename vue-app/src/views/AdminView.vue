<template>
  <section style="padding:12px">

    <!-- Accès refusé -->
    <div v-if="!userStore.isAdmin" class="content-card" style="text-align:center;padding:48px 24px">
      <ShieldOff :size="36" style="margin:0 auto 12px;color:var(--text-muted)" />
      <h2 style="margin-bottom:6px">Accès restreint</h2>
      <p style="color:var(--text-muted)">Vous n'avez pas les droits administrateur.</p>
    </div>

    <template v-else>

      <!-- En-tête + onglets -->
      <div class="content-card" style="padding:0;overflow:hidden">

        <div class="admin-head">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="admin-icon-wrap"><Shield :size="16" /></div>
            <div>
              <h2 style="margin:0 0 2px;font-size:0.9375rem">Administration</h2>
              <p style="margin:0;color:var(--text-muted);font-size:0.75rem">
                Gérez les accès, les collaborateurs et les plannings
              </p>
            </div>
          </div>
        </div>

        <!-- Onglets -->
        <div class="admin-tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="admin-tab"
            :class="{ active: tab === t.key }"
            @click="tab = t.key"
          >
            <component :is="t.icon" :size="13" />
            {{ t.label }}
          </button>
        </div>

        <!-- Contenu -->
        <div class="admin-body">

          <!-- Onglet Accès -->
          <div v-if="tab === 'acces'">
            <div class="admin-info-box" style="margin-bottom:16px">
              <Info :size="13" style="flex-shrink:0;margin-top:1px;color:var(--accent)" />
              <span>
                Le premier administrateur doit être activé manuellement dans la
                <a href="https://console.firebase.google.com" target="_blank">console Firebase</a>
                : <code>Firestore → personnes → {uid} → isAdmin: true</code>
              </span>
            </div>

            <div style="margin-bottom:12px;color:var(--text-muted);font-size:0.75rem">
              {{ userStore.users.length }} collaborateur{{ userStore.users.length > 1 ? 's' : '' }}
              · {{ adminCount }} admin{{ adminCount > 1 ? 's' : '' }}
            </div>

            <div v-if="userStore.loading" style="padding:24px;text-align:center;color:var(--text-muted)">
              Chargement…
            </div>
            <table v-else class="w-full" style="font-size:0.8125rem">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th class="desktop-only">Email</th>
                  <th>Administrateur</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in userStore.users" :key="u.uid" :class="{ 'admin-row': u.isAdmin }">
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div
                        class="person-avatar"
                        style="width:28px;height:28px;font-size:0.625rem;flex-shrink:0"
                        :style="u.isAdmin ? 'background:linear-gradient(135deg,#6366F1,#A78BFA)' : ''"
                      >
                        {{ `${u.nom?.[0] ?? ''}${u.prenom?.[0] ?? ''}`.toUpperCase() }}
                      </div>
                      <div>
                        <div style="font-weight:600">{{ u.nom }} {{ u.prenom }}</div>
                        <div style="font-size:0.6875rem;color:var(--text-muted)">{{ u.niveau }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="desktop-only" style="color:var(--text-muted)">{{ u.email || '—' }}</td>
                  <td>
                    <label
                      class="toggle-label flex items-center gap-2"
                      :class="isSelf(u) ? '' : 'cursor-pointer'"
                    >
                      <input
                        type="checkbox"
                        :checked="u.isAdmin"
                        :disabled="isSelf(u)"
                        class="toggle-input"
                        @change="toggleAdmin(u)"
                      >
                      <span class="toggle-track"><span class="toggle-thumb"></span></span>
                      <span class="toggle-text" :style="u.isAdmin ? 'color:var(--accent);font-weight:600' : ''">
                        {{ u.isAdmin ? 'Admin' : 'User' }}
                      </span>
                    </label>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Onglet Collaborateurs -->
          <div v-else-if="tab === 'collab'">
            <AdminCollaborateurs />
          </div>

          <!-- Onglet Planning -->
          <div v-else-if="tab === 'planning'">
            <AdminPlanning />
          </div>

        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.admin-head {
  padding: 20px 20px 0;
}
.admin-icon-wrap {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--accent-light); color: var(--accent);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.admin-tabs {
  display: flex; gap: 2px;
  padding: 12px 20px 0;
  border-bottom: 1px solid var(--border);
}
.admin-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  font-size: 0.8125rem; font-weight: 500;
  border: none; background: transparent; cursor: pointer;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
  border-radius: 8px 8px 0 0;
}
.admin-tab:hover { color: var(--text); background: var(--bg-hover); }
.admin-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.admin-body { padding: 20px; }

.admin-info-box {
  display: flex; align-items: flex-start; gap: 8px;
  background: var(--accent-light);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 10px; padding: 10px 12px;
  font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;
}
.admin-info-box a { color: var(--accent); text-decoration: underline; }
.admin-info-box code {
  font-family: var(--font-mono); font-size: 0.6875rem;
  background: rgba(99,102,241,0.1); padding: 1px 5px; border-radius: 4px;
}
.admin-row { background: rgba(99,102,241,0.03); }
</style>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Shield, ShieldOff, Info, Users, CalendarDays } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useAuthStore } from '@/stores/authStore'
import AdminCollaborateurs from '@/components/admin/AdminCollaborateurs.vue'
import AdminPlanning       from '@/components/admin/AdminPlanning.vue'

const userStore = useUserStore()
const auth      = useAuthStore()

const tab = ref('acces')
const tabs = [
  { key: 'acces',    label: 'Accès',          icon: Shield       },
  { key: 'collab',   label: 'Collaborateurs', icon: Users        },
  { key: 'planning', label: 'Planning',       icon: CalendarDays },
]

onMounted(() => {
  if (userStore.isAdmin) userStore.loadAllUsers()
})

const adminCount = computed(() => userStore.users.filter(u => u.isAdmin).length)
function isSelf(u)      { return u.uid === auth.user?.uid }

async function toggleAdmin(u) {
  await userStore.setAdmin(u.uid, !u.isAdmin)
}
</script>
