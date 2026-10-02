import {
  isConfigured, getFirestoreKit, safeImage, safeLink, formatMonth, sortProjects
} from './firebase.js';

window.__siteReady = true;
const root = document.documentElement;
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('#year').textContent = new Date().getFullYear();

/* ---------------- Thème clair / sombre ---------------- */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') || Object.assign(document.createElement('meta'), { name: 'theme-color' });
  meta.content = currentTheme() === 'dark' ? '#111418' : '#f6f4ef';
  document.head.appendChild(meta);
}
$('#theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* stockage indisponible */ }
  syncThemeColor();
});

/* ---------------- Navigation ---------------- */
const nav = $('#nav');
const burger = $('#burger');
const navLinks = $('#nav-links');
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  navLinks.classList.toggle('open', open);
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
navLinks.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

// Lien actif selon la section visible
const linkFor = id => $(`.nav-links a[href="#${id}"]`);
const sectionIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    $$('.nav-links a.active').forEach(a => a.classList.remove('active'));
    linkFor(e.target.id)?.classList.add('active');
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach(s => sectionIO.observe(s));

/* ---------------- Défilement : barre de progression, nav, frise ---------------- */
const progress = $('.scroll-progress');
const timeline = $('#timeline');
const tlItems = $$('.tl-item', timeline);
let ticking = false;
function onScroll() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  nav.classList.toggle('scrolled', y > 24);

  const r = timeline.getBoundingClientRect();
  const mid = innerHeight * 0.6;
  const ratio = Math.min(1, Math.max(0, (mid - r.top) / r.height));
  timeline.style.setProperty('--tl', ratio.toFixed(4));
  tlItems.forEach(item => item.classList.toggle('active', item.getBoundingClientRect().top + 12 < mid));
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ---------------- Révélation au défilement ---------------- */
const revealIO = new IntersectionObserver(entries => {
  const shown = entries.filter(e => e.isIntersecting);
  shown.forEach((e, i) => {
    e.target.style.setProperty('--stagger', `${Math.min(i, 6) * 90}ms`);
    e.target.classList.add('visible');
    revealIO.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
function observeReveal(scope = document) {
  $$('.reveal:not(.visible)', scope).forEach(el => revealIO.observe(el));
}
observeReveal();

// Halo lumineux qui suit la souris sur les cartes de compétences
$$('.skill-card').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

/* ---------------- Projets : filtres ---------------- */
const grid = $('#projects-grid');
const filtersEl = $('#filters');
const emptyMsg = $('#projects-empty');
let activeFilter = 'Tous';

function buildFilters() {
  const cats = [...new Set($$('.project-card', grid).map(c => c.dataset.category).filter(Boolean))];
  filtersEl.replaceChildren();
  if (cats.length < 2) return;
  if (!cats.includes(activeFilter)) activeFilter = 'Tous';
  ['Tous', ...cats].forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-btn';
    b.textContent = cat;
    b.setAttribute('aria-pressed', String(cat === activeFilter));
    b.addEventListener('click', () => applyFilter(cat));
    filtersEl.append(b);
  });
  applyFilter(activeFilter, false);
}

function applyFilter(cat, animate = true) {
  activeFilter = cat;
  $$('.filter-btn', filtersEl).forEach(b => b.setAttribute('aria-pressed', String(b.textContent === cat)));
  let visible = 0;
  $$('.project-card', grid).forEach(card => {
    const show = cat === 'Tous' || card.dataset.category === cat;
    card.classList.toggle('is-hidden', !show);
    if (show) {
      visible++;
      if (animate && !reduceMotion) {
        card.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
          { duration: 450, delay: Math.min(visible, 8) * 50, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      }
    }
  });
  emptyMsg.hidden = visible > 0;
}
buildFilters();

/* ---------------- Projets : rendu depuis Firestore ---------------- */
const projectsById = new Map();

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, v);
    else node[k] = v;
  });
  node.append(...children);
  return node;
}

