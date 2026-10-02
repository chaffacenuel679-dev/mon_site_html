import {
  isConfigured, getFirestoreKit, safeImage, safeLink, formatMonth, sortProjects
} from './firebase.js';
import { sanitizeSkills, renderSkillCard, YEAR_OPTIONS } from './skills.js';

window.__siteReady = true;
const root = document.documentElement;
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

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
const hero = $('#hero');
const aboutPhoto = $('#profile-photo');
const timeline = $('#timeline');
const tlItems = $$('.tl-item', timeline);
let ticking = false;
function onScroll() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
  nav.classList.toggle('scrolled', y > 24);
  nav.classList.toggle('on-dark', y < hero.offsetHeight - nav.offsetHeight);

  if (!reduceMotion) {
    const pr = aboutPhoto.getBoundingClientRect();
    if (pr.bottom > 0 && pr.top < innerHeight) {
      aboutPhoto.style.setProperty('--py', `${((pr.top + pr.height / 2 - innerHeight / 2) * -0.06).toFixed(1)}px`);
    }
  }

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
function splitTitle(title) {
  let i = 0;
  const walk = node => [...node.childNodes].forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(' '); return; }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', i++);
        w.append(inner);
        frag.append(w);
      });
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') walk(child);
  });
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  walk(title);
  title.classList.add('split');
}
if (!reduceMotion) $$('.section-title').forEach(splitTitle);

function observeReveal(scope = document) {
  $$('.reveal:not(.visible)', scope).forEach(el => revealIO.observe(el));
}
observeReveal();

// Halo lumineux qui suit la souris sur les cartes de compétences
function spotlight(scope = document) {
  $$('.skill-card', scope).forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}
spotlight();

/* ---------------- Projets : illustrations et inclinaison 3D ---------------- */
const ICONS = {
  'Mécanique & CAO': '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  'Fabrication & Atelier': '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  'Électronique & Arduino': '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  'Programmation & Web': '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  'Intelligence Artificielle': '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3 3.5M7 17l3-3.5M14 10.5l3-3.5M14 13.5l3 3.5"/>',
  'Art & Astronomie': '<circle cx="12" cy="12" r="5"/><path d="M3.5 15.5c-1.2-2 3.5-5.6 9-7.4s10-1.7 10.9.3-3.5 5.4-9 7.2-9.7 1.9-10.9-.1z"/><path d="M4 4v3M2.5 5.5h3M19 19v2M18 20h2"/>',
  Autre: '<path d="M3 21 21 3M7 21H3v-4M14 3h7v7"/><path d="M3 12h4M12 21v-4"/>'
};

function enhanceCards(scope = grid) {
  $$('.project-card', scope).forEach((card, i) => {
    if (card.dataset.enhanced) return;
    card.dataset.enhanced = '1';
    const thumb = $('.project-thumb', card);
    if (thumb?.classList.contains('placeholder')) {
      const art = (ICONS[card.dataset.category] || ICONS.Autre).replace(/\/>/g, ' pathLength="1"/>');
      thumb.classList.add('has-art');
      thumb.insertAdjacentHTML('beforeend', `<span class="thumb-art" aria-hidden="true"><svg viewBox="0 0 24 24">${art}</svg></span><span class="thumb-num" aria-hidden="true">${thumb.dataset.glyph || String(i + 1).padStart(2, '0')}</span>`);
    }
    if (!finePointer || reduceMotion) return;
    card.append(el('span', { class: 'glare', 'aria-hidden': 'true' }));
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - py) * 7).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

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
enhanceCards();

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
    const [snap, profile, skills, info] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'projects'), fs.where('published', '==', true))),
      fs.getDoc(fs.doc(db, 'settings', 'profile')).catch(() => null),
      fs.getDoc(fs.doc(db, 'settings', 'skills')).catch(() => null),
      fs.getDoc(fs.doc(db, 'settings', 'info')).catch(() => null)
    ]);

    // Compétences gérées depuis l'administration
    const cards = skills?.exists() ? sanitizeSkills(skills.data().cards) : [];
    if (cards.length) {
      const skillsGrid = $('.skills-grid');
      skillsGrid.replaceChildren(...cards.map(renderSkillCard));
      spotlight(skillsGrid);
      observeReveal(skillsGrid);
    }

    // Année d'étude
    const year = info?.exists() ? YEAR_OPTIONS.find(y => y.value === Number(info.data().gmpYear)) : null;
    if (year) {
      $('#stat-year').innerHTML = year.stat;
      $('#about-year').textContent = year.text;
    }

    const photo = profile?.exists() ? safeImage(profile.data().photo) : '';
    if (photo) $('#profile-photo').src = photo;

    if (snap.empty) return; // on garde les projets par défaut
    const list = sortProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    list.forEach(p => projectsById.set(p.id, p));
    grid.replaceChildren(...list.map(renderProjectCard));
    buildFilters();
    enhanceCards();
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

/* =====================================================
   EFFETS VISUELS
   ===================================================== */

/* ---- Texte qui s'écrit tout seul ---- */
(function typewriter() {
  const el = $('#typed');
  if (!el || reduceMotion) return;
  const words = ['des pièces mécaniques', 'des modèles 3D', 'des montages Arduino', 'des sites web', 'des solutions d\'IA'];
  let w = 0, c = words[0].length, deleting = true;
  const tick = () => {
    const word = words[w];
    c += deleting ? -1 : 1;
    el.textContent = word.slice(0, c);
    let delay = deleting ? 35 : 70;
    if (!deleting && c === word.length) { deleting = true; delay = 2200; }
    else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 3200);
})();

/* ---- Champ d'étoiles interactif (clin d'œil à l'astronomie) ---- */
(function starfield() {
  const canvas = $('#hero-stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, stars = [], running = false, visible = true;
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(120, (w * h) / 12000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.3 + 0.3, t: Math.random() * Math.PI * 2
    }));
  }

  function draw(move = true) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (move) {
        s.x += s.vx; s.y += s.vy; s.t += 0.02;
        if (s.x < -10) s.x = w + 10; else if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10; else if (s.y > h + 10) s.y = -10;
      }
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 12100) {
          ctx.strokeStyle = `rgba(150, 190, 240, ${(1 - Math.sqrt(d2) / 110) * 0.16})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const mx = a.x - mouse.x, my = a.y - mouse.y, md = Math.sqrt(mx * mx + my * my);
      if (md < 170) {
        ctx.strokeStyle = `rgba(240, 160, 102, ${(1 - md / 170) * 0.55})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    for (const s of stars) {
      ctx.fillStyle = `rgba(225, 236, 250, ${0.35 + 0.45 * (0.5 + 0.5 * Math.sin(s.t))})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop() {
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
  }
  function update() {
    const should = visible && !document.hidden && !reduceMotion;
    if (should && !running) { running = true; requestAnimationFrame(loop); }
    else if (!should) running = false;
  }

  resize();
  draw(false);
  addEventListener('resize', () => { resize(); draw(false); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(hero);
  document.addEventListener('visibilitychange', update);
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  update();
})();

/* ---- Boutons magnétiques ---- */
if (finePointer && !reduceMotion) {
  $$('.magnet').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.22}px, ${dy * 0.32}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}
