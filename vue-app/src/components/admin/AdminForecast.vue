<template>
  <div style="font-size:0.75rem">

    <!-- ── ÉTAPE 1 : Import fichier ── -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone-over': dragOver, 'drop-zone-done': fc.forecast }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInput.click()"
    >
      <input ref="fileInput" type="file" accept=".xlsx,.xlsm,.xls" style="display:none" @change="onFile" />

      <div v-if="fc.parsing" class="drop-center">
        <div class="fc-spinner"></div>
        <span style="color:var(--text-muted)">Lecture du fichier…</span>
      </div>

      <div v-else-if="fc.forecast" style="display:flex;align-items:center;gap:10px;width:100%">
        <div class="fc-file-icon"><FileSpreadsheet :size="18" /></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fc.fileName }}</div>
          <div style="color:var(--text-muted);font-size:0.6875rem">
            {{ Object.keys(fc.forecast).length }} jours travaillés · {{ monthLabel }}
          </div>
        </div>
        <button class="btn-icon" @click.stop="fc.reset()"><X :size="13" /></button>
      </div>

      <div v-else-if="fc.parseError" class="drop-center" style="color:#f87171">
        <AlertTriangle :size="20" />
        <div style="text-align:center">
          <div style="font-weight:600">Erreur de lecture</div>
          <div style="font-size:0.6875rem;margin-top:3px">{{ fc.parseError }}</div>
        </div>
      </div>

      <div v-else class="drop-center" style="color:var(--text-muted)">
        <Upload :size="28" style="opacity:0.4" />
        <div style="font-size:0.8125rem;font-weight:500">Glisser le fichier Excel ici</div>
        <div style="font-size:0.6875rem">ou cliquer pour choisir (.xlsx, .xlsm)</div>
      </div>
    </div>

    <!-- ── ÉTAPE 2 : Options ── -->
    <template v-if="fc.forecast">
      <div class="options-bar">
        <div class="opt-group">
          <span class="opt-label">BO simultanés max</span>
          <div class="stepper">
            <button class="stepper-btn" @click="fc.maxBO = Math.max(0, fc.maxBO - 1)">−</button>
            <span class="stepper-val">{{ fc.maxBO }}</span>
            <button class="stepper-btn" @click="fc.maxBO++">+</button>
          </div>
        </div>
        <span style="font-size:0.6875rem;color:var(--text-muted);margin-left:8px">
          Équitable · même horaire/semaine mais ETP en priorité · TLT max 2j/semaine · pas de TLT le mercredi
        </span>
        <button class="btn-preview" style="margin-left:auto" :disabled="fc.previewing || dataLoading" @click="doPreview">
          <div v-if="fc.previewing" class="btn-spinner"></div>
          <Eye v-else :size="14" />
          <span>{{ fc.previewing ? 'Calcul…' : 'Prévisualiser' }}</span>
        </button>
      </div>

      <!-- ── ÉTAPE 3 : Prévisualisation ── -->
      <template v-if="fc.preview">

        <!-- En-tête -->
        <div class="preview-header">
          <div>
            <h3 style="margin:0 0 2px;font-size:0.875rem;font-weight:700">
              Prévisualisation — {{ monthLabel }}
            </h3>
            <span style="color:var(--text-muted);font-size:0.6875rem">
              {{ fc.preview.persons.length }} collaborateurs · {{ fc.preview.dates.length }} jours
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <!-- Sélecteur de vue -->
            <div class="view-toggle">
              <button :class="['vt-btn', { active: viewMode === 'month' }]" @click="viewMode = 'month'">Mois</button>
              <button :class="['vt-btn', { active: viewMode === 'week' }]"  @click="viewMode = 'week'">Semaine</button>
            </div>
            <label class="toggle">
              <input type="checkbox" v-model="overwrite" />
              <span class="toggle-track"></span>
              <span class="opt-label" style="margin-left:6px">Écraser existants</span>
            </label>
            <label class="toggle">
              <input type="checkbox" v-model="testMode" />
              <span class="toggle-track toggle-track-test"></span>
              <span class="opt-label" style="margin-left:6px">Mode test</span>
            </label>
            <button
              class="btn-apply"
              :class="{ 'btn-apply-test': testMode }"
              :disabled="fc.generating"
              @click="doApply"
            >
              <div v-if="fc.generating" class="btn-spinner"></div>
              <Wand2 v-else :size="14" />
              <span>{{ fc.generating ? `Application… (${genProgress}/${genTotal})` : (testMode ? 'Appliquer (test)' : 'Appliquer') }}</span>
            </button>
          </div>
        </div>

        <!-- Navigation semaine -->
        <div v-if="viewMode === 'week'" class="week-nav">
          <button class="week-nav-btn" :disabled="weekIdx === 0" @click="weekIdx--">
            <ChevronLeft :size="14" />
          </button>
          <span class="week-nav-label">{{ weekNavLabel }}</span>
          <button class="week-nav-btn" :disabled="weekIdx >= weekGroups.length - 1" @click="weekIdx++">
            <ChevronRight :size="14" />
          </button>
          <span style="font-size:0.6875rem;color:var(--text-muted);margin-left:4px">
            semaine {{ weekIdx + 1 }} / {{ weekGroups.length }}
          </span>
        </div>

        <!-- Résultat après application -->
        <div v-if="fc.genResults" class="gen-result">
          <!-- Badge collection cible -->
          <span
            class="gen-collection-badge"
            :class="{ 'gen-collection-test': fc.genResults.collection !== 'plannings' }"
          >{{ fc.genResults.collection }}</span>

          <div class="gen-stat" style="color:#22c55e"><CheckCircle2 :size="13" />{{ fc.genResults.done }} écrits</div>
          <div class="gen-stat" style="color:var(--text-muted)"><SkipForward :size="13" />{{ fc.genResults.skipped }} ignorés</div>
          <div v-if="fc.genResults.errors" class="gen-stat" style="color:#f87171"><AlertTriangle :size="13" />{{ fc.genResults.errors }} erreurs</div>
          <span style="color:var(--text-subtle);font-size:0.6875rem">sur {{ fc.genResults.total }} jours</span>

          <!-- Rappel navigation si données en avril (pas le mois courant) -->
          <span
            v-if="resultMonthLabel"
            class="gen-nav-hint"
          >↳ Naviguer en {{ resultMonthLabel }} dans la vue planning pour vérifier</span>

          <button
            v-if="fc.appliedDayIds.length"
            class="btn-undo"
            :disabled="fc.undoing"
            @click="doUndo"
            style="margin-left:auto"
          >
            <div v-if="fc.undoing" class="btn-spinner" style="border-color:rgba(239,68,68,0.4);border-top-color:#ef4444"></div>
            <Undo2 v-else :size="13" />
            <span>{{ fc.undoing ? `Annulation… (${undoProgress}/${undoTotal})` : 'Annuler' }}</span>
          </button>
        </div>

        <!-- Vue principale : matrice + stats historiques côte à côte -->
        <div class="split-view">

          <!-- Matrice Collaborateur × Jour -->
          <div class="matrix-wrap">
            <div class="legend">
              <span v-for="(c, name) in SHIFT_COLORS" :key="name" v-show="name !== ''"
                class="legend-item" :style="{ background: c.bg, color: c.text }" :title="name">
                {{ SHIFT_SHORT[name] || name }}
              </span>
            </div>
            <div class="matrix-scroll">
              <table class="matrix-table" :style="viewMode === 'week' ? { width: '100%' } : { width: matrixTableWidth + 'px' }">
                <colgroup>
                  <col style="width:160px;min-width:160px;max-width:160px">
                  <col v-for="iso in visibleDates" :key="iso" :style="viewMode === 'week' ? { minWidth: '42px' } : { width: '42px', minWidth: '42px', maxWidth: '42px' }">
                </colgroup>
                <thead>
                  <tr>
                    <th class="th-name">Collaborateur</th>
                    <th
                      v-for="iso in visibleDates"
                      :key="iso"
                      class="th-day"
                      :class="{ 'th-lundi': viewMode === 'month' && weekStarts.has(iso), 'th-sam': getDow(iso) === 'Sam' }"
                    >
                      <div class="th-day-inner">
                        <span class="th-dow" :class="`dow-${getDow(iso).toLowerCase()}`">{{ getDow(iso) }}</span>
                        <span class="th-dm">{{ fmtDM(iso) }}</span>
                      </div>
                    </th>
                  </tr>

                  <!-- ── Ligne ETP / Risque ── -->
                  <tr>
                    <th class="th-etp-label">ETP</th>
                    <th
                      v-for="iso in visibleDates"
                      :key="iso"
                      class="th-etp"
                      :class="{ 'td-lundi': viewMode === 'month' && weekStarts.has(iso) }"
                      :style="etpCellStyle(iso)"
                      :title="etpTitle(iso)"
                    >
                      <template v-if="etpStats[iso]">
                        <!-- Chiffre demandé par le forecast (PREV col G) -->
                        <div class="etp-num">{{ etpStats[iso].expected }}</div>
                        <div class="etp-sub">
                          <!-- Manque de ressources RUN ce jour -->
                          <span v-if="etpStats[iso].shortfall < 0" style="color:inherit">{{ etpStats[iso].shortfall }}</span>
                          <span v-else>✓</span>
                          <!-- Ressources actives sans horaire (banc) -->
                          <span v-if="etpStats[iso].extraBench > 0" class="etp-bo">+{{ etpStats[iso].extraBench }}</span>
                        </div>
                      </template>
                      <span v-else class="etp-na">—</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="person in fc.preview.persons" :key="person">
                    <td class="td-name">{{ person }}</td>
                    <td
                      v-for="iso in visibleDates"
                      :key="iso"
                      class="td-cell"
                      :class="{
                        'td-lundi':   viewMode === 'month' && weekStarts.has(iso),
                        'td-edited':  isEdited(person, iso),
                        'td-editing': editCell?.person === person && editCell?.iso === iso,
                      }"
                      :style="cellStyle(fc.preview.matrix[person]?.[iso])"
                      :title="(fc.preview.matrix[person]?.[iso] || 'Non affecté') + ' · Cliquer pour modifier'"
                      @click.stop="openEdit(person, iso, $event)"
                    >
                      {{ SHIFT_SHORT[fc.preview.matrix[person]?.[iso] || ''] ?? '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Panneau d'équité historique -->
          <div class="equity-panel">
            <div class="equity-title">
              <BarChart2 :size="13" />
              Répartition historique
            </div>
            <div class="equity-subtitle">Avant ce forecast</div>

            <div class="equity-list">
              <div v-for="person in fc.preview.persons" :key="person" class="equity-row">
                <div class="eq-name">{{ person }}</div>
                <div class="eq-bars">
                  <div
                    v-for="shift in ['matin','midi','aprem','soir']"
                    :key="shift"
                    class="eq-bar-wrap"
                    :title="`${shift}: ${getHistStat(person, shift)} semaines (${getHistPct(person, shift)}%)`"
                  >
                    <div
                      class="eq-bar"
                      :style="{
                        width: getHistPct(person, shift) + '%',
                        background: SHIFT_COLORS[SITE_NAME[shift]]?.text || 'var(--accent)'
                      }"
                    ></div>
                    <span class="eq-bar-val">{{ getHistPct(person, shift) }}%</span>
                  </div>
                </div>
                <div class="eq-total">{{ getHistTotal(person) }}s</div>
              </div>
            </div>

            <!-- Légende shifts pour le panneau équité -->
            <div class="equity-legend">
              <span v-for="shift in ['matin','midi','aprem','soir']" :key="shift"
                class="eq-legend-item"
                :style="{ color: SHIFT_COLORS[SITE_NAME[shift]]?.text }"
              >
                <span class="eq-dot" :style="{ background: SHIFT_COLORS[SITE_NAME[shift]]?.text }"></span>
                {{ SITE_NAME[shift] }}
              </span>
            </div>
          </div>

        </div>
      </template>
    </template>

  <!-- ── Popup édition cellule ── -->
  <div
    v-if="editCell"
    class="cell-popup"
    :style="popupStyle"
    @click.stop
  >
    <div class="cell-popup-header">
      <span>{{ editCell.person.split(' ')[0] }} · {{ fmtDM(editCell.iso) }}</span>
      <button class="cell-popup-close" @click="closeEdit">×</button>
    </div>

    <div class="cell-popup-grid">
      <button
        v-for="s in POPUP_WORK_SHIFTS"
        :key="s"
        class="cell-popup-btn"
        :class="{ 'cell-popup-active': currentEdit === s }"
        :style="cellStyle(s)"
        :title="s"
        @click="applyEdit(s)"
      >{{ SHIFT_SHORT[s] }}</button>
      <button
        class="cell-popup-btn cell-popup-span"
        :class="{ 'cell-popup-active': currentEdit === 'BO' }"
        :style="cellStyle('BO')"
        @click="applyEdit('BO')"
      >BO</button>
    </div>

    <div class="cell-popup-sep"></div>

    <div class="cell-popup-grid">
      <button
        v-for="s in POPUP_ABSENCE_SHIFTS"
        :key="s"
        class="cell-popup-btn"
        :class="{ 'cell-popup-active': currentEdit === s }"
        :style="cellStyle(s)"
        :title="s"
        @click="applyEdit(s)"
      >{{ SHIFT_SHORT[s] }}</button>
    </div>

    <div class="cell-popup-sep"></div>

    <button
      class="cell-popup-empty"
      :class="{ 'cell-popup-active': currentEdit === '' }"
      @click="applyEdit('')"
    >— Vide</button>
  </div>

  </div>
</template>

<style scoped>
/* ── Drop zone ── */
.drop-zone {
  border: 2px dashed var(--border); border-radius: var(--radius-md);
  padding: 28px 20px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; min-height: 100px; margin-bottom: 16px;
  transition: border-color 0.15s, background 0.15s;
}
.drop-zone:hover, .drop-zone-over { border-color: var(--accent); background: var(--accent-light); }
.drop-zone-done { border-style: solid; border-color: var(--accent); background: var(--accent-light); }
.drop-center { display: flex; flex-direction: column; align-items: center; gap: 8px; }

.fc-spinner, .btn-spinner { border-radius: 50%; animation: spin 0.8s linear infinite; }
.fc-spinner { width: 28px; height: 28px; border: 3px solid var(--accent); border-top-color: transparent; }
.btn-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.fc-file-icon {
  width: 38px; height: 38px; border-radius: 10px;
  background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.btn-icon {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: var(--text-muted);
  transition: background 0.12s; flex-shrink: 0;
}
.btn-icon:hover { background: var(--bg-hover); color: var(--text); }

/* ── Options ── */
.options-bar {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 12px 16px; margin-bottom: 16px;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md);
}
.opt-group { display: flex; align-items: center; gap: 8px; }
.opt-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.stepper { display: flex; align-items: center; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.stepper-btn {
  width: 26px; height: 26px; border: none; background: var(--bg-surface);
  color: var(--text-muted); cursor: pointer; font-size: 1rem; line-height: 1;
  transition: background 0.12s, color 0.12s;
}
.stepper-btn:hover { background: var(--bg-hover); color: var(--text); }
.stepper-val { min-width: 26px; text-align: center; font-size: 0.8125rem; font-weight: 700; color: var(--text); }

.btn-preview {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--accent); background: var(--accent-light); color: var(--accent);
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: background 0.15s, color 0.15s;
}
.btn-preview:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-preview:not(:disabled):hover { background: var(--accent); color: #fff; }

/* ── Preview header ── */
.preview-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin-bottom: 12px;
}
.toggle { display: inline-flex; align-items: center; cursor: pointer; user-select: none; }
.toggle input { display: none; }
.toggle-track {
  width: 32px; height: 17px; border-radius: 9px;
  background: var(--border); position: relative; transition: background 0.2s; flex-shrink: 0;
}
.toggle-track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 13px; height: 13px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
}
.toggle input:checked + .toggle-track { background: var(--accent); }
.toggle input:checked + .toggle-track::after { transform: translateX(15px); }

