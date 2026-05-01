/* ============================================================
   CHARTS.JS — Graphiques ApexCharts + KPIs tableau de bord
   ============================================================ */

import { filtered, colors } from './data.js';

let chartDonut = null;

/* ============================================================
   GROUPES DE LIEUX
   ============================================================ */

const LIEU_GROUPS = {
  "Chez le client":       { cats: ["Matin","Midi","Aprem","Soir"],                                                                    color: "#6366F1" },
  "Télétravail domicile": { cats: ["TLT Matin","TLT Midi","TLT APREM","TLT Soir"],                                                   color: "#22D3EE" },
  "Télétravail agence":   { cats: ["TLT Agence Matin","TLT Agence Midi","TLT Agence APREM","TLT Agence Soir","ApremRenf"],            color: "#A78BFA" },
  "À l'agence":           { cats: ["Agence Matin","Agence Midi","Agence APREM","Agence Soir"],                                        color: "#34D399" }
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

export function computeKPIs() {
  const TLT_CATS = new Set([
    "TLT Matin","TLT Midi","TLT APREM","TLT Soir",
    "TLT Agence Matin","TLT Agence Midi","TLT Agence APREM","TLT Agence Soir","ApremRenf"
  ]);
  const WORK_CATS = new Set([
    "Matin","Midi","Aprem","Soir",
    "TLT Matin","TLT Midi","TLT APREM","TLT Soir",
    "TLT Agence Matin","TLT Agence Midi","TLT Agence APREM","TLT Agence Soir","ApremRenf",
    "Agence Matin","Agence Midi","Agence APREM","Agence Soir",
    "Pilote","PiloteBO","MatinW11","SoirW11","Formation","Astreinte"
  ]);

  let totalWorkDays = 0, tltDays = 0;
  const personDays = {};

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
  const topPerson = Object.entries(personDays).sort((a, b) => b[1] - a[1])[0] || null;

  return { nbPersons, totalWorkDays, tauxTlt, topPerson };
}

/* ============================================================
   GRAPHIQUES
   ============================================================ */

export function updateCharts() {
  if (!filtered) return;
  const block = document.getElementById("chartsBlock");
  if (!block || block.style.display === "none") return;

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
              fontSize: "11px", fontFamily: "'DM Sans', sans-serif", color: c.text,
              formatter: w => w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString("fr-FR"),
            },
            value: {
              fontSize: "18px", fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", color: c.strong,
              formatter: v => Number(v).toLocaleString("fr-FR"),
            }
          }
        }
      }
    },
    legend: {
      position: "bottom", fontSize: "11px", fontFamily: "'DM Sans', sans-serif",
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

/* ============================================================
   HTML DU TABLEAU DE BORD (KPIs + table)
   Appelé depuis renderGlobal() dans ui.js
   ============================================================ */

export function getDashboardHTML(rows, colorsArg) {
  const kpi     = computeKPIs();
  const fs      = document.getElementById("filterStart").value;
  const fe      = document.getElementById("filterEnd").value;
  const fmtD    = d => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const periode = fs && fe ? `${fmtD(fs)} → ${fmtD(fe)}` : "—";
  const tltColor = kpi.tauxTlt >= 50 ? "#22D3EE" : kpi.tauxTlt >= 30 ? "#A78BFA" : "#6366F1";

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
            : `<span class="color-dot" style="display:inline-block;background:${colorsArg[cat] || '#94A3B8'}"></span>`;
          return `
          <tr class="tr-link" onclick="selCat('${catKey}')" title="Voir ${cat}">
            <td>${cat}</td><td>${dot}</td><td>${jours}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}
