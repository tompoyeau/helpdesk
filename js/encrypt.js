#!/usr/bin/env node
/* ============================================================
   ENCRYPT.JS — Chiffrement du planning.json
   Usage : node encrypt.js <mot_de_passe> [input] [output]

   Exemple :
     node encrypt.js MonMotDePasse
     node encrypt.js MonMotDePasse planning.json planning.enc.json

   Algorithme : PBKDF2 (310 000 itérations, SHA-256) + AES-256-GCM
   À relancer à chaque mise à jour du planning.json.
   ============================================================ */

const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

const password   = process.argv[2];
const inputFile  = process.argv[3] || "planning.json";
const outputFile = process.argv[4] || "planning.enc.json";

if (!password) {
  console.error("❌  Mot de passe manquant.");
  console.error("    Usage : node encrypt.js <mot_de_passe> [input.json] [output.enc.json]");
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌  Fichier introuvable : ${inputFile}`);
  process.exit(1);
}

// --- Paramètres cryptographiques ---
const ITERATIONS = 310_000;   // OWASP 2023 recommandation PBKDF2-SHA256
const KEY_LEN    = 32;        // AES-256 = 32 octets
const DIGEST     = "sha256";

const salt = crypto.randomBytes(32);  // 256 bits
const iv   = crypto.randomBytes(12);  // 96 bits  (recommandé AES-GCM)

// Dérivation de la clé
const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);

// Chiffrement AES-256-GCM
const plaintext = fs.readFileSync(inputFile, "utf8");
const cipher    = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
const tag       = cipher.getAuthTag(); // 128 bits d'authentification

// Fichier de sortie : tout en hex/base64, facilement parsable côté browser
const output = {
  v:    1,                          // version du format, pour migrations futures
  salt: salt.toString("hex"),
  iv:   iv.toString("hex"),
  tag:  tag.toString("hex"),
  data: encrypted.toString("base64"),
};

fs.writeFileSync(outputFile, JSON.stringify(output));

const sizeIn  = (plaintext.length / 1024).toFixed(1);
const sizeOut = (fs.statSync(outputFile).size / 1024).toFixed(1);

console.log(`✅  Chiffrement réussi !`);
console.log(`    Entrée  : ${inputFile} (${sizeIn} Ko)`);
console.log(`    Sortie  : ${outputFile} (${sizeOut} Ko)`);
console.log(`    Algo    : PBKDF2-SHA256 × ${ITERATIONS.toLocaleString()} + AES-256-GCM`);
console.log(`\n⚠️   Ne commitez pas ${inputFile} sur GitHub, uniquement ${outputFile}.`);
console.log(`    Ajoutez cette ligne à votre .gitignore :\n    ${inputFile}`);
