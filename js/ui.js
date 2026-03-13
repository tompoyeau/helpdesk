// Empêche tout double chargement du fichier
if (window.__UI_JS_LOADED__) {
  console.warn("ui.js déjà chargé, on ignore");
} else {
  window.__UI_JS_LOADED__ = true;

  /* ============================================================
     VARIABLES GLOBALES
     ============================================================ */

  const plist = document.getElementById("personList");
  const clist = document.getElementById("categoryList");
  const psearch = document.getElementById("personSearch");

  let currentPerson = null;
  let currentCategory = null;
  let activePersons = null;

  /* ============================================================
     GROUPES DE CATÉGORIES 
     ============================================================ */

  const categoryGroups = {
    "Travail chez le client": ["Matin", "Midi", "APREM", "Soir"],
    "Télétravail au domicile": ["TLTDOMMatin", "TLTDOMMidi", "TLTDOMAPREM", "TLTDOMSoir"],
    "Télétravail à l'agence": ["TLTMatin", "TLTMidi", "TLTAPREM", "TLTSoir", "ApremRenf"],
    "Travail à l'agence": ["ApsideMatin", "ApsideMidi", "ApsideAPREM", "ApsideSoir"],
    "Projet / Pilote": ["Pilote", "PiloteBO"],
    "Autres": ["Formation", "Indisponible", "Astreinte", "Récup", "CP"]
  };

  const consolidatedMap = {
    "CONS_MATIN": { label: "Matin", cats: ["Matin", "TLTDOMMatin", "TLTMatin"] },
    "CONS_MIDI": { label: "Midi", cats: ["Midi", "TLTDOMMidi", "TLTMidi"] },
    "CONS_APREM": { label: "Aprem", cats: ["APREM", "TLTDOMAPREM", "TLTAPREM"] },
    "CONS_SOIR": { label: "Soir", cats: ["Soir", "TLTDOMSoir", "TLTSoir"] }
  };

  //bilbiothèque d'icones
  lucide.createIcons();

  /* ============================================================
     Dark mode
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

  //Refresh button
  document.getElementById("refresh").onclick = () => { computeFiltered(); renderLists(); renderGlobal(); };

  // Format des dates global
  function formatFR(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  /* ============================================================
     FILTRAGE COLLABORATEURS ACTIFS 
     ============================================================ */

  function applyPersonFilter() {
    if (!activePersons) return persons;
    return persons.filter(p => activePersons.includes(p));
  }

  function detectActivePersons() {
    const targetDate = "2026-03-12";
    const actives = new Set();

    for (const p in planning) {
      if (planning[p][targetDate] && planning[p][targetDate].length > 0) {
        actives.add(p);
      }
    }

    return [...actives].sort();
  }

  /* ============================================================
     RENDER LISTES
     ============================================================ */

  function renderLists() {
    renderPersonList();
    renderCategoryGroups();
  }

  function renderConsolidatedCategory(key, cats) {
    document.getElementById("chartsBlock").style.display = "none";

    const m = els.mode.value;
    let arr = [];

    for (const p in filtered.byPerson) {
      let slots = 0;
      let days = 0;   // <-- IMPORTANT : un nombre, pas un Set

      for (const day in filtered.byPerson[p].details) {
        const entries = filtered.byPerson[p].details[day]
          .filter(e => cats.includes(e.categorie));

        // --- Demi-journées ---
        if (entries.length === 1) days += 0.5;
        if (entries.length >= 2) days += 1;

        slots += entries.length;
      }

      if (slots > 0) arr.push([p, slots, days]);
    }

    arr.sort((a, b) => m === "jours" ? b[2] - a[2] : b[1] - a[1]);

    els.center.innerHTML = `
    <h2 class="font-semibold mb-2">${consolidatedMap[key].label}</h2>
    <table class="w-full text-xs border rounded">
      <thead class="bg-slate-100">
        <tr>
          <th>#</th>
          <th>Personne</th>
          <th class="text-right">${m === "jours" ? "Jours" : "Créneaux"}</th>
        </tr>
      </thead>
      <tbody>
        ${arr.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r[0]}</td>
            <td class="text-right">${m === "jours"
        ? (Number.isInteger(r[2]) ? r[2] : r[2].toFixed(1))
        : r[1]
      }</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  }

  function renderPersonConsolidated(n) {
    if (!filtered || !filtered.byPerson[n]) return "";

    const d = filtered.byPerson[n];
    const mode = els.mode.value;

    // --- CONSOLIDÉS CLASSIQUES ---
    const rows = Object.entries(consolidatedMap).map(([key, obj]) => {
      let slots = 0;
      let days = 0;

      for (const day in d.details) {
        const entries = d.details[day]
          .filter(e => obj.cats.includes(e.categorie));

        if (entries.length === 1) days += 0.5;
        if (entries.length >= 2) days += 1;

        slots += entries.length;
      }

      return {
        label: obj.label,
        slots,
        days
      };
    });

    // --- AJOUT DE LA CATÉGORIE SPÉCIALE : SAMEDI ---
    const sam = filtered.byCategory?.samedi?.persons[n];
    if (sam) {
      rows.push({
        label: "Samedi",
        slots: sam.slots,
        days: sam.days.size
      });
    }

    return `
    <table class="w-full text-xs border rounded">
      <thead class="bg-slate-100">
        <tr>
          <th>Horaire</th>
          <th class="text-right">${mode === "jours" ? "Jours" : "Créneaux"}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.label}</td>
            <td class="text-right">${mode === "jours" ? r.days : r.slots}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  }


  function renderPersonList() {
    plist.innerHTML = applyPersonFilter()
      .filter(n => n.toLowerCase().includes(psearch.value.toLowerCase()))
      .map(n => `
        <li class="sidebar-item" data-name="${n}" onclick="selPerson('${n}')">
          <div class="flex items-center gap-2">
            <span>👤</span> <span class="truncate max-w-[140px]">${n}</span>
          </div>
        </li>
      `)
      .join("");
  }

  function renderCategoryGroups() {
    let html = "";

    // --- CONSOLIDÉS EN HAUT (+ SAMEDI) ---
    const samedi = filtered.byCategory?.samedi;
    html += `
  <div class="mb-4">
    <h4 class="text-xs font-semibold text-slate-700 mb-2">Horaires consolidés</h4>
    <ul class="space-y-1">
      ${Object.entries(consolidatedMap).map(([key, obj]) => `
          <li class="sidebar-item" data-name="${key}" onclick="selCat('${key}')">
            <div class="flex items-center gap-2">
              <span>📅</span>
              <span class="truncate max-w-[120px]">${obj.label}</span>
            </div>
          </li>
        `).join("")}
      ${samedi ? `
        <li class="sidebar-item" data-name="samedi" onclick="selCat('samedi')">
          <div class="flex items-center gap-2">
            <span>📅</span>
            <span class="truncate max-w-[120px]">Samedi</span>
          </div>
        </li>
      ` : ""}
    </ul>
  </div>
`;



    // --- CATÉGORIES NORMALES ---
    const used = new Set();

    for (const group in categoryGroups) {
      const items = categoryGroups[group].filter(c => categories.includes(c));
      if (!items.length) continue;

      html += `
      <div class="mb-4">
        <h4 class="text-xs font-semibold text-slate-500 mb-2">${group}</h4>
        <ul class="space-y-1">
          ${items.map(c => {
        used.add(c);
        return `
              <li class="sidebar-item" data-name="${c}" onclick="selCat('${c}')">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-sm" style="background:${colors[c]}"></span>
                  <span class="truncate max-w-[120px]">${c}</span>
                </div>
              </li>
            `;
      }).join("")}
        </ul>
      </div>
    `;
    }

    clist.innerHTML = html;
  }


  function renderGlobal() {
    console.log("ko")
    document.getElementById("chartsBlock").style.display = "grid";

    const m = els.mode.value;
    if (!filtered) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    const rows = Object.entries(filtered.byCat)
      .map(([c, s]) => [c, s, countDays(c)])
      .sort((a, b) => b[1] - a[1]);

    els.center.innerHTML = `
      <h2 class="font-semibold mb-2">Vue globale</h2>
      <table class="w-full text-xs border rounded">
        <thead class="bg-slate-100">
          <tr>
            <th>Cat.</th>
            <th>Couleur</th>
            <th class="text-right">${m === "jours" ? "Jours" : "Créneaux"}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r[0]}</td>
              <td><span class="w-3 h-3 inline-block rounded-sm" style="background:${colors[r[0]]}"></span></td>
              <td class="text-right">${m === "jours" ? r[2] : r[1]}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  /* ============================================================
     HIGHLIGHT
     ============================================================ */

  function highlight(type, name) {
    document.querySelectorAll(`#${type}List .sidebar-item`)
      .forEach(el => el.classList.remove("active"));

    const el = document.querySelector(`#${type}List .sidebar-item[data-name="${name}"]`);
    if (el) el.classList.add("active");
  }

  /* ============================================================
     ACTIONS : PERSONNE / CATÉGORIE
     ============================================================ */

  function selPerson(n) {
    currentPerson = n;
    currentCategory = null;
    computeFiltered();
    renderPerson(n);
    updateCharts();
    highlight("person", n);

    // On enlève le highlight catégorie
    document.querySelectorAll("#categoryList .sidebar-item")
      .forEach(el => el.classList.remove("active"));

  }

  function selCat(c) {
    currentCategory = c;
    currentPerson = null;

    // On enlève le highlight personne
    document.querySelectorAll("#personList .sidebar-item")
      .forEach(el => el.classList.remove("active"));


    // --- CONSOLIDÉS ---
    if (consolidatedMap[c]) {
      renderConsolidatedCategory(c, consolidatedMap[c].cats);
      highlight("category", c);
      return;
    }



    // --- CATÉGORIE NORMALE ---
    computeFiltered();
    renderCategory(c);
    updateCharts();
    highlight("category", c);
  }


  /* ============================================================
     VUE GLOBALE
     ============================================================ */

  function renderGlobal() {
    console.log("filtered", filtered);

    document.getElementById("chartsBlock").style.display = "grid";

    const m = els.mode.value;
    if (!filtered) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    // --- CATÉGORIES NORMALES ---
    const rows = Object.entries(filtered.byCat)
      .map(([c, s]) => [c, s, countDays(c)])
      .sort((a, b) => b[1] - a[1]);

    // --- AJOUT DE LA CATÉGORIE SPÉCIALE : SAMEDI ---
    const sam = filtered.byCategory?.samedi;
    if (sam) {
      rows.push([
        "Samedi",
        sam.slots,          // nombre de créneaux
        sam.d.size          // nombre de jours
      ]);
    }

    els.center.innerHTML = `
    <h2 class="font-semibold mb-2">Vue globale</h2>
    <table class="w-full text-xs border rounded">
      <thead class="bg-slate-100">
        <tr>
          <th>Cat.</th>
          <th>Couleur</th>
          <th class="text-right">${m === "jours" ? "Jours" : "Créneaux"}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r[0]}</td>
            <td>
              ${r[0] === "Samedi"
        ? `<span class="w-3 h-3 inline-block rounded-sm bg-blue-400"></span>`
        : `<span class="w-3 h-3 inline-block rounded-sm" style="background:${colors[r[0]]}"></span>`
      }
            </td>
            <td class="text-right">${m === "jours" ? r[2] : r[1]}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

    els.center.innerHTML += renderConsolidatedHours();
  }


  function countDays(cat) {
    if (!filtered) return 0;
    let c = 0;
    for (const p in filtered.byPerson)
      for (const d in filtered.byPerson[p].details)
        if (filtered.byPerson[p].details[d].some(e => e.categorie === cat)) c++;
    return c;
  }

  /* ============================================================
     VUE PERSONNE
     ============================================================ */

  function renderPerson(n) {
    document.getElementById("chartsBlock").style.display = "none";

    const m = els.mode.value;
    if (!filtered || !filtered.byPerson[n]) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    const d = filtered.byPerson[n];

    const byCat = {};
    for (const day in d.details)
      d.details[day].forEach(e => {
        byCat[e.categorie] = byCat[e.categorie] || { s: 0, d: new Set() };
        byCat[e.categorie].s++;
        byCat[e.categorie].d.add(day);
      });

    const rows = Object.entries(byCat)
      .map(([c, v]) => [c, v.s, v.d.size])
      .sort((a, b) => b[1] - a[1]);

    const days = Object.keys(d.details).sort().reverse();

    els.center.innerHTML = `
    <h2 class="font-semibold mb-2">${n}</h2>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <table class="w-full text-xs border rounded">
          <thead class="bg-slate-100">
            <tr>
              <th>Cat.</th>
              <th class="text-right">${m === "jours" ? "Jours" : "Créneaux"}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><span class="w-3 h-3 inline-block rounded-sm mr-1" style="background:${colors[r[0]]}"></span>${r[0]}</td>
                <td class="text-right">${m === "jours" ? r[2] : r[1]}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        ${renderPersonConsolidated(n)}
      </div>
    </div>

    <h3 class="font-semibold mb-2">Détails</h3>
    <table class="w-full text-xs border rounded">
      <thead class="bg-slate-100">
        <tr><th>Date</th><th>Cat.</th><th>Horaires</th></tr>
      </thead>
      <tbody>
        ${days.map(day => {
      const e = d.details[day];
      return `
            <tr>
              <td>${formatFR(day)}</td>
              <td>${[...new Set(e.map(x => x.categorie))].join(", ")}</td>
              <td>${e.map(x => x.horaire).join(", ")}</td>
            </tr>
          `;
    }).join("")}
      </tbody>
    </table>
  `;
  }


  /* ============================================================
     VUE CATÉGORIE
     ============================================================ */

  function renderCategory(cat) {
    document.getElementById("chartsBlock").style.display = "none";

    if (!filtered) {
      els.center.innerHTML = "Aucune donnée";
      return;
    }

    const m = els.mode.value, lim = parseInt(els.limit.value);
    let arr = [];

    for (const p in filtered.byPerson) {
      let s = 0, d = new Set();
      for (const day in filtered.byPerson[p].details)
        filtered.byPerson[p].details[day].forEach(e => {
          if (e.categorie === cat) { s++; d.add(day); }
        });
      if (s > 0) arr.push([p, s, d.size]);
    }

    arr.sort((a, b) => m === "jours" ? b[2] - a[2] : b[1] - a[1]);
    arr = arr.slice(0, lim);

    els.center.innerHTML = `
      <h2 class="font-semibold mb-2">${cat}</h2>
      <table class="w-full text-xs border rounded">
        <thead class="bg-slate-100">
          <tr>
            <th>#</th>
            <th>Personne</th>
            <th class="text-right">${m === "jours" ? "Jours" : "Créneaux"}</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${r[0]}</td>
              <td class="text-right">${m === "jours" ? r[2] : r[1]}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  /* ============================================================
     INTERACTIONS
     ============================================================ */

  psearch.oninput = renderLists;

  document.getElementById("viewGlobal").onclick = () => {
    currentPerson = null;
    currentCategory = null;
    computeFiltered();
    renderGlobal();
    updateCharts();
  };

  document.getElementById("filterActive").onchange = (e) => {
    activePersons = e.target.checked ? detectActivePersons() : null;
    renderLists();
    computeFiltered();
    renderGlobal();
  };

} // fin du guard