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
          <label>Email <span v-if="!isEdit" style="color:#ef4444">*</span></label>
          <input
            v-model="form.email"
            type="email"
            placeholder="jean.dupont@exemple.fr"
            class="form-input"
            :required="!isEdit"
          />
          <span v-if="!isEdit" style="font-size:0.6875rem;color:var(--text-muted);margin-top:2px">
            Un email sera envoyé au collaborateur pour qu'il définisse son mot de passe.
          </span>
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

        <div class="form-row">
          <div class="form-group toggle-row">
            <label class="toggle-label flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.onRun" class="toggle-input">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Planning Run</span>
            </label>
            <span style="font-size:0.6875rem;color:var(--text-muted);margin-top:2px">Inclure dans le forecast / planning automatique</span>
          </div>
          <div class="form-group toggle-row">
            <label class="toggle-label flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.isAdmin" class="toggle-input">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Administrateur</span>
            </label>
          </div>
        </div>


        <div class="form-row">
          <div class="form-group toggle-row">
            <label class="toggle-label flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.peutTLT" class="toggle-input">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Peut faire du TLT</span>
            </label>
          </div>
          <div class="form-group toggle-row">
            <label class="toggle-label flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="form.peutBO" class="toggle-input">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Peut faire du BO</span>
            </label>
          </div>
        </div>

        <!-- Préférences Forecast -->
        <div class="prefs-section">
          <div class="prefs-title">
            <span>Préférences Forecast</span>
            <span class="prefs-hint">Forcer TLT pour certains créneaux (ex: contrainte personnelle)</span>
          </div>
          <div class="prefs-grid">
            <label v-for="fam in FAMILIES" :key="fam.key" class="pref-item" :class="{ active: form.forceTlt[fam.key] }">
              <input type="checkbox" v-model="form.forceTlt[fam.key]" class="pref-check" />
              <span class="pref-label">{{ fam.label }}</span>
              <span class="pref-badge">TLT</span>
            </label>
          </div>
        </div>

        <div v-if="errorMsg" class="form-error">{{ errorMsg }}</div>
        <div v-if="resetMsg" class="form-reset-msg" :class="{ 'form-reset-err': resetMsg.startsWith('Erreur') }">
          {{ resetMsg }}
        </div>

        <!-- Confirmation de suppression -->
        <div v-if="confirmDelete" class="delete-confirm">
          <span>Supprimer définitivement <strong>{{ props.person?.nom }} {{ props.person?.prenom }}</strong> ?<br>
          <span style="font-size:0.6875rem;opacity:0.8">Le profil sera effacé. Le compte de connexion Firebase restera mais l'accès à l'app sera révoqué.</span></span>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button type="button" class="btn-ghost" style="padding:5px 10px;font-size:0.75rem" @click="confirmDelete = false">Annuler</button>
            <button type="button" class="btn-delete-confirm" :disabled="deleting" @click="doDelete">
              {{ deleting ? 'Suppression…' : 'Confirmer' }}
            </button>
          </div>
        </div>

        <div class="modal-footer">
          <!-- Supprimer — uniquement en édition -->
          <button
            v-if="isEdit && !confirmDelete"
            type="button"
            class="btn-danger-ghost"
            @click="confirmDelete = true"
          >
            <Trash2 :size="12" />
            Supprimer
          </button>

          <!-- Renvoyer le mail de réinit — uniquement en édition si email renseigné -->
          <button
            v-if="isEdit && form.email && !confirmDelete"
            type="button"
            class="btn-reset-pwd"
            :disabled="sendingReset"
            @click="sendResetEmail"
          >
            <Mail :size="12" />
            {{ sendingReset ? 'Envoi…' : 'Renvoyer le mot de passe' }}
          </button>
          <div style="flex:1" />
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