function renderProjectCard(p, index) {
  const thumb = el('div', { class: 'project-thumb' });
  const cover = safeImage(p.cover);
  if (cover) {
    thumb.append(el('img', { src: cover, alt: '', loading: 'lazy', decoding: 'async' }));
  } else {
    thumb.classList.add('placeholder');
    thumb.dataset.glyph = String(index + 1).padStart(2, '0');
  }
  const count = Array.isArray(p.images) ? p.images.length : 0;
  if (count > 1) thumb.append(el('span', { class: 'thumb-count', text: `${count} photos` }));
  if (p.featured) thumb.append(el('span', { class: 'featured-flag', text: 'À la une' }));

  const tags = (p.tags || []).slice(0, 5).map(t => el('li', { text: t }));
  const body = el('div', { class: 'project-body' }, [
    el('p', { class: 'project-tag', text: p.category || 'Projet' }),
    el('h3', { class: 'project-title' }, [
      el('button', { type: 'button', class: 'card-link', text: p.title || 'Sans titre', 'aria-haspopup': 'dialog' })
    ]),
    el('p', { class: 'project-desc', text: p.summary || '' }),
    tags.length ? el('ul', { class: 'pills' }, tags) : '',
    el('span', { class: 'project-more', 'aria-hidden': 'true' }, ['Voir le détail ', el('span', { class: 'arrow', text: '→' })])
  ]);
  const card = el('article', { class: 'project-card reveal is-clickable', 'data-category': p.category || 'Autre' }, [thumb, body]);
  card.addEventListener('click', () => openProject(p.id));
  return card;
}

async function loadRemoteContent() {
  if (!isConfigured) return;
  try {
    const { db, fs } = await getFirestoreKit();
    const [snap, profile] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'projects'), fs.where('published', '==', true))),
      fs.getDoc(fs.doc(db, 'settings', 'profile')).catch(() => null)
    ]);

    const photo = profile?.exists() ? safeImage(profile.data().photo) : '';
    if (photo) $('#profile-photo').src = photo;

    if (snap.empty) return; // on garde les projets par défaut
    const list = sortProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    list.forEach(p => projectsById.set(p.id, p));
    grid.replaceChildren(...list.map(renderProjectCard));
    buildFilters();
    observeReveal(grid);
  } catch (err) {
    console.warn('Contenu Firebase indisponible, affichage des projets par défaut.', err);
  }
}
loadRemoteContent();

/* ---------------- Fenêtre de détail d'un projet ---------------- */
const modal = $('#project-modal');
const stage = $('#pm-stage');
const pmImage = $('#pm-image');
const pmLoader = $('#pm-loader');
const pmThumbs = $('#pm-thumbs');
const imageCache = new Map();
let gallery = [];
let current = 0;
let openToken = 0;

async function fetchImages(p) {
  if (imageCache.has(p.id)) return imageCache.get(p.id);
  const { db, fs } = await getFirestoreKit();
  const snap = await fs.getDocs(fs.query(
    fs.collection(db, 'projectImages'),
    fs.where('projectId', '==', p.id),
    fs.where('published', '==', true)
  ));
  const byId = new Map(snap.docs.map(d => [d.id, d.data()]));
  const order = Array.isArray(p.images) ? p.images : [];
  const imgs = order
    .filter(i => byId.has(i.id))
    .map(i => ({ src: safeImage(byId.get(i.id).data), caption: i.caption || byId.get(i.id).caption || '' }))
    .filter(i => i.src);
  imageCache.set(p.id, imgs);
  return imgs;
}

