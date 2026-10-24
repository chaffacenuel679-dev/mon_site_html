// Initialisation Firebase (chargée uniquement si la configuration est remplie).
import { firebaseConfig, ADMIN_EMAIL, USE_EMULATORS } from './firebase-config.js';

export const SDK_VERSION = '12.19.0';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export { ADMIN_EMAIL };

let appPromise;
function getApp() {
  appPromise ??= import(`${CDN}/firebase-app.js`).then(m => m.getApps()[0] || m.initializeApp(firebaseConfig));
  return appPromise;
}

const kits = {};

/**
 * Charge Firestore et renvoie { app, db, fs } où fs contient les fonctions Firestore.
 * - lite: true  → Firestore Lite (≈ 35 Ko compressés) : lecture et écriture simples, idéal pour le site public.
 * - lite: false → Firestore complet (≈ 175 Ko compressés) : utilisé par la page d'administration.
 */
export function getFirestoreKit({ lite = false } = {}) {
  if (!isConfigured) return Promise.reject(new Error('Firebase non configuré'));
  const key = lite ? 'lite' : 'full';
  kits[key] ??= (async () => {
    const [app, fs] = await Promise.all([
      getApp(),
      import(`${CDN}/${lite ? 'firebase-firestore-lite.js' : 'firebase-firestore.js'}`)
    ]);
    const db = fs.getFirestore(app);
    if (USE_EMULATORS) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return { app, db, fs };
  })();
  return kits[key];
}

let authPromise;

/** Charge Firebase Auth (utilisé uniquement par la page d'administration). */
export function getAuthKit() {
  authPromise ??= (async () => {
    const [app, authMod] = await Promise.all([getApp(), import(`${CDN}/firebase-auth.js`)]);
    const auth = authMod.getAuth(app);
    if (USE_EMULATORS) authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    auth.languageCode = 'fr';
    return { auth, authMod };
  })();
  return authPromise;
}

/** N'accepte que des images encodées en data URL (protection contre l'injection d'URL). */
export function safeImage(src) {
  return typeof src === 'string' && /^data:image\/(webp|jpeg|png);base64,/.test(src) ? src : '';
}

/** N'accepte que des liens http(s). */
export function safeLink(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch { return ''; }
}


/** Formate « 2026-03 » en « Mars 2026 ». */
export function formatMonth(value, lang = 'fr') {
  const m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const s = d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Tri : projets « à la une » d'abord, puis ordre manuel, puis date la plus récente. */
export function sortProjects(list) {
  return list.slice().sort((a, b) =>
    (Number(Boolean(b.featured)) - Number(Boolean(a.featured))) ||
    ((a.order ?? 0) - (b.order ?? 0)) ||
    String(b.date || '').localeCompare(String(a.date || ''))
  );
}
