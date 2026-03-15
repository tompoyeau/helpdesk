/* ============================================================
   CHARTS.JS — Graphiques ApexCharts + KPIs tableau de bord

   Dépend de : filtered, colors (data.js)
   Éléments DOM : #chartsBlock, #center (via renderGlobal)
   ============================================================ */

let chartDonut = null; // Instance donut "répartition lieux"
let chartBar   = null; // Instance bar "activité mensuelle"


/* ============================================================
   GROUPES DE LIEUX
   Regroupe les catégories brutes en familles lisibles.
   ============================================================ */

const LIEU_GROUPS = {
  "Chez le client":       { cats: ["Matin","Midi","APREM","Soir"],                              color: "#6366F1" },
  "Télétravail domicile": { cats: ["TLTDOMMatin","TLTDOMMidi","TLTDOMAPREM","TLTDOMSoir"],      color: "#22D3EE" },
  "Télétravail agence":   { cats: ["TLTMatin","TLTMidi","TLTAPREM","TLTSoir","ApremRenf"],      color: "#A78BFA" },
  "À l'agence":           { cats: ["ApsideMatin","ApsideMidi","ApsideAPREM","ApsideSoir"],      color: "#34D399" }
};


/* ============================================================
   CALCULS AGRÉGÉS
   ============================================================ */

function computeByLieu() {
  const result = {};
  for (const [label, { cats, color }] of Object.entries(LIEU_GROUPS)) {
    const personDays = new Set();
    for (const p in filtered.byPerson)
      for (const day in filtered.byPerson[p].details)
        if (filtered.byPerson[p].details[day].some(e => cats.includes(e.categorie)))
          personDays.add(`${p}|${day}`);
    if (personDays.size > 0)
      result[label] = { count: personDays.size, color };
  }
  return result;
}

function computeByMonth() {
  const ABSENCE_CATS = new Set(["CP","Indisponible","Récup"]);
  const byMonth = {};
  for (const p in filtered.byPerson)
    for (const day in filtered.byPerson[p].details) {
      const hasWork = filtered.byPerson[p].details[day].some(e => !ABSENCE_CATS.has(e.categorie));
      if (!hasWork) continue;
      const month = day.slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    }
  return byMonth;
}

function computeKPIs() {
  const TLT_CATS = new Set([
    "TLTDOMMatin","TLTDOMMidi","TLTDOMAPREM","TLTDOMSoir",
    "TLTMatin","TLTMidi","TLTAPREM","TLTSoir","ApremRenf"
  ]);
  const WORK_CATS = new Set([
    "Matin","Midi","APREM","Soir",
    "TLTDOMMatin","TLTDOMMidi","TLTDOMAPREM","TLTDOMSoir",
    "TLTMatin","TLTMidi","TLTAPREM","TLTSoir","ApremRenf",
    "ApsideMatin","ApsideMidi","ApsideAPREM","ApsideSoir",
    "Pilote","PiloteBO","Formation","Astreinte"
  ]);

  let totalWorkDays = 0, tltDays = 0;
  const personDays  = {};

  for (const p in filtered.byPerson) {
    const days = new Set();
    for (const day in filtered.byPerson[p].details) {
      const entries = filtered.byPerson[p].details[day];
      const hasWork = entries.some(e => WORK_CATS.has(e.categorie));
      const hasTlt  = entries.some(e => TLT_CATS.has(e.categorie));
      if (hasWork) { days.add(day); totalWorkDays++; }
      if (hasTlt)  tltDays++;
    }
    if (days.size > 0) personDays[p] = days.size;
  }

  const nbPersons = Object.keys(personDays).length;
  const tauxTlt   = totalWorkDays > 0 ? Math.round(tltDays / totalWorkDays * 100) : 0;
  const topPerson = Object.entries(personDays).sort((a,b) => b[1]-a[1])[0] || null;

  return { nbPersons, totalWorkDays, tauxTlt, topPerson };
}


/* ============================================================
   GRAPHIQUES
   ============================================================ */

