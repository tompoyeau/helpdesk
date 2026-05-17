# Helio — Dashboard de planning d'équipe

Application web interne de pilotage du planning et des statistiques d'activité.

## Stack technique

| Couche | Techno |
|--------|--------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| État | Pinia |
| Routeur | Vue Router 5 |
| Backend | Firebase (Auth + Firestore) |
| Style | Tailwind CSS v4 + design system `src/assets/main.css` |
| Graphiques | ApexCharts (`vue3-apexcharts`) |
| Build | Vite 8 |
| PWA | `vite-plugin-pwa` — installable sur mobile et desktop |

---

## Lancer le projet

```sh
npm install      # installer les dépendances
npm run dev      # serveur de développement (http://localhost:5173/helpdesk/)
npm run build    # build de production → dist/
```

---

## Architecture des stores Pinia

```
authStore       → Session Firebase (connexion / déconnexion)
userStore       → Rôle et liste des collaborateurs  (Firestore: personnes/)
dataStore       → Données planning filtrées + calculs stats  (Firestore: planning/)
adminStore      → CRUD planning admin (écriture Firestore)
forecastStore   → Import Excel prévisionnel BO / ETP
uiStore         → État visuel (dark mode, drawers mobiles, vue active)
notifStore      → Notifications temps réel par utilisateur
```

**Cycle de vie (App.vue) :**
1. `auth.init()` → attend que Firebase confirme la session
2. Si connecté → `userStore.loadUser()` + `data.init()` + `notifStore.subscribe()`
3. Si déconnecté → `data.cleanup()` + `notifStore.cleanup()` + `userStore.reset()`

---

## Structure des vues et composants

```
src/
├── views/
│   ├── PlanningView.vue      → Planning semaine (grille collaborateurs)
│   ├── DashboardView.vue     → Tableau de bord (graphiques + stats globales)
│   ├── PersonView.vue        → Fiche détaillée d'un collaborateur
│   ├── CatView.vue           → Détail d'une catégorie d'activité
│   └── AdminView.vue         → Interface admin (planning, collaborateurs, forecast)
│
├── components/
│   ├── layout/
│   │   ├── AppHeader.vue         → En-tête sticky : nav desktop, dark mode, notifs
│   │   ├── SidebarLeft.vue       → Menu + liste collaborateurs (drawer sur mobile)
│   │   ├── SidebarRight.vue      → Détail contextuel personne/catégorie
│   │   ├── BottomNav.vue         → Navigation mobile fixe (Teleport sur body)
│   │   ├── DateRangePicker.vue   → Sélecteur de période (filtre global des données)
│   │   └── NotificationBell.vue  → Cloche + dropdown notifications temps réel
│   │
│   ├── planning/
│   │   ├── PlanningWeek.vue      → Grille semaine complète
│   │   ├── PlanningRow.vue       → Ligne d'un collaborateur (créneaux colorés)
│   │   ├── WeekPicker.vue        → Sélecteur de semaine (navigation ←/→)
│   │   └── DayModal.vue          → Modal clic sur un créneau (détail du jour)
│   │
│   ├── dashboard/
│   │   ├── ChartsBlock.vue       → Graphique donut répartition lieux
│   │   ├── GlobalStats.vue       → Tableau stats tous collaborateurs
│   │   ├── PersonDetail.vue      → KPI + timeline activités + export ICS agenda
│   │   └── CatDetail.vue         → Liste personnes/dates pour une catégorie
│   │
│   └── admin/
│       ├── AdminPlanning.vue       → Recherche + édition du planning
│       ├── AdminCollaborateurs.vue → CRUD collaborateurs
│       ├── AdminForecast.vue       → Import Excel prévisionnel BO
│       ├── DayEditorModal.vue      → Modal édition d'une journée (admin)
│       ├── CollaborateurModal.vue  → Modal ajout/édition collaborateur
│       └── WeekPickerModal.vue     → Modal sélection semaine (admin)
```

---

## Structure Firestore

```
personnes/{uid}
  → { nom, prenom, email, isAdmin }
  → notifications/{id} : { title, message, createdAt, read }

planning/{annee-semaine}/{collaborateur}/{date}
  → tableau de créneaux : [{ categorie, horaire, couleur, slots }]
```

Le mapping code activité → catégorie/couleur est défini dans `src/stores/dataStore.js` (`ACTIVITY_MAPPING`).

---

## Icônes PWA

Les icônes se trouvent dans `public/`. Pour les regénérer après modification du logo :

```bash
node scripts/icons/generate-icons.mjs
```

Source SVG : `scripts/icons/icon-source.svg`

---

## Déploiement

L'app est déployée sur **GitHub Pages** à l'URL `/helpdesk/`.

```bash
npm run build   # génère dist/
git push        # déclenche le déploiement automatique
```
