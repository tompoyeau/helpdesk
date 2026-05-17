<template>
  <div class="notif-wrap" ref="wrapRef">
    <!-- Bouton cloche -->
    <button class="btn-icon notif-btn" :class="{ 'notif-btn-active': open }" @click="toggle" title="Notifications">
      <Bell :size="15" />
      <span v-if="notifStore.unreadCount > 0" class="notif-badge">
        {{ notifStore.unreadCount > 9 ? '9+' : notifStore.unreadCount }}
      </span>
    </button>

    <!-- Dropdown -->
    <Teleport to="body">
      <div v-if="open" class="notif-dropdown" :style="dropdownStyle">
        <div class="notif-header">
          <span class="notif-title">Notifications</span>
          <button
            v-if="notifStore.unreadCount > 0"
            class="notif-mark-all"
            @click="notifStore.markAllRead()"
          >
            Tout marquer lu
          </button>
        </div>

        <div v-if="notifStore.items.length === 0" class="notif-empty">
          <BellOff :size="22" style="opacity:0.3" />
          <span>Aucune notification</span>
        </div>

        <div v-else class="notif-list">
          <div
            v-for="n in notifStore.items"
            :key="n.id"
            class="notif-item"
            :class="{ 'notif-item-unread': !n.read }"
            @click="notifStore.markRead(n.id)"
          >
            <div class="notif-dot" :class="{ 'notif-dot-unread': !n.read }"></div>
            <div class="notif-content">
              <div class="notif-message">{{ n.message }}</div>
              <div class="notif-time">{{ timeAgo(n.createdAt) }}</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Bell, BellOff } from 'lucide-vue-next'
import { useNotificationStore } from '@/stores/notificationStore'

const notifStore = useNotificationStore()
const open       = ref(false)
const wrapRef    = ref(null)
const dropdownStyle = ref({})

function toggle() {
  open.value = !open.value
  if (open.value) positionDropdown()
}

function positionDropdown() {
  const rect = wrapRef.value?.getBoundingClientRect()
  if (!rect) return
  if (window.innerWidth <= 640) {
    // Mobile : dropdown pleine largeur, épinglé à 8px des bords
    dropdownStyle.value = {
      position: 'fixed',
      top:   rect.bottom + 6 + 'px',
      left:  '8px',
      right: '8px',
      width: 'auto',
      zIndex: 9999,
    }
  } else {
    dropdownStyle.value = {
      position: 'fixed',
      top:   rect.bottom + 6 + 'px',
      right: Math.max(8, window.innerWidth - rect.right) + 'px',
      zIndex: 9999,
    }
  }
}

function handleOutside(e) {
  if (open.value && wrapRef.value && !wrapRef.value.contains(e.target)) {
    // Vérifie si le clic est dans le dropdown (via Teleport — hors du DOM du composant)
    const dropdown = document.querySelector('.notif-dropdown')
    if (!dropdown?.contains(e.target)) open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleOutside))

const MONTHS_FR = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Date.now() - date.getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)  return "À l'instant"
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)    return `Il y a ${d}j`
  return `${date.getDate()} ${MONTHS_FR[date.getMonth()]}`
}
</script>

<style scoped>
.notif-wrap { position: relative; }

.notif-btn { position: relative; }
.notif-btn-active { background: var(--bg-hover) !important; }

.notif-badge {
  position: absolute; top: 2px; right: 2px;
  min-width: 14px; height: 14px; padding: 0 3px;
  background: #ef4444; color: #fff;
  border-radius: 7px; font-size: 0.5rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  line-height: 1; pointer-events: none;
}

.notif-dropdown {
  width: 300px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-md); box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  overflow: hidden;
}

.notif-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border);
}
.notif-title { font-size: 0.8125rem; font-weight: 700; color: var(--text); }
.notif-mark-all {
  font-size: 0.6875rem; font-weight: 600; color: var(--accent);
  background: none; border: none; cursor: pointer; padding: 0;
}
.notif-mark-all:hover { text-decoration: underline; }

.notif-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 28px 16px; color: var(--text-muted); font-size: 0.75rem;
}

.notif-list { max-height: 320px; overflow-y: auto; }

.notif-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  transition: background 0.12s;
  border-bottom: 1px solid var(--border);
}
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: var(--bg-hover); }

.notif-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
  background: var(--border);
}
.notif-dot-unread { background: var(--accent); }

.notif-content { flex: 1; min-width: 0; }
.notif-message { font-size: 0.75rem; color: var(--text); line-height: 1.4; }
.notif-item-unread .notif-message { font-weight: 600; }
.notif-time { font-size: 0.625rem; color: var(--text-muted); margin-top: 2px; }
</style>
