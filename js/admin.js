import {
  isConfigured, getFirestoreKit, getAuthKit, ADMIN_EMAIL,
  safeImage, safeLink, formatMonth, sortProjects
} from './firebase.js';
import { LEVELS, SKILL_ICONS, DEFAULT_SKILLS, sanitizeSkills, renderSkillCard } from './skills.js';
import {
  SITE_URL, CATEGORIES, YEAR_OPTIONS, AVAILABILITY, DEFAULT_ABOUT, sanitizeAbout, sanitizeCvOptions, cvKey,
  DEFAULT_PARCOURS, sanitizeParcours, PARCOURS_KINDS, SPEC_FIELDS, sanitizeSpecs
} from './content.js';
import { cvData, cvHash, generateCv } from './cv.js';
import { missingTranslation, missingEnFields } from './translations.js';
import { qrcode } from './vendor/qrcode.mjs';
import { processPhoto, thumbFromDataUrl, decodeImage, encode, PROFILE, THUMB } from './image-utils.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const MAX_PHOTOS = 30;

/* ---------------- Utilitaires ---------------- */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, v);
    else node[k] = v;
  });
  node.append(...children.filter(Boolean));
  return node;
}

function toast(msg, type = '') {
  const t = el('div', { class: `toast ${type}`, text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), type === 'err' ? 8000 : 3500);
}

function explain(err) {
  const code = err?.code || '';
  const map = {
    'permission-denied': 'Accès refusé par Firestore. Vérifie que les règles de firestore.rules sont publiées et que l\'email administrateur est le bon.',
    'auth/unauthorized-domain': 'Ce domaine n\'est pas autorisé. Ajoute-le dans Firebase → Authentication → Paramètres → Domaines autorisés.',
    'auth/operation-not-allowed': 'La connexion Google n\'est pas activée. Firebase → Authentication → Méthode de connexion → Google.',
    'auth/popup-blocked': 'La fenêtre de connexion a été bloquée par le navigateur. Autorise les pop-ups pour ce site.',
    'auth/popup-closed-by-user': 'Connexion annulée.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
    'auth/network-request-failed': 'Problème de connexion internet.',
    'unavailable': 'Firestore est injoignable. Vérifie ta connexion internet.',
    'not-found': 'Base Firestore introuvable. Crée-la dans Firebase → Firestore Database.',
    'invalid-argument': 'Donnée refusée (une photo est peut-être trop lourde).',
    'resource-exhausted': 'Quota Firebase gratuit atteint pour aujourd\'hui.'
  };
  return map[code] || err?.message || 'Erreur inconnue.';
}

function showState(id) {
  ['state-setup', 'state-login', 'state-denied', 'state-loading', 'state-app'].forEach(s => { $(`#${s}`).hidden = s !== id; });
}

const parseTags = s => [...new Set(String(s || '').split(',').map(t => t.trim()).filter(Boolean))].slice(0, 12);

/* ---------------- Démarrage ---------------- */
let db, fs, auth, authMod;

async function start() {
  if (!isConfigured) { showState('state-setup'); return; }
  try {
    ({ db, fs } = await getFirestoreKit());
    ({ auth, authMod } = await getAuthKit());
  } catch (err) {
    console.error(err);
    showState('state-login');
    $('#login-error').textContent = 'Impossible de charger Firebase. Vérifie ta connexion internet et js/firebase-config.js.';
    $('#login').disabled = true;
    return;
  }

  authMod.onAuthStateChanged(auth, user => {
    $('#admin-user').hidden = !user;
    if (!user) { showState('state-login'); return; }
    $('#user-email').textContent = user.email || '';
    const isAdmin = (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase() && user.emailVerified;
    if (!isAdmin) { $('#denied-email').textContent = user.email || 'inconnu'; showState('state-denied'); return; }
    showState('state-app');
    loadMessages();
    // Une fois tout chargé, le CV est vérifié (et régénéré s'il n'est plus à jour)
    Promise.allSettled([loadProjects(), loadProfile(), loadSkills(), loadInfo(), loadAbout(), loadParcours(), removeOldIntegrations(), loadCvOptions()])
      .then(() => { contentReady = true; renderCvOptions(); scheduleCv(0); });
  });
}

$('#login').addEventListener('click', async () => {
  $('#login-error').textContent = '';
  try {
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await authMod.signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    $('#login-error').textContent = explain(err);
  }
});
const logout = () => authMod.signOut(auth);
$('#logout').addEventListener('click', logout);
$('#logout-denied').addEventListener('click', logout);

/* ---------------- Onglets ---------------- */
const tabs = $$('[role="tab"]');
function selectTab(tab) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    next.focus(); selectTab(next);
  });
});

/* =====================================================
   PROJETS
   ===================================================== */
let projects = [];

async function loadProjects() {
  try {
    const snap = await fs.getDocs(fs.collection(db, 'projects'));
    projects = sortProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    renderProjects();
  } catch (err) {
    console.error(err);
    toast(explain(err), 'err');
  }
}

// Couvertures plus lourdes que la limite actuelle (anciens envois) : téléchargées par chaque visiteur
const heavyCovers = () => projects.filter(p => p.coverId && (p.cover || '').length > THUMB.maxChars + 5000);

function renderCoversNote() {
  const heavy = heavyCovers();
  $('#covers-note').hidden = !heavy.length;
  if (!heavy.length) return;
  const kb = Math.round(heavy.reduce((t, p) => t + p.cover.length - THUMB.maxChars * 0.8, 0) / 1024);
  $('#covers-text').textContent = `${heavy.length} couverture(s) de projet peuvent être allégées (environ ${kb} Ko de moins à télécharger pour chaque visiteur, sans perte visible).`;
}

$('#covers-fix').addEventListener('click', async e => {
  const button = e.currentTarget;
  button.disabled = true;
  let before = 0, after = 0;
  try {
    for (const p of heavyCovers()) {
      const snap = await fs.getDoc(fs.doc(db, 'projectImages', p.coverId));
      if (!snap.exists()) continue;
      const cover = await thumbFromDataUrl(safeImage(snap.data().data));
      if (cover.length >= p.cover.length) continue;
      await fs.updateDoc(fs.doc(db, 'projects', p.id), { cover, updatedAt: fs.serverTimestamp() });
      before += p.cover.length; after += cover.length;
      p.cover = cover;
    }
    toast(after ? `Couvertures allégées : ${Math.round(before / 1024)} Ko → ${Math.round(after / 1024)} Ko.` : 'Rien à alléger.');
    renderProjects();
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  } finally { button.disabled = false; }
});

// Projets dont la version anglaise peut être complétée automatiquement
const translatable = () => projects.map(p => ({ p, patch: missingTranslation(p) })).filter(x => Object.keys(x.patch).length);

function renderTranslateNote() {
  const list = translatable();
  $('#translate-note').hidden = !list.length;
  if (!list.length) return;
  $('#translate-text').textContent = `${list.length} projet(s) n'ont pas encore de version anglaise : ${list.map(x => `« ${x.p.title} »`).join(', ')}. Une traduction est prête pour le titre, le résumé et la description.`;
}

