/* ============================================================
   MAIN.JS — Point d'entrée unique de l'application
   Séquence :
     DOMContentLoaded
       → autoLoad()          [data.js]  — charge Firestore
       → computeFiltered()   [data.js]  — agrège selon la plage de dates
       → renderLists()       [ui.js]    — peuple les sidebars
       → renderGlobal()      [ui.js]    — affiche le tableau de bord
       → updateCharts()      [charts.js]— rend le donut
       → initNavigation()             — gère l'URL hash initiale
   ============================================================ */

import { autoLoad, computeFiltered } from './data.js';
import {
  renderLists, renderGlobal, renderState, navigate,
  closeAllDrawers, closeDateSheet,
  selPerson, selCat,
  toggleDetailChip, filterDetails
} from './ui.js';
import { updateCharts } from './charts.js';
import { toggleFavorite, openDayModal, closeDayModal } from './planning.js';

/* ============================================================
   GLOBALS — requis par les onclick générés dynamiquement dans le HTML
   ============================================================ */

window.closeAllDrawers  = closeAllDrawers;
window.closeDateSheet   = closeDateSheet;
window.selPerson        = selPerson;
window.selCat           = selCat;
window.toggleDetailChip = toggleDetailChip;
window.filterDetails    = filterDetails;
window.toggleFavorite   = toggleFavorite;
window.openDayModal     = openDayModal;
window.closeDayModal    = closeDayModal;

/* ============================================================
   NAVIGATION INITIALE — lit le hash de l'URL au démarrage
   ============================================================ */

function initNavigation() {
  const hash = window.location.hash;
  if (hash.startsWith('#person/'))      navigate({ view: "person", name: decodeURIComponent(hash.replace('#person/', '')) }, true);
  else if (hash.startsWith('#cat/'))    navigate({ view: "cat",    name: decodeURIComponent(hash.replace('#cat/', ''))    }, true);
  else                                  navigate({ view: "planning" }, true);

  window.addEventListener('hashchange', () => {
    const h = window.location.hash;
    if (h === '#planning')             navigate({ view: "planning" }, true);
    else if (h.startsWith('#person/')) navigate({ view: "person", name: decodeURIComponent(h.replace('#person/', '')) }, true);
    else if (h.startsWith('#cat/'))    navigate({ view: "cat",    name: decodeURIComponent(h.replace('#cat/', ''))    }, true);
    else                               navigate({ view: "global" }, true);
  });
}

/* ============================================================
   DÉMARRAGE
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await autoLoad();

  if (!ok) return; // Erreur affichée par autoLoad dans #center

  computeFiltered();
  renderLists();
  renderGlobal();
  updateCharts();
  initNavigation();
});
