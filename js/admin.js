import {
  isConfigured, getFirestoreKit, getAuthKit, ADMIN_EMAIL, CATEGORIES,
  safeImage, safeLink, formatMonth, sortProjects
} from './firebase.js';
import { processPhoto, thumbFromDataUrl, decodeImage, encode, PROFILE } from './image-utils.js';

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
    loadProjects();
    loadMessages();
    loadProfile();
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

function renderProjects() {
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
      p.date ? el('span', { class: 'status', text: formatMonth(p.date) }) : null
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

$('#f-category').append(...CATEGORIES.map(c => el('option', { value: c, text: c })));

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
    form.elements.category.value = CATEGORIES.includes(p.category) ? p.category : 'Autre';
    form.elements.date.value = p.date || '';
    form.elements.summary.value = p.summary || '';
    form.elements.description.value = p.description || '';
    form.elements.tags.value = (p.tags || []).join(', ');
    form.elements.link.value = p.link || '';
    form.elements.order.value = p.order ?? 0;
    form.elements.published.checked = Boolean(p.published);
    form.elements.featured.checked = Boolean(p.featured);
  } else {
    form.elements.order.value = projects.length;
  }
  updateCounters();
  renderPhotos();
  editor.showModal();
  form.elements.title.focus();

  if (p?.images?.length) {
    $('#editor-status').textContent = 'Chargement des photos…';
    try {
      const docs = await imagesOf(p.id);
      const byId = new Map(docs.map(d => [d.id, d.data()]));
      state.images = p.images.filter(i => byId.has(i.id)).map(i => {
        const d = byId.get(i.id);
        return { key: ++keySeq, id: i.id, caption: i.caption || d.caption || '', savedCaption: i.caption || d.caption || '', preview: safeImage(d.data), width: d.width, height: d.height, savedPublished: d.published };
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
  const items = list.slice(0, room).map(file => ({ key: ++keySeq, id: null, caption: '', preview: '', processing: true, file }));
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

function closeEditor() {
  if (busy) return;
  const dirty = state && (state.images.some(i => !i.id) || state.removed.length);
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
      link: link ? safeLink(link) : '',
      order: Number(form.elements.order.value) || 0,
      published,
      featured: form.elements.featured.checked,
      cover,
      coverId: coverImg?.id || '',
      images: state.images.map(i => ({ id: i.id, caption: i.caption.trim() })),
      updatedAt: fs.serverTimestamp()
    };
    if (state.isNew) data.createdAt = fs.serverTimestamp();
    await fs.setDoc(projectRef, data, { merge: true });

    state.isNew = false;
    busy = false;
    editor.close();
    toast(published ? 'Projet enregistré et publié.' : 'Projet enregistré en brouillon.');
    loadProjects();
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
async function loadProfile() {
  try {
    const snap = await fs.getDoc(fs.doc(db, 'settings', 'profile'));
    const photo = snap.exists() ? safeImage(snap.data().photo) : '';
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
    $('#profile-status').textContent = 'Photo par défaut du site.';
    toast('Photo par défaut rétablie.');
  } catch (err) { toast(explain(err), 'err'); }
});

start();