$('#translate-apply').addEventListener('click', async e => {
  const button = e.currentTarget;
  const list = translatable();
  if (!list.length) return;
  button.disabled = true;
  try {
    const batch = fs.writeBatch(db);
    list.forEach(({ p, patch }) => batch.update(fs.doc(db, 'projects', p.id), { ...patch, updatedAt: fs.serverTimestamp() }));
    await batch.commit();
    toast(`Version anglaise complétée pour ${list.length} projet(s).`);
    await loadProjects();
    scheduleCv();
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  } finally { button.disabled = false; }
});

function renderProjects() {
  renderCoversNote();
  renderTranslateNote();
  $('#count-projects').textContent = projects.length ? `(${projects.length})` : '';
  $('#projects-empty').hidden = projects.length > 0;
  $('#admin-projects').replaceChildren(...projects.map((p, i) => {
    const thumb = el('div', { class: 'project-thumb' });
    const cover = safeImage(p.cover);
    if (cover) thumb.append(el('img', { src: cover, alt: '' }));
    else { thumb.classList.add('placeholder'); thumb.dataset.glyph = String(i + 1).padStart(2, '0'); }

    const meta = el('div', { class: 'a-meta' }, [
      el('span', { class: `status ${p.published ? 'on' : ''}`, text: p.published ? 'Publié' : 'Brouillon' }),
      p.featured ? el('span', { class: 'status star', text: 'À la une' }) : null,
      el('span', { class: 'status', text: `${p.images?.length || 0} photo(s)` }),
      p.date ? el('span', { class: 'status', text: formatMonth(p.date) }) : null,
      missingEnFields(p).length
        ? el('span', { class: 'status warn', text: 'EN à faire', title: 'Version anglaise incomplète : ouvre « Modifier » puis « Version anglaise ».' })
        : el('span', { class: 'status', text: 'EN ✓' })
    ]);
    const editBtn = el('button', { type: 'button', text: 'Modifier' });
    const pubBtn = el('button', { type: 'button', text: p.published ? 'Dépublier' : 'Publier' });
    const delBtn = el('button', { type: 'button', class: 'danger', text: 'Supprimer' });
    editBtn.addEventListener('click', () => openEditor(p));
    pubBtn.addEventListener('click', () => togglePublished(p, pubBtn));
    delBtn.addEventListener('click', () => deleteProject(p));

    const card = el('article', { class: 'a-card' }, [
      thumb,
      el('div', { class: 'a-card-body' }, [
        el('p', { class: 'project-tag', text: p.category || 'Autre' }),
        el('h3', { class: 'a-card-title', text: p.title || 'Sans titre' }),
        meta
      ]),
      el('div', { class: 'a-actions' }, [editBtn, pubBtn, delBtn])
    ]);
    card.style.animationDelay = `${Math.min(i, 10) * 40}ms`;
    return card;
  }));
}

async function imagesOf(projectId) {
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'projectImages'), fs.where('projectId', '==', projectId)));
  return snap.docs;
}

async function togglePublished(p, btn) {
  btn.disabled = true;
  try {
    const published = !p.published;
    const batch = fs.writeBatch(db);
    batch.update(fs.doc(db, 'projects', p.id), { published, updatedAt: fs.serverTimestamp() });
    (await imagesOf(p.id)).forEach(d => batch.update(d.ref, { published }));
    await batch.commit();
    p.published = published;
    renderProjects();
    toast(published ? 'Projet publié sur le site.' : 'Projet retiré du site.');
    scheduleCv();
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  } finally { btn.disabled = false; }
}

