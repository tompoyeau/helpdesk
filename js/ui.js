// Guard contre le double chargement du fichier (ex: hot reload)
if (window.__UI_JS_LOADED__) {
  console.warn("ui.js déjà chargé, on ignore");
} else {
  window.__UI_JS_LOADED__ = true;

  /* ============================================================
     RÉFÉRENCES DOM
     ============================================================ */

  const plist = document.getElementById("personList");
  const clist = document.getElementById("categoryList");
  const psearch = document.getElementById("personSearch");

  /* ============================================================
     DÉFINITION DES GROUPES DE CATÉGORIES
     Utilisés pour la sidebar droite (catégories normales).
     ============================================================ */

  const categoryGroups = {
    "Travail chez le client": ["Matin", "Midi", "APREM", "Soir"],
    "Télétravail au domicile": [
      "TLTDOMMatin",
      "TLTDOMMidi",
      "TLTDOMAPREM",
      "TLTDOMSoir",
    ],
    "Télétravail à l'agence": [
      "TLTMatin",
      "TLTMidi",
      "TLTAPREM",
      "TLTSoir",
      "ApremRenf",
    ],
    "Travail à l'agence": [
      "ApsideMatin",
      "ApsideMidi",
      "ApsideAPREM",
      "ApsideSoir",
    ],
    "Projet / Pilote": ["Pilote", "PiloteBO"],
    Autres: ["Formation", "Indisponible", "Astreinte", "Récup", "CP"],
  };

  /*
   * Horaires consolidés : regroupent plusieurs catégories granulaires
   * sous une même étiquette lisible.
   * Ex: "Matin" = client matin + TLT domicile matin + TLT agence matin
   * Clés préfixées CONS_ pour les distinguer des catégories brutes du JSON.
   */
  const consolidatedMap = {
    CONS_MATIN: { label: "Matin", cats: ["Matin", "TLTDOMMatin", "TLTMatin"] },
    CONS_MIDI: { label: "Midi", cats: ["Midi", "TLTDOMMidi", "TLTMidi"] },
    CONS_APREM: { label: "Aprem", cats: ["APREM", "TLTDOMAPREM", "TLTAPREM"] },
    CONS_SOIR: { label: "Soir", cats: ["Soir", "TLTDOMSoir", "TLTSoir"] },
  };

  /* ============================================================
     INITIALISATION LUCIDE (bibliothèque d'icônes)
     ============================================================ */

  lucide.createIcons();

  /* ============================================================
     MODE SOMBRE
     Bascule la classe "dark" sur <html> et met à jour l'icône.
     ============================================================ */

  const toggleDark = document.getElementById("toggleDark");
  const darkIcon = document.getElementById("darkIcon");

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
     BOUTON REFRESH
     Recalcule les données filtrées et rafraîchit l'interface.
     ============================================================ */

  document.getElementById("refresh").onclick = () => {
    computeFiltered();
    renderLists();
    renderGlobal();
  };

  /* ============================================================
     UTILITAIRE : FORMATAGE DE DATE EN FRANÇAIS
     Exemple : "2026-03-13" → "13 mars 2026"
     ============================================================ */

  function formatFR(dateStr) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* ============================================================
     RENDER LISTES (sidebar gauche + sidebar droite)
     ============================================================ */

  function renderLists() {
    renderPersonList();
    renderCategoryGroups();
  }

  /* --- Sidebar gauche : liste des collaborateurs --- */
  function renderPersonList() {
    plist.innerHTML = applyPersonFilter()
      .filter((n) => n.toLowerCase().includes(psearch.value.toLowerCase()))
      .map(
        (n) => {
          const initials = n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
          return `
          <li class="sidebar-item" data-name="${n}" onclick="selPerson('${n}')">
            <div class="flex items-center gap-2" style="min-width:0">
              <div class="person-avatar">${initials}</div>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px">${n}</span>
            </div>
          </li>
        `;
        },
      )
      .join("");
  }

  /* --- Sidebar droite : horaires consolidés + catégories normales --- */
  function renderCategoryGroups() {
    let html = "";

    // Section "Horaires consolidés" : Matin, Midi, Aprem, Soir + Samedi
    const hasSamedi = filtered.byCategory?.samedi;
    html += `
      <div class="mb-3">
        <span class="cat-group-title">Horaires consolidés</span>
        <ul style="margin-top:2px">
          ${Object.entries(consolidatedMap)
            .map(
              ([key, obj]) => `
            <li class="sidebar-item" data-name="${key}" onclick="selCat('${key}')">
              <div class="flex items-center gap-2">
                <div class="color-dot" style="background:var(--accent);opacity:0.6"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${obj.label}</span>
              </div>
            </li>
          `,
            )
            .join("")}
          ${
            hasSamedi
              ? `
            <li class="sidebar-item" data-name="samedi" onclick="selCat('samedi')">
              <div class="flex items-center gap-2">
                <div class="color-dot" style="background:#60A5FA;opacity:0.8"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">Samedi</span>
              </div>
            </li>
          `
              : ""
          }
        </ul>
      </div>
    `;

    // Sections par groupe de catégories (ex: "Travail chez le client", "Autres"…)
    for (const group in categoryGroups) {
      const items = categoryGroups[group].filter((c) => categories.includes(c));
      if (!items.length) continue;

      html += `
        <div class="mb-3">
          <span class="cat-group-title">${group}</span>
          <ul style="margin-top:2px">
            ${items
              .map(
                (c) => `
              <li class="sidebar-item" data-name="${c}" onclick="selCat('${c}')">
                <div class="flex items-center gap-2">
                  <div class="color-dot" style="background:${colors[c]}"></div>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${c}</span>
                </div>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `;
    }

    clist.innerHTML = html;
  }

  /* ============================================================
     VUE GLOBALE
     Tableau récapitulatif de toutes les catégories, triées par jours.
     ============================================================ */

  function renderGlobal() {
    document.getElementById("chartsBlock").style.display = "grid";

    if (!filtered) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    // Catégories brutes triées par nombre de jours décroissant
    const rows = Object.keys(filtered.byCat)
      .map((cat) => [cat, countDays(cat)])
      .sort((a, b) => b[1] - a[1]);

    // Ajout de la ligne Samedi (catégorie calculée)
    const sam = filtered.byCategory?.samedi;
    if (sam) rows.push(["Samedi", sam.d.size]);

    els.center.innerHTML = `
      <h2>Vue globale</h2>
      <table class="w-full">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Couleur</th>
            <th class="text-right">Jours</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([cat, jours]) => {
                const catKey = cat === "Samedi" ? "samedi" : cat;
                const dot = cat === "Samedi"
                  ? `<span class="color-dot" style="display:inline-block;background:#818CF8"></span>`
                  : `<span class="color-dot" style="display:inline-block;background:${colors[cat]}"></span>`;
                return `
            <tr class="tr-link" onclick="selCat('${catKey}')" title="Voir la catégorie ${cat}">
              <td>${cat}</td>
              <td>${dot}</td>
              <td>${jours}</td>
            </tr>
          `;
              },
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  /* Compte le nombre de jours distincts où une catégorie apparaît */
  function countDays(cat) {
    let count = 0;
    for (const p in filtered.byPerson)
      for (const d in filtered.byPerson[p].details)
        if (filtered.byPerson[p].details[d].some((e) => e.categorie === cat))
          count++;
    return count;
  }

  /* ============================================================
     VUE PERSONNE
     Tableau de synthèse + détail chronologique pour un collaborateur.
     ============================================================ */

  function renderPerson(n) {
    document.getElementById("chartsBlock").style.display = "none";

    if (!filtered?.byPerson[n]) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    const d = filtered.byPerson[n];

    // Agrégation par catégorie brute pour ce collaborateur
    const byCat = {};
    for (const day in d.details)
      d.details[day].forEach((e) => {
        byCat[e.categorie] = byCat[e.categorie] || new Set();
        byCat[e.categorie].add(day);
      });

    const rows = Object.entries(byCat)
      .map(([cat, days]) => [cat, days.size])
      .sort((a, b) => b[1] - a[1]);

    const days = Object.keys(d.details).sort().reverse();

    els.center.innerHTML = `
      <h2>${n}</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        <!-- Tableau par catégorie brute -->
        <div>
          <table class="w-full">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Jours</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  ([cat, jours]) => `
                <tr class="tr-link" onclick="selCat('${cat}')" title="Voir la catégorie ${cat}">
                  <td>
                    <div style="display:flex;align-items:center;gap:7px">
                      <span class="color-dot" style="display:inline-block;background:${colors[cat]}"></span>
                      ${cat}
                    </div>
                  </td>
                  <td>${jours}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Tableau consolidé (Matin/Midi/Aprem/Soir/Samedi) -->
        <div>
          ${renderPersonConsolidated(n)}
        </div>

      </div>

      <!-- Détail chronologique -->
      <h3>Détails</h3>
      <table class="w-full">
        <thead>
          <tr><th>Date</th><th>Catégorie</th><th>Horaires</th></tr>
        </thead>
        <tbody>
          ${days
            .map((day) => {
              const entries = d.details[day];
              return `
              <tr>
                <td style="font-family:var(--font-mono);font-size:11px">${formatFR(day)}</td>
                <td>${[...new Set(entries.map((x) => x.categorie))].join(", ")}</td>
                <td style="font-family:var(--font-mono);font-size:11px">${entries.map((x) => x.horaire).join(", ")}</td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  /* Génère le tableau consolidé (Matin/Midi/Aprem/Soir + Samedi) pour un collaborateur */
  function renderPersonConsolidated(n) {
    if (!filtered?.byPerson[n]) return "";

    const d = filtered.byPerson[n];

    // Calcul des jours par horaire consolidé
    const rows = Object.entries(consolidatedMap).map(([, obj]) => {
      let days = 0;
      for (const day in d.details) {
        const count = d.details[day].filter((e) =>
          obj.cats.includes(e.categorie),
        ).length;
        if (count === 1) days += 0.5; // Demi-journée (un seul créneau)
        if (count >= 2) days += 1; // Journée complète (deux créneaux ou plus)
      }
      return { label: obj.label, days };
    });

    // Ajout de la ligne Samedi si ce collaborateur en a
    const sam = filtered.byCategory?.samedi?.persons[n];
    if (sam) rows.push({ label: "Samedi", days: sam.days.size });

    return `
      <table class="w-full">
        <thead>
          <tr>
            <th>Horaire</th>
            <th>Jours</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td>${r.label}</td>
              <td>${Number.isInteger(r.days) ? r.days : r.days.toFixed(1)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  /* ============================================================
     VUE CATÉGORIE CONSOLIDÉE
     Classement de tous les collaborateurs pour un horaire consolidé
     (Matin, Midi, Aprem ou Soir).
     ============================================================ */

  function renderConsolidatedCategory(key, cats) {
    document.getElementById("chartsBlock").style.display = "none";

    const arr = [];

    for (const p in filtered.byPerson) {
      let days = 0;
      for (const day in filtered.byPerson[p].details) {
        const count = filtered.byPerson[p].details[day].filter((e) =>
          cats.includes(e.categorie),
        ).length;
        if (count === 1) days += 0.5;
        if (count >= 2) days += 1;
      }
      if (days > 0) arr.push([p, days]);
    }

    arr.sort((a, b) => b[1] - a[1]);

    els.center.innerHTML = `
      <h2>${consolidatedMap[key].label}</h2>
      <table class="w-full">
        <thead>
          <tr>
            <th>#</th>
            <th>Personne</th>
            <th>Jours</th>
          </tr>
        </thead>
        <tbody>
          ${arr
            .map(
              ([p, days], i) => `
            <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
              <td class="rank-cell">${i + 1}</td>
              <td>${p}</td>
              <td>${Number.isInteger(days) ? days : days.toFixed(1)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  /* ============================================================
     VUE CATÉGORIE SPÉCIALE : SAMEDI
     Classement des collaborateurs ayant travaillé un samedi
     (hors astreinte). Données issues de filtered.byCategory.samedi.
     ============================================================ */

  function renderSamediCategory() {
    document.getElementById("chartsBlock").style.display = "none";

    const persons = filtered.byCategory?.samedi?.persons;
    if (!persons || !Object.keys(persons).length) {
      els.center.innerHTML = `<div class="text-slate-400">Aucune donnée pour les samedis</div>`;
      return;
    }

    const arr = Object.entries(persons)
      .map(([p, v]) => [p, v.days.size])
      .sort((a, b) => b[1] - a[1]);

    els.center.innerHTML = `
      <h2>Samedis travaillés</h2>
      <table class="w-full">
        <thead>
          <tr>
            <th>#</th>
            <th>Personne</th>
            <th>Jours</th>
          </tr>
        </thead>
        <tbody>
          ${arr
            .map(
              ([p, jours], i) => `
            <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
              <td class="rank-cell">${i + 1}</td>
              <td>${p}</td>
              <td>${jours}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  /* ============================================================
     VUE CATÉGORIE NORMALE
     Classement des collaborateurs pour une catégorie brute du JSON.
     ============================================================ */

  function renderCategory(cat) {
    document.getElementById("chartsBlock").style.display = "none";

    if (!filtered) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    const arr = [];

    for (const p in filtered.byPerson) {
      const days = new Set();
      for (const day in filtered.byPerson[p].details)
        filtered.byPerson[p].details[day].forEach((e) => {
          if (e.categorie === cat) days.add(day);
        });
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
        <thead>
          <tr>
            <th>#</th>
            <th>Personne</th>
            <th>Jours</th>
          </tr>
        </thead>
        <tbody>
          ${arr
            .map(
              ([p, jours], i) => `
            <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
              <td class="rank-cell">${i + 1}</td>
              <td>${p}</td>
              <td>${jours}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  /* ============================================================
     HIGHLIGHT SIDEBAR
     Met en surbrillance l'élément actif dans personList ou categoryList.
     ============================================================ */

  function highlight(type, name) {
    document
      .querySelectorAll(`#${type}List .sidebar-item`)
      .forEach((el) => el.classList.remove("active"));

    document
      .querySelector(`#${type}List .sidebar-item[data-name="${name}"]`)
      ?.classList.add("active");
  }

  /* ============================================================
     NAVIGATION — HISTORIQUE SPA
     Chaque vue est poussée dans history.pushState.
     Le bouton ← natif du navigateur ET un bouton custom
     dans l'interface permettent de revenir en arrière.
     ============================================================ */

  /**
   * Navigue vers un état et le pousse dans l'historique.
   * @param {Object} state  ex: { view:'person', name:'Dupont' }
   * @param {boolean} replace  true = replaceState (pas de nouvel entrée)
   */
  function navigate(state, replace = false) {
    if (replace) {
      history.replaceState(state, "");
    } else {
      history.pushState(state, "");
    }
    renderState(state);
  }

  /** Restaure une vue à partir d'un objet state. */
  function renderState(state) {
    if (!state) { renderGlobal(); updateCharts(); return; }

    switch (state.view) {
      case "global":
        document.querySelectorAll(".sidebar-item").forEach(el => el.classList.remove("active"));
        renderGlobal();
        updateCharts();
        break;
      case "person":
        document.querySelectorAll("#categoryList .sidebar-item").forEach(el => el.classList.remove("active"));
        renderPerson(state.name);
        highlight("person", state.name);
        break;
      case "cat":
        document.querySelectorAll("#personList .sidebar-item").forEach(el => el.classList.remove("active"));
        if (consolidatedMap[state.name]) {
          renderConsolidatedCategory(state.name, consolidatedMap[state.name].cats);
        } else if (state.name === "samedi") {
          renderSamediCategory();
        } else {
          computeFiltered();
          renderCategory(state.name);
          updateCharts();
        }
        highlight("category", state.name);
        break;
    }
  }

  // Écoute le bouton ← natif du navigateur
  window.addEventListener("popstate", (e) => {
    computeFiltered();
    renderState(e.state);
  });


  /* ============================================================
     ACTIONS : SÉLECTION D'UN COLLABORATEUR
     ============================================================ */

  function selPerson(n) {
    navigate({ view: "person", name: n });
  }

  /* ============================================================
     ACTIONS : SÉLECTION D'UNE CATÉGORIE
     Aiguille vers la bonne vue selon le type de catégorie.
     ============================================================ */

  function selCat(c) {
    navigate({ view: "cat", name: c });
  }

  /* ============================================================
     INTERACTIONS
     ============================================================ */

  // Recherche en temps réel dans la liste des collaborateurs
  psearch.oninput = renderLists;

  // Bouton "Tableau de bord" : retour à la vue globale
  document.getElementById("viewGlobal").onclick = () => {
    navigate({ view: "global" });
  };

  // Checkbox "Afficher uniquement les FO actuels"
  document.getElementById("filterActive").onchange = () => {
    computeFiltered();
    renderLists();
    navigate({ view: "global" });
  };

  // Bouton refresh : recalcule et reste sur la vue courante
  document.getElementById("refresh").onclick = () => {
    computeFiltered();
    renderLists();
    renderState(history.state);
  };

  // État initial : remplace le state vide par "global"
  navigate({ view: "global" }, true);

} // fin du guard