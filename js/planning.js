/* ============================================================
   PLANNING.JS — Gestion de l'affichage du planning hebdomadaire
   Dépend de : planning, persons (data.js)
   ============================================================ */

let currentWeekOffset = 0; // 0 = semaine courante, -1 = semaine précédente, etc.

/* ============================================================
   GESTION DES FAVORIS (localStorage)
   ============================================================ */

const FAVORITES_KEY = 'planning_favorites';

function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Erreur lecture favoris:', e);
    return [];
  }
}

function saveFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error('Erreur sauvegarde favoris:', e);
  }
}

function toggleFavorite(personName) {
  const favorites = getFavorites();
  const index = favorites.indexOf(personName);
  
  if (index > -1) {
    // Retirer des favoris
    favorites.splice(index, 1);
  } else {
    // Ajouter aux favoris
    favorites.push(personName);
  }
  
  saveFavorites(favorites);
  renderPlanning(); // Re-render pour mettre à jour l'affichage
}

function isFavorite(personName) {
  return getFavorites().includes(personName);
}

/* ============================================================
   UTILITAIRES DATE
   ============================================================ */

function getWeekDates(offset = 0) {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay; // Lundi = jour 1
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + (offset * 7));
  
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return {
    day: days[date.getDay()],
    date: date.getDate(),
    month: months[date.getMonth()]
  };
}

/* ============================================================
   EXTRACTION DES HORAIRES D'UNE JOURNÉE
   ============================================================ */

function getWorkHours(personData) {
  if (!personData || personData.length === 0) return null;
  
  // Filtre les absences
  const workEntries = personData.filter(e => {
    const cat = e.categorie.toLowerCase();
    return cat !== 'cp' && cat !== 'indisponible' && cat !== 'récup';
  });
  
  if (workEntries.length === 0) return null;
  
  // Extrait les heures de début et fin
  const times = workEntries.map(e => {
    const [start, end] = e.horaire.split('-');
    return { start, end };
  });
  
  // Trouve l'heure de début la plus tôt et l'heure de fin la plus tard
  const starts = times.map(t => t.start).sort();
  const ends = times.map(t => t.end).sort();
  
  return {
    debut: starts[0],
    fin: ends[ends.length - 1],
    couleur: workEntries[0].couleur
  };
}

/* ============================================================
   CALCUL DU TOTAL D'HEURES
   ============================================================ */

