let planning = null;
let persons = [];
let categories = [];
let colors = {};
let filtered = null;
let activePersons = null;

const els = {
  fs: document.getElementById("filterStart"),
  fe: document.getElementById("filterEnd"),
  fc: { value: "" },
  mode: { value: "jours" },
  limit: { value: 10 },
  center: document.getElementById("center"),
  podium: document.getElementById("podium"),
  kpiP: document.getElementById("kpiPeriod"),
  kpiD: document.getElementById("kpiDays"),
  kpiS: document.getElementById("kpiSlots"),
  kpiT: document.getElementById("kpiTopCategory")
};

function setDefaultRange() {
  const t = new Date(), p = new Date();
  p.setFullYear(t.getFullYear() - 1);
  els.fs.value = p.toISOString().slice(0, 10);
  els.fe.value = t.toISOString().slice(0, 10);
}

function loadFilter() {
  const saved = localStorage.getItem("activePersons");
  if (saved) activePersons = JSON.parse(saved);
}

async function autoLoad() {
  setDefaultRange();
  loadFilter();

  try {
    const r = await fetch("planning_enrichi.json", { cache: "no-store" });
    if (r.ok) {
      planning = await r.json();
      const foCheckbox = document.getElementById("filterActive");
      activePersons = foCheckbox.checked ? detectActivePersons() : null;
      initData();
      computeFiltered();
      renderLists();
      renderGlobal();
      updateCharts();
      return;
    }
  } catch { }


  els.center.innerHTML = `<div class="p-4 bg-yellow-50 border text-yellow-900">Aucun fichier planning détecté</div>`;
}

function initData() {
  persons = Object.keys(planning).sort();
  const set = new Set(), col = {};

  for (const p in planning)
    for (const d in planning[p])
      planning[p][d].forEach(e => {
        set.add(e.categorie);
        if (!col[e.categorie]) col[e.categorie] = e.couleur;
      });

  categories = [...set].sort();
  colors = col;

  els.fc.innerHTML = `<option value="">Toutes</option>` +
    categories.map(c => `<option>${c}</option>`).join("");
}

function applyPersonFilter() {
  if (!activePersons) return persons;
  return persons.filter(p => activePersons.includes(p));
}

function detectActivePersons() {
  const fs = els.fs.value;
  const fe = els.fe.value;

  const actives = new Set();

  for (const p in planning) {
    for (const d in planning[p]) {
      if (d >= fs && d <= fe && planning[p][d].length > 0) {
        actives.add(p);
      }
    }
  }

  return [...actives].sort();
}

function saveFilter() {
  localStorage.setItem("activePersons", JSON.stringify(activePersons));
}

function computeFiltered() {
  const fs = els.fs.value, fe = els.fe.value, fc = els.fc.value;

  const byCat = {}, byMonth = {}, byPerson = {}, byDay = new Set();
  let slots = 0;

  const list = applyPersonFilter();

  for (const p of list)
    for (const d in planning[p]) {
      if (fs && d < fs) continue;
      if (fe && d > fe) continue;

      planning[p][d].forEach(e => {
        if (fc && e.categorie !== fc) return;

        byCat[e.categorie] = (byCat[e.categorie] || 0) + 1;

        const m = d.slice(0, 7);
        byMonth[m] = (byMonth[m] || 0) + 1;

        byPerson[p] = byPerson[p] || { slots: 0, days: new Set(), details: {} };
        byPerson[p].slots++;
        byPerson[p].days.add(d);
        (byPerson[p].details[d] = byPerson[p].details[d] || []).push(e);

        byDay.add(d);
        slots++;
      });
    }

  filtered = { byCat, byMonth, byPerson, byDay, totalSlots: slots };
  // --- Catégorie spéciale : Samedi (hors astreinte) ---
filtered.byCategory = filtered.byCategory || {};
filtered.byCategory["samedi"] = { slots: 0, d: new Set(), persons: {} };

for (const p in filtered.byPerson) {
  const details = filtered.byPerson[p].details;

  for (const day in details) {
    const date = new Date(day);
    const isSaturday = date.getDay() === 6;

    if (!isSaturday) continue;

    // Exclure l'astreinte
    const entries = details[day].filter(e =>
      !e.categorie.toLowerCase().includes("astreinte")
    );

    if (entries.length === 0) continue;

    // Ajout global
    filtered.byCategory["samedi"].slots += entries.length;
    filtered.byCategory["samedi"].d.add(day);

    // Ajout par personne
    if (!filtered.byCategory["samedi"].persons[p]) {
      filtered.byCategory["samedi"].persons[p] = { slots: 0, days: new Set() };
    }

    filtered.byCategory["samedi"].persons[p].slots += entries.length;
    filtered.byCategory["samedi"].persons[p].days.add(day);
  }
}

}

document.addEventListener("DOMContentLoaded", autoLoad);

document.getElementById("filterActive").onclick = () => {
  activePersons = detectActivePersons();
  saveFilter();
  renderLists();
  computeFiltered();
  renderGlobal();
  updateCharts();
};