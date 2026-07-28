<template>
  <div class="modal-backdrop" @click.self="$emit('close')">

    <!-- ── Étape 1 : édition ── -->
    <div v-if="step === 1" class="modal-box">

      <div class="modal-header">
        <div>
          <h3>{{ ressource.nom }} {{ ressource.prenom }}</h3>
          <p class="modal-sub">{{ dateLabel }}</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span v-if="totalHeures > 0" class="heures-badge">
            <Clock :size="11" /> {{ fmtHeures(totalHeures) }}
          </span>
          <button class="btn-close" @click="$emit('close')"><X :size="14" /></button>
        </div>
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

        <div v-for="(b, i) in blocks" :key="i" class="block-row" :class="{ 'block-row-editing': editingIdx === i }">

          <!-- ── Mode édition ── -->
          <template v-if="editingIdx === i">
            <div class="chips-grid chips-grid-sm">
              <div v-for="group in CHIP_GROUPS" :key="group.label" class="chips-col">
                <div class="chips-col-label">{{ group.label }}</div>
                <button
                  v-for="code in group.codes"
                  :key="code"
                  class="activity-chip activity-chip-sm"
                  :class="{ selected: editingBlock.code === code }"
                  :style="editingBlock.code === code
                    ? { borderColor: chipColor(code), background: chipBg(chipColor(code)) }
                    : {}"
                  @click="selectEditCode(code)"
                >
                  <span class="chip-dot" :style="{ background: chipColor(code) }"></span>
                  {{ chipLabel(code) }}
                </button>
              </div>
            </div>
            <div class="edit-time-row">
              <button
                v-if="PRESETS[editingBlock.code]"
                class="btn-preset-xs"
                title="Pré-remplir les heures"
                @click="applyEditPreset"
              >
                <Zap :size="10" />
              </button>
              <select v-model="editingBlock.startSlot" class="form-input form-input-xs" @change="editError = ''">
                <option v-for="(t, idx) in TIME_SLOTS.slice(0, 44)" :key="idx" :value="idx">{{ t }}</option>
              </select>
              <span style="color:var(--text-muted);font-size:0.75rem;flex-shrink:0">→</span>
              <select v-model="editingBlock.endSlot" class="form-input form-input-xs" @change="editError = ''">
                <option
                  v-for="(t, idx) in TIME_SLOTS.slice(1)"
                  :key="idx + 1"
                  :value="idx + 1"
                  :disabled="idx + 1 <= editingBlock.startSlot"
                >{{ t }}</option>
              </select>
              <button class="btn-edit-confirm" title="Valider" @click="confirmEdit"><Check :size="11" /></button>
              <button class="btn-edit-cancel"  title="Annuler" @click="cancelEdit"><X   :size="11" /></button>
            </div>
          </template>

          <!-- ── Mode lecture ── -->
          <template v-else>
            <span class="block-dot" :style="{ background: activityColor(b.code) }"></span>
            <span class="block-name">{{ activityName(b.code) }}</span>
            <span class="block-time">{{ TIME_SLOTS[b.startSlot] }} → {{ TIME_SLOTS[b.endSlot] || TIME_SLOTS[44] }}</span>
            <button class="btn-edit-block" title="Modifier ce créneau" @click="startEdit(i)">
              <Pencil :size="11" />
            </button>
            <button class="btn-remove" @click="removeBlock(i)" title="Supprimer">
              <Trash2 :size="12" />
            </button>
          </template>
        </div>

        <div v-if="editError" class="form-error" style="margin-top:6px">{{ editError }}</div>
      </div>

      <!-- Formulaire ajout -->
      <div class="add-section">
        <div class="section-title">Ajouter une activité</div>

        <!-- Grille chips (5 colonnes) -->
        <div class="chips-grid">
          <div v-for="group in CHIP_GROUPS" :key="group.label" class="chips-col">
            <div class="chips-col-label">{{ group.label }}</div>
            <button
              v-for="code in group.codes"
              :key="code"
              class="activity-chip"
              :class="{ selected: newBlock.code === code }"
              :style="newBlock.code === code
                ? { borderColor: chipColor(code), background: chipBg(chipColor(code)) }
                : {}"
              @click="selectCode(code)"
            >
              <span class="chip-dot" :style="{ background: chipColor(code) }"></span>
              {{ chipLabel(code) }}
            </button>
          </div>
        </div>

        <!-- Contrôles horaires (visibles après sélection) -->
        <div v-if="newBlock.code" class="add-form">
          <button
            v-if="PRESETS[newBlock.code]"
            class="btn-preset"
            @click="applyPreset"
          >
            <Zap :size="11" /> Pré-remplir
          </button>
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
          <button class="btn-add" @click="addBlock">
            <Plus :size="12" /> Ajouter
          </button>
        </div>
        <div v-if="overlapError" class="form-error">{{ overlapError }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" @click="$emit('close')">Annuler</button>
        <button class="btn-save" :disabled="!hasChanged" @click="goToStep2">Valider</button>
      </div>
    </div>

    <!-- ── Étape 2 : appliquer à d'autres ── -->
    <div v-else class="modal-box">
      <div class="modal-header">
        <div>
          <h3>Appliquer ce planning</h3>
          <p class="modal-sub">{{ ressource.nom }} {{ ressource.prenom }} · {{ dateLabel }}</p>
        </div>
        <button class="btn-close" @click="$emit('close')"><X :size="14" /></button>
      </div>

      <!-- Timeline récap -->
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
          />
        </div>
      </div>

      <!-- Appliquer à d'autres collabs -->
      <div class="apply-section" v-if="otherCollabs.length">
        <div class="section-title"><Users :size="11" /> Appliquer à d'autres collaborateurs</div>
        <!-- Recherche -->
        <div class="collab-search-wrap">
          <Search :size="13" class="collab-search-icon" />
          <input
            v-model="collabSearch"
            class="collab-search-input"
            type="text"
            placeholder="Rechercher un collaborateur…"
          />
        </div>
        <div class="collab-list">
          <label
            v-for="c in filteredCollabs"
            :key="c.idPersonne"
            class="collab-check"
          >
            <input type="checkbox" :value="c.idPersonne" v-model="selectedCollabs" />
            <div class="person-avatar" style="width:22px;height:22px;font-size:0.5rem;flex-shrink:0">
              {{ `${c.nom?.[0] ?? ''}${c.prenom?.[0] ?? ''}`.toUpperCase() }}
            </div>
            <span>{{ c.nom }} {{ c.prenom }}</span>
          </label>
          <span v-if="!filteredCollabs.length" class="empty-hint" style="padding:4px 0">Aucun résultat</span>
        </div>
        <div class="quick-actions">
          <button class="btn-ghost-xs" @click="selectedCollabs = sortedCollabs.map(c => c.idPersonne)">Tous</button>
          <button class="btn-ghost-xs" @click="selectedCollabs = []">Aucun</button>
        </div>
        <!-- Option semaine pour les collabs sélectionnés -->
        <label v-if="selectedCollabs.length" class="week-check" style="margin-top:10px">
          <input type="checkbox" v-model="applyCollabsWholeWeek" />
          <span>Appliquer également sur toute la semaine pour ces collaborateurs</span>
        </label>
      </div>

      <!-- Appliquer sur toute la semaine -->
      <div class="apply-section">
        <div class="section-title"><CalendarDays :size="11" /> Appliquer sur toute la semaine</div>
        <label class="week-check">
          <input type="checkbox" v-model="applyWholeWeek" />
          <span>Répliquer ce planning sur les autres jours de la semaine pour {{ ressource.prenom }}</span>
        </label>
        <p v-if="applyWholeWeek || applyCollabsWholeWeek" class="week-hint">
          Les samedis et jours fériés sont exclus. Les jours déjà planifiés seront écrasés.
        </p>
      </div>

      <div class="modal-footer">
        <button class="btn-ghost" @click="step = 1">← Retour</button>
        <button class="btn-save" @click="confirm">Confirmer</button>
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

/* Grille chips 5 colonnes */
.chips-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px 6px;
  margin-bottom: 14px;
}
.chips-grid-sm { margin-bottom: 8px; }
.chips-col {
  display: flex; flex-direction: column; gap: 4px;
}
.chips-col-label {
  font-size: 0.5625rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted); padding: 0 2px;
  margin-bottom: 1px;
}
.activity-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 7px; font-size: 0.7rem; font-weight: 500;
  border: 1.5px solid var(--border); border-radius: 7px;
  background: var(--bg-surface); color: var(--text);
  cursor: pointer; transition: all 0.12s;
  text-align: left; width: 100%; line-height: 1.2;
  overflow: hidden;
}
.activity-chip:hover { background: var(--bg-hover); border-color: var(--border-input); }
.activity-chip.selected { font-weight: 700; }
.activity-chip-sm { padding: 4px 6px; font-size: 0.6875rem; }
.chip-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}

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