async function deleteProject(p) {
  if (!confirm(`Supprimer définitivement « ${p.title} » et ses photos ?`)) return;
  try {
    const docs = await imagesOf(p.id);
    // Lots de 400 opérations maximum (limite Firestore : 500)
    for (let i = 0; i < docs.length; i += 400) {
      const batch = fs.writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await fs.deleteDoc(fs.doc(db, 'projects', p.id));
    projects = projects.filter(x => x.id !== p.id);
    renderProjects();
    toast('Projet supprimé.');
    scheduleCv();
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  }
}

$('#import-examples').addEventListener('click', async e => {
  const button = e.currentTarget;
  const examples = [
    { title: 'Conception d\'une pièce mécanique', category: 'Mécanique & CAO', summary: 'Modélisation et conception 3D d\'une pièce fonctionnelle, avec analyse de contraintes et choix des matériaux adaptés.', tags: ['CAO', 'DAO 3D', 'RDM'] },
    { title: 'Exploration des LLMs & IA générative', category: 'Intelligence Artificielle', summary: 'Utilisation avancée des modèles de langage pour l\'automatisation, la recherche et la création de contenu technique.', tags: ['Claude', 'GPT', 'Grok', 'Prompt engineering'] },
    { title: 'Art science-fiction & astronomie', category: 'Art & Astronomie', summary: 'Création visuelle inspirée de l\'astronomie et de la science-fiction, mêlant rigueur scientifique et expression artistique.', tags: ['Design', 'IA Art'] },
    { title: 'Portfolio académique GMP', category: 'Mécanique & CAO', summary: 'Présentation structurée des travaux pratiques, dessins techniques 2D/3D et analyses réalisés en première année à l\'INSTI.', tags: ['INSTI', 'DAO 2D/3D', 'GMP'] }
  ];
  button.disabled = true;
  try {
    const batch = fs.writeBatch(db);
    examples.forEach((x, i) => batch.set(fs.doc(fs.collection(db, 'projects')), {
      ...x, description: x.summary, date: '', link: '', order: i, published: true, featured: false,
      cover: '', coverId: '', images: [], createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp()
    }));
    await batch.commit();
    toast('Projets d\'exemple importés. Ajoute-leur des photos !');
    loadProjects();
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  } finally { button.disabled = false; }
});

/* ---------------- Éditeur ---------------- */
const editor = $('#editor');
const form = $('#editor-form');
const photoList = $('#photo-list');
let state = null;   // { id, isNew, images: [...], removed: [], coverKey, original }
let keySeq = 0;
let busy = false;

$('#f-category').append(...CATEGORIES.map(c => el('option', { value: c.fr, text: c.fr })));
// Champs de la fiche technique (français et anglais)
const specInput = (f, en) => el('div', { class: 'field' }, [
  el('label', { htmlFor: `f-spec${en ? 'En' : ''}-${f.key}`, text: en ? f.en : f.fr }),
  el('input', { id: `f-spec${en ? 'En' : ''}-${f.key}`, name: `spec${en ? 'En' : ''}-${f.key}`, type: 'text', maxLength: 300, placeholder: en ? '' : f.hint })
]);
$('#specs-fields').append(...SPEC_FIELDS.map(f => specInput(f, false)));
$('#specs-fields-en').append(...SPEC_FIELDS.map(f => specInput(f, true)));
const readSpecs = en => sanitizeSpecs(Object.fromEntries(SPEC_FIELDS.map(f => [f.key, form.elements[`spec${en ? 'En' : ''}-${f.key}`].value])));

function updateCounters() {
  $$('[data-count]', form).forEach(h => {
    const f = $(`#${h.dataset.count}`);
    h.textContent = `${f.value.length}/${f.maxLength}`;
  });
}
form.addEventListener('input', updateCounters);

async function openEditor(p = null) {
  form.reset();
  state = { id: p?.id || null, isNew: !p, images: [], removed: [], coverKey: null, original: p };
  $('#editor-title').textContent = p ? 'Modifier le projet' : 'Nouveau projet';
  $('#editor-status').textContent = '';
  if (p) {
    form.elements.title.value = p.title || '';
    form.elements.category.value = CATEGORIES.some(c => c.fr === p.category) ? p.category : 'Autre';
    form.elements.date.value = p.date || '';
    form.elements.summary.value = p.summary || '';
    form.elements.description.value = p.description || '';
    form.elements.tags.value = (p.tags || []).join(', ');
    form.elements.link.value = p.link || '';
    form.elements.order.value = p.order ?? 0;
    form.elements.published.checked = Boolean(p.published);
    form.elements.featured.checked = Boolean(p.featured);
    form.elements.titleEn.value = p.titleEn || '';
    form.elements.summaryEn.value = p.summaryEn || '';
    form.elements.descriptionEn.value = p.descriptionEn || '';
    form.elements.tagsEn.value = (p.tagsEn || []).join(', ');
    SPEC_FIELDS.forEach(f => {
      form.elements[`spec-${f.key}`].value = p.specs?.[f.key] || '';
      form.elements[`specEn-${f.key}`].value = p.specsEn?.[f.key] || '';
    });
    form.querySelector('.en-box').open = Boolean(p.titleEn || p.summaryEn || p.descriptionEn);
  } else {
    form.querySelector('.en-box').open = false;
    form.elements.order.value = projects.length;
  }
  updateCounters();
  renderPhotos();
  state.snapshot = formSnapshot();
  editor.showModal();
  form.elements.title.focus();

  if (p?.images?.length) {
    $('#editor-status').textContent = 'Chargement des photos…';
    try {
      const docs = await imagesOf(p.id);
      const byId = new Map(docs.map(d => [d.id, d.data()]));
      state.images = p.images.filter(i => byId.has(i.id)).map(i => {
        const d = byId.get(i.id);
        return { key: ++keySeq, id: i.id, caption: i.caption || d.caption || '', captionEn: i.captionEn || '', savedCaption: i.caption || d.caption || '', preview: safeImage(d.data), width: d.width, height: d.height, savedPublished: d.published };
      });
      state.coverKey = state.images.find(i => i.id === p.coverId)?.key ?? state.images[0]?.key ?? null;
      renderPhotos();
      $('#editor-status').textContent = '';
    } catch (err) {
      console.error(err);
      $('#editor-status').textContent = explain(err);
    }
  }
}
$('#new-project').addEventListener('click', () => openEditor());

function renderPhotos() {
  const imgs = state.images;
  $('#photos-count').textContent = imgs.length ? `${imgs.length}/${MAX_PHOTOS}` : '';
  if (imgs.length && !imgs.some(i => i.key === state.coverKey)) state.coverKey = imgs[0].key;
  photoList.replaceChildren(...imgs.map((img, i) => {
    const isCover = img.key === state.coverKey;
    const caption = el('input', { type: 'text', value: img.caption, maxLength: 200, placeholder: 'Légende (optionnelle)', 'aria-label': `Légende de la photo ${i + 1}` });
    caption.addEventListener('input', () => { img.caption = caption.value; });
    const captionEn = el('input', { type: 'text', value: img.captionEn || '', maxLength: 200, placeholder: 'Caption in English (optional)', 'aria-label': `Légende anglaise de la photo ${i + 1}`, class: 'caption-en' });
    captionEn.addEventListener('input', () => { img.captionEn = captionEn.value; });
    const btn = (label, title, fn, cls = '', disabled = false) => {
      const b = el('button', { type: 'button', text: label, title, class: cls, 'aria-label': title, disabled });
      b.addEventListener('click', fn);
      return b;
    };
    const move = d => { const j = i + d; [imgs[i], imgs[j]] = [imgs[j], imgs[i]]; renderPhotos(); };
    const sizeKb = img.full ? Math.round(img.full.data.length * 0.75 / 1024) : null;
    return el('li', { class: `photo-item ${isCover ? 'cover' : ''} ${img.processing ? 'processing' : ''}` }, [
      el('img', { src: img.preview || '', alt: '' }),
      el('div', {}, [
        caption,
        captionEn,
        el('p', { class: 'p-meta', text: img.processing ? 'Compression…' : [isCover ? 'Couverture' : '', img.width ? `${img.width}×${img.height}px` : '', sizeKb ? `${sizeKb} Ko` : '', img.id ? '' : 'nouvelle'].filter(Boolean).join(' · ') })
      ]),
      el('div', { class: 'photo-tools' }, [
        btn('★', 'Utiliser comme couverture', () => { state.coverKey = img.key; renderPhotos(); }, isCover ? 'is-cover' : ''),
        btn('↑', 'Monter', () => move(-1), '', i === 0),
        btn('↓', 'Descendre', () => move(1), '', i === imgs.length - 1),
        btn('✕', 'Retirer la photo', () => {
          if (img.id) state.removed.push(img.id);
          state.images = imgs.filter(x => x !== img);
          renderPhotos();
        }, 'del', Boolean(img.processing))
      ])
    ]);
  }));
}

async function addFiles(files) {
  const list = [...files].filter(f => f.type.startsWith('image/'));
  if (!list.length) return;
  const room = MAX_PHOTOS - state.images.length;
  if (room <= 0) { toast(`Maximum ${MAX_PHOTOS} photos par projet.`, 'err'); return; }
  if (list.length > room) toast(`Seules ${room} photo(s) ont été ajoutées (maximum ${MAX_PHOTOS}).`, 'err');
  const items = list.slice(0, room).map(file => ({ key: ++keySeq, id: null, caption: '', captionEn: '', preview: '', processing: true, file }));
  state.images.push(...items);
  renderPhotos();
  for (const item of items) {
    try {
      const { full, thumb } = await processPhoto(item.file);
      Object.assign(item, { full, thumb: thumb.data, preview: thumb.data, width: full.width, height: full.height, processing: false });
    } catch (err) {
      console.error(err);
      toast(`${item.file.name} : ${err.message}`, 'err');
      state.images = state.images.filter(x => x !== item);
    }
    delete item.file;
    if (editor.open) renderPhotos();
  }
}

$('#f-files').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));

// Instantané des champs texte à l'ouverture, pour détecter les modifications non enregistrées
const formSnapshot = () => JSON.stringify([...new FormData(form)].filter(([, v]) => typeof v === 'string'));

