/* ============================================================
   UI.JS — Rendu de l'interface, navigation SPA, interactions
   ============================================================ */

import { applyPersonFilter, computeFiltered, filtered, categories, colors, els } from './data.js';
import { updateCharts, getDashboardHTML } from './charts.js';
import { renderPlanning } from './planning.js';

/* ============================================================
   RÉFÉRENCES DOM
   ============================================================ */

const plist   = document.getElementById("personList");
const clist   = document.getElementById("categoryList");
const psearch = document.getElementById("personSearch");

/* ============================================================
   GROUPES DE CATÉGORIES (sidebar droite)
   ============================================================ */

const categoryGroups = {
  "Travail chez le client":    ["Matin", "Midi", "Aprem", "Soir"],
  "Journées vertes":           ["Agence Matin", "Agence Midi", "Agence APREM", "Agence Soir"],
  "Télétravail au domicile":   ["TLT Matin", "TLT Midi", "TLT APREM", "TLT Soir"],
  "Télétravail à l'agence":    ["TLT Agence Matin", "TLT Agence Midi", "TLT Agence APREM", "TLT Agence Soir", "ApremRenf"],
  "Projet / Pilote":           ["Pilote", "PiloteBO", "MatinW11", "SoirW11"],
  Autres:                      ["Formation", "Indisponible", "Astreinte", "Récup", "CP"],
};

const consolidatedMap = {
  CONS_MATIN:  { label: "Matin",          cats: ["Matin",  "TLT Matin",  "TLT Agence Matin"] },
  CONS_MIDI:   { label: "Midi",           cats: ["Midi",   "TLT Midi",   "TLT Agence Midi"]  },
  CONS_APREM:  { label: "Aprem",          cats: ["Aprem",  "TLT APREM",  "TLT Agence APREM"] },
  CONS_SOIR:   { label: "Soir",           cats: ["Soir",   "TLT Soir",   "TLT Agence Soir"]  },
  CONS_AGENCE: { label: "Journées verte", cats: ["Agence Matin", "Agence Midi", "Agence APREM", "Agence Soir"] },
};

/* ============================================================
   DRAWERS & BOTTOM SHEET (responsive)
   ============================================================ */

function openDrawer(side) {
  document.getElementById(side === "left" ? "sidebarLeft" : "sidebarRight").classList.add("open");
  document.getElementById("drawerBackdrop").classList.add("open");
  lucide.createIcons();
}

export function closeAllDrawers() {
  document.getElementById("sidebarLeft").classList.remove("open");
  document.getElementById("sidebarRight").classList.remove("open");
  document.getElementById("drawerBackdrop").classList.remove("open");
}

function openDateSheet() {
  document.getElementById("filterStartMobile").value = els.fs.value;
  document.getElementById("filterEndMobile").value   = els.fe.value;
  document.getElementById("dateSheet").classList.add("open");
  document.getElementById("sheetBackdrop").classList.add("open");
}

export function closeDateSheet() {
  document.getElementById("dateSheet").classList.remove("open");
  document.getElementById("sheetBackdrop").classList.remove("open");
}

document.getElementById("btnOpenLeft").onclick  = () => openDrawer("left");
document.getElementById("btnOpenRight").onclick = () => openDrawer("right");
document.getElementById("btnDateSheet").onclick = openDateSheet;

document.getElementById("refreshMobile").onclick = () => {
  els.fs.value = document.getElementById("filterStartMobile").value;
  els.fe.value = document.getElementById("filterEndMobile").value;
  closeDateSheet();
  computeFiltered();
  renderLists();
  renderState(history.state);
};

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeAllDrawers(); closeDateSheet(); }
});

/* ============================================================
   LUCIDE + MODE SOMBRE
   ============================================================ */

lucide.createIcons();

const toggleDark = document.getElementById("toggleDark");
const darkIcon   = document.getElementById("darkIcon");

function updateDarkIcon() {
  const isDark = document.documentElement.classList.contains("dark");
  darkIcon.setAttribute("data-lucide", isDark ? "sun" : "moon");
  lucide.createIcons();
}

toggleDark.onclick = () => {
  document.documentElement.classList.toggle("dark");
  updateDarkIcon();
};

