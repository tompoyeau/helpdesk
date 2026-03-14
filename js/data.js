/* ============================================================
   DATA.JS — Chargement, filtrage et calcul des données planning
   Expose les globaux : planning, persons, categories, colors,
   filtered, els, applyPersonFilter, detectActivePersons
   ============================================================ */


/* ============================================================
   ÉTAT GLOBAL
   ============================================================ */

let planning   = null; // Données brutes du JSON
let persons    = [];   // Liste triée des collaborateurs
let categories = [];   // Liste triée des catégories présentes dans le JSON
let colors     = {};   // Map catégorie → couleur hex
let filtered   = null; // Résultat du dernier computeFiltered()


/* ============================================================
   RÉFÉRENCES DOM PARTAGÉES
   ============================================================ */

const els = {
  fs:     document.getElementById("filterStart"), // Input date début
  fe:     document.getElementById("filterEnd"),   // Input date fin
  center: document.getElementById("center")       // Zone de contenu principal
};


/* ============================================================
   INITIALISATION DE LA PLAGE DE DATES PAR DÉFAUT
   Par défaut : 1 an glissant jusqu'à aujourd'hui.
   ============================================================ */

function setDefaultRange() {
  const today      = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  els.fs.value = oneYearAgo.toISOString().slice(0, 10);
  els.fe.value = today.toISOString().slice(0, 10);
}


/* ============================================================
   CHARGEMENT AUTOMATIQUE DU FICHIER PLANNING
   Tente de récupérer planning.json depuis le backend Python.
   En cas d'échec, affiche un message d'erreur dans #center.
   ============================================================ */

async function autoLoad() {
  setDefaultRange();

  try {
    //const r = await fetch("/helpdesk/python/planning.json", { cache: "no-store" });
    const r = await fetch("planning.json", { cache: "no-store" });
    if (r.ok) {
      planning = await r.json();
      initData();
      computeFiltered();
      renderLists();
      renderGlobal();
      updateCharts();
      return;
    }
  } catch { /* Fichier absent ou erreur réseau */ }

  els.center.innerHTML = `<div class="p-4 bg-yellow-50 border text-yellow-900">Aucun fichier planning détecté</div>`;
}


/* ============================================================
   EXTRACTION DES MÉTADONNÉES (personnes, catégories, couleurs)
   Appelée une seule fois après le chargement du JSON.
   ============================================================ */

function initData() {
  persons = Object.keys(planning).sort();

  const catSet = new Set();
  const colMap = {};

  for (const p in planning)
    for (const d in planning[p])
      planning[p][d].forEach(e => {
        catSet.add(e.categorie);
        if (!colMap[e.categorie]) colMap[e.categorie] = e.couleur;
      });

  categories = [...catSet].sort();
  colors     = colMap;
}


/* ============================================================
   FILTRE DES COLLABORATEURS ACTIFS
   Source unique de vérité : lit directement la checkbox.
   Retourne la liste des collaborateurs à inclure (tous si décoché).
   ============================================================ */

function applyPersonFilter() {
  const isChecked = document.getElementById("filterActive").checked;
  if (!isChecked) return persons;
  return detectActivePersons();
}

function detectActivePersons() {
  // Collaborateurs ayant une entrée dans le planning aujourd'hui.
  const today   = new Date().toISOString().slice(0, 10);
  const actives = new Set();

  for (const p in planning)
    if (planning[p][today]?.length > 0)
      actives.add(p);

  return [...actives].sort();
}


/* ============================================================
   CALCUL DES DONNÉES FILTRÉES
   Agrège les entrées du planning selon la plage de dates
   et le filtre de personnes actif.

   Produit filtered :
     - byCat      : { categorie → nb entrées }
     - byMonth    : { "YYYY-MM" → nb entrées }  (réservé pour les graphiques)
     - byPerson   : { personne → { details: { date → [entrées] } } }
     - byCategory : { "samedi" → { d: Set<date>, persons: { personne → { days: Set<date> } } } }
   ============================================================ */

function computeFiltered() {
  const fs = els.fs.value;
  const fe = els.fe.value;

  const byCat = {}, byMonth = {}, byPerson = {};

  for (const p of applyPersonFilter())
    for (const d in planning[p]) {
      if (fs && d < fs) continue;
      if (fe && d > fe) continue;

      planning[p][d].forEach(e => {
        byCat[e.categorie] = (byCat[e.categorie] || 0) + 1;

        byMonth[d.slice(0, 7)] = (byMonth[d.slice(0, 7)] || 0) + 1;

        byPerson[p] = byPerson[p] || { details: {} };
        (byPerson[p].details[d] = byPerson[p].details[d] || []).push(e);
      });
    }

  filtered = { byCat, byMonth, byPerson };

  // --- Catégorie calculée : Samedis travaillés (hors astreinte) ---
  // Stocké dans filtered.byCategory car absent du JSON brut.
  filtered.byCategory = {
    samedi: { d: new Set(), persons: {} }
  };

  for (const p in byPerson) {
    for (const day in byPerson[p].details) {
      if (new Date(day).getDay() !== 6) continue;

      const entries = byPerson[p].details[day].filter(e =>
        !e.categorie.toLowerCase().includes("astreinte")
      );
      if (!entries.length) continue;

      filtered.byCategory.samedi.d.add(day);

      if (!filtered.byCategory.samedi.persons[p])
        filtered.byCategory.samedi.persons[p] = { days: new Set() };

      filtered.byCategory.samedi.persons[p].days.add(day);
    }
  }
}


/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */

document.addEventListener("DOMContentLoaded", autoLoad);