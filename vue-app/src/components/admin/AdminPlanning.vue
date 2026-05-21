<template>
  <div>
    <!-- Navigation -->
    <div class="planning-nav" style="margin-bottom:8px">

      <!-- Contrôles semaine -->
      <template v-if="viewMode === 'week'">
        <button class="btn-icon" @click="weekOffset--"><ChevronLeft :size="16" /></button>
        <WeekPicker :week-offset="weekOffset" :week-dates="weekDates" @update:week-offset="weekOffset = $event" />
        <button class="btn-icon" @click="weekOffset++"><ChevronRight :size="16" /></button>
      </template>

      <!-- Contrôles mois -->
      <template v-else>
        <button class="btn-icon" @click="monthOffset--"><ChevronLeft :size="16" /></button>
        <span class="month-nav-label">{{ monthNavLabel }}</span>
        <button class="btn-icon" @click="monthOffset++"><ChevronRight :size="16" /></button>
      </template>

      <!-- Aujourd'hui (commun) -->
      <button class="btn-primary" style="font-size:0.8125rem;padding:6px 12px"
        @click="viewMode === 'week' ? weekOffset = 0 : monthOffset = 0">
        <CalendarCheck :size="12" /> Aujourd'hui
      </button>

      <!-- Toggle Semaine / Mois -->
      <div class="view-mode-toggle">
        <button :class="['vm-btn', { 'vm-active': viewMode === 'week' }]" @click="viewMode = 'week'">Semaine</button>
        <button :class="['vm-btn', { 'vm-active': viewMode === 'month' }]" @click="viewMode = 'month'">
          <LayoutGrid :size="11" /> Mois
        </button>
      </div>

      <!-- Import ETP + Équipe Covéa -->
      <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
        <input ref="etpFileInput" type="file" accept=".xlsx,.xlsm,.xls" style="display:none" @change="onEtpFile" />
        <button
          class="btn-etp-import"
          :disabled="etpImporting"
          @click="etpFileInput.click()"
        >
          <div v-if="etpImporting" class="btn-spinner-sm"></div>
          <FileUp v-else :size="12" />
          {{ etpImporting ? 'Import…' : 'Import ETP' }}
        </button>
        <span v-if="etpImportMsg" class="etp-import-msg" :class="{ 'etp-import-err': etpImportMsg.startsWith('Erreur') }">
          {{ etpImportMsg }}
        </span>
        <button
          class="btn-test-collection"
          :class="{ 'btn-test-active': admin.collectionName !== 'plannings' }"
          @click="toggleTestCollection"
        >
          <FlaskConical :size="12" />
          {{ admin.collectionName !== 'plannings' ? 'Base TEST' : 'Base prod' }}
        </button>
      </div>
    </div>

    <!-- Bannière mode test -->
    <div v-if="admin.collectionName !== 'plannings'" class="test-banner">
      <FlaskConical :size="11" />
      Vous consultez <strong>plannings_test</strong> — les modifications ici n'affectent pas la production
    </div>

    <!-- ══ Vue Semaine ══ -->
    <template v-if="viewMode === 'week'">

    <!-- Cartes jours -->
    <div class="days-grid">
      <div
        v-for="date in weekDates"
        :key="fmtId(date)"
        class="day-card"
        :class="{
          'day-card-active':  selectedDate && fmtId(date) === fmtId(selectedDate),
          'day-card-today':   isToday(date),
          'day-card-weekend': date.getDay() === 6,
          [`day-card-risk-${riskLevel(dayStatus[fmtId(date)]?.etp, dayStatus[fmtId(date)]?.filledCount)}`]: dayStatus[fmtId(date)]?.state === 'exists',
        }"
        @click="selectDay(date)"
      >
        <div class="day-header">
          <span class="day-name">{{ DAYS[date.getDay()] }}</span>
          <span class="day-num">{{ date.getDate() }}</span>
          <span
            v-if="dayStatus[fmtId(date)]?.state === 'exists' && dayStatus[fmtId(date)]?.etp != null"
            class="risk-dot"
            :class="`risk-dot-${riskLevel(dayStatus[fmtId(date)].etp, dayStatus[fmtId(date)].filledCount)}`"
          ></span>
        </div>
        <div v-if="dayStatus[fmtId(date)]" class="day-status">
          <span v-if="dayStatus[fmtId(date)].state === 'loading'" style="color:var(--text-muted)">…</span>
          <template v-else-if="dayStatus[fmtId(date)].state === 'exists'">
            <span :class="dayStatus[fmtId(date)].filledCount > 0 ? 'badge-filled' : 'badge-exists'">
              <Users :size="10" /> {{ dayStatus[fmtId(date)].filledCount }} / {{ dayStatus[fmtId(date)].total }}
            </span>
            <span v-if="dayStatus[fmtId(date)].etp != null" class="badge-etp">
              <Zap :size="9" /> {{ dayStatus[fmtId(date)].etp }} ETP
            </span>
          </template>
          <span v-else class="badge-new">
            <Plus :size="10" /> Créer
          </span>
        </div>
      </div>
    </div>

    <!-- Éditeur du jour sélectionné -->
    <div v-if="selectedDate && dayData" class="day-editor">
      <div class="day-editor-header">
        <h3>
          {{ DAYS_FULL[selectedDate.getDay()] }}
          {{ selectedDate.getDate() }} {{ MONTHS[selectedDate.getMonth()] }} {{ selectedDate.getFullYear() }}
          <span v-if="dayStatus[fmtId(selectedDate)]?.etp != null" class="etp-header-badge">
            <Zap :size="11" /> {{ dayStatus[fmtId(selectedDate)].etp }} ETP
          </span>
        </h3>
        <div style="display:flex;gap:8px;align-items:center">
          <span v-if="admin.saving" style="font-size:0.75rem;color:var(--text-muted)">Enregistrement…</span>
          <span v-else-if="saveSuccess" class="save-success"><Check :size="12" /> Sauvegardé</span>
          <button
            class="btn-sort"
            :class="{ 'btn-sort-active': sortByHoraire }"
            title="Trier par type d'horaire"
            @click="sortByHoraire = !sortByHoraire"
          >
            <ArrowUpDown :size="12" />
            {{ sortByHoraire ? 'Catégorie' : 'Alphabétique' }}
          </button>
        </div>
      </div>

      <div v-if="loadingDay" style="padding:24px;text-align:center;color:var(--text-muted)">
        Chargement du planning…
      </div>

      <template v-else>
        <div class="table-scroll-wrap">
        <table class="w-full" style="font-size:0.8125rem;min-width:520px">
          <thead>
            <tr>
              <th style="width:180px">Collaborateur</th>
              <th>Activités prévues</th>
              <th style="width:60px;text-align:center">Heures</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in mergedRessources" :key="r.idPersonne" class="row-clickable" @click="openDayEditor(r)">
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="person-avatar" style="width:26px;height:26px;font-size:0.5625rem">
                    {{ `${r.nom?.[0] ?? ''}${r.prenom?.[0] ?? ''}`.toUpperCase() }}
                  </div>
                  {{ r.nom }} {{ r.prenom }}
                </div>
              </td>
              <td>
                <div class="mini-timeline">
                  <template v-for="(block, i) in getTimelineBlocks(r.activites)" :key="i">
                    <div v-if="block.empty" class="tl-gap" :style="{ width: block.width + '%' }" />
                    <div v-else class="tl-block"
                      :style="{ width: block.width + '%', background: block.color }"
                      :title="block.label"
                    >
                      <span v-if="block.width >= 10" class="tl-label" :style="{ color: block.textColor }">{{ block.label }}</span>
                    </div>
                  </template>
                </div>
              </td>
              <td style="text-align:center">
                <span v-if="calcHeures(r.activites) > 0" class="heures-badge">
                  {{ fmtHeures(calcHeures(r.activites)) }}
                </span>
                <span v-else style="color:var(--text-subtle)">—</span>
              </td>
              <td>
                <div style="display:flex;gap:4px;align-items:center;justify-content:flex-end">
                  <template v-if="clearTarget === r.idPersonne">
                    <span style="font-size:0.6875rem;color:var(--text-muted);white-space:nowrap">Effacer ?</span>
                    <button class="btn-action btn-action-confirm" title="Confirmer" @click.stop="clearActivites(r)">
                      <Check :size="12" />
                    </button>
                    <button class="btn-action" title="Annuler" @click.stop="clearTarget = null">
                      <X :size="12" />
                    </button>
                  </template>
                  <button
                    v-else-if="r.activites && r.activites.some(a => a && a !== '')"
                    class="btn-action btn-action-danger"
                    title="Effacer toutes les activités"
                    @click.stop="clearTarget = r.idPersonne"
                  >
                    <Eraser :size="12" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <!-- ── Équipe Covéa (MACA/ALRE) + ETP ── -->
        <div v-if="Object.keys(dayFixed).length || dayData?.etp != null" class="fixed-bar">
          <div v-if="dayData?.etp != null" class="fixed-bar-etp">
            <Zap :size="12" style="color:var(--accent)" />
            <span>ETP <strong>{{ dayData.etp }}</strong></span>
          </div>
          <div v-if="Object.keys(dayFixed).length" class="fixed-bar-sep"></div>
          <span class="fixed-bar-label">Équipe Covéa</span>
          <div
            v-for="(fam, name) in dayFixed"
            :key="name"
            class="fixed-shift-chip"
            :style="{ background: FAM_STYLE[fam]?.bg }"
          >
            <span class="fixed-chip-name">{{ name }}</span>
            <span class="fixed-chip-fam" :style="{ color: FAM_STYLE[fam]?.color }">{{ FAM_STYLE[fam]?.label || fam }}</span>
          </div>
        </div>

      </template>
    </div>

    </template><!-- fin vue semaine -->

    <!-- ══ Vue Mois ══ -->
    <template v-else>
      <div class="month-matrix-outer">

        <!-- Indicateur de chargement -->
        <div v-if="monthLoading" class="month-loading-bar">
          <span style="color:var(--text-muted);font-size:0.75rem">Chargement du mois…</span>
        </div>

        <div class="month-matrix-scroll">
          <table class="month-matrix-table">
            <colgroup>
              <col style="width:160px;min-width:160px;max-width:160px">
              <col v-for="iso in monthWorkDates" :key="iso" style="width:40px;min-width:40px;max-width:40px">
            </colgroup>
            <thead>
              <tr>
                <th class="mm-th-name">Collaborateur</th>
                <th
                  v-for="iso in monthWorkDates"
                  :key="iso"
                  class="mm-th-day"
                  :class="{
                    'mm-week-sep': monthWeekStarts.has(iso),
                    'mm-th-sam':   monthSamedis.has(iso),
                    'mm-th-ferie': monthFeries.has(iso),
                  }"
                >
                  <div class="mm-dow" :class="`mm-dow-${getDow(iso).toLowerCase()}`">{{ getDow(iso) }}</div>
                  <div class="mm-dm">{{ fmtDM(iso) }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- ── Ligne ETP cible (en tête, juste sous les jours) ── -->
              <tr class="mm-etp-row">
                <td class="mm-td-name mm-td-etp">ETP</td>
                <td
                  v-for="iso in monthWorkDates"
                  :key="iso"
                  class="mm-cell mm-etp-cell"
                  :class="{
                    'mm-week-sep':  monthWeekStarts.has(iso),
                    'mm-cell-sam':  monthSamedis.has(iso),
                    'mm-cell-ferie':monthFeries.has(iso),
                  }"
                  :style="etpCellStyleMonth(iso)"
                  :title="etpTitleMonth(iso)"
                >
                  <template v-if="monthEtp[iso] != null">
                    <div class="etp-num">{{ monthEtp[iso] }}</div>
                    <div class="etp-sub">
                      <span v-if="(monthData[iso]?.filledCount ?? 0) - monthEtp[iso] < 0" style="color:inherit">{{ (monthData[iso]?.filledCount ?? 0) - monthEtp[iso] }}</span>
                      <span v-else>✓</span>
                    </div>
                  </template>
                  <span v-else class="etp-na">—</span>
                </td>
              </tr>

              <tr
                v-for="{ person, fullName } in monthPersonRows"
                :key="person.id || fullName"
              >
                <td class="mm-td-name">
                  <div style="display:flex;align-items:center;gap:6px;overflow:hidden">
                    <div class="person-avatar" style="width:22px;height:22px;font-size:0.5rem;flex-shrink:0">
                      {{ `${person.nom?.[0]??''}${person.prenom?.[0]??''}`.toUpperCase() }}
                    </div>
                    <span class="mm-person-name">{{ person.nom }} {{ person.prenom }}</span>
                  </div>
                </td>
                <td
                  v-for="iso in monthWorkDates"
                  :key="iso"
                  class="mm-cell"
                  :class="{
                    'mm-week-sep':  monthWeekStarts.has(iso),
                    'mm-cell-sam':  monthSamedis.has(iso),
                    'mm-cell-ferie':monthFeries.has(iso),
                    'mm-inactive':  monthMatrix[fullName]?.[iso]?.inactive,
                    'mm-cell-load': monthMatrix[fullName]?.[iso]?.loading,
                  }"
                  :style="monthMatrix[fullName]?.[iso]?.bg
                    ? { background: monthMatrix[fullName][iso].bg, cursor: 'pointer' }
                    : undefined"
                  :title="`${fullName} · ${iso}`"
                  @click="!monthMatrix[fullName]?.[iso]?.inactive && openMonthCell(fullName, iso)"
                >
                  <span
                    v-if="monthMatrix[fullName]?.[iso]?.label"
                    class="mm-cell-label"
                    :style="{ color: monthMatrix[fullName][iso].color }"
                  >{{ monthMatrix[fullName][iso].label }}</span>
                </td>
              </tr>

              <!-- ── Lignes Équipe Covéa (MACA, ALRE) ── -->
              <template v-if="fixedPersonsInMonth.length">
                <!-- Séparateur : première cellule sticky, reste = ligne de séparation -->
                <tr class="mm-fixed-sep">
                  <td class="mm-td-name mm-fixed-sep-cell">Équipe Covéa</td>
                  <td
                    v-for="iso in monthWorkDates"
                    :key="iso"
                    class="mm-fixed-sep-td"
                    :class="{ 'mm-week-sep': monthWeekStarts.has(iso) }"
                  ></td>
                </tr>
                <tr v-for="fixedName in fixedPersonsInMonth" :key="fixedName" class="mm-fixed-row">
                  <td class="mm-td-name mm-td-fixed">
                    <div style="display:flex;align-items:center;gap:6px;overflow:hidden">
                      <div class="person-avatar" style="width:22px;height:22px;font-size:0.5rem;flex-shrink:0;background:var(--accent-light);color:var(--accent)">
                        {{ fixedName[0] }}
                      </div>
                      <span class="mm-person-name">{{ fixedName }}</span>
                      <span class="badge-fixe" style="font-size:0.5rem">Covéa</span>
                    </div>
                  </td>
                  <td
                    v-for="iso in monthWorkDates"
                    :key="iso"
                    class="mm-cell"
                    :class="{
                      'mm-week-sep':   monthWeekStarts.has(iso),
                      'mm-cell-sam':   monthSamedis.has(iso),
                      'mm-cell-ferie': monthFeries.has(iso),
                      'mm-cell-load':  fixedMonthMatrix[fixedName]?.[iso]?.loading,
                    }"
                    :style="fixedMonthMatrix[fixedName]?.[iso]?.bg
                      ? { background: fixedMonthMatrix[fixedName][iso].bg, cursor: 'default' }
                      : { cursor: 'default' }"
                  >
                    <span
                      v-if="fixedMonthMatrix[fixedName]?.[iso]?.label"
                      class="mm-cell-label"
                      :style="{ color: fixedMonthMatrix[fixedName][iso].color }"
                    >{{ fixedMonthMatrix[fixedName][iso].label }}</span>
                  </td>
                </tr>
              </template>


            </tbody>
          </table>
        </div>
      </div>
    </template><!-- fin vue mois -->

    <!-- Modal édition personne/jour -->
    <DayEditorModal
      v-if="editRessource"
      :ressource="editRessource"
      :date="selectedDate"
      :other-collabs="otherCollabs"
      @close="editRessource = null"
      @saved="onDaySaved"
    />
  </div>
</template>

<style scoped>
/* ── Bouton Enregistrer le planning ── */
.btn-save {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; font-size: 0.8125rem; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: background 0.15s, transform 0.1s;
}
.btn-save:hover   { background: var(--accent-hover); }
.btn-save:active  { transform: scale(0.97); }
.btn-save:disabled { opacity: 0.5; cursor: default; }

/* ── Bouton icône modifier (crayon) ── */
.btn-action {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: background 0.15s, color 0.15s;
}
.heures-badge {
  display: inline-block;
  font-size: 0.75rem; font-weight: 700;
  font-family: var(--font-mono);
  color: var(--accent);
}

.row-clickable { cursor: pointer; }
.row-clickable:hover td { background: var(--bg-hover); }

.btn-action:hover         { background: var(--bg-hover); color: var(--text); }
.btn-action-danger:hover  { background: rgba(239,68,68,0.08); color: #EF4444; border-color: rgba(239,68,68,0.3); }
.btn-action-confirm       { color: #059669; border-color: rgba(52,211,153,0.4); }
.btn-action-confirm:hover { background: rgba(52,211,153,0.1); color: #059669; }

.days-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px; margin-bottom: 16px;
}
.day-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
  min-height: 70px;
  display: flex; flex-direction: column; gap: 6px;
}
.day-card:hover { border-color: var(--accent); box-shadow: var(--shadow-sm); }
.day-card-active { border-color: var(--accent); background: var(--accent-light); }
.day-card-today .day-num { color: var(--accent); font-weight: 700; }
.day-card-weekend { opacity: 0.7; }
.day-header { display: flex; justify-content: space-between; align-items: center; }
.day-name { font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
.day-num  { font-size: 1rem; font-weight: 700; }
.day-status { display: flex; }
.badge-filled, .badge-exists, .badge-new {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.625rem; font-weight: 600;
  padding: 2px 6px; border-radius: 999px;
}
.badge-filled { background: rgba(52,211,153,0.15); color: #059669; }
.badge-exists { background: rgba(245,158,11,0.12); color: #D97706; }
.badge-new    { background: rgba(99,102,241,0.1);  color: var(--accent); }
.badge-etp {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.625rem; font-weight: 700;
  padding: 2px 6px; border-radius: 999px;
  background: rgba(99,102,241,0.1); color: var(--accent);
  margin-left: 4px;
}
.etp-header-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 600;
  padding: 2px 8px; border-radius: 999px;
  background: var(--accent-light); color: var(--accent);
  margin-left: 10px; vertical-align: middle;
}
.badge-fixe {
  display: inline-flex; align-items: center;
  font-size: 0.5625rem; font-weight: 700;
  padding: 1px 5px; border-radius: 4px;
  background: rgba(99,102,241,0.12); color: var(--accent);
  letter-spacing: 0.02em;
}

/* ── Bouton Import ETP ── */
.btn-etp-import {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-etp-import:hover:not(:disabled) { background: var(--accent-light); color: var(--accent); border-color: var(--accent); }
.btn-etp-import:disabled { opacity: 0.6; cursor: default; }
.btn-spinner-sm {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid rgba(99,102,241,0.3); border-top-color: var(--accent);
  animation: spin 0.7s linear infinite;
}
.etp-import-msg { font-size: 0.6875rem; color: #059669; white-space: nowrap; }
.etp-import-err { color: #ef4444 !important; }

/* ── Barre Équipe Covéa + ETP (vue semaine) ── */
.fixed-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
  font-size: 0.75rem;
}
.fixed-bar-etp {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.75rem; color: var(--text-muted);
}
.fixed-bar-etp strong { color: var(--accent); font-size: 0.875rem; }
.fixed-bar-sep { width: 1px; height: 18px; background: var(--border); }
.fixed-bar-label { font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.fixed-shift-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.06);
}
.fixed-chip-name { font-weight: 700; font-size: 0.75rem; color: var(--text); }
.fixed-chip-fam  { font-size: 0.6875rem; font-weight: 600; }


/* Day editor */
.day-editor {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.day-editor-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
  flex-wrap: wrap; gap: 8px;
}
.day-editor-header h3 { font-size: 0.875rem; font-weight: 700; margin: 0; }

.table-scroll-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

.mini-timeline {
  display: flex; height: 24px; border-radius: 6px; overflow: hidden;
  border: 1px solid var(--border); width: 100%;
  background: var(--bg-surface);
  gap: 1px;
}
.tl-gap {
  flex-shrink: 0;
  background: transparent;
}
.tl-block {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 3px;
  overflow: hidden;
  min-width: 0;
}
.tl-label {
  font-size: 0.625rem; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  padding: 0 5px;
  pointer-events: none;
  max-width: 100%;
  letter-spacing: 0.01em;
}

.save-success {
  font-size: 0.75rem; color: #059669;
  display: inline-flex; align-items: center; gap: 4px;
}

.btn-sort {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-sort:hover       { background: var(--bg-hover); color: var(--text); }
.btn-sort-active      { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }

@media (max-width: 768px) {
  .days-grid { grid-template-columns: repeat(3, 1fr); }
}

/* ── Toggle Semaine / Mois ── */
.view-mode-toggle {
  display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-sm);
  overflow: hidden; flex-shrink: 0;
}
.vm-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 11px; font-size: 0.75rem; font-weight: 500;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; transition: background 0.13s, color 0.13s; white-space: nowrap;
}
.vm-btn:hover { background: var(--bg-hover); color: var(--text); }
.vm-btn.vm-active { background: var(--accent-light); color: var(--accent); font-weight: 700; }

/* ── Navigation mois ── */
.month-nav-label {
  font-size: 0.875rem; font-weight: 700;
  min-width: 130px; text-align: center;
}

/* ── Matrice mois ── */
.month-matrix-outer {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.month-loading-bar {
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}
.month-matrix-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.month-matrix-table {
  border-collapse: collapse;
  font-size: 0.75rem;
}
.mm-th-name, .mm-td-name {
  position: sticky; left: 0; z-index: 2;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  padding: 6px 10px;
  white-space: nowrap;
}
.mm-th-name {
  background: var(--bg-surface);
  font-weight: 700; font-size: 0.6875rem; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 2px solid var(--border);
  z-index: 3;
}
.mm-th-day {
  padding: 5px 2px; text-align: center;
  background: var(--bg-surface);
  border-bottom: 2px solid var(--border);
  border-left: 1px solid transparent;
  min-width: 40px;
}
.mm-dow {
  font-size: 0.5625rem; font-weight: 700; text-transform: uppercase;
  color: var(--text-muted); line-height: 1.2;
}
.mm-dow-lun { color: var(--accent); }
.mm-dm {
  font-size: 0.6875rem; font-weight: 600; color: var(--text);
}
.mm-week-sep { border-left: 2px solid var(--border) !important; }

.mm-cell {
  height: 28px; width: 40px; padding: 0;
  text-align: center; vertical-align: middle;
  border-bottom: 1px solid var(--border);
  border-left: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.1s;
}
.mm-cell:hover:not(.mm-inactive):not(.mm-cell-load) { filter: brightness(0.88); }
.mm-inactive { background: var(--bg-surface) !important; cursor: default; }
.mm-cell-load { background: var(--bg-surface); }

.mm-cell-label {
  font-size: 0.5625rem; font-weight: 800;
  letter-spacing: 0.01em; pointer-events: none;
}
.mm-person-name {
  font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mm-td-name { border-bottom: 1px solid var(--border); }

/* Lignes alternées */
.month-matrix-table tbody tr:nth-child(even) .mm-td-name { background: var(--bg-surface); }

/* Override règle globale .content-card tbody td:last-child qui force text-align:right */
.month-matrix-table td:last-child,
.month-matrix-table th:last-child {
  text-align: center; font-family: inherit; font-size: inherit;
  color: inherit; font-weight: inherit; padding: 0;
}

/* ── Samedis ── */
.mm-th-sam {
  background: color-mix(in srgb, var(--bg-surface) 85%, #94a3b8 15%);
}
.mm-dow-sam { color: #64748b !important; }
.mm-cell-sam:not([style]) {
  background: color-mix(in srgb, var(--bg-card) 80%, #94a3b8 20%);
}

/* ── Fériés ── */
.mm-th-ferie {
  background: color-mix(in srgb, var(--bg-surface) 80%, #f59e0b 20%);
}
.mm-th-ferie .mm-dow { color: #b45309 !important; }
.mm-th-ferie .mm-dm  { color: #b45309 !important; }
.mm-cell-ferie:not([style]) {
  background: color-mix(in srgb, var(--bg-card) 75%, #fbbf24 25%);
}
.mm-cell-ferie.mm-cell-sam:not([style]) {
  background: color-mix(in srgb, var(--bg-card) 70%, #f59e0b 30%);
}

/* ── Lignes Équipe Covéa (MACA/ALRE) ── */
/* Séparateur : premier td sticky hérite mm-td-name, les autres = ligne de fond */
.mm-fixed-sep-cell {
  padding: 3px 10px;
  font-size: 0.5625rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--accent);
  background: var(--accent-light) !important;
  border-top: 2px solid var(--border);
}
.mm-fixed-sep-td {
  background: var(--accent-light);
  border-top: 2px solid var(--border);
  border-bottom: none;
  padding: 0;
}
.mm-td-fixed {
  background: color-mix(in srgb, var(--bg-card) 96%, #6366f1 4%) !important;
}
.mm-fixed-row .mm-td-name { border-bottom: 1px solid var(--border); }

/* ── Ligne ETP (identique à AdminForecast) ── */
.mm-etp-row { border-top: 2px solid var(--border); }
.mm-td-etp {
  background: var(--bg-surface) !important;
  font-weight: 700; font-size: 0.5rem;
  color: var(--text-muted); letter-spacing: 0.05em;
  text-transform: uppercase;
}
.mm-etp-cell {
  cursor: default !important;
  text-align: center;
  padding: 2px 1px;
  transition: background 0.2s;
}
.etp-num { font-size: 0.625rem; font-weight: 800; line-height: 1.2; }
.etp-sub { font-size: 0.5rem; font-weight: 700; line-height: 1.2; opacity: 0.9; display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; }
.etp-na  { font-size: 0.5rem; color: var(--text-subtle); }

/* Dot de risque dans le header des day cards */
.risk-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.risk-dot-ok   { background: #22c55e; }
.risk-dot-warn { background: #f59e0b; }
.risk-dot-crit { background: #ef4444; box-shadow: 0 0 4px rgba(239,68,68,0.5); }
.risk-dot-none { display: none; }

/* Bordure gauche des day cards selon le risque */
.day-card-risk-crit { border-left: 3px solid #ef4444 !important; }
.day-card-risk-warn { border-left: 3px solid #f59e0b !important; }
.day-card-risk-ok   { border-left: 3px solid #22c55e !important; }

/* ── Mode test ── */
.btn-test-collection {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-test-collection:hover { background: var(--bg-hover); color: var(--text); }
@media (max-width: 1024px) { .btn-test-collection { display: none !important; } }
.btn-test-active {
  background: rgba(245,158,11,0.1) !important;
  border-color: #f59e0b !important;
  color: #f59e0b !important;
}
.test-banner {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px; margin-bottom: 14px;
  background: rgba(245,158,11,0.1); border: 1px solid #f59e0b;
  border-radius: var(--radius-sm); font-size: 0.75rem;
  font-weight: 500; color: #b45309;
}
</style>

<script>
import { ref } from 'vue'
// Variables de module : persistent entre les changements d'onglets, réinitialisées au refresh
const weekOffset  = ref(0)
const viewMode    = ref('week')   // 'week' | 'month'
const monthOffset = ref(0)        // mois relatif au mois courant
</script>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  ChevronLeft, ChevronRight, CalendarCheck,
  Check, Plus, Users, Eraser, X, ArrowUpDown, FlaskConical, LayoutGrid, Zap, FileUp,
} from 'lucide-vue-next'
import { useAdminStore, ETP_CODES } from '@/stores/adminStore'
import { parseEtpFromExcel } from '@/stores/forecastStore'
import { useUserStore } from '@/stores/userStore'
import { useDataStore, ACTIVITY_MAPPING, HORAIRE_RANK } from '@/stores/dataStore'
import { notifyPlanningChange } from '@/services/notificationService'
import DayEditorModal from './DayEditorModal.vue'
import WeekPicker    from '@/components/planning/WeekPicker.vue'

const admin     = useAdminStore()
const userStore = useUserStore()
const data      = useDataStore()

/* ── Import ETP + MACA/ALRE depuis Excel ── */
const etpFileInput  = ref(null)
const etpImporting  = ref(false)
const etpImportMsg  = ref('')   // feedback message

async function onEtpFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''
  etpImporting.value = true
  etpImportMsg.value = ''
  try {
    const days = await parseEtpFromExcel(file)
    const entries = Object.entries(days)
    for (const [iso, { etp, fixed, matin, midi, aprem, soir }] of entries) {
      const [y, m, d] = iso.split('-').map(Number)
      await admin.saveEtpAndFixed(new Date(y, m - 1, d), { etp, fixed, matin, midi, aprem, soir })
    }
    etpImportMsg.value = `✓ ${entries.length} jours importés`
    // Recharger les données affichées
    if (viewMode.value === 'month') loadMonthData()
    else await checkWeekStatus()
  } catch (err) {
    etpImportMsg.value = `Erreur : ${err.message}`
  } finally {
    etpImporting.value = false
    setTimeout(() => { etpImportMsg.value = '' }, 4000)
  }
}

/* ── Niveau de risque d'une journée : etp cible vs personnes affectées ── */
function riskLevel(etp, filled) {
  if (etp == null || etp === 0) return 'none'
  if (filled == null)           return 'none'
  if (filled >= etp)                        return 'ok'
  if (filled >= Math.round(etp * 0.85))     return 'warn'
  return 'crit'
}

/* ── Style et tooltip ETP pour la vue mois (identique au forecast) ── */
function etpCellStyleMonth(iso) {
  const etp = monthEtp.value[iso]
  if (etp == null) return { background: 'var(--bg-surface)' }
  const filled = monthData.value[iso]?.filledCount ?? 0
  const shortfall = filled - etp
  if (shortfall >= 0)  return { background: 'color-mix(in srgb, #22c55e 18%, var(--bg-surface))', color: '#22c55e' }
  if (shortfall === -1) return { background: 'color-mix(in srgb, #f59e0b 22%, var(--bg-surface))', color: '#f59e0b' }
  return { background: 'color-mix(in srgb, #ef4444 22%, var(--bg-surface))', color: '#ef4444' }
}

function etpTitleMonth(iso) {
  const etp = monthEtp.value[iso]
  if (etp == null) return 'Aucune prévision ETP'
  const filled = monthData.value[iso]?.filledCount ?? 0
  const shortfall = filled - etp
  const status = shortfall === 0 ? '✓ Objectif atteint'
    : shortfall < 0 ? `⚠ Manque ${-shortfall} pers.`
    : `+${shortfall} en surplus`
  return `ETP cible : ${etp}  |  Affectés : ${filled}  (${status})`
}

/* ── Couleurs et labels pour les créneaux fixes (MACA/ALRE) ── */
const FAM_STYLE = {
  matin: { bg: 'rgba(174,219,255,0.5)', color: 'rgba(0,0,0,0.75)', label: 'Matin' },
  midi:  { bg: 'rgba(149,207,255,0.5)', color: 'rgba(0,0,0,0.75)', label: 'Midi'  },
  aprem: { bg: 'rgba(89,180,254,0.5)',  color: 'rgba(0,0,0,0.75)', label: 'Aprem' },
  soir:  { bg: 'rgba(86,166,233,0.5)',  color: 'rgba(0,0,0,0.75)', label: 'Soir'  },
}

const DAYS      = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const DAYS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const MONTHS    = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

/* ── Bascule collection test/prod ── */
async function toggleTestCollection() {
  admin.collectionName = admin.collectionName === 'plannings' ? 'plannings_test' : 'plannings'
  dayStatus.value = {}
  dayData.value   = null
  await checkWeekStatus()
  if (selectedDate.value) {
    loadingDay.value = true
    dayData.value    = await admin.loadDayPlanning(selectedDate.value)
    loadingDay.value = false
  }
}

/* ── Semaine (weekOffset défini en module-scope, au-dessus) ── */

function getMondayOf(offset) {
  const today = new Date()
  const diff  = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff + offset * 7)
  return mon
}

const weekDates = computed(() => {
  const mon = getMondayOf(weekOffset.value)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d
  })
})


function fmtId(date) { return admin.dateToId(date) }
function isToday(date) { return fmtId(date) === fmtId(new Date()) }

/* ── Jours fériés français ── */
function easterDate(year) {
  // Algorithme de Butcher
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function isFerie(date) {
  const y = date.getFullYear()
  const easter = easterDate(y)
  const add = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const feries = [
    new Date(y, 0,  1),          // Jour de l'An
    new Date(y, 4,  1),          // Fête du Travail
    new Date(y, 4,  8),          // Victoire 1945
    new Date(y, 6, 14),          // Fête Nationale
    new Date(y, 7, 15),          // Assomption
    new Date(y, 10,  1),         // Toussaint
    new Date(y, 10, 11),         // Armistice
    new Date(y, 11, 25),         // Noël
    add(easter, 1),              // Lundi de Pâques
    add(easter, 39),             // Ascension
    add(easter, 50),             // Lundi de Pentecôte
  ]
  const d0 = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  return feries.some(f => f.getFullYear() * 10000 + (f.getMonth() + 1) * 100 + f.getDate() === d0)
}

/* ── Statut des jours ── */
const dayStatus = ref({})

async function checkWeekStatus() {
  for (const date of weekDates.value) {
    const id = fmtId(date)
    dayStatus.value[id] = { state: 'loading' }
    const result = await admin.loadDayPlanning(date)
    dayStatus.value = {
      ...dayStatus.value,
      [id]: result.exists
        ? { state: 'exists', filledCount: result.filledCount, total: result.total, etp: result.etp }
        : { state: 'empty' }
    }
  }
}

// Chargement initial
onMounted(() => {
  if (viewMode.value === 'month') {
    loadMonthData()
  } else {
    checkWeekStatus()
    selectDay(weekDates.value[0])
  }
})

// Changement de semaine (vue semaine uniquement)
watch(weekDates, (newDates) => {
  if (viewMode.value !== 'week') return
  checkWeekStatus()
  selectDay(newDates[0])
})

// Bascule vers la vue mois ou changement de mois
watch([viewMode, monthOffset], ([mode], [prevMode]) => {
  if (mode === 'month') {
    loadMonthData()
  } else if (prevMode === 'month') {
    // Retour en vue semaine : recharge le statut de la semaine courante
    checkWeekStatus()
  }
})

/* ── Sélection d'un jour ── */
const selectedDate  = ref(null)
const dayData       = ref(null)
const loadingDay    = ref(false)
const editRessource = ref(null)
const saveSuccess   = ref(false) // affiché après chaque sauvegarde auto
const clearTarget   = ref(null)

// Shifts fixes (MACA/ALRE) du jour sélectionné, lus depuis Firestore
const dayFixed = computed(() => dayData.value?.fixed ?? {})

async function selectDay(date) {
  if (selectedDate.value && fmtId(date) === fmtId(selectedDate.value)) {
    selectedDate.value = null; dayData.value = null; return
  }
  selectedDate.value = date
  loadingDay.value   = true
  dayData.value      = await admin.loadDayPlanning(date)
  loadingDay.value   = false
}

/* ── Merge personnes + ressources ── */
const mergedRessources = computed(() => {
  if (!dayData.value || !userStore.users.length) return []

  const existing    = dayData.value.ressources || []
  const existingIds = new Set(existing.map(r => r.idPersonne))

  const activePeople = userStore.users
    .filter(p => admin.isActiveOn(p, selectedDate.value))

  const fromPersonnes = activePeople
    .filter(p => !existingIds.has(p.id || p.uid))
    .map(p => ({
      nom: p.nom, prenom: p.prenom,
      idPersonne: p.id || p.uid,
      activites: new Array(45).fill(''),
    }))

  const list = [...existing, ...fromPersonnes]

  if (sortByHoraire.value) {
    return list.sort((a, b) => {
      const diff = horaireRank(a.activites) - horaireRank(b.activites)
      if (diff !== 0) return diff
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')
    })
  }

  return list.sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
})

/* ── Couleur texte contrastée selon le fond ── */
function contrastColor(rgbaStr) {
  // Parse "rgba(r, g, b, a)"
  const m = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return 'rgba(0,0,0,0.7)'
  const [r, g, b] = [+m[1], +m[2], +m[3]].map(c => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.35 ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.9)'
}

/* ── Blocs timeline groupés ── */
function getTimelineBlocks(activites) {
  if (!Array.isArray(activites)) return []
  const blocks = []
  let i = 0
  while (i < 45) {
    const code = activites[i]
    if (!code || code === '') {
      // Gap vide : regroupe les slots consécutifs vides
      let j = i + 1
      while (j < 45 && (!activites[j] || activites[j] === '')) j++
      blocks.push({ empty: true, width: (j - i) / 45 * 100 })
      i = j
    } else {
      // Bloc d'activité : regroupe les slots consécutifs du même code
      let j = i + 1
      while (j < 45 && activites[j] === code) j++
      const mapping = ACTIVITY_MAPPING[String(code)]
      const color = mapping?.couleur || 'rgba(200,200,200,1)'
      blocks.push({
        empty: false,
        width: (j - i) / 45 * 100,
        color,
        textColor: contrastColor(color),
        label: mapping?.categorie || String(code),
      })
      i = j
    }
  }
  return blocks
}

/* ── Calcul des heures travaillées ── */
// Codes d'absence exclus du décompte
const ABSENCE_CODES = new Set(['30', '6', '8']) // CP, Indisponible, Récup
function calcHeures(activites) {
  if (!Array.isArray(activites)) return 0
  const slots = activites.filter(a => a && a !== '' && !ABSENCE_CODES.has(String(a))).length
  return slots * 0.25 // 1 slot = 15 min = 0.25h
}
function fmtHeures(h) {
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`
}

/* ── Tri par type d'horaire ── */
const sortByHoraire = ref(true)

function horaireRank(activites) {
  if (!Array.isArray(activites)) return 99
  const first = activites.find(a => a && a !== '')
  if (first === undefined) return 99
  const cat = ACTIVITY_MAPPING[String(first)]?.categorie
  return cat !== undefined ? (HORAIRE_RANK[cat] ?? 99) : 99
}

/* ── Éditeur personne/jour ── */
const otherCollabs = computed(() =>
  editRessource.value
    ? mergedRessources.value.filter(r => r.idPersonne !== editRessource.value.idPersonne)
    : []
)

function openDayEditor(r) {
  clearTarget.value = null
  editRessource.value = JSON.parse(JSON.stringify(r)) // deep copy
}

async function clearActivites(r) {
  const empty = new Array(45).fill('')
  applyActivitesToRessource(r.idPersonne, empty)
  clearTarget.value = null
  // Sauvegarde immédiate sans attendre "Enregistrer le planning"
  await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
  const filledCount = mergedRessources.value.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                    + Object.keys(dayFixed.value).length
  dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { ...dayStatus.value[fmtId(selectedDate.value)], state: 'exists', filledCount, total: mergedRessources.value.length } }
}

function applyActivitesToRessource(idPersonne, activites) {
  const idx = dayData.value.ressources.findIndex(r => r.idPersonne === idPersonne)
  if (idx >= 0) {
    // Réassignation de l'objet entier pour garantir la réactivité Vue
    dayData.value.ressources[idx] = { ...dayData.value.ressources[idx], activites }
  } else {
    const meta = mergedRessources.value.find(r => r.idPersonne === idPersonne)
    if (meta) dayData.value.ressources.push({ ...meta, activites })
  }
}

function fmtIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

/* ══════════════════════════════════════════════════════════
   VUE MOIS
   ══════════════════════════════════════════════════════════ */

// Abréviations d'activités pour les cellules de la grille mois
const CAT_SHORT = {
  'Matin':        'Mat',
  'Après-midi':   'Apm',
  'Midi':         'Mid',
  'Soir':         'Soi',
  'TLT':          'TLT',
  'BO':           'BO',
  'PiloteBO':     'Pil',
  'Pilote':       'Pil',
  'Congés payés': 'CP',
  'Indisponible': 'Ind',
  'Récupération': 'Réc',
  'Formation':    'For',
}

const DOW_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
function getDow(iso)  { return DOW_SHORT[new Date(iso + 'T12:00:00').getDay()] }
function fmtDM(iso)   { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()}/${d.getMonth()+1}` }

// Tous les jours lun–sam du mois (dimanches exclus, fériés et samedis inclus)
const monthWorkDates = computed(() => {
  const today = new Date()
  const base  = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  const y     = base.getFullYear()
  const mo    = base.getMonth()
  const dates = []
  const d     = new Date(y, mo, 1)
  while (d.getMonth() === mo) {
    if (d.getDay() !== 0) dates.push(fmtIso(d)) // tout sauf dimanche
    d.setDate(d.getDate() + 1)
  }
  return dates
})

// Sets pour le style des cellules
const monthFeries  = computed(() => {
  const set = new Set()
  for (const iso of monthWorkDates.value) {
    const d = new Date(iso + 'T12:00:00')
    if (isFerie(d)) set.add(iso)
  }
  return set
})
const monthSamedis = computed(() => {
  const set = new Set()
  for (const iso of monthWorkDates.value) {
    if (new Date(iso + 'T12:00:00').getDay() === 6) set.add(iso)
  }
  return set
})

const monthNavLabel = computed(() => {
  const today = new Date()
  const d = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
})

// Lundis du mois = séparateurs visuels de semaine
const monthWeekStarts = computed(() => {
  const set = new Set()
  if (monthWorkDates.value.length) set.add(monthWorkDates.value[0]) // 1er jour toujours
  for (const iso of monthWorkDates.value) {
    if (new Date(iso + 'T12:00:00').getDay() === 1) set.add(iso)
  }
  return set
})

// Personnes fixes (MACA/ALRE) présentes dans les données du mois (via champ `fixed`)
const fixedPersonsInMonth = computed(() => {
  const found = new Set()
  for (const dayInfo of Object.values(monthData.value)) {
    if (dayInfo.state !== 'loaded') continue
    for (const name of Object.keys(dayInfo.fixed || {})) found.add(name)
  }
  return [...found].sort()
})

// Matrice des cellules pour les personnes fixes — couleur par famille d'horaire
const fixedMonthMatrix = computed(() => {
  const m = {}
  for (const fixedName of fixedPersonsInMonth.value) {
    m[fixedName] = {}
    for (const iso of monthWorkDates.value) {
      const dayInfo = monthData.value[iso]
      if (!dayInfo || dayInfo.state === 'loading') { m[fixedName][iso] = { loading: true }; continue }
      const fam = dayInfo.fixed?.[fixedName]
      if (!fam) { m[fixedName][iso] = { empty: true }; continue }
      const style = FAM_STYLE[fam] || { bg: 'rgba(150,150,150,0.3)', color: 'var(--text)', label: fam.slice(0,3) }
      m[fixedName][iso] = { bg: style.bg, color: style.color, label: style.label.slice(0, 3) }
    }
  }
  return m
})

// ETP par jour pour la ligne récapitulative (null = pas encore importé)
const monthEtp = computed(() => {
  const out = {}
  for (const iso of monthWorkDates.value) {
    const d = monthData.value[iso]
    out[iso] = (!d || d.state !== 'loaded') ? null : (d.etp ?? null)
  }
  return out
})

// Collaborateurs actifs au moins un jour dans le mois
const monthPersons = computed(() => {
  if (!userStore.users.length || !monthWorkDates.value.length) return []
  const first = new Date(monthWorkDates.value[0] + 'T12:00:00')
  const last  = new Date(monthWorkDates.value[monthWorkDates.value.length - 1] + 'T12:00:00')
  return userStore.users
    .filter(p => admin.isActiveOn(p, first) || admin.isActiveOn(p, last))
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'))
})

const monthPersonRows = computed(() =>
  monthPersons.value.map(p => ({ person: p, fullName: `${p.nom} ${p.prenom}` }))
)

// Données chargées pour le mois : { iso → { state, ressources, filledCount, total } }
const monthData    = ref({})
const monthLoading = ref(false)

async function loadMonthData() {
  const dates = monthWorkDates.value
  if (!dates.length) return
  monthLoading.value = true
  // Pré-remplir en état "loading"
  const loading = {}
  for (const iso of dates) loading[iso] = { state: 'loading', ressources: [] }
  monthData.value = loading
  // Chargement parallèle
  const results = await Promise.all(
    dates.map(iso => {
      const [y, m, d] = iso.split('-').map(Number)
      return admin.loadDayPlanning(new Date(y, m - 1, d)).then(r => ({ iso, ...r }))
    })
  )
  const newData = {}
  for (const r of results) {
    newData[r.iso] = {
      state: 'loaded',
      ressources:  r.ressources  || [],
      filledCount: r.filledCount ?? 0,
      total:       r.total       ?? 0,
      exists:      r.exists,
      etp:   r.etp   ?? null,
      fixed: r.fixed ?? {},
      matin: r.matin ?? null,
      midi:  r.midi  ?? null,
      aprem: r.aprem ?? null,
      soir:  r.soir  ?? null,
    }
  }
  monthData.value = newData
  monthLoading.value = false
}

// Matrice calculée : { fullName → { iso → cellInfo } }
const monthMatrix = computed(() => {
  const m = {}
  for (const { fullName, person } of monthPersonRows.value) {
    m[fullName] = {}
    for (const iso of monthWorkDates.value) {
      const dayInfo = monthData.value[iso]
      if (!dayInfo || dayInfo.state === 'loading') {
        m[fullName][iso] = { loading: true }
        continue
      }
      const date = new Date(iso + 'T12:00:00')
      if (!admin.isActiveOn(person, date)) {
        m[fullName][iso] = { inactive: true }
        continue
      }
      const r = dayInfo.ressources?.find(r2 => `${r2.nom} ${r2.prenom}` === fullName)
      if (!r || !r.activites?.some(a => a && a !== '')) {
        m[fullName][iso] = { empty: true }
        continue
      }
      // Activité dominante (slot le plus fréquent)
      const counts = {}
      for (const code of r.activites) {
        if (code && code !== '') counts[code] = (counts[code] || 0) + 1
      }
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
      const mapping  = ACTIVITY_MAPPING[String(dominant)]
      const cat      = mapping?.categorie || ''
      const full     = mapping?.couleur || 'rgba(150,150,150,1)'
      const bg       = full.replace(/,\s*1\s*\)$/, ', 0.5)')   // opacité réduite pour le fond
      const label    = CAT_SHORT[cat] || cat.slice(0, 3) || '?'
      m[fullName][iso] = { bg, color: contrastColor(bg), label }
    }
  }
  return m
})


// Navigation : clic sur une cellule → passe en vue semaine sur ce jour
function getMondayOfDate(date) {
  const d   = new Date(date)
  const day = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - day + 1)
  return d
}

async function openMonthCell(fullName, iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date       = new Date(y, m - 1, d)

  // Charge les données du jour
  selectedDate.value = date
  loadingDay.value   = true
  dayData.value      = await admin.loadDayPlanning(date)
  loadingDay.value   = false

  // Trouve ou crée l'entrée pour cette personne
  const person   = monthPersons.value.find(p => `${p.nom} ${p.prenom}` === fullName)
  if (!person) return
  const existing = dayData.value?.ressources?.find(r => `${r.nom} ${r.prenom}` === fullName)
  const resource = existing ?? {
    nom: person.nom, prenom: person.prenom,
    idPersonne: person.id || person.uid,
    activites: new Array(45).fill(''),
  }

  // Ouvre la modale d'édition
  openDayEditor(resource)
}

function uidForId(idPersonne) {
  const r = mergedRessources.value.find(r => r.idPersonne === idPersonne)
  if (!r) return null
  return data.nameToUid[`${r.nom} ${r.prenom}`] || null
}


async function onDaySaved({ activites, toCollabIds, applyWholeWeek, applyCollabsWholeWeek }) {
  try {
    // 1. Applique au collab courant + collabs sélectionnés (même jour)
    applyActivitesToRessource(editRessource.value.idPersonne, activites)
    for (const id of toCollabIds) {
      applyActivitesToRessource(id, activites)
    }

    // Sauvegarde immédiate du jour courant
    await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
    const filledCount = mergedRessources.value.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                      + Object.keys(dayFixed.value).length
    dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { ...dayStatus.value[fmtId(selectedDate.value)], state: 'exists', filledCount, total: mergedRessources.value.length } }
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)

    const currentId = fmtId(selectedDate.value)
    const otherDays = weekDates.value.filter(d =>
      fmtId(d) !== currentId && d.getDay() !== 6 && !isFerie(d)
    )

    // ── Notifications ──
    const mainUid = data.nameToUid[`${editRessource.value.nom} ${editRessource.value.prenom}`]
    const notifDates = [selectedDate.value, ...(applyWholeWeek ? otherDays : [])]
    for (const date of notifDates)
      notifyPlanningChange(mainUid, fmtIso(date))

    for (const id of toCollabIds) {
      const uid = uidForId(id)
      const collabDates = [selectedDate.value, ...(applyCollabsWholeWeek ? otherDays : [])]
      for (const date of collabDates)
        notifyPlanningChange(uid, fmtIso(date))
    }

    // 2. Applique sur toute la semaine pour le collab courant
    if (applyWholeWeek) {
      const meta = { ...editRessource.value, activites }
      for (const date of otherDays) {
        const result     = await admin.loadDayPlanning(date)
        const ressources = result.ressources.filter(r => r.idPersonne !== meta.idPersonne)
        ressources.push(meta)
        await admin.saveDayPlanning(date, ressources)
        const fc = ressources.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                 + Object.keys(result.fixed || {}).length
        dayStatus.value = { ...dayStatus.value, [fmtId(date)]: { state: 'exists', filledCount: fc, total: ressources.length } }
      }
    }

    // 3. Applique sur toute la semaine pour les collabs sélectionnés
    if (applyCollabsWholeWeek && toCollabIds.length) {
      for (const date of otherDays) {
        const result     = await admin.loadDayPlanning(date)
        const ressources = [...result.ressources]
        for (const id of toCollabIds) {
          const collab = mergedRessources.value.find(r => r.idPersonne === id)
          if (!collab) continue
          const idx = ressources.findIndex(r => r.idPersonne === id)
          const entry = { nom: collab.nom, prenom: collab.prenom, idPersonne: id, activites }
          if (idx >= 0) ressources[idx] = entry
          else ressources.push(entry)
        }
        await admin.saveDayPlanning(date, ressources)
        const fc = ressources.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                 + Object.keys(result.fixed || {}).length
        dayStatus.value = { ...dayStatus.value, [fmtId(date)]: { state: 'exists', filledCount: fc, total: ressources.length } }
      }
    }
  } finally {
    editRessource.value = null
  }
}

</script>
