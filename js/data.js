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
   CRYPTO — Déchiffrement AES-256-GCM côté navigateur
   Utilise l'API Web Crypto native (aucune dépendance externe).
   ============================================================ */

/** Convertit une chaîne hex en Uint8Array */
function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++)
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

/**
 * Déchiffre le contenu du fichier .enc.json avec le mot de passe fourni.
 * @param {Object} enc  { v, salt, iv, tag, data }
 * @param {string} password
 * @returns {Promise<string>}  Le JSON en clair, ou lève une erreur si mdp incorrect.
 */
async function decryptPlanning(enc, password) {
  const te       = new TextEncoder();
  const saltBytes = hexToBytes(enc.salt);
  const ivBytes   = hexToBytes(enc.iv);
  const tagBytes  = hexToBytes(enc.tag);
  const ctBytes   = Uint8Array.from(atob(enc.data), c => c.charCodeAt(0));

  // AES-GCM attend ciphertext + tag concaténés
  const ctWithTag = new Uint8Array(ctBytes.length + tagBytes.length);
  ctWithTag.set(ctBytes);
  ctWithTag.set(tagBytes, ctBytes.length);

  // Dérivation PBKDF2 → même algo que encrypt.js
  const keyMaterial = await crypto.subtle.importKey(
    "raw", te.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 310_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
    key,
    ctWithTag
  );

  return new TextDecoder().decode(plainBuffer);
}


/* ============================================================
   AUTHENTIFICATION — Écran de login
   ============================================================ */

const SESSION_KEY = "planning_pwd"; // Clé sessionStorage

/** Lance le déchiffrement depuis le mot de passe en session ou via le formulaire. */
async function autoLoad() {
  setDefaultRange();

  // Tente de récupérer le fichier chiffré
  let enc;
  try {
    const r = await fetch("planning.enc.json", { cache: "no-store" });
    if (!r.ok) throw new Error("Fichier introuvable");
    enc = await r.json();
  } catch {
    els.center.innerHTML = `<div style="padding:16px;background:#FEF3C7;border-radius:12px;color:#92400E">
      Aucun fichier <code>planning.enc.json</code> détecté.
    </div>`;
    return;
  }

  // Mot de passe déjà en session ? On tente directement.
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) {
    const ok = await tryUnlock(enc, cached, false);
    if (ok) return;
    sessionStorage.removeItem(SESSION_KEY); // Session expirée / mdp changé
  }

  showLoginScreen(enc);
}

/** Affiche l'overlay de login. */
function showLoginScreen(enc) {
  const overlay = document.getElementById("loginOverlay");
  overlay.style.display = "flex";
  overlay.style.animation = "loginFadeIn 0.25s ease";

  const form  = document.getElementById("loginForm");
  const input = document.getElementById("loginPassword");
  const error = document.getElementById("loginError");
  const btn   = document.getElementById("loginBtn");

  form.onsubmit = async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = "Vérification…";
    error.style.display = "none";

    const ok = await tryUnlock(enc, input.value, true);

    if (!ok) {
      error.style.display = "block";
      input.value = "";
      input.focus();
    }

    btn.disabled = false;
    btn.textContent = "Accéder";
  };

  input.focus();
}

/**
 * Tente de déchiffrer avec le mot de passe fourni.
 * @returns {boolean}  true si succès.
 */
async function tryUnlock(enc, password, saveSession) {
  try {
    const json = await decryptPlanning(enc, password);
    planning = JSON.parse(json);

    if (saveSession) sessionStorage.setItem(SESSION_KEY, password);

    // Masque l'overlay avec une animation
    const overlay = document.getElementById("loginOverlay");
    overlay.style.animation = "loginFadeOut 0.2s ease forwards";
    setTimeout(() => { overlay.style.display = "none"; }, 200);

    initData();
    computeFiltered();
    renderLists();
    renderGlobal();
    updateCharts();
    return true;
  } catch {
    return false; // Mauvais mot de passe = déchiffrement échoue
  }
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