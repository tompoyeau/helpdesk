/* ============================================================
   PLANNING.JS — Affichage du planning hebdomadaire
   ============================================================ */

import { applyPersonFilter, planning } from './data.js';

let currentWeekOffset = 0;

/* ============================================================
   FAVORIS (localStorage)
   ============================================================ */

const FAVORITES_KEY = 'planning_favorites';

function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error('Erreur sauvegarde favoris :', e);
  }
}

export function toggleFavorite(personName) {
  const favorites = getFavorites();
  const index     = favorites.indexOf(personName);
  if (index > -1) favorites.splice(index, 1);
  else            favorites.push(personName);
  saveFavorites(favorites);
  renderPlanning();
}

function isFavorite(personName) {
  return getFavorites().includes(personName);
}

/* ============================================================
   UTILITAIRES DATE
   ============================================================ */

function getWeekDates(offset = 0) {
  const today = new Date();
  const diff  = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + offset * 7);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(date) {
  const days   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
  return { day: days[date.getDay()], date: date.getDate(), month: months[date.getMonth()] };
}

/* ============================================================
   CONTRASTE TEXTE (WCAG 2.1)
   ============================================================ */

function textColor(rgba) {
  const [r, g, b] = rgba.match(/\d+/g).map(Number);
  const lum = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  return L > 0.179 ? '#1a1a1a' : '#ffffff';
}

/* ============================================================
   HORAIRES & BADGE DE LIEU
   ============================================================ */

function getWorkHours(personData) {
  if (!personData?.length) return null;
  const work = personData.filter(e => {
    const cat = e.categorie.toLowerCase();
    return cat !== 'cp' && cat !== 'indisponible' && cat !== 'récup';
  });
  if (!work.length) return null;

  const times  = work.map(e => { const [s, en] = e.horaire.split('-'); return { start: s, end: en }; });
  const starts = times.map(t => t.start).sort();
  const ends   = times.map(t => t.end).sort();
  return { debut: starts[0], fin: ends[ends.length - 1], couleur: work[0].couleur };
}

function getLocationBadge(personData) {
  if (!personData?.length) return null;
  const work = personData.filter(e => {
    const cat = e.categorie.toLowerCase();
    return cat !== 'cp' && cat !== 'indisponible' && cat !== 'récup';
  });
  if (!work.length) return null;

  const cat = work[0].categorie;
  if (cat.includes('TLT Agence')) return { icon: '💼', label: 'TLT Agence',  color: 'rgba(167,139,250,0.15)'  };
  if (cat.includes('TLT'))        return { icon: '🏠', label: 'Domicile',    color: 'rgba(188,145,87,0.15)'   };
  if (cat.includes('Agence'))     return { icon: '🏢', label: 'Agence',      color: 'rgba(52,211,153,0.15)'   };
  return                                  { icon: '👤', label: 'Client',      color: 'rgba(99,102,241,0.15)'   };
}

function getSlotAbbrev(personData) {
  if (!personData?.length) return '';
  const work = personData.filter(e => {
    const cat = e.categorie.toLowerCase();
    return cat !== 'cp' && cat !== 'indisponible' && cat !== 'récup';
  });
  if (!work.length) return '';

  const cats = new Set(work.map(e => e.categorie));
  const slots = [];
  if (['Matin','TLT Matin','TLT Agence Matin','Agence Matin'].some(c => cats.has(c)))              slots.push('Mat');
  if (['Midi','TLT Midi','TLT Agence Midi','Agence Midi'].some(c => cats.has(c)))                  slots.push('Midi');
  if (['Aprem','TLT APREM','TLT Agence APREM','Agence APREM','ApremRenf'].some(c => cats.has(c)))  slots.push('Apr');
  if (['Soir','TLT Soir','TLT Agence Soir','Agence Soir'].some(c => cats.has(c)))                 slots.push('Soir');
  return slots.length ? slots.join('+') : work[0].categorie.slice(0, 4);
}

/* ============================================================
   MODAL DÉTAIL JOURNÉE
   ============================================================ */