.btn-danger-ghost {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;
  background: transparent; border: 1px solid var(--border);
  color: #ef4444; cursor: pointer; transition: all 0.15s;
}
.btn-danger-ghost:hover { border-color: #ef4444; background: rgba(239,68,68,0.08); }

.btn-delete-confirm {
  display: inline-flex; align-items: center;
  padding: 5px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;
  background: #ef4444; color: #fff; border: none; cursor: pointer; transition: background 0.15s;
}
.btn-delete-confirm:hover:not(:disabled) { background: #dc2626; }
.btn-delete-confirm:disabled { opacity: 0.6; cursor: default; }

.delete-confirm {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2);
  font-size: 0.8125rem; color: var(--text);
}

.btn-reset-pwd {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;
  background: transparent; border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.btn-reset-pwd:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.btn-reset-pwd:disabled { opacity: 0.5; cursor: default; }

.form-reset-msg {
  font-size: 0.75rem; border-radius: 8px; padding: 8px 10px;
  background: rgba(34,197,94,0.08); color: #15803d;
}
.form-reset-err { background: rgba(239,68,68,0.08); color: #ef4444; }

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

/* Préférences Forecast */
.prefs-section {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 10px;
  background: var(--bg-surface);
}
.prefs-title {
  display: flex; align-items: baseline; gap: 8px;
  font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
}
.prefs-hint {
  font-size: 0.6875rem; font-weight: 400; color: var(--text-subtle);
}
.prefs-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
}
.pref-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: 6px; padding: 6px 8px;
  border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; transition: background 0.12s, border-color 0.12s;
  background: var(--bg-card);
}
.pref-item:hover { background: var(--bg-hover); }
.pref-item.active {
  background: rgba(215,190,158,0.15);
  border-color: rgba(201,167,123,0.6);
}
.pref-check { display: none; }
.pref-label { font-size: 0.75rem; font-weight: 600; color: var(--text); }
.pref-badge {
  font-size: 0.5625rem; font-weight: 700; letter-spacing: 0.04em;
  padding: 1px 5px; border-radius: 4px;
  background: rgba(215,190,158,0.2); color: rgba(201,167,123,1);
  opacity: 0.4; transition: opacity 0.12s;
}
.pref-item.active .pref-badge { opacity: 1; }
@media (max-width: 480px) { .prefs-grid { grid-template-columns: repeat(2, 1fr); } }
</style>

<script setup>
import { ref, computed } from 'vue'
import { X, Mail, Trash2 } from 'lucide-vue-next'
import { useAdminStore } from '@/stores/adminStore'
import { useUserStore } from '@/stores/userStore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/firebase/config'

const FAMILIES = [
  { key: 'matin', label: 'Matin' },
  { key: 'midi',  label: 'Midi'  },
  { key: 'aprem', label: 'Aprem' },
  { key: 'soir',  label: 'Soir'  },
]

const props = defineProps({
  person: { type: Object, default: null }, // null = création
})
const emit = defineEmits(['close', 'saved', 'deleted'])

const admin    = useAdminStore()
const userStore = useUserStore()

const isEdit   = computed(() => !!props.person)
const saving        = ref(false)
const errorMsg      = ref('')
const sendingReset  = ref(false)
const resetMsg      = ref('')
const confirmDelete = ref(false)
const deleting      = ref(false)

// Initialise le formulaire
const initForceTlt = () => ({
  matin: props.person?.forecastPrefs?.matin === 'tlt',
  midi:  props.person?.forecastPrefs?.midi  === 'tlt',
  aprem: props.person?.forecastPrefs?.aprem === 'tlt',
  soir:  props.person?.forecastPrefs?.soir  === 'tlt',
})

const form = ref({
  nom:             props.person?.nom             ?? '',
  prenom:          props.person?.prenom          ?? '',
  email:           props.person?.email           ?? '',
  niveau:          props.person?.niveau          ?? '',
  role:            props.person?.role            ?? '',
  arriveeInput:    admin.firestoreToInput(props.person?.arrivee ?? ''),
  departInput:     admin.firestoreToInput(props.person?.depart  ?? ''),
  isAdmin:         props.person?.isAdmin         ?? false,
  onRun:           props.person?.onRun           ?? true,
  peutTLT:         props.person?.peutTLT         ?? true,
  peutBO:          props.person?.peutBO          ?? false,
  forceTlt:          initForceTlt(),
})

const initial = {
  nom:             props.person?.nom             ?? '',
  prenom:          props.person?.prenom          ?? '',
  email:           props.person?.email           ?? '',
  niveau:          props.person?.niveau          ?? '',
  role:            props.person?.role            ?? '',
  arriveeInput:    admin.firestoreToInput(props.person?.arrivee ?? ''),
  departInput:     admin.firestoreToInput(props.person?.depart  ?? ''),
  isAdmin:         props.person?.isAdmin         ?? false,
  onRun:           props.person?.onRun           ?? true,
  peutTLT:         props.person?.peutTLT         ?? true,
  peutBO:          props.person?.peutBO          ?? false,
  forceTlt:        initForceTlt(),
}

const isDirty = computed(() => {
  if (!isEdit.value) return true
  const f = form.value
  return (
    f.nom          !== initial.nom          ||
    f.prenom       !== initial.prenom       ||
    f.email        !== initial.email        ||
    f.niveau       !== initial.niveau       ||
    f.role         !== initial.role         ||
    f.arriveeInput !== initial.arriveeInput ||
    f.departInput  !== initial.departInput  ||
    f.isAdmin         !== initial.isAdmin         ||
    f.onRun           !== initial.onRun           ||
    f.peutTLT         !== initial.peutTLT         ||
    f.peutBO          !== initial.peutBO          ||
    FAMILIES.some(fam => f.forceTlt[fam.key] !== initial.forceTlt[fam.key])
  )
})

async function doDelete() {
  deleting.value = true
  try {
    await admin.deletePersonne(props.person.uid)
    await userStore.loadAllUsers()
    emit('deleted')
  } catch (e) {
    errorMsg.value = e.message || 'Erreur lors de la suppression.'
    confirmDelete.value = false
  } finally {
    deleting.value = false
  }
}

async function sendResetEmail() {
  sendingReset.value = true
  resetMsg.value = ''
  try {
    await sendPasswordResetEmail(auth, form.value.email)
    resetMsg.value = `✓ Email envoyé à ${form.value.email}`
  } catch (e) {
    resetMsg.value = `Erreur : ${e.code === 'auth/user-not-found' ? 'aucun compte Firebase pour cet email.' : e.message}`
  } finally {
    sendingReset.value = false
    setTimeout(() => { resetMsg.value = '' }, 5000)
  }
}

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
      isAdmin:          form.value.isAdmin,
      onRun:            form.value.onRun,
      peutTLT:          form.value.peutTLT,
      peutBO:           form.value.peutBO,
      forecastPrefs: {
        matin: form.value.forceTlt.matin ? 'tlt' : null,
        midi:  form.value.forceTlt.midi  ? 'tlt' : null,
        aprem: form.value.forceTlt.aprem ? 'tlt' : null,
        soir:  form.value.forceTlt.soir  ? 'tlt' : null,
      },
    }
    if (isEdit.value) {
      await admin.updatePersonne(props.person.uid, data)
    } else {
      await admin.createPersonneWithAuth(data)
    }
    await userStore.loadAllUsers()
    emit('saved', !isEdit.value)
  } catch (e) {
    const AUTH_ERRORS = {
      'auth/email-already-in-use': 'Un compte Firebase existe déjà pour cet email.',
      'auth/invalid-email':        'Adresse email invalide.',
      'auth/weak-password':        'Mot de passe trop faible (généré en interne — réessayez).',
    }
    errorMsg.value = AUTH_ERRORS[e.code] || e.message || 'Une erreur est survenue.'
  } finally {
    saving.value = false
  }
}
</script>
