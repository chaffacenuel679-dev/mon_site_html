// =====================================================================
//  CONFIGURATION FIREBASE
//  1. Console Firebase → ⚙️ Paramètres du projet → « Vos applications »
//  2. Ajoute une application Web (</>) puis copie l'objet firebaseConfig ici.
//  Ces valeurs ne sont PAS secrètes : elles identifient ton projet.
//  La sécurité est assurée par les règles Firestore (fichier firestore.rules).
//  Tant que apiKey est vide, le site fonctionne en mode statique.
// =====================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCbshWETY8SDA2-tJ6PtqKGFbN21rcGM7g",
  authDomain: "cenuel-portfolio.firebaseapp.com",
  projectId: "cenuel-portfolio",
  storageBucket: "cenuel-portfolio.firebasestorage.app",
  messagingSenderId: "787592424759",
  appId: "1:787592424759:web:7b209d5211e31609e67eb2"
};

// Seul ce compte Google peut se connecter à /admin.html et publier.
// ⚠️ Doit être identique à l'email écrit dans firestore.rules.
export const ADMIN_EMAIL = "chaffacenuel679@gmail.com";

// Réservé aux tests en local avec les émulateurs Firebase.
export const USE_EMULATORS = false;