function showImage(i) {
  if (!gallery.length) return;
  current = (i + gallery.length) % gallery.length;
  const img = gallery[current];
  pmImage.classList.add('loading');
  pmImage.onload = () => pmImage.classList.remove('loading');
  pmImage.src = img.src;
  pmImage.alt = img.caption || $('#pm-title').textContent;
  $('#pm-caption').textContent = img.caption;
  $('#pm-counter').textContent = gallery.length > 1 ? `${current + 1} / ${gallery.length}` : '';
  $$('button', pmThumbs).forEach((b, j) => b.setAttribute('aria-current', String(j === current)));
  pmThumbs.children[current]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function setGallery(imgs) {
  gallery = imgs;
  stage.classList.toggle('empty', !imgs.length);
  pmImage.hidden = !imgs.length;
  $('#pm-prev').hidden = $('#pm-next').hidden = imgs.length < 2;
  pmThumbs.replaceChildren(...(imgs.length > 1 ? imgs.map((img, j) => {
    const b = el('button', { type: 'button', 'aria-label': `Photo ${j + 1}` }, [el('img', { src: img.src, alt: '' })]);
    b.addEventListener('click', () => showImage(j));
    return b;
  }) : []));
  if (imgs.length) showImage(0);
  else { $('#pm-caption').textContent = ''; $('#pm-counter').textContent = ''; }
}

async function openProject(id) {
  const p = projectsById.get(id);
  if (!p) return;
  const token = ++openToken;
  $('#pm-category').textContent = p.category || 'Projet';
  $('#pm-title').textContent = p.title || 'Sans titre';
  $('#pm-date').textContent = formatMonth(p.date);
  $('#pm-desc').textContent = p.description || p.summary || '';
  $('#pm-tags').replaceChildren(...(p.tags || []).map(t => el('li', { text: t })));
  const link = safeLink(p.link);
  const pmLink = $('#pm-link');
  pmLink.hidden = !link;
  if (link) pmLink.href = link;

  // Aperçu immédiat avec la miniature de couverture, puis photos en haute qualité
  const cover = safeImage(p.cover);
  setGallery(cover ? [{ src: cover, caption: '' }] : []);
  root.style.overflow = 'hidden';
  modal.showModal();

  if (!p.images?.length) return;
  pmLoader.hidden = false;
  try {
    const imgs = await fetchImages(p);
    if (token === openToken && imgs.length) setGallery(imgs);
  } catch (err) {
    console.warn('Impossible de charger les photos', err);
  } finally {
    if (token === openToken) pmLoader.hidden = true;
  }
}

$('#pm-prev').addEventListener('click', () => showImage(current - 1));
$('#pm-next').addEventListener('click', () => showImage(current + 1));
modal.addEventListener('close', () => { root.style.overflow = ''; openToken++; pmLoader.hidden = true; });
modal.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-close]')) modal.close();
});
modal.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') showImage(current - 1);
  if (e.key === 'ArrowRight') showImage(current + 1);
});
let touchX = null;
stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
stage.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 45) showImage(current + (dx < 0 ? 1 : -1));
  touchX = null;
});

/* ---------------- Formulaire de contact ---------------- */
const form = $('#contact-form');
const statusEl = $('#cf-status');
const submitBtn = $('#cf-submit');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = `form-status ${type}`;
}

function mailtoFallback(data) {
  const body = `${data.message}\n\n— ${data.name} (${data.email})`;
  location.href = `mailto:chaffacenuel679@gmail.com?subject=${encodeURIComponent(data.subject || 'Contact depuis le portfolio')}&body=${encodeURIComponent(body)}`;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(form);
  const data = {
    name: String(fd.get('name') || '').trim(),
    email: String(fd.get('email') || '').trim(),
    subject: String(fd.get('subject') || '').trim(),
    message: String(fd.get('message') || '').trim()
  };
  const invalid = {
    name: !data.name,
    email: !EMAIL_RE.test(data.email),
    message: data.message.length < 5
  };
  Object.entries(invalid).forEach(([k, bad]) => form.elements[k].setAttribute('aria-invalid', String(bad)));
  const firstBad = Object.keys(invalid).find(k => invalid[k]);
  if (firstBad) {
    setStatus('Merci de remplir votre nom, un email valide et votre message.', 'err');
    form.elements[firstBad].focus();
    return;
  }
  if (fd.get('website')) { form.reset(); setStatus('Merci ! Votre message a bien été envoyé.', 'ok'); return; }

  if (!isConfigured) { mailtoFallback(data); setStatus('Votre logiciel de messagerie va s\'ouvrir pour envoyer le message.', 'ok'); return; }

  try {
    const last = Number(localStorage.getItem('lastMessageAt') || 0);
    if (Date.now() - last < 60_000) { setStatus('Message déjà envoyé. Patientez une minute avant d\'en envoyer un autre.', 'err'); return; }
  } catch (e) { /* stockage indisponible */ }

  submitBtn.disabled = true;
  setStatus('Envoi en cours…');
  try {
    const { db, fs } = await getFirestoreKit();
    await fs.addDoc(fs.collection(db, 'messages'), { ...data, createdAt: fs.serverTimestamp(), read: false });
    try { localStorage.setItem('lastMessageAt', String(Date.now())); } catch (e) { /* ignoré */ }
    form.reset();
    setStatus('Merci ! Votre message a bien été envoyé. Je vous réponds rapidement.', 'ok');
  } catch (err) {
    console.error(err);
    setStatus('L\'envoi a échoué. Ouverture de votre messagerie…', 'err');
    setTimeout(() => mailtoFallback(data), 900);
  } finally {
    submitBtn.disabled = false;
  }
});
form.addEventListener('input', e => { if (e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });
