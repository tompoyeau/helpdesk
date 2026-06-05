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
        <button :class="['vm-btn', { 'vm-active': viewMode === 'week' }]" @click="switchToWeek">Semaine</button>
        <button :class="['vm-btn', { 'vm-active': viewMode === 'month' }]" @click="switchToMonth">
          <LayoutGrid :size="11" /> Mois
        </button>
      </div>

      <!-- Mode rapide (vue mois uniquement) -->
      <button
        v-if="viewMode === 'month'"
        class="btn-quick-mode"
        :class="{ 'btn-quick-active': quickMode.active }"
        @click="toggleQuickMode"
      >
        <Zap :size="12" />
        {{ quickMode.active ? 'Quitter mode rapide' : 'Mode rapide' }}
      </button>

      <!-- Nettoyer le mois (mode test uniquement) -->
      <button
        v-if="viewMode === 'month' && admin.collectionName !== 'plannings'"
        class="btn-clear-month"
        :disabled="clearingMonth"
        @click="confirmClearMonth = true"
      >
        <div v-if="clearingMonth" class="btn-spinner-sm"></div>
        <Trash2 v-else :size="12" />
        {{ clearingMonth ? 'Suppression…' : 'Nettoyer le mois' }}
      </button>

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
        </div>
      </div>

      <div v-if="loadingDay" style="padding:24px;text-align:center;color:var(--text-muted)">
        Chargement du planning…
      </div>

      <template v-else>

        <!-- ── Palette de peinture ── -->
        <div class="painter-palette">
          <!-- Indicateur de sélection -->
          <div v-if="weekSelectedPersons.size > 0" class="palette-select-hint">
            <Check :size="11" />
            {{ weekSelectedPersons.size }} sélectionné{{ weekSelectedPersons.size > 1 ? 's' : '' }} — cliquer un horaire pour l'appliquer
            <button class="palette-deselect" @click="weekSelectedPersons = new Set()">✕</button>
          </div>

          <div v-for="group in PAINT_GROUPS" :key="group.label" class="paint-group">
            <span class="paint-group-label">{{ group.label }}</span>
            <button
              v-for="code in group.codes"
              :key="code"
              class="paint-chip"
              :class="{ 'paint-chip-active': paintCode === code }"
              :style="paintCode === code
                ? { borderColor: ACTIVITY_MAPPING[code].couleur, background: ACTIVITY_MAPPING[code].couleur.replace(/,\s*1\s*\)/, ', 0.15)'), color: ACTIVITY_MAPPING[code].couleur }
                : {}"
              @click="onPaintChipClick(code)"
            >
              <span class="paint-dot" :style="{ background: ACTIVITY_MAPPING[code].couleur }"></span>
              {{ ACTIVITY_MAPPING[code].categorie }}
            </button>
          </div>
          <!-- Outil effaceur -->
          <button
            class="paint-chip paint-chip-erase"
            :class="{ 'paint-chip-active': paintCode === 'erase' }"
            @click="onPaintChipClick('erase')"
          >
            <Eraser :size="11" />
            Effacer
          </button>
          <span v-if="weekSelectedPersons.size === 0 && paintCode" class="paint-hint">
            {{ paintCode === 'erase' ? 'Glissez pour effacer' : 'Glissez pour peindre' }}
          </span>
          <span v-else-if="weekSelectedPersons.size === 0" class="paint-hint" style="opacity:0.5">Sélectionnez un outil</span>
        </div>

        <!-- ── Barre d'info live (apparaît pendant le drag) ── -->
        <Transition name="paint-info">
          <div v-if="isPainting && paintInfo" class="paint-info-bar">
            <span class="paint-info-name">{{ paintInfo.name }}</span>
            <span class="paint-info-sep">·</span>
            <span class="paint-info-range">{{ paintInfo.startTime }} → {{ paintInfo.endTime }}</span>
            <span class="paint-info-dur">{{ paintInfo.durStr }}</span>
            <span
              class="paint-info-act"
              :style="paintCode !== 'erase' && ACTIVITY_MAPPING[paintCode]
                ? { color: ACTIVITY_MAPPING[paintCode].couleur }
                : { color: '#ef4444' }"
            >{{ paintInfo.actLabel }}</span>
          </div>
        </Transition>

        <!-- ── Grille de créneaux ── -->
        <div class="table-scroll-wrap" :class="{ 'painter-active': !!paintCode }">
          <table class="slot-painter-table">
            <thead>
              <tr class="slot-time-row">
                <th class="slot-name-col">
                  <!-- Select-all -->
                  <input
                    type="checkbox"
                    class="slot-checkbox slot-checkbox-all"
                    :checked="weekSelectedPersons.size === mergedRessources.length && mergedRessources.length > 0"
                    :indeterminate="weekSelectedPersons.size > 0 && weekSelectedPersons.size < mergedRessources.length"
                    title="Tout sélectionner / désélectionner"
                    @change="toggleSelectAll"
                  />
                </th>
                <th
                  v-for="s in 45"
                  :key="s - 1"
                  class="slot-th"
                  :class="{
                    'slot-h-sep':  (s - 1) % 4 === 0,
                    'slot-h2-sep': (s - 1) % 2 === 0 && (s - 1) % 4 !== 0,
                  }"
                >
                  <!-- Heure pile (toutes les heures) -->
                  <span v-if="(s - 1) % 4 === 0" class="slot-h-label">
                    {{ TIME_SLOTS[s - 1]?.replace(':', 'h') }}
                  </span>
                  <!-- Demi-heure (toutes les 30 min) -->
                  <span v-else-if="(s - 1) % 2 === 0" class="slot-h2-label">
                    :30
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in mergedRessources"
                :key="r.idPersonne"
                class="slot-row"
              >
                <!-- Colonne nom + heures + effacer -->
                <td class="slot-name-col" :class="{ 'slot-row-selected': weekSelectedPersons.has(r.idPersonne) }">
                  <div class="slot-name-inner">
                    <!-- Checkbox de sélection -->
                    <input
                      type="checkbox"
                      class="slot-checkbox"
                      :checked="weekSelectedPersons.has(r.idPersonne)"
                      @change="togglePersonSelect(r.idPersonne)"
                    />
                    <div class="person-avatar" style="width:22px;height:22px;font-size:0.5rem;flex-shrink:0">
                      {{ `${r.nom?.[0]??''}${r.prenom?.[0]??''}`.toUpperCase() }}
                    </div>
                    <span class="slot-name-text">{{ r.nom }} {{ r.prenom }}</span>
                    <span v-if="slotHours(r) > 0" class="slot-hours-badge">{{ fmtHeures(slotHours(r)) }}</span>
                    <div v-if="paintSaving.has(r.idPersonne)" class="btn-spinner-sm" style="margin-left:auto;flex-shrink:0"></div>
                    <template v-else-if="clearTarget === r.idPersonne">
                      <button class="btn-action btn-action-confirm" style="width:20px;height:20px;margin-left:auto" @click.stop="clearActivites(r)"><Check :size="11" /></button>
                      <button class="btn-action" style="width:20px;height:20px" @click.stop="clearTarget = null"><X :size="11" /></button>
                    </template>
                    <button
                      v-else-if="(r.activites||[]).some(a => a)"
                      class="slot-clear-btn"
                      title="Effacer"
                      @click.stop="clearTarget = r.idPersonne"
                    >
                      <Eraser :size="10" />
                    </button>
                  </div>
                </td>
                <!-- 45 slots cliquables/peinturables -->
                <td
                  v-for="s in 45"
                  :key="s - 1"
                  class="slot-cell"
                  :class="{
                    'slot-h-sep':     (s - 1) % 4 === 0,
                    'slot-h2-sep':    (s - 1) % 2 === 0 && (s - 1) % 4 !== 0,
                    'slot-paintable': !!paintCode,
                    'slot-dragging':  paintPersonId === r.idPersonne && isPainting
                                        && (s - 1) >= Math.min(paintSlotStart, paintSlotEnd)
                                        && (s - 1) <= Math.max(paintSlotStart, paintSlotEnd),
                  }"
                  :style="slotCellStyle(r, s - 1)"
                  :title="`${TIME_SLOTS[s-1]} — ${getSlotCode(r, s-1) ? ACTIVITY_MAPPING[getSlotCode(r, s-1)]?.categorie || '' : 'vide'}`"
                  @mousedown.prevent="onSlotMouseDown($event, r, s - 1)"
                  @mouseenter="onSlotMouseEnter(r, s - 1)"
                ></td>
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

      <!-- Barre mode rapide -->
      <Transition name="quick-bar">
        <div v-if="quickMode.active" class="quick-bar">
          <span class="quick-bar-hint">
            <Zap :size="11" v-if="quickMode.code !== 'erase'" />
            <Eraser :size="11" v-else />
            {{ quickMode.code === 'erase' ? 'Cliquez pour effacer' : quickMode.code ? 'Cliquez une cellule pour assigner' : 'Choisissez un horaire' }}
          </span>
          <div class="quick-bar-groups">
            <div v-for="group in QUICK_CHIP_GROUPS" :key="group.label" class="quick-group">
              <span class="quick-group-label">{{ group.label }}</span>
              <button
                v-for="code in group.codes"
                :key="code"
                class="quick-chip"
                :class="{ 'quick-chip-selected': quickMode.code === code }"
                :style="quickMode.code === code
                  ? { borderColor: ACTIVITY_MAPPING[code].couleur, background: ACTIVITY_MAPPING[code].couleur.replace(/,\s*[\d.]+\s*\)/, ', 0.18)') }
                  : {}"
                @click="selectQuickChip(code)"
              >
                <span class="quick-chip-dot" :style="{ background: ACTIVITY_MAPPING[code].couleur }"></span>
                {{ ACTIVITY_MAPPING[code].categorie }}
              </button>
            </div>
            <!-- Gomme -->
            <button
              class="quick-chip quick-chip-erase"
              :class="{ 'quick-chip-selected': quickMode.code === 'erase' }"
              @click="selectQuickChip('erase')"
            >
              <Eraser :size="11" />
              Effacer
            </button>
          </div>
          <kbd class="quick-bar-esc" @click="toggleQuickMode">Esc</kbd>
        </div>
      </Transition>

      <div class="month-matrix-outer" :class="{ 'quick-mode-active': quickMode.active && quickMode.code }">


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
                    'mm-week-sep':   monthWeekStarts.has(iso),
                    'mm-th-sam':     monthSamedis.has(iso),
                    'mm-th-ferie':   monthFeries.has(iso),
                    'mm-th-sorted':  monthSortDay === iso,
                  }"
                  :title="monthSortDay === iso ? 'Cliquer pour annuler le tri' : 'Trier par cet horaire'"
                  @click="toggleDaySort(iso)"
                >
                  <div class="mm-dow" :class="`mm-dow-${getDow(iso).toLowerCase()}`">{{ getDow(iso) }}</div>
                  <div class="mm-dm">{{ fmtDM(iso) }}</div>
                  <ArrowUpDown v-if="monthSortDay === iso" :size="8" class="mm-sort-icon" />
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
                <td class="mm-td-name mm-td-name-clearable">
                  <!-- Confirmation suppression -->
                  <div v-if="clearPersonTarget === fullName" class="mm-clear-confirm">
                    <span class="mm-clear-confirm-label">Tout effacer ?</span>
                    <button class="mm-confirm-btn mm-confirm-yes" :disabled="clearingPerson" @click.stop="clearPersonMonth(fullName)">
                      <Check :size="11" />
                    </button>
                    <button class="mm-confirm-btn mm-confirm-no" @click.stop="clearPersonTarget = null">
                      <X :size="11" />
                    </button>
                  </div>
                  <!-- Affichage normal -->
                  <div v-else class="mm-name-row">
                    <div class="person-avatar" style="width:22px;height:22px;font-size:0.5rem;flex-shrink:0">
                      {{ `${person.nom?.[0]??''}${person.prenom?.[0]??''}`.toUpperCase() }}
                    </div>
                    <span class="mm-person-name">{{ person.nom }} {{ person.prenom }}</span>
                    <button class="mm-clear-btn" title="Effacer tous les horaires du mois" @click.stop="clearPersonTarget = fullName">
                      <Trash2 :size="11" />
                    </button>
                  </div>
                </td>
                <td
                  v-for="iso in monthWorkDates"
                  :key="iso"
                  class="mm-cell"
                  :class="{
                    'mm-week-sep':    monthWeekStarts.has(iso),
                    'mm-cell-sam':    monthSamedis.has(iso),
                    'mm-cell-ferie':  monthFeries.has(iso),
                    'mm-inactive':    monthMatrix[fullName]?.[iso]?.inactive,
                    'mm-cell-load':   monthMatrix[fullName]?.[iso]?.loading || quickSavingCells.has(`${fullName}|${iso}`),
                    'mm-cell-quick':  quickMode.active && quickMode.code && !monthMatrix[fullName]?.[iso]?.inactive && !monthSamedis.has(iso),
                    'mm-cell-dragging': isDragging && dragFullName === fullName && dragIsos.has(iso),
                  }"
                  :style="monthMatrix[fullName]?.[iso]?.bg
                    ? { background: monthMatrix[fullName][iso].bg, cursor: 'pointer' }
                    : undefined"
                  :title="`${fullName} · ${iso}`"
                  @mousedown="onCellMouseDown($event, fullName, iso)"
                  @mouseenter="onCellMouseEnter(fullName, iso)"
                  @click="onCellClick(fullName, iso)"
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

    <!-- Confirmation nettoyage du mois -->
    <Teleport to="body">
      <div v-if="confirmClearMonth" class="modal-backdrop" @click.self="confirmClearMonth = false">
        <div class="modal-confirm-box">
          <div class="modal-confirm-icon"><Trash2 :size="22" /></div>
          <h3 class="modal-confirm-title">Nettoyer le mois ?</h3>
          <p class="modal-confirm-body">
            Tous les plannings de <strong>{{ monthNavLabel }}</strong> seront supprimés
            de la base <strong>test</strong>. Cette action est irréversible.
          </p>
          <div class="modal-confirm-actions">
            <button class="btn-confirm-cancel" @click="confirmClearMonth = false">Annuler</button>
            <button class="btn-confirm-delete" @click="doClearMonth">
              <Trash2 :size="13" /> Supprimer
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirmation écrasement semaine -->
    <Teleport to="body">
      <div v-if="weekOverwriteModal.show" class="modal-backdrop" @click.self="resolveOverwrite('cancel')">
        <div class="modal-confirm-box" style="max-width:460px">
          <div class="modal-confirm-icon" style="color:#F59E0B;background:rgba(245,158,11,0.1)">
            <CalendarCheck :size="22" />
          </div>
          <h3 class="modal-confirm-title">Horaires existants détectés</h3>
          <p class="modal-confirm-body" style="margin-bottom:12px">
            {{ weekOverwriteModal.subtitle || 'Les collaborateurs suivants ont déjà des horaires sur cette semaine :' }}
          </p>

          <!-- Liste des conflits -->
          <div class="overwrite-conflict-list">
            <div
              v-for="c in weekOverwriteModal.conflicts"
              :key="c.name"
              class="overwrite-conflict-person"
            >
              <div class="overwrite-conflict-name">{{ c.name }}</div>
              <div
                v-for="d in c.days"
                :key="d.dateLbl"
                class="overwrite-conflict-day"
              >
                <span class="overwrite-day-lbl">{{ d.dateLbl }}</span>
                <span class="overwrite-day-type">{{ d.types }}</span>
              </div>
            </div>
          </div>

          <p class="modal-confirm-body" style="margin-top:12px">Que souhaitez-vous faire ?</p>
          <div class="modal-confirm-actions" style="flex-direction:column;gap:8px">
            <button class="btn-save" style="width:100%;justify-content:center" @click="resolveOverwrite('overwrite')">
              {{ weekOverwriteModal.labelOverwrite || 'Tout écraser' }}
            </button>
            <button v-if="!weekOverwriteModal.noEmptyOnly" class="btn-confirm-cancel" style="width:100%;justify-content:center" @click="resolveOverwrite('empty_only')">
              Remplir les jours vides uniquement
            </button>
            <button class="btn-confirm-cancel" style="width:100%;justify-content:center;color:var(--text-muted)" @click="resolveOverwrite('cancel')">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </Teleport>

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
  border-left: 1px solid var(--border);
  cursor: pointer; user-select: none;
  transition: background 0.12s;
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
.mm-week-sep { border-left: 2px solid var(--text-muted) !important; }

.mm-cell {
  height: 28px; width: 40px; padding: 0;
  text-align: center; vertical-align: middle;
  border-bottom: 1px solid var(--border);
  border-left: 1px solid var(--border);
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

/* ── Colonne triée ── */
.mm-th-day:hover { background: var(--bg-hover); }
.mm-th-sorted {
  background: var(--accent-light) !important;
  border-bottom-color: var(--accent) !important;
  color: var(--accent);
}
.mm-sort-icon {
  display: block; margin: 1px auto 0;
  color: var(--accent); opacity: 0.8;
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


/* ── Suppression personne vue mois ── */
.mm-td-name-clearable { overflow: visible !important; }

.mm-name-row {
  display: flex; align-items: center; gap: 6px; overflow: hidden;
}
.mm-clear-btn {
  display: none;
  align-items: center; justify-content: center;
  margin-left: auto; flex-shrink: 0;
  width: 20px; height: 20px;
  background: none; border: none; border-radius: 4px;
  color: var(--text-muted); cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.mm-clear-btn:hover { background: color-mix(in srgb, #ef4444 12%, var(--bg-surface)); color: #ef4444; }
.mm-td-name-clearable:hover .mm-clear-btn { display: flex; }

.mm-clear-confirm {
  display: flex; align-items: center; gap: 5px;
  padding: 0 2px;
}
.mm-clear-confirm-label {
  font-size: 0.6rem; font-weight: 600; color: #ef4444; white-space: nowrap; flex: 1;
}
.mm-confirm-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px;
  border: none; cursor: pointer; flex-shrink: 0;
  transition: background 0.12s;
}
.mm-confirm-yes { background: #ef444422; color: #ef4444; }
.mm-confirm-yes:hover { background: #ef4444; color: #fff; }
.mm-confirm-no  { background: var(--bg-hover); color: var(--text-muted); }
.mm-confirm-no:hover  { background: var(--border); }

/* ── Mode rapide ── */
.btn-quick-mode {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; font-size: 0.75rem; font-weight: 600;
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-quick-mode:hover { background: var(--bg-hover); color: var(--text); }
.btn-quick-active {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-surface)) !important;
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

.quick-bar {
  display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap;
  padding: 10px 14px; margin-bottom: 6px;
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-card));
  border: 1.5px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: var(--radius-md);
}
.quick-bar-hint {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.75rem; font-weight: 600; color: var(--accent);
  white-space: nowrap; padding-top: 2px; flex-shrink: 0;
}
.quick-bar-groups {
  display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; flex: 1;
}
.quick-group {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
}
.quick-group-label {
  font-size: 0.5625rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
  padding-right: 2px; white-space: nowrap;
}
.quick-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; font-size: 0.75rem; font-weight: 500;
  border: 1.5px solid var(--border); border-radius: 999px;
  background: var(--bg-surface); color: var(--text);
  cursor: pointer; transition: all 0.12s; white-space: nowrap;
}
.quick-chip:hover { background: var(--bg-hover); }
.quick-chip-selected { font-weight: 700; }
.quick-chip-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.quick-chip-erase { color: var(--text-muted); }
.quick-chip-erase:hover { background: rgba(239,68,68,0.08); color: #ef4444; border-color: rgba(239,68,68,0.3); }
.quick-chip-erase.quick-chip-selected { border-color: #ef4444; background: rgba(239,68,68,0.12); color: #ef4444; }
.quick-bar-esc {
  display: inline-flex; align-items: center;
  padding: 2px 7px; font-size: 0.6875rem; font-family: var(--font-mono);
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: 5px; color: var(--text-muted); cursor: pointer;
  transition: background 0.12s; white-space: nowrap; flex-shrink: 0;
}
.quick-bar-esc:hover { background: var(--bg-hover); color: var(--text); }

/* Cellule ciblable en mode rapide */
.mm-cell-quick { cursor: crosshair !important; }
.quick-mode-active .mm-cell-quick:hover {
  filter: brightness(1.12) saturate(1.1);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
/* Cellule sélectionnée par le drag */
.mm-cell-dragging {
  outline: 2px solid var(--accent) !important;
  outline-offset: -2px;
  background: color-mix(in srgb, var(--accent) 22%, var(--bg-card)) !important;
  cursor: crosshair !important;
}
/* Désactive la sélection de texte pendant le drag */
.quick-mode-active { user-select: none; }

/* Transition barre mode rapide */
.quick-bar-enter-active, .quick-bar-leave-active { transition: all 0.2s ease; }
.quick-bar-enter-from, .quick-bar-leave-to { opacity: 0; transform: translateY(-6px); }

.btn-clear-month {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; font-size: 0.75rem; font-weight: 600;
  background: color-mix(in srgb, #ef4444 12%, var(--bg-surface));
  border: 1px solid color-mix(in srgb, #ef4444 35%, var(--border));
  border-radius: var(--radius-sm); color: #ef4444;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.btn-clear-month:hover:not(:disabled) { background: color-mix(in srgb, #ef4444 20%, var(--bg-surface)); }
.btn-clear-month:disabled { opacity: 0.6; cursor: default; }

/* Modale confirmation */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15,17,40,0.5);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
}
.modal-confirm-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px 28px 22px;
  width: 340px; max-width: calc(100vw - 32px);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}
.modal-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%;
  background: color-mix(in srgb, #ef4444 14%, var(--bg-surface));
  color: #ef4444;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 2px;
}
.modal-confirm-title { font-size: 1rem; font-weight: 700; color: var(--text); margin: 0; }
.modal-confirm-body {
  font-size: 0.8125rem; color: var(--text-muted); text-align: center;
  line-height: 1.5; margin: 0;
}
.modal-confirm-actions { display: flex; gap: 10px; margin-top: 8px; }

/* Liste des conflits d'écrasement */
.overwrite-conflict-list {
  width: 100%;
  max-height: 200px; overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: 0.8125rem;
}
.overwrite-conflict-person {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.overwrite-conflict-person:last-child { border-bottom: none; }
.overwrite-conflict-name {
  font-weight: 700; color: var(--text);
  margin-bottom: 4px;
}
.overwrite-conflict-day {
  display: flex; align-items: center; gap: 10px;
  padding: 2px 0;
}
.overwrite-day-lbl {
  font-family: var(--font-mono); font-size: 0.75rem;
  color: var(--text-muted); min-width: 72px; flex-shrink: 0;
}
.overwrite-day-type {
  color: var(--text); font-size: 0.75rem;
  background: var(--accent-light); color: var(--accent);
  padding: 1px 8px; border-radius: 999px; font-weight: 600;
}
.btn-confirm-cancel {
  padding: 8px 18px; font-size: 0.8125rem; font-weight: 600;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text); cursor: pointer;
  transition: background 0.15s;
}
.btn-confirm-cancel:hover { background: var(--bg-hover); }
.btn-confirm-delete {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; font-size: 0.8125rem; font-weight: 600;
  background: #ef4444; border: none;
  border-radius: var(--radius-sm); color: #fff; cursor: pointer;
  transition: background 0.15s;
}
.btn-confirm-delete:hover { background: #dc2626; }

/* ══ Palette de peinture ══ */
.painter-palette {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}
.paint-group {
  display: flex; align-items: center; gap: 3px;
}
.paint-group-label {
  font-size: 0.5625rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-muted);
  padding-right: 3px; white-space: nowrap;
  border-right: 1px solid var(--border); margin-right: 3px;
}
.paint-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 11px; font-size: 0.75rem; font-weight: 500;
  border: 1.5px solid var(--border); border-radius: 999px;
  background: var(--bg-surface); color: var(--text);
  cursor: pointer; transition: all 0.12s; white-space: nowrap;
}
.paint-chip:hover { background: var(--bg-hover); }
.paint-chip-active { font-weight: 700; }
.paint-chip-erase {
  color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;
}
.paint-chip-erase.paint-chip-active {
  border-color: #ef4444; background: rgba(239,68,68,0.1); color: #ef4444;
}
.paint-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.paint-hint {
  font-size: 0.6875rem; color: var(--accent); font-style: italic;
  margin-left: 4px; white-space: nowrap;
}

/* ══ Grille de slots ══ */
.slot-painter-table {
  border-collapse: collapse;
  font-size: 0.75rem;
  user-select: none;
}
.slot-time-row th { padding: 0; border: none; background: var(--bg-surface); }
.slot-name-col {
  position: sticky; left: 0; z-index: 2;
  background: var(--bg-card);
  border-right: 2px solid var(--border);
  width: 190px; min-width: 190px; max-width: 190px;
  padding: 0;
}
.slot-th {
  width: 20px; min-width: 20px; max-width: 20px;
  text-align: left; vertical-align: bottom;
  padding: 0;
  border-left: 1px solid transparent;
}
/* Heure pile : trait épais bien visible */
.slot-th.slot-h-sep  { border-left: 2px solid var(--text-muted) !important; }
/* Demi-heure : trait intermédiaire */
.slot-th.slot-h2-sep { border-left: 1px solid var(--border) !important; }
.slot-h-label {
  display: block;
  font-size: 0.5rem; font-weight: 700; color: var(--text);
  padding: 2px 0 1px 2px;
  white-space: nowrap;
}
.slot-h2-label {
  display: block;
  font-size: 0.45rem; color: var(--text-muted); opacity: 0.55;
  padding: 2px 0 1px 2px;
  white-space: nowrap;
}
.slot-row { border-bottom: 1px solid var(--border); }
.slot-name-inner {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 8px; overflow: hidden;
}
.slot-name-text {
  font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; flex: 1; min-width: 0;
}
.slot-hours-badge {
  font-size: 0.625rem; font-weight: 700; font-family: var(--font-mono);
  color: var(--accent); white-space: nowrap; flex-shrink: 0;
}
.slot-clear-btn {
  display: none;
  align-items: center; justify-content: center;
  width: 18px; height: 18px; flex-shrink: 0;
  background: none; border: none; border-radius: 4px;
  color: var(--text-muted); cursor: pointer; transition: all 0.12s;
}
.slot-clear-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
.slot-name-inner:hover .slot-clear-btn { display: flex; }

/* ── Checkboxes sélection multiple ── */
.slot-checkbox {
  width: 14px; height: 14px; flex-shrink: 0; cursor: pointer;
  accent-color: var(--accent);
}
.slot-checkbox-all { margin: 0 auto; display: block; }
.slot-row-selected { background: var(--accent-light) !important; }

/* ── Indicateur de sélection dans la palette ── */
.palette-select-hint {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 6px;
  background: var(--accent-light); color: var(--accent);
  font-size: 0.6875rem; font-weight: 600;
  border: 1px solid var(--accent); white-space: nowrap;
}
.palette-deselect {
  margin-left: auto; background: none; border: none;
  cursor: pointer; color: var(--accent); font-size: 0.75rem;
  line-height: 1; padding: 0 2px; opacity: 0.7;
}
.palette-deselect:hover { opacity: 1; }

.slot-cell {
  width: 20px; min-width: 20px; max-width: 20px;
  height: 32px;
  /* Séparateur 15 min visible dans les deux modes */
  border-left: 1px solid var(--border);
  border-bottom: none;
  transition: filter 0.05s;
  padding: 0;
}
/* Heure pile : trait épais bien visible + fond de colonne */
.slot-cell.slot-h-sep  {
  border-left: 2px solid var(--text-muted);
  background-color: rgba(128,128,128,0.06);
}
/* Demi-heure : trait un peu plus soutenu que les 15 min */
.slot-cell.slot-h2-sep { border-left: 1px solid var(--text-muted); }
.slot-cell:not([style]) { background: var(--bg-surface); }
.slot-cell.slot-paintable { cursor: crosshair; }
.slot-cell.slot-paintable:hover { filter: brightness(1.15); outline: 1px solid rgba(99,102,241,0.5); outline-offset: -1px; }
.slot-cell.slot-dragging {
  outline: 1.5px solid var(--accent) !important;
  outline-offset: -1px;
  filter: brightness(1.1) saturate(1.2);
}
/* Désactive sélection texte pendant le drag */
.painter-active { user-select: none; }

/* ── Barre d'info live (drag peinture) ── */
.paint-info-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  font-size: 0.75rem;
  overflow: hidden;
}
.paint-info-name {
  font-weight: 600; color: var(--text); white-space: nowrap;
}
.paint-info-sep { color: var(--text-muted); }
.paint-info-range {
  font-family: var(--font-mono); font-size: 0.6875rem;
  color: var(--text); white-space: nowrap;
}
.paint-info-dur {
  font-family: var(--font-mono); font-size: 0.6875rem; font-weight: 700;
  color: var(--accent); white-space: nowrap;
}
.paint-info-act {
  font-weight: 600; white-space: nowrap; margin-left: auto;
}
/* Transition glisse depuis le haut */
.paint-info-enter-active,
.paint-info-leave-active { transition: opacity 0.15s, transform 0.15s; }
.paint-info-enter-from,
.paint-info-leave-to     { opacity: 0; transform: translateY(-4px); }
</style>

<script>
import { ref } from 'vue'
// Variables de module : persistent entre les changements d'onglets, réinitialisées au refresh
const weekOffset  = ref(0)
const viewMode    = ref('week')   // 'week' | 'month'
const monthOffset = ref(0)        // mois relatif au mois courant
</script>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  ChevronLeft, ChevronRight, CalendarCheck,
  Check, Plus, Users, Eraser, X, ArrowUpDown, FlaskConical, LayoutGrid, Zap, FileUp, Trash2,
} from 'lucide-vue-next'
import { useAdminStore, ETP_CODES, QUICK_PRESETS, TIME_SLOTS } from '@/stores/adminStore'
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
const etpFileInput     = ref(null)
const etpImporting     = ref(false)
const etpImportMsg     = ref('')   // feedback message
const confirmClearMonth  = ref(false)
const clearingMonth      = ref(false)
const clearPersonTarget  = ref(null)   // fullName en attente de confirmation
const weekOverwriteModal = ref({ show: false, resolve: null, conflicts: [], subtitle: '', labelOverwrite: '', noEmptyOnly: false })

/* ══ Mode rapide ══ */
const quickMode        = ref({ active: false, code: null })
const quickSavingCells = ref(new Set())

/* ── Drag (cliquer-glisser sur une ligne) ── */
const isDragging   = ref(false)
const dragFullName = ref(null)
const dragIsos     = ref(new Set())

const QUICK_CHIP_GROUPS = [
  { label: 'Matin',   codes: ['0', '9', '12', '20', '28'] },
  { label: 'Midi',    codes: ['1', '10', '13', '21'] },
  { label: 'Aprem',   codes: ['15', '16', '17', '22', '27'] },
  { label: 'Soir',    codes: ['2', '11', '14', '23', '29'] },
  { label: 'Pilote',  codes: ['26'] },
  { label: 'Absence', codes: ['30', '6', '8'] },
]

function toggleQuickMode() {
  quickMode.value.active = !quickMode.value.active
  if (!quickMode.value.active) quickMode.value.code = null
}

function selectQuickChip(code) {
  quickMode.value.code = quickMode.value.code === code ? null : code
}

/* ── Gestion clic / drag cellule (vue mois) ── */
function onCellMouseDown(event, fullName, iso) {
  if (!quickMode.value.active || !quickMode.value.code) return
  if (monthMatrix.value[fullName]?.[iso]?.inactive) return
  if (monthSamedis.value.has(iso) || monthFeries.value.has(iso)) return
  event.preventDefault()
  isDragging.value  = true
  dragFullName.value = fullName
  dragIsos.value    = new Set([iso])
}

function onCellMouseEnter(fullName, iso) {
  if (!isDragging.value || fullName !== dragFullName.value) return
  if (monthMatrix.value[fullName]?.[iso]?.inactive) return
  if (monthSamedis.value.has(iso) || monthFeries.value.has(iso)) return
  dragIsos.value = new Set([...dragIsos.value, iso])
}

function onCellClick(fullName, iso) {
  if (monthMatrix.value[fullName]?.[iso]?.inactive) return
  if (quickMode.value.active && quickMode.value.code) {
    quickAssignCell(fullName, iso)
  } else if (!quickMode.value.active) {
    openMonthCell(fullName, iso)
  }
}

async function endDrag() {
  if (!isDragging.value) return
  const code     = quickMode.value.code
  const isos     = [...dragIsos.value]
  const fullName = dragFullName.value
  isDragging.value  = false
  dragFullName.value = null
  dragIsos.value    = new Set()
  // Un seul cell → le click event s'en charge
  if (!code || !fullName || isos.length <= 1) return
  for (const iso of isos) await quickAssignCell(fullName, iso)
}

async function quickAssignCell(fullName, iso) {
  const code = quickMode.value.code
  if (!code) return
  const cellKey = `${fullName}|${iso}`
  if (quickSavingCells.value.has(cellKey)) return

  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)

  quickSavingCells.value = new Set([...quickSavingCells.value, cellKey])
  try {
    const dayResult = await admin.loadDayPlanning(date)
    const person    = monthPersons.value.find(p => `${p.nom} ${p.prenom}` === fullName)
    if (!person) return

    let newActivites
    if (code === 'erase') {
      newActivites = new Array(45).fill('')
    } else {
      const preset = QUICK_PRESETS[code]
      if (!preset) return

      const existing     = dayResult.ressources?.find(r => `${r.nom} ${r.prenom}` === fullName)
      const curActivites = existing?.activites || new Array(45).fill('')

      // Applique le preset (remplace les blocs qui chevauchent, garde les autres)
      const curBlocks = admin.parseBlocks(curActivites)
      const kept      = curBlocks.filter(b => !preset.some(p => p.startSlot < b.endSlot && p.endSlot > b.startSlot))
      const newBlocks = [...kept, ...preset.map(p => ({ code, ...p }))].sort((a, b) => a.startSlot - b.startSlot)
      newActivites    = admin.buildActivites(newBlocks)
    }

    const resource   = { nom: person.nom, prenom: person.prenom, idPersonne: person.id || person.uid, activites: newActivites }
    const ressources = [...(dayResult.ressources || []).filter(r => `${r.nom} ${r.prenom}` !== fullName), resource]

    await admin.saveDayPlanning(date, ressources)

    const fc = ressources.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
             + Object.keys(dayResult.fixed || {}).length
    dayStatus.value = { ...dayStatus.value, [fmtId(date)]: { state: 'exists', filledCount: fc, total: ressources.length } }

    updateMonthDay(iso, ressources, fc)
  } finally {
    const next = new Set(quickSavingCells.value)
    next.delete(cellKey)
    quickSavingCells.value = next
  }
}

function askOverwriteMode(conflicts = [], { subtitle = '', labelOverwrite = '', noEmptyOnly = false } = {}) {
  return new Promise(resolve => {
    weekOverwriteModal.value = { show: true, resolve, conflicts, subtitle, labelOverwrite, noEmptyOnly }
  })
}
function resolveOverwrite(mode) {
  const { resolve } = weekOverwriteModal.value
  weekOverwriteModal.value = { show: false, resolve: null }
  resolve(mode)
}
const clearingPerson    = ref(false)

/* ══ Sélection multiple vue semaine ══ */
let weekSelectedPersons = ref(new Set())

function togglePersonSelect(idPersonne) {
  const s = new Set(weekSelectedPersons.value)
  s.has(idPersonne) ? s.delete(idPersonne) : s.add(idPersonne)
  weekSelectedPersons.value = s
}

function toggleSelectAll() {
  if (weekSelectedPersons.value.size === mergedRessources.value.length) {
    weekSelectedPersons.value = new Set()
  } else {
    weekSelectedPersons.value = new Set(mergedRessources.value.map(r => r.idPersonne))
  }
}

/* Chip de palette : applique aux sélectionnés OU sélectionne l'outil de peinture */
async function onPaintChipClick(code) {
  if (weekSelectedPersons.value.size > 0) {
    await applyPresetToSelected(code)
  } else {
    // Comportement habituel : sélectionner/désélectionner l'outil de peinture
    paintCode.value = paintCode.value === code ? null : code
  }
}

async function applyPresetToSelected(code) {
  const ids       = [...weekSelectedPersons.value]
  const resources = mergedRessources.value.filter(r => ids.includes(r.idPersonne))

  // Conflits : personnes ayant déjà un horaire
  const conflicts = code === 'erase'
    ? []
    : resources.filter(r => (r.activites || []).some(a => a && a !== '')).map(r => `${r.nom} ${r.prenom}`)

  let mode = 'overwrite'
  if (conflicts.length > 0) {
    mode = await askOverwriteMode(conflicts, {
      subtitle:      `${conflicts.length} collaborateur(s) ont déjà un horaire`,
      labelOverwrite: 'Écraser les horaires existants',
    })
    if (mode === 'cancel') return
  }

  for (const r of resources) {
    const hasExisting = (r.activites || []).some(a => a && a !== '')
    if (mode === 'empty_only' && hasExisting) continue

    let newActivites
    if (code === 'erase') {
      newActivites = new Array(45).fill('')
    } else {
      const preset = QUICK_PRESETS[code]
      if (!preset) continue
      const curActivites = r.activites || new Array(45).fill('')
      const curBlocks    = admin.parseBlocks(curActivites)
      const kept         = curBlocks.filter(b => !preset.some(p => p.startSlot < b.endSlot && p.endSlot > b.startSlot))
      const newBlocks    = [...kept, ...preset.map(p => ({ code, ...p }))].sort((a, b) => a.startSlot - b.startSlot)
      newActivites       = admin.buildActivites(newBlocks)
    }
    paintSaving.value.add(r.idPersonne)
    applyActivitesToRessource(r.idPersonne, newActivites)
  }

  await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)

  const filledCount = mergedRessources.value.filter(r =>
    (r.activites || []).some(a => a && ETP_CODES.has(String(a)))
  ).length + Object.keys(dayFixed.value).length
  const iso = fmtIso(selectedDate.value)
  dayStatus.value = { ...dayStatus.value, [iso]: { state: 'exists', filledCount, total: mergedRessources.value.length } }

  for (const r of resources) paintSaving.value.delete(r.idPersonne)
  weekSelectedPersons.value = new Set()
}

/* ══ Peinture de créneaux (vue semaine) ══ */
const paintCode      = ref(null)   // code activité, 'erase', ou null
const isPainting     = ref(false)
const paintPersonId  = ref(null)
const paintSlotStart = ref(0)
const paintSlotEnd   = ref(0)
const paintBuffer    = ref({})     // { idPersonne: activites[] } — buffer pendant le drag
const paintSaving    = ref(new Set())

const PAINT_GROUPS = [
  { label: 'Matin',   codes: ['0', '9', '12', '20', '28'] },
  { label: 'Midi',    codes: ['1', '10', '13', '21'] },
  { label: 'Aprem',   codes: ['15', '16', '17', '22', '27'] },
  { label: 'Soir',    codes: ['2', '11', '14', '23', '29'] },
  { label: 'Pilote',  codes: ['24', '26'] },
  { label: 'Absence', codes: ['30', '6', '8'] },
  { label: 'Autre',   codes: ['5', '7', '31'] },
]

/** Retourne le code du slot (buffer en priorité pendant le drag) */
function getSlotCode(r, slot) {
  const buf = paintBuffer.value[r.idPersonne]
  if (buf) return buf[slot] || ''
  return r.activites?.[slot] || ''
}

/** Style de fond d'un slot */
function slotCellStyle(r, slot) {
  const code = getSlotCode(r, slot)
  if (!code) return {}
  const mapping = ACTIVITY_MAPPING[String(code)]
  if (!mapping) return {}
  return { background: mapping.couleur.replace(/,\s*1\s*\)/, ', 0.82)') }
}

/** Heures travaillées (lit le buffer si en cours de peinture) */
function slotHours(r) {
  const acts = paintBuffer.value[r.idPersonne] || r.activites || []
  return calcHeures(acts)
}

/** Info live affichée pendant le drag */
const paintInfo = computed(() => {
  if (!isPainting.value || paintPersonId.value === null) return null
  const s    = Math.min(paintSlotStart.value, paintSlotEnd.value)
  const e    = Math.max(paintSlotStart.value, paintSlotEnd.value)
  const r    = mergedRessources.value.find(x => x.idPersonne === paintPersonId.value)
  const name = r ? `${r.nom} ${r.prenom}` : ''
  const startTime = TIME_SLOTS[s] ?? ''
  // On affiche la fin du dernier slot (slot + 1, ou le temps du slot lui-même + 15 min)
  const nextIdx   = Math.min(e + 1, 44)
  const endTime   = e + 1 < TIME_SLOTS.length ? TIME_SLOTS[e + 1] : TIME_SLOTS[e]
  const durMin    = (e - s + 1) * 15
  const h = Math.floor(durMin / 60), m = durMin % 60
  const durStr    = m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
  const actLabel  = paintCode.value === 'erase'
    ? 'Effacer'
    : (ACTIVITY_MAPPING[paintCode.value]?.categorie ?? paintCode.value)
  return { name, startTime, endTime, durStr, actLabel }
})

/** Met à jour le buffer de slots entre start et end */
function applyPaintBuffer() {
  const id  = paintPersonId.value
  const buf = [...(paintBuffer.value[id] || new Array(45).fill(''))]
  const s   = Math.min(paintSlotStart.value, paintSlotEnd.value)
  const e   = Math.max(paintSlotStart.value, paintSlotEnd.value)
  for (let i = s; i <= e; i++) {
    buf[i] = paintCode.value === 'erase' ? '' : String(paintCode.value)
  }
  paintBuffer.value = { ...paintBuffer.value, [id]: buf }
}

function onSlotMouseDown(event, r, slot) {
  if (!paintCode.value) return
  isPainting.value     = true
  paintPersonId.value  = r.idPersonne
  paintSlotStart.value = slot
  paintSlotEnd.value   = slot
  // Initialise le buffer depuis les activités actuelles
  paintBuffer.value = { ...paintBuffer.value, [r.idPersonne]: [...(r.activites || new Array(45).fill(''))] }
  applyPaintBuffer()
}

function onSlotMouseEnter(r, slot) {
  if (!isPainting.value || r.idPersonne !== paintPersonId.value) return
  paintSlotEnd.value = slot
  applyPaintBuffer()
}

async function endPaint() {
  if (!isPainting.value) return
  isPainting.value = false
  const id = paintPersonId.value
  paintPersonId.value = null
  if (!id || !paintBuffer.value[id]) return

  const activites = paintBuffer.value[id]

  // Vide le buffer
  const newBuf = { ...paintBuffer.value }
  delete newBuf[id]
  paintBuffer.value = newBuf

  // Applique dans dayData et sauvegarde
  applyActivitesToRessource(id, activites)

  paintSaving.value = new Set([...paintSaving.value, id])
  try {
    await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
    const fc = mergedRessources.value.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
             + Object.keys(dayFixed.value).length
    const iso = fmtIso(selectedDate.value)
    dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { ...dayStatus.value[fmtId(selectedDate.value)], state: 'exists', filledCount: fc, total: mergedRessources.value.length } }
    updateMonthDay(iso, mergedRessources.value, fc)
  } finally {
    const next = new Set(paintSaving.value)
    next.delete(id)
    paintSaving.value = next
  }
}


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
  monthData.value = {}
  if (viewMode.value === 'week') {
    await checkWeekStatus()
    if (selectedDate.value) {
      loadingDay.value = true
      dayData.value    = await admin.loadDayPlanning(selectedDate.value)
      loadingDay.value = false
    }
  } else {
    await loadMonthData()
  }
}

/* ── Suppression des horaires d'une personne sur tout le mois ── */
async function clearPersonMonth(fullName) {
  clearPersonTarget.value = null
  clearingPerson.value    = true
  try {
    const isosToClear = monthWorkDates.value.filter(iso => {
      const d = monthData.value[iso]
      return d?.state === 'loaded' && d.ressources?.some(r => `${r.nom} ${r.prenom}` === fullName)
    })
    await Promise.all(isosToClear.map(iso => {
      const [y, m, d] = iso.split('-').map(Number)
      const date         = new Date(y, m - 1, d)
      const dayInfo      = monthData.value[iso]
      const newRessources = dayInfo.ressources.map(r =>
        `${r.nom} ${r.prenom}` === fullName
          ? { ...r, activites: new Array(45).fill('') }
          : r
      )
      const filledCount = newRessources.filter(r =>
        (r.activites || []).some(a => a && ETP_CODES.has(String(a)))
      ).length + Object.keys(dayInfo.fixed || {}).length
      return admin.saveDayPlanning(date, newRessources).then(() => {
        updateMonthDay(iso, newRessources, filledCount)
      })
    }))
  } finally {
    clearingPerson.value = false
  }
}

/* ── Nettoyage du mois (mode test uniquement) ── */
async function doClearMonth() {
  confirmClearMonth.value = false
  clearingMonth.value = true
  try {
    await admin.clearMonthPlanning(monthWorkDates.value)
    // Réinitialise l'état local du mois
    monthData.value = {}
    await loadMonthData()
  } finally {
    clearingMonth.value = false
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

function getMondayOfToday() {
  const today = new Date()
  const diff  = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const mon   = new Date(today)
  mon.setDate(today.getDate() + diff)
  return mon
}

// Retourne les 6 jours (Lun–Sam) de la semaine contenant `date`
function getWeekDatesForDate(date) {
  const dow     = date.getDay()
  const daysToMon = dow === 0 ? -6 : 1 - dow
  const monday  = new Date(date)
  monday.setDate(date.getDate() + daysToMon)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d
  })
}

