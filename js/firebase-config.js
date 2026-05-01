/* ============================================================
   FIREBASE.JS — Configuration et initialisation Firebase
   ============================================================ */

// Import Firebase SDK (version 12.12.1 - même que ton test.html)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';

// Configuration Firebase (depuis la console)
const firebaseConfig = {
  apiKey: "AIzaSyAaVpBB1J8_RStOBZHtoiJS099p4W8IySk",
  authDomain: "planning-helpdesk.firebaseapp.com",
  projectId: "planning-helpdesk",
  storageBucket: "planning-helpdesk.appspot.com",
  messagingSenderId: "230078628617",
  appId: "1:230078628617:web:da99961233f4a0b67c49d8"
};

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('✅ Firebase initialisé avec succès');

// Export pour utilisation dans d'autres fichiers
export { db };
