<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-box">

      <div class="modal-header">
        <h3>{{ isEdit ? 'Modifier le collaborateur' : 'Nouveau collaborateur' }}</h3>
        <button class="btn-close" @click="$emit('close')"><X :size="14" /></button>
      </div>

      <form @submit.prevent="submit" class="collab-form">
        <div class="form-row">
          <div class="form-group">
            <label>Nom *</label>
            <input v-model="form.nom" required placeholder="DUPONT" class="form-input" />
          </div>
          <div class="form-group">
            <label>Prénom *</label>
            <input v-model="form.prenom" required placeholder="Jean" class="form-input" />
          </div>
        </div>

        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" placeholder="jean.dupont@exemple.fr" class="form-input" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Niveau</label>
            <select v-model="form.niveau" class="form-input">
              <option value="">—</option>
              <option>Junior</option>
              <option>Confirmé</option>
              <option>Senior</option>
              <option>Expert</option>
            </select>
          </div>
          <div class="form-group">
            <label>Rôle métier</label>
            <select v-model="form.role" class="form-input">
              <option value="">—</option>
              <option>Technique</option>
              <option>Fonctionnel</option>
              <option>Technico-fonctionnel</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Date d'arrivée *</label>
            <input v-model="form.arriveeInput" type="date" required class="form-input" />
          </div>
          <div class="form-group">
            <label>Date de départ</label>
            <input v-model="form.departInput" type="date" class="form-input" />
          </div>
        </div>

        <div class="form-group toggle-row">
          <label class="toggle-label flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.isAdmin" class="toggle-input">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-text">Administrateur</span>
          </label>
        </div>

        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>

        <div class="modal-footer">
          <button type="button" class="btn-ghost" @click="$emit('close')">Annuler</button>
          <button type="submit" class="btn-save" :disabled="saving || !isDirty">
            <span v-if="saving">Enregistrement…</span>
            <span v-else>{{ isEdit ? 'Enregistrer' : 'Créer' }}</span>
          </button>
        </div>
      </form>
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
  width: 100%; max-width: 520px;
  max-height: 90vh; overflow-y: auto;
  box-shadow: var(--shadow-md);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 0;
}
.modal-header h3 { font-size: 0.9375rem; font-weight: 700; margin: 0; }
.collab-form { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
.form-input {
  border: 1px solid var(--border-input);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 0.8125rem;
  background: var(--bg-surface);
  color: var(--text);
  outline: none;
  width: 100%;
}
.form-input:focus { border-color: var(--border-focus); }
.toggle-row { margin-top: 4px; }
.form-error {
  font-size: 0.75rem;
  color: #EF4444;
  background: rgba(239,68,68,0.08);
  border-radius: 8px;
  padding: 8px 10px;
}
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn-ghost {
  padding: 7px 16px; border-radius: 8px; font-size: 0.8125rem;
  border: 1px solid var(--border); cursor: pointer;
  background: transparent; color: var(--text);
}
.btn-ghost:hover { background: var(--bg-hover); }

/* Bouton Enregistrer/Créer — visible en light et dark */
.btn-save {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 18px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.btn-save:hover   { background: var(--accent-hover); }
.btn-save:active  { transform: scale(0.97); }
.btn-save:disabled { opacity: 0.5; cursor: default; }

/* Bouton croix fermeture */
.btn-close {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.btn-close:hover { background: var(--bg-hover); color: var(--text); }

@media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }
</style>

<script setup>
import { ref, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useAdminStore } from '@/stores/adminStore'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  person: { type: Object, default: null }, // null = création
})
const emit = defineEmits(['close', 'saved'])

const admin    = useAdminStore()
const userStore = useUserStore()

const isEdit   = computed(() => !!props.person)
const saving   = ref(false)
const errorMsg = ref('')

// Initialise le formulaire
const form = ref({
  nom:         props.person?.nom         ?? '',
  prenom:      props.person?.prenom      ?? '',
  email:       props.person?.email       ?? '',
  niveau:      props.person?.niveau      ?? '',
  role:        props.person?.role        ?? '',
  arriveeInput: admin.firestoreToInput(props.person?.arrivee ?? ''),
  departInput:  admin.firestoreToInput(props.person?.depart  ?? ''),
  isAdmin:     props.person?.isAdmin     ?? false,
})

// Valeurs initiales pour détecter les modifications (mode édition uniquement)
const initial = {
  nom:         props.person?.nom         ?? '',
  prenom:      props.person?.prenom      ?? '',
  email:       props.person?.email       ?? '',
  niveau:      props.person?.niveau      ?? '',
  role:        props.person?.role        ?? '',
  arriveeInput: admin.firestoreToInput(props.person?.arrivee ?? ''),
  departInput:  admin.firestoreToInput(props.person?.depart  ?? ''),
  isAdmin:     props.person?.isAdmin     ?? false,
}

const isDirty = computed(() => {
  if (!isEdit.value) return true // création : toujours actif
  const f = form.value
  return (
    f.nom         !== initial.nom         ||
    f.prenom      !== initial.prenom      ||
    f.email       !== initial.email       ||
    f.niveau      !== initial.niveau      ||
    f.role        !== initial.role        ||
    f.arriveeInput !== initial.arriveeInput ||
    f.departInput  !== initial.departInput  ||
    f.isAdmin     !== initial.isAdmin
  )
})

async function submit() {
  errorMsg.value = ''
  saving.value   = true
  try {
    const data = {
      nom:     form.value.nom.trim().toUpperCase(),
      prenom:  form.value.prenom.trim(),
      email:   form.value.email.trim(),
      niveau:  form.value.niveau,
      role:    form.value.role.trim(),
      arrivee: admin.inputToFirestore(form.value.arriveeInput),
      depart:  admin.inputToFirestore(form.value.departInput),
      isAdmin: form.value.isAdmin,
    }
    if (isEdit.value) {
      await admin.updatePersonne(props.person.uid, data)
    } else {
      await admin.createPersonne(data)
    }
    await userStore.loadAllUsers() // rafraîchit la liste
    emit('saved')
  } catch (e) {
    errorMsg.value = e.message || 'Une erreur est survenue.'
  } finally {
    saving.value = false
  }
}
</script>