// Semaine → Mois : on se place sur le mois de la semaine actuellement affichée
function switchToMonth() {
  const today = new Date()
  const mon   = getMondayOf(weekOffset.value)
  // Parcourir les 6 jours (lun→sam) : si l'un est un 1er du mois, l'utiliser
  let ref = mon
  for (let i = 0; i < 6; i++) {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i)
    if (d.getDate() === 1) { ref = d; break }
  }
  monthOffset.value = (ref.getFullYear() - today.getFullYear()) * 12 + (ref.getMonth() - today.getMonth())
  viewMode.value    = 'month'
}

// Mois → Semaine : on se place sur la 1re semaine du mois actuellement affiché
function switchToWeek() {
  const today    = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth() + monthOffset.value, 1)
  // Lundi de la semaine contenant le 1er du mois
  const dow = firstDay.getDay()
  const daysToMon = dow === 0 ? -6 : 1 - dow
  const targetMon = new Date(firstDay)
  targetMon.setDate(firstDay.getDate() + daysToMon)
  // Offset en semaines par rapport au lundi courant
  const currentMon = getMondayOfToday()
  const diffWeeks  = Math.round((targetMon - currentMon) / (7 * 24 * 60 * 60 * 1000))
  weekOffset.value = diffWeeks
  viewMode.value   = 'week'
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
function onKeydown(e) {
  if (e.key === 'Escape') {
    if (quickMode.value.active) { quickMode.value.active = false; quickMode.value.code = null }
    if (paintCode.value)        paintCode.value = null
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('mouseup', endPaint)
  if (viewMode.value === 'month') {
    loadMonthData()
  } else {
    checkWeekStatus()
    selectDay(weekDates.value[0])
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('mouseup', endPaint)
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
watch(selectedDate, () => { weekSelectedPersons.value = new Set() })
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

  // Admin planning :
  // - Arrivée : date-relative (apparaît à sa date d'arrivée sur le planning)
  // - Départ  : basé sur aujourd'hui (caché dès que depart < today, i.e. parti hier)
  // - hiddenFromPublic : toujours masqué même en admin
  const todayAdmin = new Date(); todayAdmin.setHours(0, 0, 0, 0)
  const activePeople = userStore.users.filter(p => {
    const parse = str => { if (!str) return null; const pt = str.trim().split(' '); return pt.length >= 3 ? new Date(+pt[2], +pt[1] - 1, +pt[0]) : null }
    const d0      = new Date(selectedDate.value); d0.setHours(0, 0, 0, 0)
    const arrivee = parse(p.arrivee)
    const depart  = parse(p.depart)
    if (!arrivee || d0 < arrivee) return false          // pas encore arrivé ce jour-là
    if (depart && todayAdmin > depart) return false     // parti hier ou avant
    return true
  })
  const activeIds = new Set(activePeople.map(p => p.id || p.uid))

  // Garder uniquement les ressources Firestore dont la personne est encore active
  const existing    = (dayData.value.ressources || []).filter(r => activeIds.has(r.idPersonne))
  const existingIds = new Set(existing.map(r => r.idPersonne))

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

/* ── Met à jour monthData en place après une sauvegarde (vue mois) ── */
function updateMonthDay(iso, ressources, filledCount) {
  if (!(iso in monthData.value)) return
  monthData.value = {
    ...monthData.value,
    [iso]: {
      ...monthData.value[iso],
      ressources,
      filledCount,
      total:  ressources.length,
      exists: true,
      state:  'loaded',
    },
  }
}

async function clearActivites(r) {
  const empty = new Array(45).fill('')
  applyActivitesToRessource(r.idPersonne, empty)
  clearTarget.value = null
  await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
  const filledCount = mergedRessources.value.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                    + Object.keys(dayFixed.value).length
  const iso = fmtIso(selectedDate.value)
  dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { ...dayStatus.value[fmtId(selectedDate.value)], state: 'exists', filledCount, total: mergedRessources.value.length } }
  updateMonthDay(iso, mergedRessources.value, filledCount)
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
  'Matin':              'Mat',
  'Après-midi':         'Apm',
  'Midi':               'Mid',
  'Soir':               'Soi',
  'TLT Matin':          'TM',
  'TLT Midi':           'TMi',
  'TLT APREM':          'TA',
  'TLT Soir':           'TS',
  'TLT Agence Matin':   'TM',
  'TLT Agence Midi':    'TMi',
  'TLT Agence APREM':   'TA',
  'TLT Agence Soir':    'TS',
  'Agence Matin':       'AM',
  'Agence Midi':        'AMi',
  'Agence APREM':       'AA',
  'Agence Soir':        'AS',
  'BO':                 'BO',
  'PiloteBO':           'Pil',
  'Pilote':             'Pil',
  'Congés payés':       'CP',
  'Indisponible':       'Ind',
  'Récupération':       'Réc',
  'Formation':          'For',
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

// ── Tri par jour dans la vue mois ──
const monthSortDay = ref(null)   // ISO du jour sélectionné pour trier, ou null (= alphabétique)
watch(monthOffset, () => { monthSortDay.value = null })

function toggleDaySort(iso) {
  monthSortDay.value = monthSortDay.value === iso ? null : iso
}

const monthPersonRows = computed(() => {
  const rows = monthPersons.value.map(p => ({ person: p, fullName: `${p.nom} ${p.prenom}` }))
  if (!monthSortDay.value) return rows
  const iso = monthSortDay.value
  return [...rows].sort((a, b) => {
    const rA = monthData.value[iso]?.ressources?.find(r => `${r.nom} ${r.prenom}` === a.fullName)
    const rB = monthData.value[iso]?.ressources?.find(r => `${r.nom} ${r.prenom}` === b.fullName)
    return horaireRank(rA?.activites) - horaireRank(rB?.activites)
      || a.fullName.localeCompare(b.fullName, 'fr')
  })
})


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
    const mainId = editRessource.value.idPersonne

    // ── Snapshot avant toute modification (pour rollback éventuel) ──
    const snapshotIds = new Set([mainId, ...toCollabIds])
    const snapshot = {}
    for (const r of mergedRessources.value) {
      if (snapshotIds.has(r.idPersonne)) snapshot[r.idPersonne] = [...(r.activites || [])]
    }

    // ── Vérification conflits sur le JOUR COURANT pour les collabs sélectionnés ──
    // (doit avoir lieu avant toute écriture → rien à rollback si cancel)
    let effectiveCollabIds = [...toCollabIds]
    if (toCollabIds.length) {
      const DAYS_LBL_C   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
      const MONTHS_LBL_C = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
      const d0     = selectedDate.value
      const dateLbl = `${DAYS_LBL_C[d0.getDay()]} ${d0.getDate()} ${MONTHS_LBL_C[d0.getMonth()]}`

      const conflicting = toCollabIds.filter(id => {
        const r = mergedRessources.value.find(r => r.idPersonne === id)
        return r && (r.activites || []).some(a => a && a !== '')
      })

      if (conflicting.length) {
        const currentConflicts = conflicting.map(id => {
          const r = mergedRessources.value.find(r => r.idPersonne === id)
          const blocks = admin.parseBlocks(r.activites || [])
          const types  = [...new Set(blocks.map(b => ACTIVITY_MAPPING[b.code]?.categorie || b.code))].join(' · ')
          return { name: `${r.nom} ${r.prenom}`, days: [{ dateLbl, types }] }
        })

        const mode = await askOverwriteMode(currentConflicts, {
          subtitle:      'Ces collaborateurs ont déjà des horaires ce jour :',
          labelOverwrite:'Écraser quand même',
          noEmptyOnly:   false,
        })
        if (mode === 'cancel') return
        if (mode === 'empty_only') effectiveCollabIds = toCollabIds.filter(id => !conflicting.includes(id))
        // 'overwrite' → effectiveCollabIds inchangé (tous)
      }
    }

    // 1. Applique au collab courant + collabs sélectionnés (même jour)
    applyActivitesToRessource(mainId, activites)
    for (const id of effectiveCollabIds) {
      applyActivitesToRessource(id, activites)
    }

    // Sauvegarde immédiate du jour courant
    await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
    const filledCount = mergedRessources.value.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                      + Object.keys(dayFixed.value).length
    const currentIso = fmtIso(selectedDate.value)
    dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { ...dayStatus.value[fmtId(selectedDate.value)], state: 'exists', filledCount, total: mergedRessources.value.length } }
    updateMonthDay(currentIso, mergedRessources.value, filledCount)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)

    const currentId = fmtId(selectedDate.value)
    // Calcule les jours de la semaine contenant selectedDate (et non weekDates qui suit weekOffset)
    const selectedWeekDates = getWeekDatesForDate(selectedDate.value)
    const otherDays = selectedWeekDates.filter(d =>
      fmtId(d) !== currentId && d.getDay() !== 6 && !isFerie(d)
    )

    // ── Notifications ──
    const mainUid = data.nameToUid[`${editRessource.value.nom} ${editRessource.value.prenom}`]
    const notifDates = [selectedDate.value, ...(applyWholeWeek ? otherDays : [])]
    for (const date of notifDates)
      notifyPlanningChange(mainUid, fmtIso(date))

    for (const id of effectiveCollabIds) {
      const uid = uidForId(id)
      const collabDates = [selectedDate.value, ...(applyCollabsWholeWeek ? otherDays : [])]
      for (const date of collabDates)
        notifyPlanningChange(uid, fmtIso(date))
    }

    if (!applyWholeWeek && !applyCollabsWholeWeek) return

    // 2. Pré-charge tous les autres jours en parallèle
    const dayResults = await Promise.all(otherDays.map(d => admin.loadDayPlanning(d)))

    // 3. Détecte si des horaires existent déjà pour les personnes concernées
    const allIds  = new Set([
      ...(applyWholeWeek          ? [mainId]             : []),
      ...(applyCollabsWholeWeek   ? effectiveCollabIds   : []),
    ])

    // Construit la liste détaillée des conflits (par personne)
    const DAYS_LBL   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
    const MONTHS_LBL = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
    const conflictMap = new Map()  // personName → [{ dateLabel, types }]

    for (let i = 0; i < otherDays.length; i++) {
      const d      = otherDays[i]
      const result = dayResults[i]
      const dateLbl = `${DAYS_LBL[d.getDay()]} ${d.getDate()} ${MONTHS_LBL[d.getMonth()]}`
      for (const r of (result.ressources || [])) {
        if (!allIds.has(r.idPersonne)) continue
        if (!(r.activites || []).some(a => a && a !== '')) continue
        const blocks = admin.parseBlocks(r.activites || [])
        const types  = [...new Set(blocks.map(b => ACTIVITY_MAPPING[b.code]?.categorie || b.code))].join(' · ')
        const name   = `${r.nom} ${r.prenom}`
        if (!conflictMap.has(name)) conflictMap.set(name, [])
        conflictMap.get(name).push({ dateLbl, types })
      }
    }
    const conflicts = [...conflictMap.entries()].map(([name, days]) => ({ name, days }))

    const overwriteMode = conflicts.length ? await askOverwriteMode(conflicts) : 'overwrite'
    if (overwriteMode === 'cancel') {
      // ── Rollback : restaure le jour courant dans son état d'avant ──
      for (const [id, prev] of Object.entries(snapshot)) {
        applyActivitesToRessource(id, prev)
      }
      await admin.saveDayPlanning(selectedDate.value, mergedRessources.value)
      const fcRollback = mergedRessources.value.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                       + Object.keys(dayFixed.value).length
      dayStatus.value = { ...dayStatus.value, [fmtId(selectedDate.value)]: { ...dayStatus.value[fmtId(selectedDate.value)], filledCount: fcRollback, total: mergedRessources.value.length } }
      updateMonthDay(currentIso, mergedRessources.value, fcRollback)
      saveSuccess.value = false
      return
    }

    // 4. Applique sur les autres jours (un seul passage)
    for (let i = 0; i < otherDays.length; i++) {
      const date       = otherDays[i]
      const result     = dayResults[i]
      const ressources = [...result.ressources]
      let   changed    = false

      if (applyWholeWeek) {
        const meta    = { ...editRessource.value, activites }
        const hasData = result.ressources?.some(r =>
          r.idPersonne === mainId && (r.activites || []).some(a => a && a !== '')
        )
        if (overwriteMode === 'overwrite' || !hasData) {
          const idx = ressources.findIndex(r => r.idPersonne === mainId)
          if (idx >= 0) ressources[idx] = meta; else ressources.push(meta)
          changed = true
        }
      }

      if (applyCollabsWholeWeek && effectiveCollabIds.length) {
        for (const id of effectiveCollabIds) {
          const collab  = mergedRessources.value.find(r => r.idPersonne === id)
          if (!collab) continue
          const hasData = result.ressources?.some(r =>
            r.idPersonne === id && (r.activites || []).some(a => a && a !== '')
          )
          if (overwriteMode === 'overwrite' || !hasData) {
            const entry = { nom: collab.nom, prenom: collab.prenom, idPersonne: id, activites }
            const idx   = ressources.findIndex(r => r.idPersonne === id)
            if (idx >= 0) ressources[idx] = entry; else ressources.push(entry)
            changed = true
          }
        }
      }

      if (changed) {
        await admin.saveDayPlanning(date, ressources)
        const fc = ressources.filter(r => (r.activites || []).some(a => a && ETP_CODES.has(String(a)))).length
                 + Object.keys(result.fixed || {}).length
        dayStatus.value = { ...dayStatus.value, [fmtId(date)]: { state: 'exists', filledCount: fc, total: ressources.length } }
        updateMonthDay(fmtIso(date), ressources, fc)
      }
    }
  } finally {
    editRessource.value = null
  }
}

</script>