function calculateHours(debut, fin) {
  const [hD, mD] = debut.split(':').map(Number);
  const [hF, mF] = fin.split(':').map(Number);
  const totalMinutes = (hF * 60 + mF) - (hD * 60 + mD);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, '0') : ''}`;
}

/* ============================================================
   GÉNÉRATION DU BADGE DE LIEU
   ============================================================ */

function getLocationBadge(personData) {
  if (!personData || personData.length === 0) return null;
  
  const workEntries = personData.filter(e => {
    const cat = e.categorie.toLowerCase();
    return cat !== 'cp' && cat !== 'indisponible' && cat !== 'récup';
  });
  
  if (workEntries.length === 0) return null;
  
  const cat = workEntries[0].categorie;
  
  if (cat.includes('TLTDOM')) {
    return { icon: '🏠', label: 'Domicile', color: 'rgba(188, 145, 87, 0.15)' };
  } else if (cat.includes('TLT')) {
    return { icon: '💼', label: 'TLT Agence', color: 'rgba(167, 139, 250, 0.15)' };
  } else if (cat.includes('Apside')) {
    return { icon: '🏢', label: 'Agence', color: 'rgba(52, 211, 153, 0.15)' };
  } else {
    return { icon: '👤', label: 'Client', color: 'rgba(99, 102, 241, 0.15)' };
  }
}

/* ============================================================
   RENDU DU PLANNING
   ============================================================ */

function renderPlanning() {
  const container = document.getElementById('planningContent');
  if (!container) return;
  
  const weekDates = getWeekDates(currentWeekOffset);
  const weekStart = formatDateLabel(weekDates[0]);
  const weekEnd = formatDateLabel(weekDates[4]);
  
  // Récupère la liste des personnes actives si le filtre est activé
  const activePerson = applyPersonFilter();
  
  // Séparer favoris et non-favoris
  const favorites = getFavorites();
  const favoritePeople = activePerson.filter(p => favorites.includes(p));
  const otherPeople = activePerson.filter(p => !favorites.includes(p));
  
  // Header avec navigation
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
    </div>
  `;
  
  // Header des jours
  const daysHeader = `
    <div class="planning-grid-header">
      <div class="planning-name-col">Collaborateur</div>
      ${weekDates.map(date => {
        const label = formatDateLabel(date);
        const isToday = formatDate(date) === formatDate(new Date());
        return `
          <div class="planning-day-col ${isToday ? 'planning-day-today' : ''}">
            <div class="planning-day-label">${label.day}</div>
            <div class="planning-day-date">${label.date} ${label.month}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Lignes des collaborateurs
  const createPersonRow = (person, isFav = false) => {
    const initials = person.split(' ').map(n => n[0]).join('');
    
    const daysCells = weekDates.map(date => {
      const dateStr = formatDate(date);
      const dayData = planning[person]?.[dateStr];
      const hours = getWorkHours(dayData);
      const location = getLocationBadge(dayData);
      
      if (!hours) {
            // Jour de repos ou absence
            const absence =
              dayData &&
              dayData.find(
                (e) =>
                  e.categorie === "CP" ||
                  e.categorie === "Indisponible" ||
                  e.categorie === "Récup",
              );

            return `
  <div class="planning-cell planning-cell-empty">
    ${
      absence
        ? `<span class="planning-absence">${absence.categorie}</span>`
        : '<span class="planning-rest">—</span>'
    }
  </div>
`;
      }
      
      // Couleur pour les heures de travail, avec transparence pour le badge de lieu
          const color = hours.couleur.replace(", 1)", ", 0.5)");

          return `
        <div class="planning-cell planning-cell-work" style="border-left: 3px solid ${hours.couleur}">
          ${
            location
              ? `
            <div class="planning-location" style="background:${color}">
            <span>${location.icon}</span>
            <span>${hours.debut} - ${hours.fin}</span>
              <span>${location.label}</span>
            </div>
          `
              : ""
          }
        </div>
      `;
        })
        .join("");
    
    return `
      <div class="planning-row ${isFav ? 'planning-row-favorite' : ''}">
        <div class="planning-name-cell">
          <div class="planning-avatar" style="background: linear-gradient(135deg, #6366F1 0%, #A78BFA 100%)">
            ${initials}
          </div>
          <div class="planning-person-info">
            <div class="planning-person-name">${person}</div>
          </div>
          <button class="btn-favorite ${isFav ? 'active' : ''}" 
                  onclick="toggleFavorite('${person.replace(/'/g, "\\'")}')" 
                  title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            <i data-lucide="${isFav ? 'star' : 'star'}" style="width:14px;height:14px;${isFav ? 'fill:currentColor;' : ''}"></i>
          </button>
        </div>
        ${daysCells}
      </div>
    `;
  };

  // Génération des sections
  let favoritesSection = '';
  if (favoritePeople.length > 0) {
    favoritesSection = `
      <div class="planning-section">
        <div class="planning-section-header">
          <i data-lucide="star" style="width:14px;height:14px;fill:currentColor;"></i>
          <span>Favoris (${favoritePeople.length})</span>
        </div>
        ${favoritePeople.map(p => createPersonRow(p, true)).join('')}
      </div>
    `;
  }

  const othersSection = otherPeople.length > 0 ? `
    <div class="planning-section ${favoritePeople.length > 0 ? 'planning-section-others' : ''}">
      ${favoritePeople.length > 0 ? `
        <div class="planning-section-header">
          <i data-lucide="users" style="width:14px;height:14px;"></i>
          <span>Autres collaborateurs (${otherPeople.length})</span>
        </div>
      ` : ''}
      ${otherPeople.map(p => createPersonRow(p, false)).join('')}
    </div>
  ` : '';
  
  container.innerHTML = header + daysHeader + `<div class="planning-grid-body">${favoritesSection}${othersSection}</div>`;
  
  // Recrée les icônes Lucide
  lucide.createIcons();
  
  // Événements de navigation
  document.getElementById('prevWeek').onclick = () => {
    currentWeekOffset--;
    renderPlanning();
  };
  
  document.getElementById('nextWeek').onclick = () => {
    currentWeekOffset++;
    renderPlanning();
  };
  
  document.getElementById('todayWeek').onclick = () => {
    currentWeekOffset = 0;
    renderPlanning();
  };
}

/* ============================================================
   EXPORT
   ============================================================ */

window.renderPlanning = renderPlanning;
window.toggleFavorite = toggleFavorite;