function closeEditor() {
  if (busy) return;
  const dirty = state && (state.images.some(i => !i.id) || state.removed.length || formSnapshot() !== state.snapshot);
  if (dirty && !confirm('Fermer sans enregistrer les modifications ?')) return;
  editor.close();
}
$$('[data-cancel]', editor).forEach(b => b.addEventListener('click', closeEditor));
editor.addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  const title = form.elements.title.value.trim();
  if (!title) { form.elements.title.setAttribute('aria-invalid', 'true'); form.elements.title.focus(); return; }
  form.elements.title.removeAttribute('aria-invalid');
  const link = form.elements.link.value.trim();
  if (link && !safeLink(link)) { toast('Le lien doit commencer par https://', 'err'); form.elements.link.focus(); return; }
  if (state.images.some(i => i.processing)) { toast('Patiente pendant la compression des photos…', 'err'); return; }

  busy = true;
  const saveBtn = $('#editor-save');
  saveBtn.disabled = true;
  const status = $('#editor-status');
  const published = form.elements.published.checked;

  try {
    const projectRef = state.id ? fs.doc(db, 'projects', state.id) : fs.doc(fs.collection(db, 'projects'));
    state.id = projectRef.id;

    // 1. Envoi des nouvelles photos (une par document Firestore)
    const fresh = state.images.filter(i => !i.id);
    for (const [n, img] of fresh.entries()) {
      status.textContent = `Envoi des photos… ${n + 1}/${fresh.length}`;
      const ref = fs.doc(fs.collection(db, 'projectImages'));
      await fs.setDoc(ref, {
        projectId: state.id, published, data: img.full.data, width: img.width, height: img.height,
        caption: img.caption.trim(), createdAt: fs.serverTimestamp()
      });
      img.id = ref.id;
      img.savedCaption = img.caption.trim();
      img.savedPublished = published;
      img.preview = img.thumb;
      delete img.full;
    }

    // 2. Mise à jour des légendes / visibilité et suppression des photos retirées
    status.textContent = 'Enregistrement…';
    const batch = fs.writeBatch(db);
    let ops = 0;
    state.images.forEach(img => {
      const caption = img.caption.trim();
      if (caption !== img.savedCaption || published !== img.savedPublished) {
        batch.update(fs.doc(db, 'projectImages', img.id), { caption, published });
        img.savedCaption = caption; img.savedPublished = published; ops++;
      }
    });
    state.removed.forEach(id => { batch.delete(fs.doc(db, 'projectImages', id)); ops++; });
    if (ops) await batch.commit();
    state.removed = [];

    // 3. Vignette de couverture
    const coverImg = state.images.find(i => i.key === state.coverKey) || state.images[0];
    let cover = '';
    if (coverImg) {
      if (coverImg.thumb) cover = coverImg.thumb;
      else if (coverImg.id === state.original?.coverId && state.original?.cover) cover = state.original.cover;
      else cover = await thumbFromDataUrl(coverImg.preview);
      coverImg.thumb = cover;
    }

    // 4. Document du projet
    const data = {
      title,
      category: form.elements.category.value,
      date: form.elements.date.value,
      summary: form.elements.summary.value.trim(),
      description: form.elements.description.value.trim(),
      tags: parseTags(form.elements.tags.value),
      titleEn: form.elements.titleEn.value.trim(),
      summaryEn: form.elements.summaryEn.value.trim(),
      descriptionEn: form.elements.descriptionEn.value.trim(),
      tagsEn: parseTags(form.elements.tagsEn.value),
      specs: readSpecs(false),
      specsEn: readSpecs(true),
      link: link ? safeLink(link) : '',
      order: Number(form.elements.order.value) || 0,
      published,
      featured: form.elements.featured.checked,
      cover,
      coverId: coverImg?.id || '',
      images: state.images.map(i => ({ id: i.id, caption: i.caption.trim(), captionEn: (i.captionEn || '').trim() })),
      updatedAt: fs.serverTimestamp()
    };
    if (state.isNew) data.createdAt = fs.serverTimestamp();
    await fs.setDoc(projectRef, data, { merge: true });

    state.isNew = false;
    busy = false;
    editor.close();
    toast(published ? 'Projet enregistré et publié.' : 'Projet enregistré en brouillon.');
    loadProjects().then(() => scheduleCv());
  } catch (err) {
    console.error(err);
    status.textContent = '';
    toast(`Échec de l'enregistrement : ${explain(err)}`, 'err');
    renderPhotos();
  } finally {
    busy = false;
    saveBtn.disabled = false;
  }
});

/* =====================================================
   MESSAGES
   ===================================================== */
async function loadMessages() {
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'messages'), fs.orderBy('createdAt', 'desc'), fs.limit(200)));
    renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  }
}
$('#refresh-messages').addEventListener('click', loadMessages);

function renderMessages(list) {
  const unread = list.filter(m => !m.read).length;
  const badge = $('#count-messages');
  badge.hidden = !unread;
  badge.textContent = unread;
  $('#messages-empty').hidden = list.length > 0;
  $('#messages').replaceChildren(...list.map(m => {
    const date = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const reply = el('a', {
      class: 'btn btn-small',
      href: `mailto:${encodeURIComponent(m.email || '')}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Votre message'))}`,
      text: 'Répondre'
    });
    const toggle = el('button', { type: 'button', class: 'btn btn-ghost btn-small', text: m.read ? 'Marquer non lu' : 'Marquer comme lu' });
    const del = el('button', { type: 'button', class: 'btn btn-ghost btn-small', text: 'Supprimer' });
    toggle.addEventListener('click', async () => {
      try { await fs.updateDoc(fs.doc(db, 'messages', m.id), { read: !m.read }); m.read = !m.read; renderMessages(list); }
      catch (err) { toast(explain(err), 'err'); }
    });
    del.addEventListener('click', async () => {
      if (!confirm('Supprimer ce message ?')) return;
      try { await fs.deleteDoc(fs.doc(db, 'messages', m.id)); renderMessages(list.filter(x => x !== m)); }
      catch (err) { toast(explain(err), 'err'); }
    });
    return el('article', { class: `msg ${m.read ? '' : 'unread'}` }, [
      el('div', { class: 'msg-head' }, [
        el('div', {}, [el('span', { class: 'msg-from', text: m.name || 'Anonyme' }), el('span', { class: 'msg-email', text: `  ·  ${m.email || ''}` })]),
        el('span', { class: 'msg-date', text: date })
      ]),
      m.subject ? el('p', { class: 'msg-subject', text: m.subject }) : null,
      el('p', { class: 'msg-body', text: m.message || '' }),
      el('div', { class: 'msg-actions' }, [reply, toggle, del])
    ]);
  }));
}

/* =====================================================
   PHOTO DE PROFIL
   ===================================================== */
const DEFAULT_PHOTO = 'assets/cenuel-chaffa.webp';
let profilePhoto = '';   // photo personnalisée (data URL), vide = photo par défaut
async function loadProfile() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'profile'));
    const photo = snap.exists() ? safeImage(snap.data().photo) : '';
    profilePhoto = photo;
    $('#profile-preview').src = photo || DEFAULT_PHOTO;
    $('#profile-status').textContent = photo ? 'Photo personnalisée en ligne.' : 'Photo par défaut du site.';
  } catch (err) { console.error(err); }
}
$('#profile-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const status = $('#profile-status');
  status.textContent = 'Compression et envoi…';
  try {
    const img = await decodeImage(file);
    const { data } = encode(img, PROFILE);
    img.close?.();
    await fs.setDoc(fs.doc(db, 'settings', 'profile'), { photo: data, updatedAt: fs.serverTimestamp() });
    $('#profile-preview').src = data;
    profilePhoto = data;
    if (about.cvPhoto) scheduleCv();
    status.textContent = 'Photo de profil mise à jour sur le site.';
    toast('Photo de profil mise à jour.');
  } catch (err) {
    console.error(err); status.textContent = ''; toast(explain(err), 'err');
  }
});
$('#profile-reset').addEventListener('click', async () => {
  try {
    await fs.deleteDoc(fs.doc(db, 'settings', 'profile'));
    $('#profile-preview').src = DEFAULT_PHOTO;
    profilePhoto = '';
    if (about.cvPhoto) scheduleCv();
    $('#profile-status').textContent = 'Photo par défaut du site.';
    toast('Photo par défaut rétablie.');
  } catch (err) { toast(explain(err), 'err'); }
});