updateDarkIcon();

/* ============================================================
   UTILITAIRE : FORMATAGE DE DATE EN FRANÇAIS
   ============================================================ */

function formatFR(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/* ============================================================
   PROFIL JOURNÉE — pour indicateur de série
   ============================================================ */

const PROFILE_COLORS = {
  matin:  '#6366F1',
  midi:   '#60A5FA',
  aprem:  '#A78BFA',
  soir:   '#22D3EE',
  agence: '#34D399',
  autre:  '#94A3B8',
};

function getDayProfile(entries) {
  const cats = new Set(entries.map(e => e.categorie));
  const parts = [];
  if (['Matin','TLT Matin','TLT Agence Matin'].some(c => cats.has(c)))                          parts.push('matin');
  if (['Midi','TLT Midi','TLT Agence Midi'].some(c => cats.has(c)))                             parts.push('midi');
  if (['Aprem','TLT APREM','TLT Agence APREM','ApremRenf'].some(c => cats.has(c)))              parts.push('aprem');
  if (['Soir','TLT Soir','TLT Agence Soir'].some(c => cats.has(c)))                            parts.push('soir');
  if (['Agence Matin','Agence Midi','Agence APREM','Agence Soir'].some(c => cats.has(c)))       parts.push('agence');
  // Profil consolidé trouvé → on retourne la combinaison
  if (parts.length > 0) return parts.join('+');
  // Hors consolidé → on retourne la catégorie exacte pour ne pas mélanger des catégories différentes
  return entries[0]?.categorie || 'autre';
}

function isNextWorkDay(a, b) {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  const diff = Math.round((db - da) / 86400000);
  // Lundi→Vendredi : jours consécutifs
  if (diff === 1 && da.getDay() !== 6 && db.getDay() !== 0) return true;
  // Vendredi→Lundi (weekend)
  if (da.getDay() === 5 && diff === 3) return true;
  // Samedi→Lundi
  if (da.getDay() === 6 && diff === 2) return true;
  return false;
}

/* ============================================================
   RENDER LISTES (sidebars)
   ============================================================ */

export function renderLists() {
  renderPersonList();
  renderCategoryGroups();
}

function renderPersonList() {
  plist.innerHTML = applyPersonFilter()
    .filter(n => n.toLowerCase().includes(psearch.value.toLowerCase()))
    .map(n => {
      const initials = n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      return `
        <li class="sidebar-item" data-name="${n}" onclick="selPerson('${n}')">
          <div class="flex items-center gap-2" style="min-width:0">
            <div class="person-avatar">${initials}</div>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">${n}</span>
          </div>
        </li>`;
    }).join("");
}

function renderCategoryGroups() {
  const hasSamedi = filtered.byCategory?.samedi;
  let html = `
    <div class="mb-3">
      <span class="cat-group-title">Horaires consolidés</span>
      <ul style="margin-top:2px">
        ${Object.entries(consolidatedMap).map(([key, obj]) => {
          const dotColor = key === "CONS_AGENCE" ? "#34D399" : "var(--accent)";
          return `
            <li class="sidebar-item" data-name="${key}" onclick="selCat('${key}')">
              <div class="flex items-center gap-2">
                <div class="color-dot" style="background:${dotColor};opacity:0.8"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${obj.label}</span>
              </div>
            </li>`;
        }).join("")}
        ${hasSamedi ? `
          <li class="sidebar-item" data-name="samedi" onclick="selCat('samedi')">
            <div class="flex items-center gap-2">
              <div class="color-dot" style="background:#60A5FA;opacity:0.8"></div>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">Samedi</span>
            </div>
          </li>` : ""}
      </ul>
    </div>`;

  for (const group in categoryGroups) {
    const items = categoryGroups[group].filter(c => categories.includes(c));
    if (!items.length) continue;
    html += `
      <div class="mb-3">
        <span class="cat-group-title">${group}</span>
        <ul style="margin-top:2px">
          ${items.map(c => `
            <li class="sidebar-item" data-name="${c}" onclick="selCat('${c}')">
              <div class="flex items-center gap-2">
                <div class="color-dot" style="background:${colors[c]}"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${c}</span>
              </div>
            </li>`).join("")}
        </ul>
      </div>`;
  }

  clist.innerHTML = html;
}

/* ============================================================
   VUE GLOBALE
   ============================================================ */

export function renderGlobal() {
  document.getElementById("chartsBlock").style.display = "grid";

  if (!filtered) { els.center.innerHTML = "Aucune donnée"; return; }

  const rows = Object.keys(filtered.byCat)
    .map(cat => [cat, countDays(cat)])
    .sort((a, b) => b[1] - a[1]);

  const sam = filtered.byCategory?.samedi;
  if (sam) rows.push(["Samedi", sam.d.size]);

  els.center.innerHTML = getDashboardHTML(rows, colors);
}

function countDays(cat) {
  let totalSlots = 0;
  for (const p in filtered.byPerson)
    for (const d in filtered.byPerson[p].details)
      for (const e of filtered.byPerson[p].details[d])
        if (e.categorie === cat) totalSlots += e.slots || 0;
  const days = totalSlots / 30;
  return Number.isInteger(days) ? days : +days.toFixed(1);
}

/* ============================================================
   VUE PERSONNE
   ============================================================ */

function renderPerson(n) {
  document.getElementById("chartsBlock").style.display = "none";

  if (!filtered?.byPerson[n]) { els.center.innerHTML = "Aucune donnée"; return; }

  const d = filtered.byPerson[n];

  const FULL_DAY_CATS = new Set(["CP", "Indisponible", "Récup"]);
  const byCat = {};
  for (const day in d.details) {
    const catCounts = {};
    d.details[day].forEach(e => { catCounts[e.categorie] = (catCounts[e.categorie] || 0) + 1; });
    for (const [cat, count] of Object.entries(catCounts)) {
      const val = FULL_DAY_CATS.has(cat) ? 1 : (count === 1 ? 0.5 : 1);
      byCat[cat] = (byCat[cat] || 0) + val;
    }
  }

  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const days = Object.keys(d.details).sort().reverse();

  const TLT_CATS  = new Set(["TLT Matin","TLT Midi","TLT APREM","TLT Soir","TLT Agence Matin","TLT Agence Midi","TLT Agence APREM","TLT Agence Soir","ApremRenf"]);
  const CLI_CATS  = new Set(["Matin","Midi","Aprem","Soir","Formation","PiloteBO"]);
  const WORK_CATS = new Set([...TLT_CATS, ...CLI_CATS, "Agence Matin","Agence Midi","Agence APREM","Agence Soir","Pilote","PiloteBO","MatinW11","SoirW11","Astreinte"]);

  let workDays = 0, tltDays = 0, clientDays = 0, cpDays = 0;
  for (const day in d.details) {
    const entries     = d.details[day];
    const workCount   = entries.filter(e => WORK_CATS.has(e.categorie)).length;
    const tltCount    = entries.filter(e => TLT_CATS.has(e.categorie)).length;
    const clientCount = entries.filter(e => CLI_CATS.has(e.categorie)).length;
    const cpCount     = entries.filter(e => e.categorie === "CP").length;
    const toDay       = c => c === 1 ? 0.5 : c >= 2 ? 1 : 0;
    workDays   += toDay(workCount);
    tltDays    += toDay(tltCount);
    clientDays += toDay(clientCount);
    if (cpCount > 0 && new Date(day).getDay() !== 6) cpDays += 1;
  }

  const tauxTlt    = workDays > 0 ? Math.round(tltDays   / workDays * 100) : 0;
  const tauxClient = workDays > 0 ? Math.round(clientDays / workDays * 100) : 0;
  const firstDay   = days[days.length - 1];
  const lastDay    = days[0];
  const fmtJ       = v => Number.isInteger(v) ? v : v.toFixed(1);
  const tltColor   = tauxTlt >= 50 ? "#22D3EE" : tauxTlt >= 30 ? "#A78BFA" : "#6366F1";

  const statCards = [
    { label: "Jours travaillés", value: fmtJ(workDays),   sub: `${firstDay ? formatFR(firstDay) : "—"} → ${lastDay ? formatFR(lastDay) : "—"}`, color: "#6366F1", icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` },
    { label: "Taux TLT",         value: tauxTlt + "%",    sub: `${fmtJ(tltDays)}j en télétravail`,    color: tltColor,  icon: `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>` },
    { label: "Taux client",      value: tauxClient + "%", sub: `${fmtJ(clientDays)}j chez le client`, color: "#34D399", icon: `<path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>` },
    { label: "CP",               value: fmtJ(cpDays),     sub: `jours de congés`,                     color: "#94A3B8", icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
  ];

  const initials = n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  // Calcul des séries consécutives par profil d'horaire consolidé
  const chronoDays = [...days].reverse(); // ordre chronologique
  const dayStreakInfo = {};
  let ci = 0;
  while (ci < chronoDays.length) {
    const profile = getDayProfile(d.details[chronoDays[ci]]);
    let cj = ci + 1;
    while (
      cj < chronoDays.length &&
      isNextWorkDay(chronoDays[cj - 1], chronoDays[cj]) &&
      getDayProfile(d.details[chronoDays[cj]]) === profile
    ) cj++;
    const len = cj - ci;
    if (len >= 2) {
      for (let k = ci; k < cj; k++) {
        const mainProfile  = profile.split('+')[0];
        const firstCat     = d.details[chronoDays[k]]?.[0]?.categorie;
        const streakColor  = (mainProfile !== 'autre' && PROFILE_COLORS[mainProfile])
          ? PROFILE_COLORS[mainProfile]
          : (colors[firstCat] || PROFILE_COLORS.autre);
        dayStreakInfo[chronoDays[k]] = {
          length:  len,
          color:   streakColor,
          isFirst: k === cj - 1, // plus récent = premier affiché dans le tableau inversé
          isLast:  k === ci,
        };
      }
    }
    ci = cj;
  }

  els.center.innerHTML = `
    <div class="person-header">
      <div class="person-avatar-lg">${initials}</div>
      <div>
        <h2 style="margin-bottom:2px">${n}</h2>
        <span class="person-period">${workDays} jours · ${days.length > 0 ? formatFR(firstDay) + " → " + formatFR(lastDay) : "—"}</span>
      </div>
    </div>

    <div class="person-stats-grid">
      ${statCards.map(s => `
        <div class="person-stat-card">
          <div class="person-stat-icon" style="background:${s.color}18">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
          </div>
          <div class="person-stat-body">
            <span class="person-stat-label">${s.label}</span>
            <span class="person-stat-value" style="color:${s.color}">${s.value}</span>
            <span class="person-stat-sub">${s.sub}</span>
          </div>
        </div>`).join("")}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" style="margin-top:20px">
      <div>
        <h3>Par catégorie</h3>
        <table class="w-full">
          <thead><tr><th>Catégorie</th><th>Jours</th></tr></thead>
          <tbody>
            ${rows.map(([cat, jours]) => `
              <tr class="tr-link" onclick="selCat('${cat}')" title="Voir ${cat}">
                <td>
                  <div style="display:flex;align-items:center;gap:7px">
                    <span class="color-dot" style="display:inline-block;background:${colors[cat]}"></span>${cat}
                  </div>
                </td>
                <td>${Number.isInteger(jours) ? jours : jours.toFixed(1)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Répartition par horaire</h3>
        ${renderPersonConsolidated(n)}
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:20px;margin-bottom:10px">
      <h3 style="margin:0">Détails</h3>
    </div>

    <div class="details-filter-bar">
      <div class="detail-chips" id="detailChips">
        ${[
          { key: "matin",           label: "Matin",           cats: ["matin","tlt matin","tlt agence matin"] },
          { key: "midi",            label: "Midi",            cats: ["midi","tlt midi","tlt agence midi"] },
          { key: "aprem",           label: "Aprem",           cats: ["aprem","tlt aprem","tlt agence aprem"] },
          { key: "soir",            label: "Soir",            cats: ["soir","tlt soir","tlt agence soir"] },
          { key: "journees-vertes", label: "Journées vertes", cats: ["agence matin","agence midi","agence aprem","agence soir"] },
          { key: "samedi",          label: "Samedi",          cats: ["samedi"] },
        ].map(h => `<button class="detail-chip" data-chip="${h.key}" data-cats='${JSON.stringify(h.cats)}' onclick="toggleDetailChip(this)">${h.label}</button>`).join("")}
      </div>
      <select id="detailCatFilter" class="detail-select" onchange="filterDetails()">
        <option value="">Toutes catégories</option>
        ${[...new Set(days.flatMap(day => d.details[day].map(e => e.categorie)))]
          .filter(cat => !["Matin","Midi","Aprem","Soir","TLT Matin","TLT Midi","TLT APREM","TLT Soir","TLT Agence Matin","TLT Agence Midi","TLT Agence APREM","TLT Agence Soir","ApremRenf"].includes(cat))
          .sort().map(cat => `<option value="${cat}">${cat}</option>`).join("")}
      </select>
      <select id="detailMonthFilter" class="detail-select" onchange="filterDetails()">
        <option value="">Tous les mois</option>
        ${[...new Set(days.map(day => day.slice(0,7)))].sort().reverse()
          .map(m => {
            const label = new Date(m + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
            return `<option value="${m}">${label}</option>`;
          }).join("")}
      </select>
      <span id="detailCount" class="detail-count">${days.length} entrées</span>
    </div>

    <table class="w-full" id="detailTable">
      <thead><tr><th>Date</th><th>Catégorie</th><th>Horaires</th></tr></thead>
      <tbody id="detailBody">
        ${days.map(day => {
          const entries    = d.details[day];
          const catList = [...new Set(entries.map(x => x.categorie))];
          const cats    = catList.join(", ");
          const catsHTML = cats;
          const horaires = entries.map(x => x.horaire).join(", ");
          const safeName = n.replace(/'/g, "\\'");
          const streak   = dayStreakInfo[day];
          const borderStyle = streak
            ? `border-left:3px solid ${streak.color};`
            : 'border-left:3px solid transparent;';
          const badge = streak?.isFirst
            ? `<span class="streak-badge" style="background:${streak.color}22;color:${streak.color};border-color:${streak.color}55">${streak.length}j</span> `
            : '';
          return `
            <tr data-date="${day}" data-cats="${cats.toLowerCase()}" data-month="${day.slice(0,7)}"
                onclick="openDayModal('${safeName}','${day}')" style="${borderStyle}cursor:pointer" title="Voir le détail">
              <td style="font-family:var(--font-mono);font-size:11px">${badge}${new Date(day).toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","")}&nbsp;· ${formatFR(day)}</td>
              <td>${catsHTML}</td>
              <td style="font-family:var(--font-mono);font-size:11px">${horaires}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  lucide.createIcons();
}

function renderPersonConsolidated(n) {
  if (!filtered?.byPerson[n]) return "";
  const d = filtered.byPerson[n];

  const HORAIRES = [
    { label: "Matin",          slots: { "Client": ["Matin"],  "TLT Domicile": ["TLT Matin"],  "TLT Agence": ["TLT Agence Matin"] },  colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" } },
    { label: "Midi",           slots: { "Client": ["Midi"],   "TLT Domicile": ["TLT Midi"],   "TLT Agence": ["TLT Agence Midi"]  },  colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" } },
    { label: "Aprem",          slots: { "Client": ["Aprem"],  "TLT Domicile": ["TLT APREM"],  "TLT Agence": ["TLT Agence APREM"] },  colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" } },
    { label: "Soir",           slots: { "Client": ["Soir"],   "TLT Domicile": ["TLT Soir"],   "TLT Agence": ["TLT Agence Soir"]  },  colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" } },
    { label: "Journées verte", slots: { "Agence": ["ApsideMatin","ApsideMidi","ApsideAPREM","ApsideSoir"] },                  colors: { "Agence": "#34D399" } },
  ];

  const rows = HORAIRES.map(({ label, slots, colors: slotColors }) => {
    const counts = {};
    for (const type in slots) counts[type] = 0;
    for (const day in d.details)
      for (const [type, cats] of Object.entries(slots)) {
        const count = d.details[day].filter(e => cats.includes(e.categorie)).length;
        if (count === 1) counts[type] += 0.5;
        else if (count >= 2) counts[type] += 1;
      }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return null;

    const fmtV = v => Number.isInteger(v) ? v : v.toFixed(1);
    const bars = Object.entries(counts).filter(([, v]) => v > 0)
      .map(([type, v]) => `<div class="repartition-bar-seg" style="width:${Math.round(v/total*100)}%;background:${slotColors[type]}" title="${type} : ${v}j"></div>`).join("");
    const legend = Object.entries(counts).filter(([, v]) => v > 0)
      .map(([type, v]) => `<span class="rep-legend-item"><span class="rep-dot" style="background:${slotColors[type]}"></span><span>${type}</span><span class="rep-val">${fmtV(v)}j</span></span>`).join("");

    return `
      <div class="repartition-row">
        <div class="rep-label">${label}</div>
        <div class="rep-right">
          <div class="rep-total">${fmtV(total)}j</div>
          <div class="repartition-bar-track">${bars}</div>
          <div class="rep-legend">${legend}</div>
        </div>
      </div>`;
  }).filter(Boolean).join("");

  const sam = filtered.byCategory?.samedi?.persons[n];
  const samRow = sam ? `
    <div class="repartition-row">
      <div class="rep-label">Samedi</div>
      <div class="rep-right">
        <div class="rep-total">${sam.days.size}j</div>
        <div class="repartition-bar-track"><div class="repartition-bar-seg" style="width:100%;background:#F472B6"></div></div>
        <div class="rep-legend"><span class="rep-legend-item"><span class="rep-dot" style="background:#F472B6"></span><span>Travaillé</span><span class="rep-val">${sam.days.size}j</span></span></div>
      </div>
    </div>` : "";

  return rows || samRow
    ? `<div class="repartition-block">${rows}${samRow}</div>`
    : `<div style="color:var(--text-subtle);font-size:11px">Aucune donnée</div>`;
}

/* ============================================================
   VUE CATÉGORIE CONSOLIDÉE
   ============================================================ */

function renderConsolidatedCategory(key, cats) {
  document.getElementById("chartsBlock").style.display = "none";

  const SUBTYPES = {
    CONS_MATIN:  { "Client": ["Matin"],  "TLT Domicile": ["TLT Matin"],  "TLT Agence": ["TLT Agence Matin"] },
    CONS_MIDI:   { "Client": ["Midi"],   "TLT Domicile": ["TLT Midi"],   "TLT Agence": ["TLT Agence Midi"]  },
    CONS_APREM:  { "Client": ["Aprem"],  "TLT Domicile": ["TLT APREM"],  "TLT Agence": ["TLT Agence APREM"] },
    CONS_SOIR:   { "Client": ["Soir"],   "TLT Domicile": ["TLT Soir"],   "TLT Agence": ["TLT Agence Soir"]  },
    CONS_AGENCE: { "Agence": ["ApsideMatin","ApsideMidi","ApsideAPREM","ApsideSoir"] },
  };
  const COLORS   = { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" };
  const subtypes = SUBTYPES[key];
  const arr      = [];

  for (const p in filtered.byPerson) {
    let days = 0;
    const sub = subtypes ? Object.fromEntries(Object.keys(subtypes).map(k => [k, 0])) : null;

    for (const day in filtered.byPerson[p].details) {
      const count = filtered.byPerson[p].details[day].filter(e => cats.includes(e.categorie)).length;
      if (count === 1) days += 0.5;
      if (count >= 2) days += 1;
      if (subtypes)
        for (const [type, typeCats] of Object.entries(subtypes))
          if (filtered.byPerson[p].details[day].some(e => typeCats.includes(e.categorie)))
            sub[type]++;
    }
    if (days > 0) arr.push([p, days, sub]);
  }

  arr.sort((a, b) => b[1] - a[1]);

  const renderSubBar = sub => {
    if (!sub || key === "CONS_AGENCE") return "";
    const total = Object.values(sub).reduce((a, b) => a + b, 0);
    if (total === 0) return "";
    const bars   = Object.entries(sub).filter(([, v]) => v > 0).map(([type, v]) => `<div class="repartition-bar-seg" style="width:${Math.round(v/total*100)}%;background:${COLORS[type]}" title="${type} : ${v}j"></div>`).join("");
    const legend = Object.entries(sub).filter(([, v]) => v > 0).map(([type, v]) => `<span class="rep-legend-item"><span class="rep-dot" style="background:${COLORS[type]}"></span><span>${type}</span><span class="rep-val">${v}j</span></span>`).join("");
    return `<div class="repartition-bar-track" style="margin-top:3px">${bars}</div><div class="rep-legend">${legend}</div>`;
  };

  els.center.innerHTML = `
    <h2>${consolidatedMap[key].label}</h2>
    <table class="w-full">
      <thead><tr><th>#</th><th>Personne</th><th>Jours</th></tr></thead>
      <tbody>
        ${arr.map(([p, days, sub], i) => `
          <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
            <td class="rank-cell">${i + 1}</td>
            <td><div>${p}</div>${renderSubBar(sub)}</td>
            <td>${Number.isInteger(days) ? days : days.toFixed(1)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

/* ============================================================
   VUE SAMEDI
   ============================================================ */

function renderSamediCategory() {
  document.getElementById("chartsBlock").style.display = "none";

  const persons = filtered.byCategory?.samedi?.persons;
  if (!persons || !Object.keys(persons).length) {
    els.center.innerHTML = `<div class="text-slate-400">Aucune donnée pour les samedis</div>`;
    return;
  }

  const arr = Object.entries(persons).map(([p, v]) => [p, v.days.size]).sort((a, b) => b[1] - a[1]);

  els.center.innerHTML = `
    <h2>Samedis travaillés</h2>
    <table class="w-full">
      <thead><tr><th>#</th><th>Personne</th><th>Jours</th></tr></thead>
      <tbody>
        ${arr.map(([p, jours], i) => `
          <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
            <td class="rank-cell">${i + 1}</td><td>${p}</td><td>${jours}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

/* ============================================================
   VUE CATÉGORIE NORMALE
   ============================================================ */

function renderCategory(cat) {
  document.getElementById("chartsBlock").style.display = "none";

  if (!filtered) { els.center.innerHTML = "Aucune donnée"; return; }

  const arr = [];
  for (const p in filtered.byPerson) {
    const days = new Set();
    for (const day in filtered.byPerson[p].details)
      filtered.byPerson[p].details[day].forEach(e => { if (e.categorie === cat) days.add(day); });
    if (days.size > 0) arr.push([p, days.size]);
  }

  arr.sort((a, b) => b[1] - a[1]);

  els.center.innerHTML = `
    <h2>
      <span style="display:inline-flex;align-items:center;gap:8px">
        <span class="color-dot" style="background:${colors[cat]}"></span>${cat}
      </span>
    </h2>
    <table class="w-full">
      <thead><tr><th>#</th><th>Personne</th><th>Jours</th></tr></thead>
      <tbody>
        ${arr.map(([p, jours], i) => `
          <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
            <td class="rank-cell">${i + 1}</td><td>${p}</td><td>${jours}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

/* ============================================================
   HIGHLIGHT SIDEBAR
   ============================================================ */

function highlight(type, name) {
  document.querySelectorAll(`#${type}List .sidebar-item`).forEach(el => el.classList.remove("active"));
  document.querySelector(`#${type}List .sidebar-item[data-name="${name}"]`)?.classList.add("active");
}

/* ============================================================
   NAVIGATION SPA
   ============================================================ */

export function navigate(state, replace = false) {
  let hash = '';
  if (state?.view === 'planning')      hash = '#planning';
  else if (state?.view === 'person')   hash = `#person/${state.name}`;
  else if (state?.view === 'cat')      hash = `#cat/${state.name}`;

  if (replace) history.replaceState(state, "", hash || '#');
  else         history.pushState(state, "", hash || '#');
  renderState(state);
}

function setActiveNav(view) {
  document.getElementById("viewGlobal")?.classList.toggle("active", view !== "planning");
  document.getElementById("viewPlanning")?.classList.toggle("active", view === "planning");
}

export function renderState(state) {
  const planningView  = document.getElementById("planningView");
  const dashboardView = document.getElementById("dashboardView");

  if (!state) {
    dashboardView.style.display = "block";
    planningView.style.display  = "none";
    renderGlobal();
    updateCharts();
    return;
  }

  setActiveNav(state.view);

  switch (state.view) {
    case "planning":
      dashboardView.style.display = "none";
      planningView.classList.add("active");
      planningView.style.display = "flex";
      document.querySelectorAll(".sidebar-item").forEach(el => el.classList.remove("active"));
      renderPlanning();
      break;

    case "global":
      planningView.style.display = "none";
      planningView.classList.remove("active");
      dashboardView.style.display = "block";
      document.querySelectorAll(".sidebar-item").forEach(el => el.classList.remove("active"));
      renderGlobal();
      updateCharts();
      break;

    case "person":
      planningView.style.display = "none";
      planningView.classList.remove("active");
      dashboardView.style.display = "block";
      document.querySelectorAll("#categoryList .sidebar-item").forEach(el => el.classList.remove("active"));
      renderPerson(state.name);
      highlight("person", state.name);
      break;

    case "cat":
      planningView.style.display = "none";
      planningView.classList.remove("active");
      dashboardView.style.display = "block";
      document.querySelectorAll("#personList .sidebar-item").forEach(el => el.classList.remove("active"));
      if (consolidatedMap[state.name])   renderConsolidatedCategory(state.name, consolidatedMap[state.name].cats);
      else if (state.name === "samedi")  renderSamediCategory();
      else { computeFiltered(); renderCategory(state.name); updateCharts(); }
      highlight("category", state.name);
      break;
  }
}

window.addEventListener("popstate", e => {
  computeFiltered();
  renderState(e.state);
});

/* ============================================================
   FILTRE DU TABLEAU DE DÉTAILS
   ============================================================ */

export function toggleDetailChip(btn) {
  const wasActive = btn.classList.contains("active");
  document.querySelectorAll("#detailChips .detail-chip").forEach(c => c.classList.remove("active"));
  if (!wasActive) btn.classList.add("active");
  filterDetails();
}

export function filterDetails() {
  const catVal   = document.getElementById("detailCatFilter")?.value  || "";
  const monthVal = document.getElementById("detailMonthFilter")?.value || "";
  const activeChip = document.querySelector("#detailChips .detail-chip.active");
  const chipKey    = activeChip?.dataset.chip || "";
  const chipCats   = activeChip ? JSON.parse(activeChip.dataset.cats) : [];
  const JOURNEES_VERTES = new Set(["agence matin","agence midi","agence aprem","agence soir"]);

  let visible = 0;
  document.querySelectorAll("#detailBody tr").forEach(tr => {
    const trCats  = tr.dataset.cats || "";
    const trDate  = tr.dataset.date || "";
    const isSat   = new Date(trDate).getDay() === 6;

    let matchChip = true;
    if (chipKey === "samedi")               matchChip = isSat;
    else if (chipKey === "journees-vertes") matchChip = [...JOURNEES_VERTES].some(c => trCats.includes(c));
    else if (chipCats.length > 0)           matchChip = chipCats.some(c => trCats.includes(c));

    const show = matchChip && (!catVal || trCats.includes(catVal.toLowerCase())) && (!monthVal || tr.dataset.month === monthVal);
    tr.style.display = show ? "" : "none";
    if (show) visible++;
  });

  const countEl = document.getElementById("detailCount");
  if (countEl) countEl.textContent = `${visible} entrée${visible > 1 ? "s" : ""}`;
}

/* ============================================================
   SÉLECTION PERSONNE / CATÉGORIE
   ============================================================ */

export function selPerson(n) {
  closeAllDrawers();
  navigate({ view: "person", name: n });
}

export function selCat(c) {
  closeAllDrawers();
  navigate({ view: "cat", name: c });
}

/* ============================================================
   INTERACTIONS
   ============================================================ */

psearch.oninput = renderLists;

document.getElementById("viewGlobal").onclick = () => {
  closeAllDrawers();
  navigate({ view: "global" });
};

document.getElementById("viewPlanning").onclick = () => {
  closeAllDrawers();
  navigate({ view: "planning" });
};

document.getElementById("filterActive").onchange = () => {
  computeFiltered();
  renderLists();
  navigate({ view: "global" });
};

document.getElementById("refresh").onclick = () => {
  computeFiltered();
  renderLists();
  renderState(history.state);
};
