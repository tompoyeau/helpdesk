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

          <!-- Onglet Collaborateurs -->
          <div v-if="tab === 'collab'">
            <AdminCollaborateurs />
          </div>

          <!-- Onglet Planning -->
          <div v-else-if="tab === 'planning'">
            <AdminPlanning />
          </div>

          <!-- Onglet Forecast -->
          <div v-else-if="tab === 'forecast'">
            <AdminForecast />
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

</style>

<script setup>
import { ref, watch } from 'vue'
import { Shield, ShieldOff, Users, CalendarDays, TrendingUp } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import AdminCollaborateurs from '@/components/admin/AdminCollaborateurs.vue'
import AdminPlanning       from '@/components/admin/AdminPlanning.vue'
import AdminForecast       from '@/components/admin/AdminForecast.vue'

const userStore = useUserStore()

const tab = ref('collab')
const tabs = [
  { key: 'collab',    label: 'Collaborateurs', icon: Users        },
  { key: 'planning',  label: 'Planning',       icon: CalendarDays },
  { key: 'forecast',  label: 'Forecast',       icon: TrendingUp   },
]

// Charge la liste dès que isAdmin devient true (y compris au refresh,
// quand Firebase finit de s'initialiser après le montage du composant)
watch(
  () => userStore.isAdmin,
  (val) => { if (val) userStore.loadAllUsers() },
  { immediate: true }
)
</script>