.btn-apply {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: var(--radius-sm);
  background: var(--accent); color: #fff; border: none;
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
}
.btn-apply:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-apply:not(:disabled):hover { opacity: 0.85; }
.btn-apply-test { background: #f59e0b; }

.toggle-track-test { background: #fcd34d !important; }
.toggle input:checked + .toggle-track-test { background: #f59e0b !important; }

/* ── Sélecteur vue mois/semaine ── */
.view-toggle { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.vt-btn {
  padding: 5px 12px; font-size: 0.75rem; font-weight: 600;
  border: none; background: transparent; cursor: pointer;
  color: var(--text-muted); transition: background 0.12s, color 0.12s;
}
.vt-btn:hover { background: var(--bg-hover); color: var(--text); }
.vt-btn.active { background: var(--accent); color: #fff; }

/* ── Navigation semaine ── */
.week-nav {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px;
}
.week-nav-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--bg-surface);
  color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.week-nav-btn:disabled { opacity: 0.35; cursor: default; }
.week-nav-btn:not(:disabled):hover { background: var(--bg-hover); color: var(--text); }
.week-nav-label {
  font-size: 0.8125rem; font-weight: 700; color: var(--text);
  min-width: 160px; text-align: center;
}

/* ── Résultat ── */
.gen-result {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 14px; margin-bottom: 12px;
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.gen-stat { display: flex; align-items: center; gap: 5px; font-weight: 600; font-size: 0.75rem; }
.gen-collection-badge {
  padding: 2px 8px; border-radius: 4px; font-size: 0.625rem; font-weight: 700;
  background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.25);
  white-space: nowrap; flex-shrink: 0;
}
.gen-collection-test {
  background: rgba(245,158,11,0.12) !important;
  color: #f59e0b !important;
  border-color: rgba(245,158,11,0.35) !important;
}
.gen-nav-hint {
  font-size: 0.625rem; color: var(--text-muted); font-style: italic;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.btn-undo {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: var(--radius-sm);
  border: 1px solid #ef4444; background: rgba(239,68,68,0.08); color: #ef4444;
  font-size: 0.75rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.btn-undo:hover:not(:disabled) { background: rgba(239,68,68,0.15); }
.btn-undo:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Layout split ── */
.split-view {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 16px;
  align-items: start;
}
@media (max-width: 960px) {
  .split-view { grid-template-columns: 1fr; }
}

/* ── Légende ── */
.legend { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.legend-item { padding: 2px 7px; border-radius: 4px; font-size: 0.625rem; font-weight: 700; }

/* ── Matrice ── */
.matrix-wrap { min-width: 0; }
.matrix-scroll { overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-md); max-height: 65vh; }
.matrix-table { border-collapse: collapse; font-size: 0.6875rem; table-layout: fixed; }
.matrix-table th, .matrix-table td { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); }
.matrix-table tr:last-child td { border-bottom: none; }

.th-name {
  position: sticky; left: 0; top: 0; z-index: 4;
  background: var(--bg-surface); padding: 6px 10px;
  font-weight: 700; text-align: left; white-space: nowrap;
  border-right: 2px solid var(--border) !important;
  border-bottom: none !important;
  border-radius: 0 !important;
  font-size: 0.6875rem; color: var(--text-muted); width: 160px;
}
.th-day {
  position: sticky; top: 0; z-index: 2;
  background: var(--bg-surface); padding: 4px 2px; text-align: center;
  width: 42px; max-width: 42px; overflow: hidden;
  border-bottom: none !important;
}
.th-lundi { border-left: 2px solid var(--border) !important; }
.th-day-inner { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.th-dow { font-size: 0.5rem; font-weight: 700; text-transform: uppercase; }
.th-dm  { font-size: 0.5625rem; font-weight: 600; color: var(--text-muted); }
.dow-lun { color: #22c55e; } .dow-sam { color: var(--accent); }

/* ── Ligne ETP ── */
.th-etp-label {
  position: sticky; left: 0; top: 30px; z-index: 3;
  background: var(--bg-surface); padding: 3px 10px;
  font-weight: 700; text-align: left; white-space: nowrap;
  border-right: 2px solid var(--border) !important;
  border-bottom: 1px solid var(--border);
  font-size: 0.5rem; color: var(--text-muted); letter-spacing: 0.05em;
  border-radius: 0 !important;
}
.th-etp {
  position: sticky; top: 30px; z-index: 1;
  text-align: center; padding: 2px 1px; width: 42px;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s;
  border-radius: 0 !important;
}
.etp-num  { font-size: 0.625rem; font-weight: 800; line-height: 1.2; }
.etp-sub  { font-size: 0.5rem; font-weight: 700; line-height: 1.2; opacity: 0.9; display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; }
.etp-bo   { color: #a78bfa; opacity: 1; }   /* violet discret pour les ressources BO */
.etp-na   { font-size: 0.5rem; color: var(--text-subtle); }

.td-name {
  position: sticky; left: 0; z-index: 1;
  background: var(--bg-card); padding: 5px 10px;
  font-weight: 600; white-space: nowrap;
  border-right: 2px solid var(--border) !important; width: 160px;
}
.td-cell { text-align: center; padding: 4px 2px; font-weight: 700; cursor: pointer; transition: filter 0.1s; font-size: 0.625rem; width: 42px; max-width: 42px; overflow: hidden; }
/* Override règle globale .content-card tbody td:last-child qui force text-align:right */
.matrix-table td:last-child,
.matrix-table th:last-child { text-align: center; font-family: inherit; font-size: 0.625rem; color: inherit; font-weight: 700; padding: 4px 2px; }
.td-cell:hover { filter: brightness(1.25); }
.td-lundi   { border-left: 2px solid var(--border) !important; }
.td-editing { outline: 2px solid var(--accent); outline-offset: -2px; z-index: 1; position: relative; }
.td-edited  { outline: 1px dashed var(--accent); outline-offset: -1px; }

/* ── Panneau équité ── */
.equity-panel {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 14px; flex-shrink: 0;
  position: sticky; top: 0;
}
.equity-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.8125rem; font-weight: 700; margin-bottom: 2px; color: var(--text);
}
.equity-subtitle { font-size: 0.625rem; color: var(--text-muted); margin-bottom: 12px; }

.equity-list { display: flex; flex-direction: column; gap: 7px; max-height: 55vh; overflow-y: auto; }
.equity-row {
  display: grid; grid-template-columns: 1fr auto auto;
  align-items: center; gap: 6px;
}
.eq-name { font-size: 0.6875rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.eq-bars { display: flex; flex-direction: column; gap: 2px; min-width: 80px; }
.eq-bar-wrap { display: flex; align-items: center; gap: 3px; }
.eq-bar {
  height: 4px; border-radius: 2px; min-width: 2px; max-width: 60px;
  transition: width 0.3s;
}
.eq-bar-val { font-size: 0.5625rem; color: var(--text-muted); min-width: 24px; }
.eq-total { font-size: 0.5625rem; color: var(--text-subtle); white-space: nowrap; }

.equity-legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.eq-legend-item { display: flex; align-items: center; gap: 3px; font-size: 0.5625rem; font-weight: 600; }
.eq-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

/* ── Popup édition cellule ── */
.cell-popup {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-md); box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  padding: 10px; min-width: 200px;
}
.cell-popup-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);
}
.cell-popup-close {
  width: 18px; height: 18px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer; font-size: 1.1rem; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; padding: 0; transition: background 0.12s;
}
.cell-popup-close:hover { background: var(--bg-hover); color: var(--text); }
.cell-popup-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.cell-popup-btn {
  padding: 5px 2px; border-radius: 4px; border: 1px solid transparent;
  font-size: 0.5625rem; font-weight: 800; cursor: pointer; text-align: center;
  transition: filter 0.1s;
}
.cell-popup-btn:hover { filter: brightness(1.25); }
.cell-popup-active { outline: 2px solid currentColor; outline-offset: 1px; }
.cell-popup-span { grid-column: 1 / -1; }
.cell-popup-sep { height: 1px; background: var(--border); margin: 7px 0; }
.cell-popup-empty {
  width: 100%; padding: 5px; border: 1px dashed var(--border); border-radius: 4px;
  background: transparent; color: var(--text-muted); font-size: 0.625rem;
  font-weight: 600; cursor: pointer; text-align: center; transition: background 0.12s;
}
.cell-popup-empty:hover { background: var(--bg-hover); }
.cell-popup-empty.cell-popup-active { outline: 2px solid var(--border); outline-offset: 1px; }
</style>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useForecastStore, SHIFT_COLORS } from '@/stores/forecastStore'
import { useUserStore }                   from '@/stores/userStore'
import { useDataStore }                   from '@/stores/dataStore'
import {
  Upload, FileSpreadsheet, X, Eye, Wand2, Undo2,
  AlertTriangle, CheckCircle2, SkipForward, BarChart2,
  ChevronLeft, ChevronRight,
} from 'lucide-vue-next'

const fc        = useForecastStore()
const userStore = useUserStore()
const data      = useDataStore()

const fileInput   = ref(null)
const dragOver    = ref(false)
const overwrite   = ref(false)
const testMode    = ref(false)
const genProgress  = ref(0)
const genTotal     = ref(0)
const undoProgress = ref(0)
const undoTotal    = ref(0)
const viewMode    = ref('month')  // 'month' | 'week'
const weekIdx     = ref(0)

/* ── Édition cellule à la volée ── */
const editCell = ref(null)   // { person, iso, rectLeft, rectTop, rectBottom }

// Shifts proposés dans le popup (ordre affiché)
const POPUP_WORK_SHIFTS    = [
  'Matin',        'Midi',        'Aprem',        'Soir',
  'TLT Matin',    'TLT Midi',    'TLT APREM',    'TLT Soir',
  'Agence Matin', 'Agence Midi', 'Agence APREM', 'Agence Soir',
]
const POPUP_ABSENCE_SHIFTS = ['CP','Indisponible','Récup','Formation']

// Valeur actuelle de la cellule en cours d'édition
const currentEdit = computed(() =>
  editCell.value ? (fc.preview?.matrix[editCell.value.person]?.[editCell.value.iso] ?? '') : ''
)

// Cellules modifiées manuellement (pour indicateur visuel)
const editedCells = ref(new Set())   // Set de clés "person|iso"

function isEdited(person, iso) { return editedCells.value.has(`${person}|${iso}`) }

// Positionnement fixe du popup, recalculé à l'ouverture (pas besoin d'être computed)
const popupStyle = ref({})

function openEdit(person, iso, event) {
  const rect    = event.currentTarget.getBoundingClientRect()
  editCell.value = { person, iso, rectLeft: rect.left, rectTop: rect.top, rectBottom: rect.bottom }
  // Popup ~210px de large, ~220px de haut
  const PW = 210, PH = 220
  let x = rect.left
  let y = rect.bottom + 4
  if (x + PW > window.innerWidth  - 8) x = window.innerWidth  - PW - 8
  if (y + PH > window.innerHeight - 8) y = rect.top - PH - 4
  popupStyle.value = { position: 'fixed', left: x + 'px', top: y + 'px', zIndex: 9999 }
}

function applyEdit(shift) {
  if (!editCell.value) return
  const { person, iso } = editCell.value
  fc.setMatrixCell(person, iso, shift)
  editedCells.value = new Set([...editedCells.value, `${person}|${iso}`])
  editCell.value = null
}

function closeEdit() { editCell.value = null }

function handleOutsideClick(e) {
  if (editCell.value && !e.target.closest('.cell-popup')) editCell.value = null
}
function handleKey(e) { if (e.key === 'Escape') editCell.value = null }

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick)
  document.addEventListener('keydown',   handleKey)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
  document.removeEventListener('keydown',   handleKey)
})

const dataLoading = computed(() => data.loading)

/* ── Gestion fichier ── */
function onFile(e) {
  const file = e.target.files?.[0]
  if (file) fc.parseExcel(file)
  e.target.value = ''
}
function onDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) fc.parseExcel(file)
}

