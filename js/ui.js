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
    CONS_MATIN:  { label: "Matin",           cats: ["Matin", "TLTDOMMatin", "TLTMatin"] },
    CONS_MIDI:   { label: "Midi",            cats: ["Midi", "TLTDOMMidi", "TLTMidi"] },
    CONS_APREM:  { label: "Aprem",           cats: ["APREM", "TLTDOMAPREM", "TLTAPREM"] },
    CONS_SOIR:   { label: "Soir",            cats: ["Soir", "TLTDOMSoir", "TLTSoir"] },
    CONS_AGENCE: { label: "Journées verte", cats: ["ApsideMatin", "ApsideMidi", "ApsideAPREM", "ApsideSoir"] },
  };

  /* ============================================================
     RESPONSIVE — DRAWERS & BOTTOM SHEET
     ============================================================ */

  function openDrawer(side) {
    const el  = document.getElementById(side === "left" ? "sidebarLeft" : "sidebarRight");
    const bck = document.getElementById("drawerBackdrop");
    el.classList.add("open");
    bck.classList.add("open");
    // Recrée les icônes Lucide dans le drawer
    lucide.createIcons();
  }

  function closeAllDrawers() {
    document.getElementById("sidebarLeft").classList.remove("open");
    document.getElementById("sidebarRight").classList.remove("open");
    document.getElementById("drawerBackdrop").classList.remove("open");
  }

  function openDateSheet() {
    // Synchronise les valeurs du sheet avec les inputs desktop
    document.getElementById("filterStartMobile").value = els.fs.value;
    document.getElementById("filterEndMobile").value   = els.fe.value;
    document.getElementById("dateSheet").classList.add("open");
    document.getElementById("sheetBackdrop").classList.add("open");
  }

  function closeDateSheet() {
    document.getElementById("dateSheet").classList.remove("open");
    document.getElementById("sheetBackdrop").classList.remove("open");
  }

  // Boutons header mobile
  document.getElementById("btnOpenLeft").onclick  = () => openDrawer("left");
  document.getElementById("btnOpenRight").onclick = () => openDrawer("right");
  document.getElementById("btnDateSheet").onclick = openDateSheet;

  // Bouton Appliquer du sheet mobile → sync vers inputs desktop puis refresh
  document.getElementById("refreshMobile").onclick = () => {
    els.fs.value = document.getElementById("filterStartMobile").value;
    els.fe.value = document.getElementById("filterEndMobile").value;
    closeDateSheet();
    computeFiltered();
    renderLists();
    renderState(history.state);
  };

  // Fermer drawers avec la touche Échap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeAllDrawers(); closeDateSheet(); }
  });

  // Exposer les fonctions drawer globalement (appelées depuis onclick HTML)
  window.closeAllDrawers = closeAllDrawers;
  window.closeDateSheet  = closeDateSheet;

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
              ([key, obj]) => {
                const dotColor = key === "CONS_AGENCE" ? "#34D399" : "var(--accent)";
                return `
            <li class="sidebar-item" data-name="${key}" onclick="selCat('${key}')">
              <div class="flex items-center gap-2">
                <div class="color-dot" style="background:${dotColor};opacity:0.8"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${obj.label}</span>
              </div>
            </li>
          `;}
            )
            .join("")}
          ${hasSamedi ? `
            <li class="sidebar-item" data-name="samedi" onclick="selCat('samedi')">
              <div class="flex items-center gap-2">
                <div class="color-dot" style="background:#60A5FA;opacity:0.8"></div>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">Samedi</span>
              </div>
            </li>` : ""}
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

    const rows = Object.keys(filtered.byCat)
      .map((cat) => [cat, countDays(cat)])
      .sort((a, b) => b[1] - a[1]);

    const sam = filtered.byCategory?.samedi;
    if (sam) rows.push(["Samedi", sam.d.size]);

    els.center.innerHTML = getDashboardHTML(rows, colors);
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

    // Agrégation par catégorie brute — avec demi-journées (1 entrée = 0.5j, 2+ = 1j)
    // Exception : CP et Indisponible = journée entière (1 entrée = 1j)
    const FULL_DAY_CATS = new Set(["CP", "Indisponible", "Récup"]);
    const byCat = {};
    for (const day in d.details) {
      const catCounts = {};
      d.details[day].forEach(e => {
        catCounts[e.categorie] = (catCounts[e.categorie] || 0) + 1;
      });
      for (const [cat, count] of Object.entries(catCounts)) {
        const val = FULL_DAY_CATS.has(cat) ? 1 : (count === 1 ? 0.5 : 1);
        byCat[cat] = (byCat[cat] || 0) + val;
      }
    }

    const rows = Object.entries(byCat)
      .map(([cat, jours]) => [cat, jours])
      .sort((a, b) => b[1] - a[1]);

    const days = Object.keys(d.details).sort().reverse();

    // --- Calcul des stats (demi-journées) ---
    const TLT_CATS  = new Set(["TLTDOMMatin","TLTDOMMidi","TLTDOMAPREM","TLTDOMSoir","TLTMatin","TLTMidi","TLTAPREM","TLTSoir","ApremRenf"]);
    const CLI_CATS  = new Set(["Matin","Midi","APREM","Soir","Formation","PiloteBO"]);
    const WORK_CATS = new Set([...TLT_CATS, ...CLI_CATS, "ApsideMatin","ApsideMidi","ApsideAPREM","ApsideSoir","Pilote","PiloteBO","Astreinte"]);

    let workDays = 0, tltDays = 0, clientDays = 0, cpDays = 0;

    for (const day in d.details) {
      const entries  = d.details[day];
      const workCount   = entries.filter(e => WORK_CATS.has(e.categorie)).length;
      const tltCount    = entries.filter(e => TLT_CATS.has(e.categorie)).length;
      const clientCount = entries.filter(e => CLI_CATS.has(e.categorie)).length;
      const cpCount     = entries.filter(e => e.categorie === "CP").length;

      const toDay = c => c === 1 ? 0.5 : c >= 2 ? 1 : 0;
      workDays   += toDay(workCount);
      tltDays    += toDay(tltCount);
      clientDays += toDay(clientCount);
      if (cpCount > 0 && new Date(day).getDay() !== 6)
        cpDays += 1; // CP = journée entière, pas de demi-journée
    }

    const tauxTlt    = workDays > 0 ? Math.round(tltDays / workDays * 100) : 0;
    const tauxClient = workDays > 0 ? Math.round(clientDays / workDays * 100) : 0;
    const firstDay   = days[days.length - 1];
    const lastDay    = days[0];

    const fmtJ = v => Number.isInteger(v) ? v : v.toFixed(1);
    const tltColor = tauxTlt >= 50 ? "#22D3EE" : tauxTlt >= 30 ? "#A78BFA" : "#6366F1";

    const statCards = [
      { label: "Jours travaillés", value: fmtJ(workDays),    sub: `${firstDay ? formatFR(firstDay) : "—"} → ${lastDay ? formatFR(lastDay) : "—"}`, color: "#6366F1", icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` },
      { label: "Taux TLT",         value: tauxTlt + "%",     sub: `${fmtJ(tltDays)}j en télétravail`,    color: tltColor,  icon: `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>` },
      { label: "Taux client",      value: tauxClient + "%",  sub: `${fmtJ(clientDays)}j chez le client`, color: "#34D399", icon: `<path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>` },
      { label: "CP",               value: fmtJ(cpDays),      sub: `jours de congés`,                     color: "#94A3B8", icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>` },
    ];

    const statsHTML = `
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
      </div>`;

    const initials = n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

    els.center.innerHTML = `
      <div class="person-header">
        <div class="person-avatar-lg">${initials}</div>
        <div>
          <h2 style="margin-bottom:2px">${n}</h2>
          <span class="person-period">${workDays} jours · ${days.length > 0 ? formatFR(firstDay) + " → " + formatFR(lastDay) : "—"}</span>
        </div>
      </div>

      ${statsHTML}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" style="margin-top:20px">
        <div>
          <h3>Par catégorie</h3>
          <table class="w-full">
            <thead><tr><th>Catégorie</th><th>Jours</th></tr></thead>
            <tbody>
              ${rows.map(([cat, jours]) => `
                <tr class="tr-link" onclick="selCat('${cat}')" title="Voir la catégorie ${cat}">
                  <td>
                    <div style="display:flex;align-items:center;gap:7px">
                      <span class="color-dot" style="display:inline-block;background:${colors[cat]}"></span>
                      ${cat}
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

        <!-- Chips horaires consolidés -->
        <div class="detail-chips" id="detailChips">
          ${[
            { key: "matin",          label: "Matin",           cats: ["matin","tltdommatin","tltmatin"] },
            { key: "midi",           label: "Midi",            cats: ["midi","tltdommidi","tltmidi"] },
            { key: "aprem",          label: "Aprem",           cats: ["aprem","tltdomaprem","tltaprem"] },
            { key: "soir",           label: "Soir",            cats: ["soir","tltdomsoir","tltsoir"] },
            { key: "journees-vertes",label: "Journées vertes", cats: ["apsidématin","apsidemidi","apsideaprem","apsidesoir"] },
            { key: "samedi",         label: "Samedi",          cats: ["samedi"] },
          ].map(h => `<button class="detail-chip" data-chip="${h.key}" data-cats='${JSON.stringify(h.cats)}' onclick="toggleDetailChip(this)">${h.label}</button>`).join("")}
        </div>

        <!-- Select autres catégories (hors horaires consolidés) -->
        <select id="detailCatFilter" class="detail-select" onchange="filterDetails()">
          <option value="">Toutes catégories</option>
          ${[...new Set(days.flatMap(day => d.details[day].map(e => e.categorie)))]
            .filter(cat => !["Matin","Midi","APREM","Soir","TLTDOMMatin","TLTDOMMidi","TLTDOMAPREM","TLTDOMSoir","TLTMatin","TLTMidi","TLTAPREM","TLTSoir","ApremRenf"].includes(cat))
            .sort()
            .map(cat => `<option value="${cat}">${cat}</option>`).join("")}
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
        <thead>
          <tr><th>Date</th><th>Catégorie</th><th>Horaires</th></tr>
        </thead>
        <tbody id="detailBody">
          ${days.map((day) => {
            const entries = d.details[day];
            const cats    = [...new Set(entries.map(x => x.categorie))].join(", ");
            const horaires = entries.map(x => x.horaire).join(", ");
            return `
              <tr data-date="${day}" data-cats="${cats.toLowerCase()}" data-month="${day.slice(0,7)}">
                <td style="font-family:var(--font-mono);font-size:11px">${new Date(day).toLocaleDateString("fr-FR", { weekday:"short" }).replace(".","")}&nbsp;· ${formatFR(day)}</td>
                <td>${cats}</td>
                <td style="font-family:var(--font-mono);font-size:11px">${horaires}</td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;

    lucide.createIcons();
  }

  /* Génère la répartition TLT / Client / TLT Agence par horaire */
  function renderPersonConsolidated(n) {
    if (!filtered?.byPerson[n]) return "";

    const d = filtered.byPerson[n];

    const HORAIRES = [
      {
        label: "Matin",
        slots: {
          "Client":       ["Matin"],
          "TLT Domicile": ["TLTDOMMatin"],
          "TLT Agence":   ["TLTMatin"],
        },
        colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" }
      },
      {
        label: "Midi",
        slots: {
          "Client":       ["Midi"],
          "TLT Domicile": ["TLTDOMMidi"],
          "TLT Agence":   ["TLTMidi"],
        },
        colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" }
      },
      {
        label: "Aprem",
        slots: {
          "Client":       ["APREM"],
          "TLT Domicile": ["TLTDOMAPREM"],
          "TLT Agence":   ["TLTAPREM"],
        },
        colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" }
      },
      {
        label: "Soir",
        slots: {
          "Client":       ["Soir"],
          "TLT Domicile": ["TLTDOMSoir"],
          "TLT Agence":   ["TLTSoir"],
        },
        colors: { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" }
      },
      {
        label: "Journées verte",
        slots: {
          "Agence": ["ApsideMatin", "ApsideMidi", "ApsideAPREM", "ApsideSoir"],
        },
        colors: { "Agence": "#34D399" }
      },
    ];

    const rows = HORAIRES.map(({ label, slots, colors }) => {
      // Compte les jours par type avec logique demi-journée
      const counts = {};
      for (const type in slots) counts[type] = 0;

      for (const day in d.details) {
        for (const [type, cats] of Object.entries(slots)) {
          const count = d.details[day].filter(e => cats.includes(e.categorie)).length;
          if (count === 1) counts[type] += 0.5;
          else if (count >= 2) counts[type] += 1;
        }
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total === 0) return null;

      const fmtV = v => Number.isInteger(v) ? v : v.toFixed(1);

      // Barres de répartition
      const bars = Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([type, v]) => {
          const pct = Math.round(v / total * 100);
          return `<div class="repartition-bar-seg" style="width:${pct}%;background:${colors[type]}" title="${type} : ${v}j (${pct}%)"></div>`;
        }).join("");

      // Légende inline
      const legend = Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([type, v]) => `
          <span class="rep-legend-item">
            <span class="rep-dot" style="background:${colors[type]}"></span>
            <span>${type}</span>
            <span class="rep-val">${fmtV(v)}j</span>
          </span>`).join("");

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
          <div class="repartition-bar-track">
            <div class="repartition-bar-seg" style="width:100%;background:#F472B6"></div>
          </div>
          <div class="rep-legend">
            <span class="rep-legend-item">
              <span class="rep-dot" style="background:#F472B6"></span>
              <span>Travaillé</span>
              <span class="rep-val">${sam.days.size}j</span>
            </span>
          </div>
        </div>
      </div>` : "";

    return rows || samRow
      ? `<div class="repartition-block">${rows}${samRow}</div>`
      : `<div style="color:var(--text-subtle);font-size:11px">Aucune donnée</div>`;
  }

  /* ============================================================
     VUE CATÉGORIE CONSOLIDÉE
     Classement de tous les collaborateurs pour un horaire consolidé
     (Matin, Midi, Aprem ou Soir).
     ============================================================ */

  function renderConsolidatedCategory(key, cats) {
    document.getElementById("chartsBlock").style.display = "none";

    // Définition des sous-types par horaire consolidé
    const SUBTYPES = {
      CONS_MATIN:  { "Client": ["Matin"], "TLT Domicile": ["TLTDOMMatin"], "TLT Agence": ["TLTMatin"] },
      CONS_MIDI:   { "Client": ["Midi"],  "TLT Domicile": ["TLTDOMMidi"],  "TLT Agence": ["TLTMidi"]  },
      CONS_APREM:  { "Client": ["APREM"],"TLT Domicile": ["TLTDOMAPREM"], "TLT Agence": ["TLTAPREM"] },
      CONS_SOIR:   { "Client": ["Soir"],  "TLT Domicile": ["TLTDOMSoir"],  "TLT Agence": ["TLTSoir"]  },
      CONS_AGENCE: { "Agence": ["ApsideMatin","ApsideMidi","ApsideAPREM","ApsideSoir"] },
    };
    const COLORS = { "Client": "#6366F1", "TLT Domicile": "#22D3EE", "TLT Agence": "#A78BFA" };
    const subtypes = SUBTYPES[key];

    const arr = [];

    for (const p in filtered.byPerson) {
      let days = 0;
      const sub = subtypes ? Object.fromEntries(Object.keys(subtypes).map(k => [k, 0])) : null;

      for (const day in filtered.byPerson[p].details) {
        const count = filtered.byPerson[p].details[day].filter((e) =>
          cats.includes(e.categorie),
        ).length;
        if (count === 1) days += 0.5;
        if (count >= 2) days += 1;

        if (subtypes) {
          for (const [type, typeCats] of Object.entries(subtypes)) {
            if (filtered.byPerson[p].details[day].some(e => typeCats.includes(e.categorie)))
              sub[type]++;
          }
        }
      }
      if (days > 0) arr.push([p, days, sub]);
    }

    arr.sort((a, b) => b[1] - a[1]);

    const renderSubBar = (sub) => {
      if (!sub) return "";
      if (key === "CONS_AGENCE") return ""; // Pas de répartition pour les journées vertes
      const total = Object.values(sub).reduce((a, b) => a + b, 0);
      if (total === 0) return "";
      const bars = Object.entries(sub).filter(([, v]) => v > 0)
        .map(([type, v]) => `<div class="repartition-bar-seg" style="width:${Math.round(v/total*100)}%;background:${COLORS[type]}" title="${type} : ${v}j"></div>`).join("");
      const legend = Object.entries(sub).filter(([, v]) => v > 0)
        .map(([type, v]) => `<span class="rep-legend-item"><span class="rep-dot" style="background:${COLORS[type]}"></span><span>${type}</span><span class="rep-val">${v}j</span></span>`).join("");
      return `<div class="repartition-bar-track" style="margin-top:3px">${bars}</div><div class="rep-legend">${legend}</div>`;
    };

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
          ${arr.map(([p, days, sub], i) => `
            <tr class="tr-link" onclick="selPerson('${p}')" title="Voir ${p}">
              <td class="rank-cell">${i + 1}</td>
              <td>
                <div>${p}</div>
                ${renderSubBar(sub)}
              </td>
              <td>${Number.isInteger(days) ? days : days.toFixed(1)}</td>
            </tr>
          `).join("")}
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
    // Utilise des hash pour GitHub Pages (compatible)
    let hash = '';
    if (state?.view === 'planning') {
      hash = '#planning';
    } else if (state?.view === 'person') {
      hash = `#person/${state.name}`;
    } else if (state?.view === 'cat') {
      hash = `#cat/${state.name}`;
    }
    
    if (replace) {
      history.replaceState(state, "", hash || '#');
    } else {
      history.pushState(state, "", hash || '#');
    }
    renderState(state);
  }

  /** Restaure une vue à partir d'un objet state. */
  function renderState(state) {
    // Masque toutes les vues
    const planningView = document.getElementById("planningView");
    const dashboardView = document.getElementById("dashboardView");
    
    if (!state) { 
      dashboardView.style.display = "block";
      planningView.style.display = "none";
      renderGlobal(); 
      updateCharts(); 
      return; 
    }

    switch (state.view) {
      case "planning":
        dashboardView.style.display = "none";
        planningView.classList.add("active");
        planningView.style.display = "flex";
        document.querySelectorAll(".sidebar-item").forEach(el => el.classList.remove("active"));
        if (typeof renderPlanning === 'function') {
          renderPlanning();
        }
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
     FILTRE DU TABLEAU DE DÉTAILS (vue collaborateur)
     ============================================================ */

  function toggleDetailChip(btn) {
    const wasActive = btn.classList.contains("active");
    // Désactive tous les chips
    document.querySelectorAll("#detailChips .detail-chip").forEach(c => c.classList.remove("active"));
    // Réactive uniquement si ce n'était pas déjà actif (toggle off)
    if (!wasActive) btn.classList.add("active");
    filterDetails();
  }

  function filterDetails() {
    const catVal   = document.getElementById("detailCatFilter")?.value || "";
    const monthVal = document.getElementById("detailMonthFilter")?.value || "";

    const activeChip = document.querySelector("#detailChips .detail-chip.active");
    const chipKey    = activeChip?.dataset.chip || "";
    const chipCats   = activeChip ? JSON.parse(activeChip.dataset.cats) : [];

    const rows = document.querySelectorAll("#detailBody tr");
    let visible = 0;

    const JOURNEES_VERTES = new Set(["apsidématin","apsidemidi","apsideaprem","apsidesoir","apsidematin"]);

    rows.forEach(tr => {
      const trCats  = tr.dataset.cats  || "";
      const trDate  = tr.dataset.date  || "";
      const isSat   = new Date(trDate).getDay() === 6;

      let matchChip = true;
      if (chipKey === "samedi") {
        matchChip = isSat;
      } else if (chipKey === "journees-vertes") {
        matchChip = [...JOURNEES_VERTES].some(c => trCats.includes(c));
      } else if (chipCats.length > 0) {
        matchChip = chipCats.some(c => trCats.includes(c));
      }

      const matchCat   = !catVal   || trCats.includes(catVal.toLowerCase());
      const matchMonth = !monthVal || tr.dataset.month === monthVal;
      const show = matchChip && matchCat && matchMonth;
      tr.style.display = show ? "" : "none";
      if (show) visible++;
    });

    const countEl = document.getElementById("detailCount");
    if (countEl) countEl.textContent = `${visible} entrée${visible > 1 ? "s" : ""}`;
  }

  /* ============================================================
     ACTIONS : SÉLECTION D'UN COLLABORATEUR
     ============================================================ */

  function selPerson(n) {
    closeAllDrawers();
    navigate({ view: "person", name: n });
  }

  /* ============================================================
     ACTIONS : SÉLECTION D'UNE CATÉGORIE
     Aiguille vers la bonne vue selon le type de catégorie.
     ============================================================ */

  function selCat(c) {
    closeAllDrawers();
    navigate({ view: "cat", name: c });
  }

  /* ============================================================
     INTERACTIONS
     ============================================================ */

  // Recherche en temps réel dans la liste des collaborateurs
  psearch.oninput = renderLists;

  // Bouton "Tableau de bord" : retour à la vue globale
  document.getElementById("viewGlobal").onclick = () => {
    closeAllDrawers();
    navigate({ view: "global" });
  };

  // Bouton "Planning" : aller vers la vue planning
  document.getElementById("viewPlanning").onclick = () => {
    closeAllDrawers();
    navigate({ view: "planning" });
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
  // Vérifie si on doit afficher le planning via l'URL hash
  const initialHash = window.location.hash;
  if (initialHash === '#planning') {
    navigate({ view: "planning" }, true);
  } else if (initialHash.startsWith('#person/')) {
    const name = decodeURIComponent(initialHash.replace('#person/', ''));
    navigate({ view: "person", name }, true);
  } else if (initialHash.startsWith('#cat/')) {
    const name = decodeURIComponent(initialHash.replace('#cat/', ''));
    navigate({ view: "cat", name }, true);
  } else {
    navigate({ view: "global" }, true);
  }

  // Écoute les changements de hash
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#planning') {
      navigate({ view: "planning" }, true);
    } else if (hash.startsWith('#person/')) {
      const name = decodeURIComponent(hash.replace('#person/', ''));
      navigate({ view: "person", name }, true);
    } else if (hash.startsWith('#cat/')) {
      const name = decodeURIComponent(hash.replace('#cat/', ''));
      navigate({ view: "cat", name }, true);
    } else {
      navigate({ view: "global" }, true);
    }
  });

} // fin du guard