function updateCharts() {
  if (!filtered) return;
  const block = document.getElementById("chartsBlock");
  if (!block || block.style.display === "none") return;

  // Crée les conteneurs si absents
  if (!document.getElementById("chartDonutEl")) {
    block.innerHTML = `
      <div class="chart-card" style="grid-column:1/-1">
        <p class="chart-title">Répartition par lieu</p>
        <div id="chartDonutEl"></div>
      </div>`;
  }

  _renderDonut();
}

function _isDark() {
  return document.documentElement.classList.contains("dark");
}

function _chartColors() {
  return {
    text:    _isDark() ? "#7275A8" : "#8A8DBF",
    grid:    _isDark() ? "#252745" : "#E8ECF2",
    surface: _isDark() ? "#1E2038" : "#FFFFFF",
    strong:  _isDark() ? "#D8DAF8" : "#2B2D6E",
  };
}

function _renderDonut() {
  const byLieu = computeByLieu();
  if (!Object.keys(byLieu).length) return;

  const labels = Object.keys(byLieu);
  const series = labels.map(l => byLieu[l].count);
  const clrs   = labels.map(l => byLieu[l].color);
  const c      = _chartColors();

  const opts = {
    chart: {
      type: "donut", height: 240,
      background: "transparent",
      animations: { enabled: true, speed: 500 },
      toolbar: { show: false },
    },
    series, labels, colors: clrs,
    dataLabels: {
      enabled: true,
      formatter: (val) => Math.round(val) + "%",
      style: { fontSize: "11px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 },
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true, label: "Total",
              fontSize: "11px",
              fontFamily: "'DM Sans', sans-serif",
              color: c.text,
              formatter: w => w.globals.seriesTotals.reduce((a,b) => a+b, 0).toLocaleString("fr-FR"),
            },
            value: {
              fontSize: "18px", fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              color: c.strong,
              formatter: v => Number(v).toLocaleString("fr-FR"),
            }
          }
        }
      }
    },
    legend: {
      position: "bottom", fontSize: "11px",
      fontFamily: "'DM Sans', sans-serif",
      labels: { colors: c.text },
      markers: { width: 8, height: 8, radius: 3 },
      itemMargin: { horizontal: 6, vertical: 2 },
    },
    tooltip: {
      style: { fontSize: "12px", fontFamily: "'DM Sans', sans-serif" },
      y: { formatter: v => `${v.toLocaleString("fr-FR")} jours` },
    },
    stroke: { width: 2, colors: [_isDark() ? "#1E2038" : "#FFFFFF"] },
    theme: { mode: _isDark() ? "dark" : "light" },
  };

  if (chartDonut) { chartDonut.updateOptions(opts, true); }
  else { chartDonut = new ApexCharts(document.getElementById("chartDonutEl"), opts); chartDonut.render(); }
}

function _renderBar() {
  const el = document.getElementById("chartBarEl");
  if (!el) return;

  const PODIUM_CATS = {
    "Matin":  { cats: ["Matin","TLTDOMMatin","TLTMatin"],    color: "#6366F1", icon: "🌅" },
    "Midi":   { cats: ["Midi","TLTDOMMidi","TLTMidi"],       color: "#22D3EE", icon: "☀️"  },
    "Aprem":  { cats: ["APREM","TLTDOMAPREM","TLTAPREM"],    color: "#A78BFA", icon: "🌤️" },
    "Soir":   { cats: ["Soir","TLTDOMSoir","TLTSoir"],       color: "#34D399", icon: "🌙" },
    "Samedi": { cats: null,                                   color: "#F472B6", icon: "📅" },
  };

  const getRanking = (label, cats) => {
    if (label === "Samedi") {
      const persons = filtered.byCategory?.samedi?.persons || {};
      return Object.entries(persons)
        .map(([p, v]) => [p, v.days.size])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    }
    const scores = {};
    for (const p in filtered.byPerson)
      for (const day in filtered.byPerson[p].details) {
        const count = filtered.byPerson[p].details[day].filter(e => cats.includes(e.categorie)).length;
        if (count === 1) scores[p] = (scores[p] || 0) + 0.5;
        if (count >= 2) scores[p] = (scores[p] || 0) + 1;
      }
    return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 3);
  };

  const medals = [
    { icon: "🥇", bg: "rgba(255,196,0,0.13)",   color: "#A07800" },
    { icon: "🥈", bg: "rgba(150,155,175,0.13)",  color: "#60637A" },
    { icon: "🥉", bg: "rgba(175,100,45,0.11)",   color: "#7A4020" },
  ];

  const cards = Object.entries(PODIUM_CATS).map(([label, { cats, color, icon }]) => {
    const top3 = getRanking(label, cats);
    const max  = top3[0]?.[1] || 1;

    const rows = top3.length
      ? top3.map(([p, d], i) => {
          const short = p.split(" ").map((w, j) => j === 0 ? w : w[0] + ".").join(" ");
          const val   = Number.isInteger(d) ? d : d.toFixed(1);
          const pct   = Math.round(d / max * 100);
          const m     = medals[i];
          return `
            <div class="hcard-row">
              <span class="hcard-medal" style="background:${m.bg};color:${m.color}">${m.icon}</span>
              <div class="hcard-info">
                <div class="hcard-name" title="${p}">${short}</div>
                <div class="hcard-bar-track">
                  <div class="hcard-bar-fill" style="width:${pct}%;background:${color}"></div>
                </div>
              </div>
              <span class="hcard-days" style="color:${color}">${val}j</span>
            </div>`;
        }).join("")
      : `<div class="hcard-empty">Aucune donnée</div>`;

    return `
      <div class="hcard">
        <div class="hcard-header">
          <span class="hcard-icon">${icon}</span>
          <span class="hcard-label" style="color:${color}">${label}</span>
        </div>
        ${rows}
      </div>`;
  }).join("");

  el.innerHTML = `<div class="hcard-grid">${cards}</div>`;
}