/* ── Preview ── */
function doPreview() {
  weekIdx.value    = 0
  editedCells.value = new Set()
  fc.previewPlanningWeekly({
    persons:     userStore.users,
    planningData: data.planning,
  })
}

/* ── Application Firestore ── */
async function doApply() {
  genProgress.value = 0
  genTotal.value    = fc.preview?.dates.length || 0
  await fc.applyPreview({
    persons:    userStore.users,
    overwrite:  overwrite.value,
    collection: testMode.value ? 'plannings_test' : 'plannings',
    onProgress: (n, total) => { genProgress.value = n; genTotal.value = total },
  })
}

async function doUndo() {
  undoProgress.value = 0
  undoTotal.value    = fc.appliedDayIds.length
  await fc.undoApply({
    onProgress: (n, total) => { undoProgress.value = n; undoTotal.value = total },
  })
}

/* ── Helpers affichage ── */
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

const SITE_NAME = { matin: 'Matin', midi: 'Midi', aprem: 'Aprem', soir: 'Soir' }

const SHIFT_SHORT = {
  'Matin':        'Mat', 'Midi':      'Mid',  'Aprem':     'Apr', 'Soir':      'Soi',
  'TLT Matin':    'TM',  'TLT Midi':  'TMi',  'TLT APREM': 'TA',  'TLT Soir':  'TS',
  'Agence Matin': 'AM',  'Agence Midi':'AMi', 'Agence APREM':'AA','Agence Soir':'AS',
  'BO':           'BO',
  'CP':           'CP',  'Indisponible': 'Ind', 'Récup': 'Réc',
  'Formation': 'For',
  '':             '—',
}