/* =====================================================
   COMPÉTENCES
   ===================================================== */
let skillCards = [];
let skillsSaved = false;     // false = compétences par défaut du site, pas encore dans Firebase
let editingIndex = null;
const skillEditor = $('#skill-editor');
const skillRows = $('#skill-rows');

$('#s-icon').append(...Object.entries(SKILL_ICONS).map(([k, v]) => el('option', { value: k, text: v.label })));

async function loadSkills() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'skills'));
    const cards = snap.exists() ? sanitizeSkills(snap.data().cards) : [];
    skillsSaved = cards.length > 0;
    skillCards = skillsSaved ? cards : structuredClone(DEFAULT_SKILLS);
    renderSkillsAdmin();
  } catch (err) { console.error(err); toast(explain(err), 'err'); }
}

async function saveSkills(message) {
  await fs.setDoc(fs.doc(db, 'settings', 'skills'), { cards: skillCards, updatedAt: fs.serverTimestamp() });
  skillsSaved = true;
  renderSkillsAdmin();
  toast(message);
  scheduleCv();
}

function renderSkillsAdmin() {
  $('#skills-default-note').hidden = skillsSaved;
  $('#skills-admin').replaceChildren(...skillCards.map((card, i) => {
    const btn = (label, fn, cls = '', disabled = false) => {
      const b = el('button', { type: 'button', text: label, class: cls, disabled });
      b.addEventListener('click', fn);
      return b;
    };
    const move = async d => {
      const j = i + d;
      [skillCards[i], skillCards[j]] = [skillCards[j], skillCards[i]];
      try { await saveSkills('Ordre mis à jour.'); } catch (err) { toast(explain(err), 'err'); loadSkills(); }
    };
    return el('div', { class: 'skill-admin-card' }, [
      renderSkillCard(card),
      el('div', { class: 'a-actions' }, [
        btn('Modifier', () => openSkillEditor(i)),
        btn('↑', () => move(-1), '', i === 0),
        btn('↓', () => move(1), '', i === skillCards.length - 1),
        btn('Supprimer', async () => {
          // Sans aucune carte enregistrée, le site réafficherait les compétences par défaut
          if (skillCards.length === 1) { toast('Garde au moins une carte : sinon le site réaffiche les compétences par défaut.', 'err'); return; }
          if (!confirm(`Supprimer la carte « ${card.title} » ?`)) return;
          skillCards.splice(i, 1);
          try { await saveSkills('Carte supprimée.'); } catch (err) { toast(explain(err), 'err'); loadSkills(); }
        }, 'danger')
      ])
    ]);
  }));
}

function addSkillRow(item = { name: '', level: 3 }) {
  const name = el('input', { type: 'text', value: item.name, maxLength: 120, placeholder: 'Ex. Usinage sur tour', 'aria-label': 'Nom de la compétence', class: 'sk-name' });
  const nameEn = el('input', { type: 'text', value: item.nameEn || '', maxLength: 120, placeholder: 'In English (optional)', 'aria-label': 'Nom en anglais', class: 'sk-name-en' });
  const level = el('select', { 'aria-label': 'Niveau' }, LEVELS.map(l => el('option', { value: String(l.value), text: l.label })));
  level.value = String(item.level ?? 0);
  const row = el('li', { class: 'skill-row' });
  const tool = (label, title, fn, cls = '') => {
    const b = el('button', { type: 'button', text: label, title, 'aria-label': title, class: cls });
    b.addEventListener('click', fn);
    return b;
  };
  row.append(name, nameEn, level, el('div', { class: 'photo-tools' }, [
    tool('↑', 'Monter', () => row.previousElementSibling && skillRows.insertBefore(row, row.previousElementSibling)),
    tool('↓', 'Descendre', () => row.nextElementSibling && skillRows.insertBefore(row.nextElementSibling, row)),
    tool('✕', 'Retirer', () => row.remove(), 'del')
  ]));
  skillRows.append(row);
  return name;
}

function openSkillEditor(index = null) {
  editingIndex = index;
  const card = index === null ? { category: '', title: '', icon: 'gear', items: [] } : skillCards[index];
  $('#skill-editor-title').textContent = index === null ? 'Nouvelle carte de compétences' : 'Modifier la carte';
  $('#s-category').value = card.category;
  $('#s-title').value = card.title;
  $('#s-icon').value = card.icon;
  $('#s-category-en').value = card.categoryEn || '';
  $('#s-title-en').value = card.titleEn || '';
  $('#skill-status').textContent = '';
  skillRows.replaceChildren();
  (card.items.length ? card.items : [{ name: '', level: 3 }]).forEach(addSkillRow);
  skillEditor.showModal();
  $('#s-title').focus();
}

$('#new-skill-card').addEventListener('click', () => openSkillEditor());
$('#add-skill-row').addEventListener('click', () => addSkillRow().focus());
$$('[data-skill-cancel]', skillEditor).forEach(b => b.addEventListener('click', () => skillEditor.close()));

$('#skill-form').addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('#s-title').value.trim();
  if (!title) { $('#s-title').setAttribute('aria-invalid', 'true'); $('#s-title').focus(); return; }
  $('#s-title').removeAttribute('aria-invalid');
  const items = $$('.skill-row', skillRows)
    .map(r => ({ name: $('.sk-name', r).value.trim(), nameEn: $('.sk-name-en', r).value.trim(), level: Number($('select', r).value) }))
    .filter(i => i.name);
  if (!items.length) { $('#skill-status').textContent = 'Ajoute au moins une compétence.'; return; }
  const card = sanitizeSkills([{
    category: $('#s-category').value.trim(), categoryEn: $('#s-category-en').value.trim(),
    title, titleEn: $('#s-title-en').value.trim(), icon: $('#s-icon').value, items
  }])[0];
  const previous = structuredClone(skillCards);
  if (editingIndex === null) skillCards.push(card); else skillCards[editingIndex] = card;
  const btn = $('#skill-save');
  btn.disabled = true;
  try {
    await saveSkills(editingIndex === null ? 'Carte ajoutée au site.' : 'Carte mise à jour sur le site.');
    skillEditor.close();
  } catch (err) {
    console.error(err);
    skillCards = previous;
    $('#skill-status').textContent = explain(err);
  } finally { btn.disabled = false; }
});

/* =====================================================
   ANNÉE D'ÉTUDE ET DISPONIBILITÉ (settings/info)
   ===================================================== */
let info = { gmpYear: 2, availability: 'open', cv: null };

$('#year-select').append(...YEAR_OPTIONS.map(y => el('option', { value: String(y.value), text: y.text.charAt(0).toUpperCase() + y.text.slice(1) + ' GMP' })));
$('#availability-select').append(...Object.entries(AVAILABILITY).map(([k, v]) => el('option', { value: k, text: v.fr })));