/* Badge heures */
.heures-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.8125rem; font-weight: 700;
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--accent-light);
  padding: 3px 10px; border-radius: 999px;
}

/* Bouton croix */
.btn-close {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.btn-close:hover { background: var(--bg-hover); color: var(--text); }

/* Bouton corbeille (supprimer bloc) */
.btn-remove {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent;
  border-radius: var(--radius-sm); color: var(--text-subtle);
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.btn-remove:hover { background: rgba(239,68,68,0.08); color: #EF4444; border-color: rgba(239,68,68,0.3); }

/* Bouton crayon (modifier bloc) */
.btn-edit-block {
  width: 26px; height: 26px; margin-left: auto;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent;
  border-radius: var(--radius-sm); color: var(--text-subtle);
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.btn-edit-block:hover { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }

/* Boutons valider/annuler en mode édition */
.btn-edit-confirm, .btn-edit-cancel {
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); border: 1px solid;
  cursor: pointer; transition: background 0.12s; flex-shrink: 0;
}
.btn-edit-confirm { background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.4); color: #059669; }
.btn-edit-confirm:hover { background: rgba(52,211,153,0.2); }
.btn-edit-cancel  { background: transparent; border-color: var(--border); color: var(--text-muted); }
.btn-edit-cancel:hover { background: var(--bg-hover); }

/* Bloc en cours d'édition */
.block-row-editing {
  background: var(--accent-light);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin: 0 -6px;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px !important;
}
/* Ligne horaires + actions en mode édition */
.block-row-editing .edit-time-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; width: 100%;
}

/* Input select compact pour l'édition inline */
.form-input-edit { width: 130px; font-size: 0.6875rem; padding: 4px 6px; }
.form-input-xs   { width: 76px;  font-size: 0.6875rem; padding: 4px 6px; }

/* Bouton preset compact (mode édition) */
.btn-preset-xs {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; flex-shrink: 0;
  background: rgba(245,158,11,0.12); color: #D97706;
  border: 1px solid rgba(245,158,11,0.3); border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.15s;
}
.btn-preset-xs:hover { background: rgba(245,158,11,0.22); }

/* Bouton Pré-remplir */
.btn-preset {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; font-size: 0.75rem; font-weight: 600;
  background: rgba(245,158,11,0.12); color: #D97706;
  border: 1px solid rgba(245,158,11,0.3); border-radius: var(--radius-md);
  cursor: pointer; transition: background 0.15s;
  white-space: nowrap;
}
.btn-preset:hover { background: rgba(245,158,11,0.22); }

/* Bouton Ajouter (formulaire) */
.btn-add {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; font-size: 0.75rem; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: background 0.15s;
  white-space: nowrap;
}
.btn-add:hover    { background: var(--accent-hover); }
.btn-add:disabled { opacity: 0.4; cursor: default; }

/* Bouton Valider */
.btn-save {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 18px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; cursor: pointer; transition: background 0.15s, transform 0.1s;
}
.btn-save:hover    { background: var(--accent-hover); }
.btn-save:active   { transform: scale(0.97); }
.btn-save:disabled { opacity: 0.4; cursor: default; }

/* Étape 2 — sections */
.apply-section {
  padding: 0 20px 16px;
  border-top: 1px solid var(--border);
}
/* Recherche collabs */
.collab-search-wrap {
  position: relative; margin: 8px 0 6px;
}
.collab-search-icon {
  position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); pointer-events: none;
}
.collab-search-input {
  width: 100%; padding: 6px 10px 6px 30px;
  border: 1px solid var(--border-input); border-radius: 8px;
  font-size: 0.75rem; background: var(--bg-surface); color: var(--text);
  outline: none; box-sizing: border-box;
}
.collab-search-input:focus { border-color: var(--border-focus); }

.collab-list {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 160px; overflow-y: auto;
  margin-top: 4px;
}
.collab-check {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 6px; border-radius: var(--radius-sm);
  cursor: pointer; font-size: 0.8125rem;
  transition: background 0.12s;
}
.collab-check:hover { background: var(--bg-hover); }
.collab-check input { cursor: pointer; accent-color: var(--accent); }
.quick-actions {
  display: flex; gap: 6px; margin-top: 8px;
}
.btn-ghost-xs {
  padding: 2px 10px; border-radius: 6px; font-size: 0.6875rem;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer;
}
.btn-ghost-xs:hover { background: var(--bg-hover); color: var(--text); }

.week-check {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 0.8125rem; cursor: pointer; margin-top: 8px;
}
.week-check input { cursor: pointer; accent-color: var(--accent); margin-top: 2px; flex-shrink: 0; }
.week-hint {
  font-size: 0.75rem; color: #D97706;
  background: rgba(245,158,11,0.08); border-radius: 8px;
  padding: 6px 10px; margin-top: 8px;
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { X, Trash2, Plus, Zap, Users, CalendarDays, Clock, Pencil, Check, Search } from 'lucide-vue-next'
import { useAdminStore, TIME_SLOTS, QUICK_PRESETS, DAY_PRESETS } from '@/stores/adminStore'
import { ACTIVITY_MAPPING } from '@/stores/dataStore'

const props = defineProps({
  ressource:   { type: Object,  required: true }, // { nom, prenom, idPersonne, activites }
  date:        { type: Date,    required: true },
  otherCollabs: { type: Array,  default: () => [] }, // autres collabs actifs ce jour
})
const emit = defineEmits(['close', 'saved'])

const admin = useAdminStore()

/* ── Étapes ── */
const step                = ref(1)
const selectedCollabs      = ref([])
const applyWholeWeek       = ref(false)
const applyCollabsWholeWeek = ref(false)

/* ── Recherche collabs (étape 2) ── */
const collabSearch = ref('')
const sortedCollabs = computed(() =>
  [...props.otherCollabs].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
)
const filteredCollabs = computed(() => {
  const q = collabSearch.value.toLowerCase().trim()
  if (!q) return sortedCollabs.value
  return sortedCollabs.value.filter(c =>
    c.nom.toLowerCase().includes(q) || c.prenom.toLowerCase().includes(q)
  )
})

/* ── Données ── */
const blocks = ref(admin.parseBlocks(props.ressource.activites || []))
const _initialBlocks = JSON.stringify(blocks.value)
const hasChanged = computed(() => JSON.stringify(blocks.value) !== _initialBlocks)
const newBlock = ref({ code: '', startSlot: 0, endSlot: 4 })
const overlapError = ref('')

/* ── Options activités ── */
const activityOptions = Object.entries(ACTIVITY_MAPPING)

/* ── Groupes de chips ── */
const CHIP_GROUPS = [
  { label: 'Matin', codes: ['0', '9', '12', '20', 'samedi', '28'] },
  { label: 'Midi',  codes: ['1', '10', '13', '21'] },
  { label: 'Aprem', codes: ['15', '16', '17', '22', '27'] },
  { label: 'Soir',  codes: ['2', '11', '14', '23', '29'] },
  { label: 'Autre', codes: ['30', '6', '8', '5', '7', '31', '24', '26', '32'] },
]

/* Un chip peut être un code d'activité ('20') ou une clé DAY_PRESETS ('samedi'). */
function realCode(id)  { return DAY_PRESETS[id]?.code ?? id }
function chipLabel(id) { return DAY_PRESETS[id]?.label ?? ACTIVITY_MAPPING[id]?.categorie ?? id }
function chipColor(id) { return ACTIVITY_MAPPING[realCode(id)]?.couleur ?? 'var(--accent)' }

/* ── Presets créneaux (importés depuis adminStore) ── */
const PRESETS = QUICK_PRESETS

/** Applique un ajout rapide « journée type » (ex. Samedi) : ajoute ses blocs en
    remplaçant ceux qui chevauchent, garde les autres. */
function applyDayPreset(id) {
  const def = DAY_PRESETS[id]
  if (!def) return
  overlapError.value = ''
  const kept = blocks.value.filter(b =>
    !def.blocks.some(p => p.startSlot < b.endSlot && p.endSlot > b.startSlot)
  )
  const added = def.blocks.map(p => ({ code: def.code, ...p }))
  blocks.value = [...kept, ...added].sort((a, b) => a.startSlot - b.startSlot)
  autoFilledCode.value = null
  newBlock.value = { code: '', startSlot: 0, endSlot: 4 }
}

function onCodeChange() {
  newBlock.value.startSlot = 0
  newBlock.value.endSlot   = 4
  overlapError.value = ''
}

/* ── Sélection via chip ── */
// Mémorise le code dont le preset a été auto-appliqué (null = modif manuelle)
const autoFilledCode = ref(null)

function selectCode(code) {
  // Chip « journée type » (Samedi) : applique directement ses blocs
  if (DAY_PRESETS[code]) {
    applyDayPreset(code)
    return
  }
  if (newBlock.value.code === code) return

  // Si le remplissage actuel vient d'un auto-preset non modifié → on le retire
  if (autoFilledCode.value !== null) {
    blocks.value = []
    autoFilledCode.value = null
  }

  newBlock.value.code = code
  onCodeChange()

  // Auto-apply si journée vide et preset dispo
  if (blocks.value.length === 0 && PRESETS[code]) {
    applyPreset()
    autoFilledCode.value = code  // marqué après applyPreset (qui le reset à null)
  }
}
function selectEditCode(code) {
  // Chip « journée type » : convertit le bloc édité en son code réel + horaires
  if (DAY_PRESETS[code]) {
    const def = DAY_PRESETS[code]
    editingBlock.value.code      = def.code
    editingBlock.value.startSlot = def.blocks[0].startSlot
    editingBlock.value.endSlot   = def.blocks[def.blocks.length - 1].endSlot
    editError.value = ''
    return
  }
  editingBlock.value.code = code
  editError.value = ''
}

/* ── Couleur chip (rgba → opacité réduite pour background) ── */
function chipBg(couleur) {
  return couleur.replace(/,\s*[\d.]+\s*\)/, ', 0.14)')
}

function applyPreset() {
  overlapError.value = ''
  const preset = PRESETS[newBlock.value.code]
  if (!preset) return

  // Retire les blocs existants qui chevauchent le preset, conserve les autres
  const kept = blocks.value.filter(b =>
    !preset.some(p => p.startSlot < b.endSlot && p.endSlot > b.startSlot)
  )
  const newBlocks = preset.map(p => ({ code: newBlock.value.code, ...p }))
  blocks.value = [...kept, ...newBlocks].sort((a, b) => a.startSlot - b.startSlot)
  newBlock.value = { code: '', startSlot: 0, endSlot: 4 }
  autoFilledCode.value = null  // clic manuel → ne plus remplacer au prochain chip
}

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

/* ── Heures travaillées ── */
const ABSENCE_CODES = new Set(['30', '6', '8']) // CP, Indisponible, Récup
const totalHeures = computed(() => {
  const slots = previewSlots.value.filter(a => a && a !== '' && !ABSENCE_CODES.has(String(a))).length
  return slots * 0.25
})
function fmtHeures(h) {
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`
}

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
  autoFilledCode.value = null
}

function removeBlock(i) {
  if (editingIdx.value === i) cancelEdit()
  blocks.value = blocks.value.filter((_, idx) => idx !== i)
  autoFilledCode.value = null
}

/* ── Édition inline d'un bloc existant ── */
const editingIdx   = ref(null)
const editingBlock = ref(null)
const editError    = ref('')

function startEdit(i) {
  editingIdx.value   = i
  editingBlock.value = { ...blocks.value[i] }
  editError.value    = ''
  overlapError.value = ''
}

function cancelEdit() {
  editingIdx.value   = null
  editingBlock.value = null
  editError.value    = ''
}

function applyEditPreset() {
  const preset = PRESETS[editingBlock.value.code]
  if (!preset || !preset.length) return
  editingBlock.value.startSlot = preset[0].startSlot
  editingBlock.value.endSlot   = preset[preset.length - 1].endSlot
}

function confirmEdit() {
  editError.value = ''
  const { code, startSlot, endSlot } = editingBlock.value
  if (!code || endSlot <= startSlot) {
    editError.value = 'Créneau invalide.'
    return
  }
  const overlap = blocks.value.some((b, i) =>
    i !== editingIdx.value && startSlot < b.endSlot && endSlot > b.startSlot
  )
  if (overlap) {
    editError.value = 'Ce créneau chevauche une autre activité.'
    return
  }
  autoFilledCode.value = null
  blocks.value = blocks.value
    .map((b, i) => i === editingIdx.value ? { code, startSlot, endSlot } : b)
    .sort((a, b) => a.startSlot - b.startSlot)
  cancelEdit()
}

/* ── Navigation étapes ── */
function goToStep2() {
  selectedCollabs.value       = []
  applyWholeWeek.value        = false
  applyCollabsWholeWeek.value = false
  step.value = 2
}

function confirm() {
  emit('saved', {
    activites:           admin.buildActivites(blocks.value),
    toCollabIds:         selectedCollabs.value,
    applyWholeWeek:      applyWholeWeek.value,
    applyCollabsWholeWeek: applyCollabsWholeWeek.value,
  })
}
</script>