// Premier jour présent dans les données pour chaque semaine ISO → trait de séparation
const weekStarts = computed(() => {
  const s = new Set()
  if (!fc.preview) return s
  let prevWk = null
  for (const iso of fc.preview.dates) {
    const d = new Date(iso + 'T12:00:00')
    d.setDate(d.getDate() + 4 - (d.getDay() || 7))
    const yr = d.getFullYear()
    const wk = Math.ceil(((d - new Date(yr, 0, 1)) / 86400000 + 1) / 7)
    const key = `${yr}-${wk}`
    if (key !== prevWk) { s.add(iso); prevWk = key }
  }
  return s
})

// Dates groupées par semaine ISO
const weekGroups = computed(() => {
  if (!fc.preview) return []
  const groups = []
  let prevKey = null
  for (const iso of fc.preview.dates) {
    const d = new Date(iso + 'T12:00:00')
    d.setDate(d.getDate() + 4 - (d.getDay() || 7))
    const yr = d.getFullYear()
    const wk = Math.ceil(((d - new Date(yr, 0, 1)) / 86400000 + 1) / 7)
    const key = `${yr}-W${String(wk).padStart(2, '0')}`
    if (key !== prevKey) { groups.push({ key, dates: [] }); prevKey = key }
    groups[groups.length - 1].dates.push(iso)
  }
  return groups
})

