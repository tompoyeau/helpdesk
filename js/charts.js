/* ============================================================
   CHARTS.JS — Graphiques ApexCharts (en attente d'implémentation)

   Ce fichier est réservé aux graphiques de l'interface.
   Les fonctions ci-dessous sont appelées depuis ui.js et data.js
   mais leur contenu sera développé dans une prochaine itération.

   Variables attendues depuis data.js : filtered, colors
   Éléments DOM attendus : #chartCategories, #chartMonths
   ============================================================ */

let chartCat   = null; // Instance ApexCharts du graphique "par catégorie"
let chartMonth = null; // Instance ApexCharts du graphique "par mois"


/* Rafraîchit les deux graphiques selon les données filtrées courantes */
function updateCharts() {
  // À implémenter : donut par catégorie + barre par mois
}

/* Met à jour les indicateurs clés (KPI) en haut de page */
function updateKPIs() {
  // À implémenter : période, nb jours, nb créneaux, top catégorie
}

/* Affiche le podium des 5 collaborateurs les plus actifs sur une catégorie */
function updatePodium() {
  // À implémenter : dépend de la catégorie sélectionnée (currentCategory)
}