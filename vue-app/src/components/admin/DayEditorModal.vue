<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box">

      <div class="modal-header">
        <div>
          <h3>{{ ressource.nom }} {{ ressource.prenom }}</h3>
          <p class="modal-sub">{{ dateLabel }}</p>
        </div>
        <button class="btn-icon btn-icon-sm" @click="$emit('close')"><X :size="14" /></button>
      </div>

      <!-- Timeline visuelle -->
      <div class="timeline-wrap">
        <div class="timeline-labels">
          <span v-for="h in timeLabels" :key="h">{{ h }}</span>
        </div>
        <div class="timeline-bar">
          <div
            v-for="(code, i) in previewSlots"
            :key="i"
            class="timeline-slot"
            :style="{ background: slotColor(code) }"
            :title="slotLabel(code, i)"
          />
        </div>
      </div>

      <!-- Blocs existants -->
      <div class="blocks-section">
        <div class="section-title">Activités</div>
        <div v-if="!blocks.length" class="empty-hint">Aucune activité — journée vide</div>
        <div v-for="(b, i) in blocks" :key="i" class="block-row">
          <span class="block-dot" :style="{ background: activityColor(b.code) }"></span>
          <span class="block-name">{{ activityName(b.code) }}</span>
          <span class="block-time">{{ TIME_SLOTS[b.startSlot] }} → {{ TIME_SLOTS[b.endSlot] || TIME_SLOTS[44] }}</span>
          <button class="btn-icon btn-icon-sm btn-danger-ghost" @click="removeBlock(i)" title="Supprimer">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>

      <!-- Formulaire ajout -->
      <div class="add-section">
        <div class="section-title">Ajouter une activité</div>
        <div class="add-form">
          <select v-model="newBlock.code" class="form-input">
            <option value="">— Activité —</option>
            <option v-for="[code, act] in activityOptions" :key="code" :value="code">
              {{ act.categorie }}
            </option>
          </select>
          <select v-model="newBlock.startSlot" class="form-input form-input-sm">
            <option v-for="(t, i) in TIME_SLOTS.slice(0, 44)" :key="i" :value="i">{{ t }}</option>
          </select>
          <span style="color:var(--text-muted);font-size:0.75rem">→</span>
          <select v-model="newBlock.endSlot" class="form-input form-input-sm">
            <option
              v-for="(t, i) in TIME_SLOTS.slice(1)"
              :key="i + 1"
              :value="i + 1"
              :disabled="i + 1 <= newBlock.startSlot"
            >{{ t }}</option>
          </select>
          <button class="btn-primary btn-sm" :disabled="!newBlock.code" @click="addBlock">
            <Plus :size="12" /> Ajouter
          </button>
        </div>
        <div v-if="overlapError" class="form-error">{{ overlapError }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" @click="$emit('close')">Annuler</button>
        <button class="btn-primary" @click="save">Valider</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal-box {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  width: 100%; max-width: 560px;
  max-height: 90vh; overflow-y: auto;
  box-shadow: var(--shadow-md);
}
.modal-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 20px 12px;
}
.modal-header h3 { font-size: 0.9375rem; font-weight: 700; margin: 0 0 2px; }
.modal-sub { font-size: 0.75rem; color: var(--text-muted); margin: 0; }

/* Timeline */
.timeline-wrap { padding: 0 20px 12px; }
.timeline-labels {
  display: flex; justify-content: space-between;
  font-size: 0.625rem; color: var(--text-muted);
  margin-bottom: 4px;
}
.timeline-bar {
  display: flex; height: 20px; border-radius: 6px; overflow: hidden;
  border: 1px solid var(--border);
}
.timeline-slot { flex: 1; }