// Dates affichées selon le mode
const visibleDates = computed(() => {
  if (!fc.preview) return []
  if (viewMode.value === 'week') return weekGroups.value[weekIdx.value]?.dates ?? []
  return fc.preview.dates
})

// Largeur exacte de la table = colonne nom (160px) + n×42px jours
const matrixTableWidth = computed(() => 160 + visibleDates.value.length * 42)

// Libellé de navigation semaine (ex: "Lun 02/06 → Ven 06/06")
const weekNavLabel = computed(() => {
  const grp = weekGroups.value[weekIdx.value]
  if (!grp || !grp.dates.length) return ''
  const first = grp.dates[0]
  const last  = grp.dates[grp.dates.length - 1]
  return `${getDow(first)} ${fmtDM(first)} → ${getDow(last)} ${fmtDM(last)}`
})


const monthLabel = computed(() => {
  if (!fc.forecast) return ''
  const first = Object.keys(fc.forecast).sort()[0]
  if (!first) return ''
  const d = new Date(first + 'T12:00:00')
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
})

// Indique le mois des données appliquées (pour le rappel de navigation dans la vue planning)
const resultMonthLabel = computed(() => {
  if (!fc.genResults || !fc.preview) return ''
  const first = fc.preview.dates[0]
  if (!first) return ''
  const d = new Date(first + 'T12:00:00')
  const now = new Date()
  // Afficher le rappel seulement si ce n'est pas le mois courant
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return ''
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
})

