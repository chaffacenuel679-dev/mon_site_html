// Initialisation Firebase (chargée uniquement si la configuration est remplie).
import { firebaseConfig, ADMIN_EMAIL, USE_EMULATORS } from './firebase-config.js';

export const SDK_VERSION = '12.19.0';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export { ADMIN_EMAIL };

let appPromise;

/** Charge le SDK et renvoie { app, fs } où fs contient les fonctions Firestore. */
export function getFirestoreKit() {
  if (!isConfigured) return Promise.reject(new Error('Firebase non configuré'));
  appPromise ??= (async () => {
    const [{ initializeApp }, fs] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-firestore.js`)
    ]);
    const app = initializeApp(firebaseConfig);
    const db = fs.getFirestore(app);
    if (USE_EMULATORS) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return { app, db, fs };
  })();
  return appPromise;
}

let authPromise;

/** Charge Firebase Auth (utilisé uniquement par la page d'administration). */
export function getAuthKit() {
  authPromise ??= (async () => {
    const { app } = await getFirestoreKit();
    const authMod = await import(`${CDN}/firebase-auth.js`);
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

export const CATEGORIES = [
  'Mécanique & CAO',
  'Fabrication & Atelier',
  'Électronique & Arduino',
  'Programmation & Web',
  'Intelligence Artificielle',
  'Art & Astronomie',
  'Autre'
];

/** Formate « 2026-03 » en « Mars 2026 ». */
export function formatMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const s = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