async function loadInfo() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'info'));
    const d = snap.exists() ? snap.data() : {};
    info = {
      gmpYear: Number(d.gmpYear) || 2,
      availability: AVAILABILITY[d.availability] ? d.availability : 'open',
      cv: d.cv || null
    };
    $('#year-select').value = String(info.gmpYear);
    $('#availability-select').value = info.availability;
    renderCvState();
  } catch (err) { console.error(err); }
}

async function saveInfo(fields, statusEl, message) {
  try {
    await fs.setDoc(fs.doc(db, 'settings', 'info'), { ...fields, updatedAt: fs.serverTimestamp() }, { merge: true });
    Object.assign(info, fields);
    statusEl.textContent = message;
    toast(message);
  } catch (err) { toast(explain(err), 'err'); }
}
$('#year-save').addEventListener('click', async () => {
  await saveInfo({ gmpYear: Number($('#year-select').value) }, $('#year-status'), 'Année d\'étude mise à jour sur le site.');
  scheduleCv();
});
$('#availability-save').addEventListener('click', () =>
  saveInfo({ availability: $('#availability-select').value }, $('#availability-status'), 'Disponibilité mise à jour sur le site.'));

/* =====================================================
   TEXTES DE PRÉSENTATION (settings/about)
   ===================================================== */
let about = sanitizeAbout(null);
const aboutForm = $('#about-form');
const langRows = $('#lang-rows');
const ABOUT_FIELDS = ['title', 'hero', 'about', 'tags', 'cvSummary', 'email', 'phone', 'linkedin', 'location', 'interests'];
const ABOUT_EN = ['title', 'hero', 'about', 'tags', 'cvSummary', 'location', 'interests'];
const ABOUT_LABELS = { title: 'Titre', hero: 'Accroche', about: 'À propos', tags: 'Étiquettes', cvSummary: 'Résumé du CV', location: 'Localisation', interests: 'Centres d\'intérêt' };

function addLangRow(l = { name: '', nameEn: '', level: '', levelEn: '' }) {
  const input = (value, placeholder, label, cls) => el('input', { type: 'text', value, maxLength: cls.startsWith('l-level') ? 60 : 40, placeholder, 'aria-label': label, class: cls });
  const row = el('li', { class: 'skill-row lang-row' }, [
    input(l.name, 'Ex. Anglais', 'Langue', 'l-name'),
    input(l.level, 'Ex. Intermédiaire (B1)', 'Niveau', 'l-level'),
    input(l.nameEn, 'English', 'Langue en anglais', 'l-name-en'),
    input(l.levelEn, 'Intermediate (B1)', 'Niveau en anglais', 'l-level-en')
  ]);
  const del = el('button', { type: 'button', text: '✕', title: 'Retirer', 'aria-label': 'Retirer la langue', class: 'del' });
  del.addEventListener('click', () => row.remove());
  row.append(el('div', { class: 'photo-tools' }, [del]));
  langRows.append(row);
  return row;
}
$('#add-lang-row').addEventListener('click', () => $('input', addLangRow()).focus());

function fillAboutForm() {
  [...ABOUT_FIELDS, ...ABOUT_EN.map(k => k + 'En')].forEach(k => { aboutForm.elements[k].value = about[k] || ''; });
  aboutForm.elements.cvProjects.value = about.cvProjects;
  aboutForm.elements.cvPhoto.checked = about.cvPhoto;
  langRows.replaceChildren();
  about.languages.forEach(addLangRow);
}

async function loadAbout() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'about'));
    about = sanitizeAbout(snap.exists() ? snap.data() : null);
    fillAboutForm();
  } catch (err) { console.error(err); }
}

aboutForm.addEventListener('submit', async e => {
  e.preventDefault();
  const v = k => aboutForm.elements[k].value.trim();
  const status = $('#about-status');
  if (v('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) { toast('Adresse email invalide.', 'err'); aboutForm.elements.email.focus(); return; }
  if (v('linkedin') && !safeLink(v('linkedin'))) { toast('Le lien LinkedIn doit commencer par https://', 'err'); aboutForm.elements.linkedin.focus(); return; }

  const data = Object.fromEntries(ABOUT_FIELDS.map(k => [k, v(k)]));
  const stale = [];
  ABOUT_EN.forEach(k => {
    let en = v(k + 'En');
    // Français modifié mais anglais resté sur le texte d'origine : l'ancienne traduction serait fausse
    if (en && en === DEFAULT_ABOUT[k + 'En'] && data[k] !== DEFAULT_ABOUT[k]) { en = ''; stale.push(ABOUT_LABELS[k]); }
    data[k + 'En'] = en;
  });
  if (data.linkedin) data.linkedin = safeLink(data.linkedin);
  data.languages = $$('.lang-row', langRows)
    .map(r => ({ name: $('.l-name', r).value.trim(), nameEn: $('.l-name-en', r).value.trim(), level: $('.l-level', r).value.trim(), levelEn: $('.l-level-en', r).value.trim() }))
    .filter(l => l.name);
  data.cvProjects = Math.max(0, Math.min(8, Math.round(Number(aboutForm.elements.cvProjects.value) || 0)));
  data.cvPhoto = aboutForm.elements.cvPhoto.checked;

  const btn = $('#about-save');
  btn.disabled = true;
  try {
    await fs.setDoc(fs.doc(db, 'settings', 'about'), { ...data, updatedAt: fs.serverTimestamp() });
    about = sanitizeAbout(data);
    fillAboutForm();
    status.textContent = stale.length
      ? `Enregistré. Version anglaise à mettre à jour : ${stale.join(', ')} (en attendant, le texte français s'affiche en anglais).`
      : 'Textes enregistrés sur le site.';
    toast('Textes de présentation enregistrés.');
    scheduleCv();
  } catch (err) {
    console.error(err); toast(explain(err), 'err');
  } finally { btn.disabled = false; }
});

$('#about-reset').addEventListener('click', async () => {
  if (!confirm('Remettre tous les textes de présentation tels qu\'ils étaient à l\'origine ?')) return;
  try {
    await fs.deleteDoc(fs.doc(db, 'settings', 'about'));
    about = sanitizeAbout(null);
    fillAboutForm();
    $('#about-status').textContent = 'Textes d\'origine rétablis.';
    toast('Textes d\'origine rétablis.');
    scheduleCv();
  } catch (err) { toast(explain(err), 'err'); }
});

/* =====================================================
   PARCOURS (settings/parcours)
   ===================================================== */
let parcoursItems = structuredClone(DEFAULT_PARCOURS);
let parcoursSaved = false;
let parcoursIndex = null;
const parcoursEditor = $('#parcours-editor');
const parcoursForm = $('#parcours-form');
const PARCOURS_FIELDS = ['kind', 'period', 'periodEn', 'title', 'titleEn', 'place', 'placeEn', 'description', 'descriptionEn'];

async function loadParcours() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'parcours'));
    parcoursSaved = snap.exists() && Array.isArray(snap.data().items);
    parcoursItems = parcoursSaved ? sanitizeParcours(snap.data().items) : structuredClone(DEFAULT_PARCOURS);
    renderParcoursAdmin();
  } catch (err) { console.error(err); toast(explain(err), 'err'); }
}

async function saveParcours(message) {
  await fs.setDoc(fs.doc(db, 'settings', 'parcours'), { items: parcoursItems, updatedAt: fs.serverTimestamp() });
  parcoursSaved = true;
  renderParcoursAdmin();
  toast(message);
  scheduleCv();
}