function fmtDM(iso) {
  const d = new Date(iso + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
}
function getDow(iso) { return JOURS_SHORT[new Date(iso + 'T12:00:00').getDay()] }
function cellStyle(shift) {
  const c = SHIFT_COLORS[shift || ''] || SHIFT_COLORS['']
  return { background: c.bg, color: c.text }
}

/* ── ETP / Risque par jour ── */

// Mapping shift → famille ETP pour le comptage
const SHIFT_TO_FAMILY = {
  'Matin':            'matin', 'TLT Matin':        'matin', 'Agence Matin':      'matin',
  'TLT Agence Matin': 'matin', 'MatinW11':         'matin',
  'Midi':             'midi',  'TLT Midi':          'midi',  'Agence Midi':       'midi',
  'TLT Agence Midi':  'midi',
  'Aprem':            'aprem', 'TLT APREM':         'aprem', 'Agence APREM':      'aprem',
  'TLT Agence APREM': 'aprem', 'ApremRenf':         'aprem',
  'Soir':             'soir',  'TLT Soir':          'soir',  'Agence Soir':       'soir',
  'TLT Agence Soir':  'soir',  'SoirW11':           'soir',
  'BO':               'bo',    'PiloteBO':          'bo',    'Pilote':            'bo',
}

// Réactif aux modifications à chaud : lit matrix[person][iso] pour chaque date
const etpStats = computed(() => {
  if (!fc.preview || !fc.forecast) return {}
  const result = {}
  for (const iso of fc.preview.dates) {
    const fcDay = fc.forecast[iso]
    if (!fcDay) { result[iso] = null; continue }

    const actual = { matin: 0, midi: 0, aprem: 0, soir: 0, bo: 0 }
    for (const person of fc.preview.persons) {
      const fam = SHIFT_TO_FAMILY[fc.preview.matrix[person]?.[iso] || '']
      if (fam) actual[fam]++
    }

    const expM = fcDay.matin || 0, expMi = fcDay.midi || 0
    const expA = fcDay.aprem || 0, expS  = fcDay.soir || 0
    const expTotal = expM + expMi + expA + expS   // = fcDay.etp

    // Les BO ne comptent pas dans l'ETP (ressources hors RUN)
    const actRun   = actual.matin + actual.midi + actual.aprem + actual.soir
    const shortfall = actRun - expTotal  // négatif si manque de ressources

    // +N = personnes actives ce jour sans horaire (ni shift, ni absence, ni BO)
    // = disponibles mais non affectées au RUN (banc, surplus)
    const activeNames = fc.preview.activeByDate?.[iso]
    const extraBench = fc.preview.persons.filter(p => {
      if (activeNames && !activeNames.has(p)) return false  // pas active ce jour
      return fc.preview.matrix[p]?.[iso] === ''              // aucune affectation (strict: undefined = absent/BO/non-dispo)
    }).length

    result[iso] = {
      expected:   expTotal,    // cible forecast (PREV col G) — affiché en grand
      actRun,                  // RUN affectés (hors BO)
      shortfall,               // actRun - expected (0 = OK, négatif = manque)
      extraBench,              // actives sans horaire (hors absences) — affiché en +N
      byShift: {
        matin: { actual: actual.matin, exp: expM  },
        midi:  { actual: actual.midi,  exp: expMi },
        aprem: { actual: actual.aprem, exp: expA  },
        soir:  { actual: actual.soir,  exp: expS  },
      },
    }
  }
  return result
})

function etpCellStyle(iso) {
  const s = etpStats.value[iso]
  if (!s) return { background: 'var(--bg-surface)' }
  if (s.shortfall >= 0) return { background: 'color-mix(in srgb, #22c55e 18%, var(--bg-surface))', color: '#22c55e' }
  if (s.shortfall === -1) return { background: 'color-mix(in srgb, #f59e0b 22%, var(--bg-surface))', color: '#f59e0b' }
  return { background: 'color-mix(in srgb, #ef4444 22%, var(--bg-surface))', color: '#ef4444' }
}

function etpTitle(iso) {
  const s = etpStats.value[iso]
  if (!s) return 'Aucune prévision'
  const b = s.byShift
  const status = s.shortfall === 0 ? '✓ Objectif atteint'
    : s.shortfall < 0 ? `⚠ Manque ${-s.shortfall} pers.`
    : `+${s.shortfall} en surplus`
  return (
    `ETP cible : ${s.expected}  |  RUN affectés : ${s.actRun}  (${status})\n` +
    `Mat ${b.matin.actual}/${b.matin.exp}  ` +
    `Mid ${b.midi.actual}/${b.midi.exp}  ` +
    `Apr ${b.aprem.actual}/${b.aprem.exp}  ` +
    `Soi ${b.soir.actual}/${b.soir.exp}` +
    (s.extraBench ? `\nBanc : ${s.extraBench} pers. actives sans horaire` : '')
  )
}

/* ── Stats historiques ── */
function getHistStat(person, shift) {
  return fc.preview?.history?.[person]?.[shift] ?? 0
}
function getHistTotal(person) {
  return fc.preview?.history?.[person]?.total ?? 0
}
function getHistPct(person, shift) {
  const total = getHistTotal(person)
  if (!total) return 0
  return Math.round(getHistStat(person, shift) / total * 100)
}
</script>
