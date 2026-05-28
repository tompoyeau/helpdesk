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
        <button class="btn-info" @click="showInfoModal = true">
          <Info :size="13" />
          <span>Règles</span>
        </button>
        <span style="font-size:0.6875rem;color:var(--text-muted);margin-left:8px">
          Équitable · même horaire/semaine mais ETP en priorité · TLT max 2j/semaine · pas de TLT le mercredi
        </span>
        <!-- Option absences base test -->
        <label class="opt-test-absences" :class="{ active: useTestAbsences }">
          <input type="checkbox" v-model="useTestAbsences" style="display:none" />
          <FlaskConical :size="12" />
          Absences base TEST
        </label>
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
                  <tr
                    v-for="person in fc.preview.persons"
                    :key="person"
                    :class="{ 'tr-fixed': fc.preview.fixedPersons?.has(person) }"
                  >
                    <td class="td-name">
                      <span v-if="fc.preview.fixedPersons?.has(person)" class="td-fixed-badge" title="Ressource fixe — non modifiable">⚓</span>
                      {{ person }}
                    </td>
                    <td
                      v-for="iso in visibleDates"
                      :key="iso"
                      class="td-cell"
                      :class="{
                        'td-lundi':   viewMode === 'month' && weekStarts.has(iso),
                        'td-edited':  isEdited(person, iso),
                        'td-editing': editCell?.person === person && editCell?.iso === iso,
                        'td-fixed':   fc.preview.fixedPersons?.has(person),
                      }"
                      :style="cellStyle(fc.preview.matrix[person]?.[iso])"
                      :title="fc.preview.fixedPersons?.has(person)
                        ? (fc.preview.matrix[person]?.[iso] || 'Non affecté') + ' · Ressource fixe'
                        : (fc.preview.matrix[person]?.[iso] || 'Non affecté') + ' · Cliquer pour modifier'"
                      @click.stop="!fc.preview.fixedPersons?.has(person) && openEdit(person, iso, $event)"
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
            <div class="equity-subtitle">Avant ce forecast · 12 mois glissants · Agence = jour off</div>

            <div class="equity-list">
              <div v-for="person in fc.preview.persons.filter(p => !fc.preview.fixedPersons?.has(p))" :key="person" class="equity-row">
                <div class="eq-name">{{ person }}</div>
                <div class="eq-bars">
                  <!-- Shifts matin/midi/aprem/soir -->
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

                  <!-- Ratio journées vertes (Agence) -->
                  <div
                    class="eq-bar-wrap eq-bar-agence-wrap"
                    :title="`Journées Agence : ${getAgenceDays(person)} / ${getTotalActiveDays(person)} jours actifs (${getAgencePct(person)}%)`"
                  >
                    <div
                      class="eq-bar eq-bar-agence"
                      :style="{ width: Math.min(getAgencePct(person), 100) + '%' }"
                    ></div>
                    <span class="eq-bar-val eq-bar-agence-val">
                      {{ getAgencePct(person) }}%
                      <span class="eq-agence-detail">({{ getAgenceDays(person) }}j / {{ getTotalActiveDays(person) }}j)</span>
                    </span>
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
              <span class="eq-legend-item eq-legend-agence">
                <span class="eq-dot" style="background:#65a30d"></span>
                Agence
              </span>
            </div>
          </div>

        </div>
      </template>
    </template>

  <!-- ── Modale info algorithme ── -->
  <teleport to="body">
    <div v-if="showInfoModal" class="eq-modal-backdrop" @click.self="showInfoModal = false">
      <div class="eq-modal" style="max-width:560px">

        <!-- En-tête -->
        <div class="eq-modal-head">
          <div style="display:flex;align-items:center;gap:8px">
            <Info :size="15" style="color:var(--accent)" />
            <span style="font-weight:700;font-size:0.875rem">Règles de l'algorithme forecast</span>
          </div>
          <button class="btn-icon" @click="showInfoModal = false"><X :size="14" /></button>
        </div>

        <div class="info-modal-body">

          <!-- ETP -->
          <div class="info-section">
            <div class="info-section-title">Dimensionnement ETP</div>
            <p>La grille ETP détermine le nombre de créneaux matin / midi / aprem / soir à couvrir chaque semaine selon le nombre de collaborateurs disponibles (de 10 à 21+). Si le pool est trop petit, les besoins sont redimensionnés proportionnellement (méthode des plus grands restes).</p>
          </div>

          <!-- Absences -->
          <div class="info-section">
            <div class="info-section-title">Absences protégées</div>
            <p>Les jours déjà renseignés comme <strong>CP, Indisponible, Récup, Astreinte</strong> ou <strong>RH</strong> ne sont jamais remplacés par l'algorithme, quelle que soit l'option « Écraser existants ».</p>
          </div>

          <!-- Fixes -->
          <div class="info-section">
            <div class="info-section-title">Personnes fixes</div>
            <p><strong>MACA</strong> et <strong>ALRE</strong> ont leurs plannings lus directement depuis le fichier Excel importé et ne sont pas touchés par le moteur d'affectation.</p>
          </div>

          <!-- Cohérence horaire -->
          <div class="info-section">
            <div class="info-section-title">Cohérence horaire &amp; équité historique</div>
            <p>Chaque collaborateur garde le même créneau (matin, midi, aprem ou soir) toute la semaine (référence = lundi ou premier jour travaillé).</p>
            <p style="margin-top:6px">L'algorithme analyse <strong>tout l'historique Firebase</strong> pour compter combien de semaines chaque personne a été sur chaque créneau. Le score d'attribution est : <code>0,25 − (semaines sur ce créneau / total)</code> — ceux qui ont le moins cumulé ce créneau passent en priorité. Une pénalité s'applique si la même personne a eu le même créneau la semaine précédente, et un bonus pour ceux qui n'ont pas été affectés plusieurs semaines d'affilée.</p>
          </div>

          <!-- TLT -->
          <div class="info-section">
            <div class="info-section-title">Télétravail (TLT)</div>
            <p>Maximum <strong>2 jours TLT par semaine</strong> par collaborateur. Le mercredi est toujours exclu du TLT. Les jours TLT sont alloués après les affectations en présentiel, dans la limite du quota hebdomadaire de chaque personne.</p>
          </div>

          <!-- Agence -->
          <div class="info-section">
            <div class="info-section-title">Journées vertes (Agence)</div>
            <p>Les créneaux Agence correspondent aux besoins non couverts après les affectations classiques. Maximum <strong>2 jours Agence par personne par semaine</strong>. La distribution suit une rotation mensuelle avec égalisation du ratio historique sur une fenêtre glissante d'un an (ou depuis la date d'arrivée si plus récente).</p>
          </div>

          <!-- BO -->
          <div class="info-section">
            <div class="info-section-title">Back-office (BO)</div>
            <p>Le BO est attribué en rotation équitable parmi les collaborateurs éligibles (<code>peutBO = true</code>), dans la limite du nombre de BO simultanés configuré ci-dessus. Une personne en BO n'est pas affectée à un créneau horaire cette semaine-là.</p>
          </div>

        </div>
      </div>
    </div>
  </teleport>

  <!-- ── Modale répartition globale ── -->
  <teleport to="body">
    <div v-if="showEquityModal" class="eq-modal-backdrop" @click.self="showEquityModal = false">
      <div class="eq-modal">

        <!-- Header -->
        <div class="eq-modal-head">
          <div>
            <h3 style="margin:0 0 2px;font-size:0.9375rem;font-weight:700">Répartition des équipes</h3>
            <span style="font-size:0.6875rem;color:var(--text-muted)">
              12 mois glissants · {{ monthLabel }} · {{ equityPersons.length }} collaborateurs
            </span>
          </div>
          <button class="btn-icon" @click="showEquityModal = false"><X :size="14" /></button>
        </div>

        <!-- Table -->
        <div class="eq-modal-scroll">
          <table class="eq-modal-table">
            <thead>
              <tr>
                <th class="eqt-th eqt-name" @click="toggleSort('nom')">
                  Collaborateur <span class="sort-arrow">{{ sortArrow('nom') }}</span>
                </th>
                <th class="eqt-th" @click="toggleSort('total')">
                  Semaines <span class="sort-arrow">{{ sortArrow('total') }}</span>
                </th>
                <th v-for="s in ['matin','midi','aprem','soir']" :key="s" class="eqt-th" @click="toggleSort(s)">
                  {{ SITE_NAME[s] }} <span class="sort-arrow">{{ sortArrow(s) }}</span>
                </th>
                <th class="eqt-th eqt-agence" @click="toggleSort('agence')">
                  Agence <span class="sort-arrow">{{ sortArrow('agence') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="person in equityPersonsSorted" :key="person" class="eqt-row">

                <!-- Nom -->
                <td class="eqt-name">{{ person }}</td>

                <!-- Total semaines -->
                <td class="eqt-num">{{ getHistTotal(person) }}s</td>

                <!-- Shift bars -->
                <td v-for="s in ['matin','midi','aprem','soir']" :key="s" class="eqt-bar-cell">
                  <div class="eqt-bar-wrap">
                    <div
                      class="eqt-bar"
                      :style="{
                        width: getHistPct(person, s) + '%',
                        background: SHIFT_COLORS[SITE_NAME[s]]?.text
                      }"
                    ></div>
                    <span class="eqt-pct">{{ getHistPct(person, s) }}%</span>
                    <span class="eqt-abs">({{ getHistStat(person, s) }}s)</span>
                  </div>
                </td>

                <!-- Agence ratio -->
                <td class="eqt-bar-cell eqt-agence">
                  <div class="eqt-bar-wrap">
                    <div class="eqt-bar eqt-bar-green" :style="{ width: Math.min(getAgencePct(person), 100) + '%' }"></div>
                    <span class="eqt-pct eqt-pct-green">{{ getAgencePct(person) }}%</span>
                    <span class="eqt-abs">({{ getAgenceDays(person) }}j / {{ getTotalActiveDays(person) }}j)</span>
                  </div>
                </td>

              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  </teleport>

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
.opt-test-absences {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
  border: 1.5px solid var(--border); border-radius: 999px;
  color: var(--text-muted); cursor: pointer;
  transition: all 0.15s; white-space: nowrap; user-select: none;
}
.opt-test-absences:hover { background: var(--bg-hover); color: var(--text); }
.opt-test-absences.active {
  border-color: #a78bfa; background: rgba(167,139,250,0.12); color: #a78bfa;
}
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
.td-cell:hover:not(.td-fixed) { filter: brightness(1.25); }
.td-fixed { cursor: default !important; }
.tr-fixed .td-name { background: color-mix(in srgb, var(--bg-card) 85%, var(--accent) 15%); }
.td-fixed-badge { font-size: 0.55rem; margin-right: 3px; opacity: 0.6; }
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

/* Barre journées vertes (Agence) */
.eq-bar-agence-wrap { margin-top: 3px; border-top: 1px solid var(--border); padding-top: 3px; }
.eq-bar-agence { background: #65a30d; max-width: 60px; }
.eq-bar-agence-val { color: #3f6212 !important; font-weight: 700; display: flex; align-items: center; gap: 3px; }
.eq-agence-detail { font-size: 0.5rem; font-weight: 400; color: var(--text-muted); white-space: nowrap; }

.equity-legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.eq-legend-item { display: flex; align-items: center; gap: 3px; font-size: 0.5625rem; font-weight: 600; }
.eq-legend-agence { color: #3f6212; }
.eq-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

/* ── Bouton répartition ── */
.btn-equity {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg-surface);
  color: var(--text-muted); font-size: 0.75rem; font-weight: 600; cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.btn-equity:hover { background: var(--bg-hover); color: var(--text); }

/* ── Modale répartition ── */
.eq-modal-backdrop {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.eq-modal {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: 0 16px 48px rgba(0,0,0,0.3);
  width: 100%; max-width: 1100px; max-height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.eq-modal-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.eq-modal-scroll { overflow: auto; flex: 1; }

/* ── Table équité ── */
.eq-modal-table {
  width: 100%; border-collapse: collapse; font-size: 0.75rem;
}
.eq-modal-table thead { position: sticky; top: 0; z-index: 2; }
.eqt-th {
  padding: 10px 16px; text-align: left; font-size: 0.6875rem; font-weight: 700;
  color: var(--text-muted); background: var(--bg-surface);
  border-bottom: 2px solid var(--border); cursor: pointer; white-space: nowrap;
  user-select: none;
}
.eqt-th:hover { color: var(--text); }
.eqt-row { border-bottom: 1px solid var(--border); transition: background 0.1s; }
.eqt-row:hover { background: var(--bg-hover); }
.eqt-name { padding: 10px 16px; font-weight: 600; white-space: nowrap; min-width: 160px; }
.eqt-num  { padding: 10px 12px; text-align: center; color: var(--text-muted); font-size: 0.6875rem; white-space: nowrap; }
.eqt-bar-cell { padding: 8px 16px; min-width: 160px; }
.eqt-agence { min-width: 180px; }
.eqt-bar-wrap { display: flex; align-items: center; gap: 6px; }
.eqt-bar {
  height: 8px; border-radius: 4px; min-width: 2px; max-width: 80px;
  transition: width 0.3s; flex-shrink: 0;
}
.eqt-bar-green { background: #65a30d; max-width: 80px; }
.eqt-pct { font-size: 0.6875rem; font-weight: 700; color: var(--text); min-width: 32px; }
.eqt-pct-green { color: #3f6212; }
.eqt-abs { font-size: 0.5625rem; color: var(--text-muted); }
.sort-arrow { font-size: 0.5rem; margin-left: 2px; }

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

/* ── Bouton info ── */
.btn-info {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 7px; border: 1px solid var(--border);
  background: var(--bg-card); color: var(--text-muted);
  font-size: 0.75rem; font-weight: 500; cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.btn-info:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }

/* ── Modale info ── */
.info-modal-body {
  padding: 16px 20px 20px;
  max-height: 70vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.info-section {
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 11px 14px;
  border: 1px solid var(--border);
}
.info-section-title {
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--accent);
  margin-bottom: 5px;
  letter-spacing: 0.01em;
}
.info-section p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text);
  line-height: 1.55;
}
.info-section strong { color: var(--text); }
.info-section code {
  font-family: monospace;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 0.7rem;
}
</style>

<script>
import { ref } from 'vue'
// Persistants entre les changements d'onglets (réinitialisés uniquement au refresh)
const overwrite = ref(false)
const testMode  = ref(false)
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useForecastStore, SHIFT_COLORS, loadAbsencesFromCollection } from '@/stores/forecastStore'
import { useUserStore }                   from '@/stores/userStore'
import { useDataStore }                   from '@/stores/dataStore'
import {
  Upload, FileSpreadsheet, X, Eye, Wand2, Undo2,
  AlertTriangle, CheckCircle2, SkipForward, BarChart2,
  ChevronLeft, ChevronRight, PieChart, Info, FlaskConical,
} from 'lucide-vue-next'

const fc        = useForecastStore()
const userStore = useUserStore()
const data      = useDataStore()

const fileInput   = ref(null)
const dragOver    = ref(false)
const useTestAbsences = ref(false)   // lire les absences depuis plannings_test
// overwrite et testMode sont définis en module-scope (persistants entre onglets)
const genProgress  = ref(0)
const genTotal     = ref(0)
const undoProgress = ref(0)
const undoTotal    = ref(0)
const viewMode    = ref('month')  // 'month' | 'week'
const weekIdx     = ref(0)

/* ── Modale info algorithme ── */
const showInfoModal = ref(false)

/* ── Modale répartition globale ── */
const showEquityModal = ref(false)
const equitySort      = ref({ key: 'nom', dir: 1 })   // dir: 1=asc, -1=desc

// Personnes affichées dans la modale (sans les fixes)
const equityPersons = computed(() =>
  (fc.preview?.persons ?? []).filter(p => !fc.preview?.fixedPersons?.has(p))
)

const equityPersonsSorted = computed(() => {
  const { key, dir } = equitySort.value
  return [...equityPersons.value].sort((a, b) => {
    let va, vb
    if      (key === 'nom')    { va = a;                       vb = b }
    else if (key === 'total')  { va = getHistTotal(a);         vb = getHistTotal(b) }
    else if (key === 'agence') { va = getAgencePct(a);         vb = getAgencePct(b) }
    else                       { va = getHistPct(a, key);      vb = getHistPct(b, key) }
    if (va < vb) return -dir
    if (va > vb) return  dir
    return a.localeCompare(b, 'fr')
  })
})

function toggleSort(key) {
  if (equitySort.value.key === key) equitySort.value.dir *= -1
  else equitySort.value = { key, dir: key === 'nom' ? 1 : -1 }
}
function sortArrow(key) {
  if (equitySort.value.key !== key) return '↕'
  return equitySort.value.dir === 1 ? '↑' : '↓'
}

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
async function doPreview() {
  weekIdx.value     = 0
  editedCells.value = new Set()

  let testAbsenceMap = null
  if (useTestAbsences.value && fc.forecast) {
    const dates = Object.keys(fc.forecast)
    testAbsenceMap = await loadAbsencesFromCollection(dates, 'plannings_test')
  }

  fc.previewPlanningWeekly({
    persons:       userStore.users,
    planningData:  data.planning,
    testAbsenceMap,
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

/* ── Ratio journées vertes (Agence) ── */
function getAgenceDays(person) {
  return fc.preview?.personStats?.[person]?.agenceDays ?? 0
}
function getTotalActiveDays(person) {
  return fc.preview?.personStats?.[person]?.totalActiveDays ?? 0
}
function getAgencePct(person) {
  return Math.round((fc.preview?.personStats?.[person]?.agenceRatio ?? 0) * 100)
}
</script>