function renderParcoursAdmin() {
  $('#parcours-default-note').hidden = parcoursSaved;
  const box = $('#parcours-admin');
  if (!parcoursItems.length) {
    box.replaceChildren(el('div', { class: 'empty-state' }, [el('p', { text: 'Aucun élément. Ajoute une formation ou une expérience.' })]));
    return;
  }
  box.replaceChildren(...parcoursItems.map((item, i) => {
    const btn = (label, fn, cls = '', disabled = false) => {
      const b = el('button', { type: 'button', text: label, class: cls, disabled });
      b.addEventListener('click', fn);
      return b;
    };
    const move = async d => {
      const j = i + d;
      [parcoursItems[i], parcoursItems[j]] = [parcoursItems[j], parcoursItems[i]];
      try { await saveParcours('Ordre mis à jour.'); } catch (err) { toast(explain(err), 'err'); loadParcours(); }
    };
    return el('article', { class: `a-card parcours-card ${item.kind}` }, [
      el('div', { class: 'a-card-body' }, [
        el('div', { class: 'a-meta' }, [
          el('span', { class: `status ${item.kind === 'experience' ? 'star' : ''}`, text: PARCOURS_KINDS[item.kind].fr }),
          item.period ? el('span', { class: 'status', text: item.period }) : null,
          item.titleEn ? el('span', { class: 'status', text: 'EN ✓' }) : null
        ]),
        el('h2', { class: 'a-card-title', text: item.title }),
        item.place ? el('p', { class: 'muted small', text: item.place }) : null
      ]),
      el('div', { class: 'a-actions' }, [
        btn('Modifier', () => openParcoursEditor(i)),
        btn('↑', () => move(-1), '', i === 0),
        btn('↓', () => move(1), '', i === parcoursItems.length - 1),
        btn('Supprimer', async () => {
          if (!confirm(`Supprimer « ${item.title} » du parcours ?`)) return;
          parcoursItems.splice(i, 1);
          try { await saveParcours('Élément supprimé.'); } catch (err) { toast(explain(err), 'err'); loadParcours(); }
        }, 'danger')
      ])
    ]);
  }));
}

function openParcoursEditor(index = null, kind = 'education') {
  parcoursIndex = index;
  const item = index === null ? { kind } : parcoursItems[index];
  $('#parcours-editor-title').textContent = index === null
    ? (kind === 'experience' ? 'Nouvelle expérience professionnelle' : 'Nouvelle formation')
    : 'Modifier l\'élément';
  PARCOURS_FIELDS.forEach(k => { parcoursForm.elements[k].value = item[k] || (k === 'kind' ? 'education' : ''); });
  $('.en-box', parcoursForm).open = Boolean(item.titleEn);
  $('#parcours-status').textContent = '';
  parcoursEditor.showModal();
  parcoursForm.elements.title.focus();
}
$$('[data-new-parcours]').forEach(b => b.addEventListener('click', () => openParcoursEditor(null, b.dataset.newParcours)));
$$('[data-parcours-cancel]', parcoursEditor).forEach(b => b.addEventListener('click', () => parcoursEditor.close()));

parcoursForm.addEventListener('submit', async e => {
  e.preventDefault();
  const titleInput = parcoursForm.elements.title;
  if (!titleInput.value.trim()) { titleInput.setAttribute('aria-invalid', 'true'); titleInput.focus(); return; }
  titleInput.removeAttribute('aria-invalid');
  const item = sanitizeParcours([Object.fromEntries(PARCOURS_FIELDS.map(k => [k, parcoursForm.elements[k].value.trim()]))])[0];
  const previous = structuredClone(parcoursItems);
  if (parcoursIndex === null) {
    // Une nouvelle expérience se place avant les formations (plus récent en premier sur le CV)
    parcoursItems.splice(item.kind === 'experience' ? 0 : parcoursItems.length, 0, item);
  } else parcoursItems[parcoursIndex] = item;
  const btn = $('#parcours-save');
  btn.disabled = true;
  try {
    await saveParcours(parcoursIndex === null ? 'Ajouté au parcours.' : 'Parcours mis à jour.');
    parcoursEditor.close();
  } catch (err) {
    console.error(err);
    parcoursItems = previous;
    $('#parcours-status').textContent = explain(err);
  } finally { btn.disabled = false; }
});

/* =====================================================
   CV PDF (settings/cv-fr, settings/cv-en)
   ===================================================== */
const CV_LAYOUT = 4;          // à incrémenter si la mise en page du CV change
let contentReady = false;     // vrai quand toutes les données sont chargées
let cvTimer = null, cvRunning = false, cvAgain = false;
const cvCache = {};

function scheduleCv(delay = 1200) {
  if (!contentReady) return;
  clearTimeout(cvTimer);
  cvTimer = setTimeout(() => refreshCv(), delay);
}

function cvSources() {
  const src = { about, parcours: parcoursItems, skills: skillCards, projects, info, options: cvOptions };
  return { fr: cvData(src, 'fr'), en: cvData(src, 'en') };
}

function setCvState(text, cls = '') {
  const p = $('#cv-state');
  p.textContent = text;
  p.className = cls || 'muted';
}

function renderCvState() {
  const cv = info.cv;
  if (!cv?.updatedAt) { setCvState('Pas encore généré : le bouton « Mon CV » est masqué sur le site.'); return; }
  const date = cv.updatedAt.toDate ? cv.updatedAt.toDate() : new Date(cv.updatedAt);
  setCvState(`✓ À jour — généré le ${date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}, en français et en anglais.`, 'ok-text');
}

async function refreshCv(force = false) {
  if (cvRunning) { cvAgain = true; return; }
  cvRunning = true;
  const btn = $('#cv-generate');
  try {
    const data = cvSources();
    const photo = profilePhoto || DEFAULT_PHOTO;
    const hash = await cvHash({ layout: CV_LAYOUT, data, photo: about.cvPhoto ? photo.slice(-200) + photo.length : '' });
    if (!force && info.cv?.hash === hash) { renderCvState(); return; }
    btn.disabled = true;
    setCvState('Génération du CV en cours…');
    const out = {};
    for (const lang of ['fr', 'en']) {
      const { dataUrl } = await generateCv(data[lang], photo);
      if (dataUrl.length > 900_000) throw new Error('Le CV dépasse la taille autorisée (essaie sans la photo).');
      out[lang] = dataUrl;
    }
    const batch = fs.writeBatch(db);
    for (const lang of ['fr', 'en']) {
      batch.set(fs.doc(db, 'settings', `cv-${lang}`), { pdf: out[lang], size: Math.round(out[lang].length * 0.75), updatedAt: fs.serverTimestamp() });
    }
    batch.set(fs.doc(db, 'settings', 'info'), { cv: { updatedAt: fs.serverTimestamp(), hash } }, { merge: true });
    await batch.commit();
    Object.assign(cvCache, out);
    info.cv = { updatedAt: new Date(), hash };
    renderCvState();
    toast('CV mis à jour (français + anglais).');
  } catch (err) {
    console.error(err);
    setCvState(`Le CV n'a pas pu être mis à jour : ${explain(err)}`, 'err-text');
  } finally {
    cvRunning = false;
    btn.disabled = false;
    if (cvAgain) { cvAgain = false; scheduleCv(0); }
  }
}
$('#cv-generate').addEventListener('click', () => refreshCv(true));

