import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAaVpBB1J8_RStOBZHtoiJS099p4W8IySk",
  authDomain: "planning-helpdesk.firebaseapp.com",
  projectId: "planning-helpdesk",
  storageBucket: "planning-helpdesk.appspot.com",
  messagingSenderId: "230078628617",
  appId: "1:230078628617:web:da99961233f4a0b67c49d8"
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)