/* Blocs */
.blocks-section, .add-section {
  padding: 0 20px 16px;
  border-top: 1px solid var(--border);
}
.section-title {
  font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em;
  margin: 12px 0 8px;
}
.empty-hint { font-size: 0.75rem; color: var(--text-subtle); font-style: italic; }
.block-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-bottom: 1px solid var(--border);
  font-size: 0.8125rem;
}
.block-row:last-child { border-bottom: none; }
.block-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.block-name { flex: 1; font-weight: 500; }
.block-time { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); }
.btn-danger-ghost { color: #EF4444 !important; }
.btn-danger-ghost:hover { background: rgba(239,68,68,0.1) !important; }

/* Add form */
.add-form {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.form-input {
  border: 1px solid var(--border-input);
  border-radius: 8px; padding: 6px 8px;
  font-size: 0.75rem; background: var(--bg-surface); color: var(--text);
  outline: none;
}
.form-input:focus { border-color: var(--border-focus); }
.form-input-sm { width: 90px; }
.btn-sm {
  padding: 6px 12px !important; font-size: 0.75rem !important;
  display: flex; align-items: center; gap: 4px;
}
.form-error {
  margin-top: 8px; font-size: 0.75rem; color: #EF4444;
  background: rgba(239,68,68,0.08); border-radius: 8px; padding: 6px 10px;
}

/* Footer */
.modal-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 20px 20px; border-top: 1px solid var(--border);
}
.btn-ghost {
  padding: 7px 16px; border-radius: 8px; font-size: 0.8125rem;
  border: 1px solid var(--border); cursor: pointer;
  background: transparent; color: var(--text);
}
.btn-ghost:hover { background: var(--bg-hover); }
</style>

<script setup>
import { ref, computed } from 'vue'
import { X, Trash2, Plus } from 'lucide-vue-next'
import { useAdminStore, TIME_SLOTS } from '@/stores/adminStore'
import { ACTIVITY_MAPPING } from '@/stores/dataStore'

const props = defineProps({
  ressource: { type: Object, required: true }, // { nom, prenom, idPersonne, activites }
  date:      { type: Date,   required: true },
})
const emit = defineEmits(['close', 'saved'])

const admin = useAdminStore()

/* ── Données ── */
const blocks = ref(admin.parseBlocks(props.ressource.activites || []))
const newBlock = ref({ code: '', startSlot: 0, endSlot: 4 })
const overlapError = ref('')

/* ── Options activités ── */
const activityOptions = Object.entries(ACTIVITY_MAPPING)

/* ── Label date ── */
const DAYS_FR   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
const dateLabel = computed(() => {
  const d = props.date
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
})

/* ── Timeline preview ── */
const previewSlots = computed(() => admin.buildActivites(blocks.value))
const timeLabels   = ['08h','10h','12h','14h','16h','18h','']

function slotColor(code) {
  return code ? (ACTIVITY_MAPPING[code]?.couleur.replace(', 1)', ', 0.8)') || '#ccc') : 'var(--border)'
}
function slotLabel(code, i) {
  return code ? `${TIME_SLOTS[i]} — ${ACTIVITY_MAPPING[code]?.categorie}` : TIME_SLOTS[i]
}

/* ── Couleurs / noms ── */
function activityColor(code) { return ACTIVITY_MAPPING[code]?.couleur || '#ccc' }
function activityName(code)  { return ACTIVITY_MAPPING[code]?.categorie || code }

/* ── Ajout d'un bloc ── */
function addBlock() {
  overlapError.value = ''
  const { code, startSlot, endSlot } = newBlock.value
  if (!code || endSlot <= startSlot) return

  // Vérifie les chevauchements
  const overlap = blocks.value.some(b =>
    startSlot < b.endSlot && endSlot > b.startSlot
  )
  if (overlap) {
    overlapError.value = 'Ce créneau chevauche une activité existante.'
    return
  }

  blocks.value = [...blocks.value, { code, startSlot, endSlot }]
    .sort((a, b) => a.startSlot - b.startSlot)
  newBlock.value = { code: '', startSlot: endSlot, endSlot: Math.min(endSlot + 4, 44) }
}

function removeBlock(i) {
  blocks.value = blocks.value.filter((_, idx) => idx !== i)
}

/* ── Sauvegarde ── */
function save() {
  emit('saved', admin.buildActivites(blocks.value))
}
</script>