/* ============================================================
   HTML DU TABLEAU DE BORD (KPIs + table)
   Appelé depuis renderGlobal() dans ui.js
   ============================================================ */

function getDashboardHTML(rows, colors) {
  const kpi    = computeKPIs();
  const fs     = document.getElementById("filterStart").value;
  const fe     = document.getElementById("filterEnd").value;
  const fmtD   = d => new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
  const periode = fs && fe ? `${fmtD(fs)} → ${fmtD(fe)}` : "—";

  const tltColor = kpi.tauxTlt >= 50 ? "#22D3EE" : kpi.tauxTlt >= 30 ? "#A78BFA" : "#6366F1";
  const topName  = kpi.topPerson ? kpi.topPerson[0] : "—";
  const topDays  = kpi.topPerson ? kpi.topPerson[1] : 0;
  const topShort = topName !== "—" && topName.length > 15 ? topName.split(" ")[0] : topName;

  return `
    <div class="kpi-grid">

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(99,102,241,0.1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Collaborateurs</span>
          <span class="kpi-value">${kpi.nbPersons}</span>
          <span class="kpi-sub">actifs sur la période</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(34,211,238,0.1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Jours-présence</span>
          <span class="kpi-value">${kpi.totalWorkDays.toLocaleString("fr-FR")}</span>
          <span class="kpi-sub">${periode}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(167,139,250,0.12)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Taux télétravail</span>
          <span class="kpi-value" style="color:${tltColor}">${kpi.tauxTlt}%</span>
          <span class="kpi-sub">des jours travaillés</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(244,114,182,0.1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Top collaborateur</span>
          <span class="kpi-value" style="font-size:14px" title="${topName}">${topShort}</span>
          <span class="kpi-sub">${topDays} jours</span>
        </div>
      </div>

    </div>

    <h3>Détail par catégorie</h3>
    <table class="w-full">
      <thead>
        <tr><th>Catégorie</th><th></th><th>Jours</th></tr>
      </thead>
      <tbody>
        ${rows.map(([cat, jours]) => {
          const catKey = cat === "Samedi" ? "samedi" : cat;
          const dot    = cat === "Samedi"
            ? `<span class="color-dot" style="display:inline-block;background:#818CF8"></span>`
            : `<span class="color-dot" style="display:inline-block;background:${colors[cat] || '#94A3B8'}"></span>`;
          return `
          <tr class="tr-link" onclick="selCat('${catKey}')" title="Voir ${cat}">
            <td>${cat}</td><td>${dot}</td><td>${jours}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}


/* ============================================================
   STUBS (non utilisés mais gardés pour compatibilité)
   ============================================================ */
function updateKPIs()  {}
function updatePodium(){}