/* ---------- Personnalisation du contenu du CV (settings/cvOptions) ---------- */
let cvOptions = sanitizeCvOptions(null);
const cvForm = $('#cv-custom-form');
const cvSectionsBox = $('#cv-sections');

async function loadCvOptions() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'cvOptions'));
    cvOptions = sanitizeCvOptions(snap.exists() ? snap.data() : null);
    fillCvSections();
  } catch (err) { console.error(err); }
}

function cvCheck(key, label, { sub = false, tag = '' } = {}) {
  const box = el('input', { type: 'checkbox', checked: !cvOptions.hidden.includes(key) });
  box.dataset.key = key;
  return el('label', { class: `cv-check ${sub ? 'sub' : ''}` }, [box, el('span', {}, [label, tag ? el('span', { class: 'tag', text: tag }) : null])]);
}

function renderCvOptions() {
  const groups = [];
  if (parcoursItems.length) groups.push(el('div', { class: 'cv-group' }, [
    el('h3', { text: 'Parcours' }),
    ...parcoursItems.map(i => cvCheck(cvKey.parcours(i), i.title, { tag: PARCOURS_KINDS[i.kind].fr }))
  ]));
  if (skillCards.length) groups.push(el('div', { class: 'cv-group' }, [
    el('h3', { text: 'Compétences' }),
    ...skillCards.flatMap(c => [cvCheck(cvKey.skillCard(c), c.title), ...c.items.map(i => cvCheck(cvKey.skillItem(c, i), i.name, { sub: true }))])
  ]));
  const published = projects.filter(p => p.published);
  if (published.length) groups.push(el('div', { class: 'cv-group' }, [
    el('h3', { text: `Projets publiés (maximum ${about.cvProjects} sur le CV — réglable dans Profil)` }),
    ...published.map(p => cvCheck(cvKey.project(p), p.title || 'Sans titre'))
  ]));
  $('#cv-checks').replaceChildren(...groups);
}

function addCvSection(x = { title: '', titleEn: '', text: '', textEn: '' }) {
  const field = (tag, name, value, label, extra = {}) => el(tag, { name, value, 'aria-label': label, placeholder: label, ...extra });
  const row = el('div', { class: 'cv-section-row' }, [
    el('div', { class: 'row-head' }, [el('strong', { text: 'Rubrique' }), (() => {
      const del = el('button', { type: 'button', class: 'btn btn-ghost btn-small', text: 'Retirer' });
      del.addEventListener('click', () => row.remove());
      return del;
    })()]),
    field('input', 'title', x.title, 'Titre (ex. Certifications)', { maxLength: 60 }),
    field('textarea', 'text', x.text, 'Contenu — une ligne par point', { rows: 3, maxLength: 1500 }),
    field('input', 'titleEn', x.titleEn, 'Title in English (e.g. Certifications)', { maxLength: 60 }),
    field('textarea', 'textEn', x.textEn, 'Content in English — one line per item', { rows: 3, maxLength: 1500 })
  ]);
  cvSectionsBox.append(row);
  return row;
}
$('#add-cv-section').addEventListener('click', () => $('input', addCvSection()).focus());

function fillCvSections() {
  cvSectionsBox.replaceChildren();
  cvOptions.sections.forEach(addCvSection);
}

cvForm.addEventListener('submit', async e => {
  e.preventDefault();
  const hidden = $$('#cv-checks input[type=checkbox]').filter(b => !b.checked).map(b => b.dataset.key);
  // Les éléments masqués qui n'existent plus sont oubliés ; ceux d'une carte masquée sont déjà couverts par la carte
  const sections = $$('.cv-section-row', cvSectionsBox).map(r => Object.fromEntries(['title', 'titleEn', 'text', 'textEn'].map(k => [k, $(`[name=${k}]`, r).value])));
  const next = sanitizeCvOptions({ hidden, sections });
  const btn = $('#cv-custom-save');
  btn.disabled = true;
  try {
    await fs.setDoc(fs.doc(db, 'settings', 'cvOptions'), { ...next, updatedAt: fs.serverTimestamp() });
    cvOptions = next;
    $('#cv-custom-status').textContent = 'Enregistré. Le CV se met à jour…';
    toast('Contenu du CV enregistré.');
    scheduleCv(0);
  } catch (err) { console.error(err); toast(explain(err), 'err'); }
  finally { btn.disabled = false; }
});
$('#tab-cv').addEventListener('click', () => { renderCvOptions(); });


$$('[data-cv-preview]').forEach(b => b.addEventListener('click', async () => {
  const lang = b.dataset.cvPreview;
  const win = window.open('', '_blank');   // ouvert tout de suite pour éviter le blocage des pop-ups
  try {
    let pdf = cvCache[lang];
    if (!pdf) {
      const snap = await fs.getDoc(fs.doc(db, 'settings', `cv-${lang}`));
      pdf = snap.exists() ? snap.data().pdf : '';
    }
    if (!/^data:application\/pdf;base64,/.test(pdf || '')) {
      win?.close();
      toast('Le CV n\'a pas encore été généré.', 'err');
      return;
    }
    const url = URL.createObjectURL(await (await fetch(pdf)).blob());
    if (win) win.location.href = url; else location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (err) { win?.close(); toast(explain(err), 'err'); }
}));

/* =====================================================
   QR CODE DU PORTFOLIO
   ===================================================== */
function qrModules() {
  const q = qrcode(0, 'M');
  q.addData($('#qr-lang').value === 'en' ? `${SITE_URL}?lang=en` : SITE_URL);
  q.make();
  const n = q.getModuleCount();
  return { n, dark: (r, c) => q.isDark(r, c) };
}
function qrSvg(color = '#0b1a2b') {
  const { n, dark } = qrModules();
  const m = 4, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}
function renderQr() {
  const img = el('img', { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg())}`, alt: '' });
  $('#qr-preview').replaceChildren(img);
}
function download(href, name) {
  const a = el('a', { href, download: name });
  document.body.append(a); a.click(); a.remove();
}
$('#qr-lang').addEventListener('change', renderQr);
$('#qr-svg').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([qrSvg()], { type: 'image/svg+xml' }));
  download(url, `QR-portfolio-${$('#qr-lang').value}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
});
$('#qr-png').addEventListener('click', () => {
  const { n, dark } = qrModules();
  const scale = 24, m = 4;
  const canvas = el('canvas', { width: (n + m * 2) * scale, height: (n + m * 2) * scale });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0b1a2b';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) ctx.fillRect((c + m) * scale, (r + m) * scale, scale, scale);
  download(canvas.toDataURL('image/png'), `QR-portfolio-${$('#qr-lang').value}.png`);
});
renderQr();

/* Nettoyage : les services GoatCounter / EmailJS ont été retirés, on supprime leurs réglages enregistrés.
   On vérifie d'abord l'existence du document pour ne pas écrire inutilement à chaque connexion. */
async function removeOldIntegrations() {
  try {
    const ref = fs.doc(db, 'settings', 'integrations');
    if ((await fs.getDoc(ref)).exists()) await fs.deleteDoc(ref);
  } catch (err) { console.warn(err); }
}

start();