export function openDayModal(person, dateStr) {
  const dayData = planning[person]?.[dateStr];
  if (!dayData?.length) return;

  const date      = new Date(dateStr + 'T12:00:00');
  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const initials  = person.split(' ').map(n => n[0]).join('');

  const entriesHTML = dayData.map(e => `
    <div class="modal-entry">
      <div class="modal-entry-bar" style="background:${e.couleur}"></div>
      <div class="modal-entry-info">
        <span class="modal-entry-cat">${e.categorie}</span>
        <span class="modal-entry-hours">${e.horaire}</span>
      </div>
    </div>`).join('');

  const modal = document.getElementById('planningModal');
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeDayModal()"></div>
    <div class="modal-box">
      <div class="modal-header">
        <div class="planning-avatar" style="background:linear-gradient(135deg,#6366F1 0%,#A78BFA 100%)">${initials}</div>
        <div>
          <div class="modal-person">${person}</div>
          <div class="modal-date">${dateLabel}</div>
        </div>
        <button class="btn-icon btn-icon-sm" onclick="closeDayModal()" style="margin-left:auto">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
      </div>
      <div class="modal-entries">${entriesHTML}</div>
    </div>`;

  modal.classList.add('open');
  lucide.createIcons();
}

export function closeDayModal() {
  document.getElementById('planningModal').classList.remove('open');
}

export function renderPlanning() {
  const container = document.getElementById('planningContent');
  if (!container) return;

  const weekDates = getWeekDates(currentWeekOffset);
  const weekStart = formatDateLabel(weekDates[0]);
  const weekEnd   = formatDateLabel(weekDates[4]);

  const activePerson   = applyPersonFilter();
  const favorites      = getFavorites();
  const favoritePeople = activePerson.filter(p => favorites.includes(p));
  const otherPeople    = activePerson.filter(p => !favorites.includes(p));

  const header = `
    <div class="planning-header">
      <div class="planning-nav">
        <button id="prevWeek" class="btn-icon" title="Semaine précédente">
          <i data-lucide="chevron-left" style="width:16px;height:16px;"></i>
        </button>
        <div class="planning-period">
          <i data-lucide="calendar" style="width:14px;height:14px;"></i>
          <span>Semaine du ${weekStart.date} ${weekStart.month} au ${weekEnd.date} ${weekEnd.month}</span>
        </div>
        <button id="nextWeek" class="btn-icon" title="Semaine suivante">
          <i data-lucide="chevron-right" style="width:16px;height:16px;"></i>
        </button>
        <button id="todayWeek" class="btn-primary" style="font-size:0.8125rem;padding:6px 12px;">
          <i data-lucide="calendar-check" style="width:12px;height:12px;"></i>
          Aujourd'hui
        </button>
      </div>
    </div>`;

  const daysHeader = `
    <div class="planning-grid-header">
      <div class="planning-name-col">Collaborateur</div>
      ${weekDates.map(date => {
        const label   = formatDateLabel(date);
        const isToday = formatDate(date) === formatDate(new Date());
        return `
          <div class="planning-day-col ${isToday ? 'planning-day-today' : ''}">
            <div class="planning-day-label">${label.day}</div>
            <div class="planning-day-date">${label.date} ${label.month}</div>
          </div>`;
      }).join('')}
    </div>`;

  const createPersonRow = (person, isFav = false) => {
    const initials = person.split(' ').map(n => n[0]).join('');
    const daysCells = weekDates.map(date => {
      const dateStr  = formatDate(date);
      const label    = formatDateLabel(date);
      const dayData  = planning[person]?.[dateStr];
      const hours    = getWorkHours(dayData);
      const location = getLocationBadge(dayData);

      if (!hours) {
        const absence = dayData?.find(e => e.categorie === "CP" || e.categorie === "Indisponible" || e.categorie === "Récup");
        if (absence) {
          const bg = absence.couleur.replace(', 1)', ', 0.7)');
          return `
            <div class="planning-cell planning-cell-absence" data-day="${label.day}">
              <div class="planning-absence-fill" style="background:${bg};color:${textColor(bg)}">
                <span class="planning-absence" style="font-weight:600">${absence.categorie}</span>
              </div>
            </div>`;
        }
        return `
          <div class="planning-cell planning-cell-empty" data-day="${label.day}">
            <span class="planning-rest">—</span>
          </div>`;
      }

      const bgColor  = hours.couleur.replace(', 1)', ', 0.7)');
      const slot     = getSlotAbbrev(dayData);
      const safeName = person.replace(/'/g, "\\'");
      return `
        <div class="planning-cell planning-cell-work" data-day="${label.day}" style="cursor:pointer" onclick="openDayModal('${safeName}','${dateStr}')">
          ${location ? `
            <div class="planning-location" style="background:${bgColor};color:${textColor(bgColor)}">
              <span class="loc-icon">${location.icon}</span>
              <span class="loc-slot">${slot}</span>
              <span class="loc-time">${hours.debut} – ${hours.fin}</span>
              <span class="loc-label">${location.label}</span>
            </div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="planning-row ${isFav ? 'planning-row-favorite' : ''}">
        <div class="planning-name-cell">
          <div class="planning-avatar" style="background:linear-gradient(135deg,#6366F1 0%,#A78BFA 100%)">${initials}</div>
          <div class="planning-person-info">
            <div class="planning-person-name">${person}</div>
          </div>
          <button class="btn-favorite ${isFav ? 'active' : ''}"
                  onclick="toggleFavorite('${person.replace(/'/g, "\\'")}')"
                  title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            <i data-lucide="star" style="width:14px;height:14px;${isFav ? 'fill:currentColor;' : ''}"></i>
          </button>
        </div>
        <div class="planning-days-mobile">${daysCells}</div>
      </div>`;
  };

  const favoritesSection = favoritePeople.length > 0 ? `
    <div class="planning-section">
      <div class="planning-section-header">
        <i data-lucide="star" style="width:14px;height:14px;fill:currentColor;"></i>
        <span>Favoris (${favoritePeople.length})</span>
      </div>
      ${favoritePeople.map(p => createPersonRow(p, true)).join('')}
    </div>` : '';

  const othersSection = otherPeople.length > 0 ? `
    <div class="planning-section ${favoritePeople.length > 0 ? 'planning-section-others' : ''}">
      ${favoritePeople.length > 0 ? `
        <div class="planning-section-header">
          <i data-lucide="users" style="width:14px;height:14px;"></i>
          <span>Autres collaborateurs (${otherPeople.length})</span>
        </div>` : ''}
      ${otherPeople.map(p => createPersonRow(p, false)).join('')}
    </div>` : '';

  container.innerHTML = `<div class="planning-card">${header}${daysHeader}<div class="planning-grid-body">${favoritesSection}${othersSection}</div></div>`;

  lucide.createIcons();

  document.getElementById('prevWeek').onclick  = () => { currentWeekOffset--; renderPlanning(); };
  document.getElementById('nextWeek').onclick  = () => { currentWeekOffset++; renderPlanning(); };
  document.getElementById('todayWeek').onclick = () => { currentWeekOffset = 0; renderPlanning(); };
}
