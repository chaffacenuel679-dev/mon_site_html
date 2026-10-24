import {
  isConfigured, getFirestoreKit, safeImage, safeLink, formatMonth, sortProjects
} from './firebase.js';
import { sanitizeSkills, renderSkillCard, DEFAULT_SKILLS } from './skills.js';
import { lang, t, applyStatic, setLang } from './i18n.js';
import {
  categoryLabel, pick, isFallback, translateTerm, yearInfo, AVAILABILITY, sanitizeAbout, fillYear,
  richParagraphs, splitList, whatsappLink, DEFAULT_PARCOURS, sanitizeParcours, SPEC_FIELDS, sanitizeSpecs
} from './content.js';

window.__siteReady = true;
// Le site public n'a besoin que de lectures simples : Firestore Lite suffit (≈ 5 fois plus léger)
const getDb = () => getFirestoreKit({ lite: true });
const root = document.documentElement;
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, v);
    else node[k] = v;
  });
  node.append(...children.filter(c => c !== null && c !== undefined && c !== ''));
  return node;
}

/* Contenus du site : valeurs par défaut, remplacées par celles de l'administration (Firebase) */
const state = {
  projects: null,              // projets publiés (null = projets d'exemple écrits dans le HTML)
  skills: null,                // cartes de compétences (null = valeurs par défaut)
  about: sanitizeAbout(null),  // textes de présentation et coordonnées
  parcours: null,              // formations et expériences (null = valeurs par défaut)
  info: { gmpYear: 2, availability: 'open', cv: null }
};

$('#year').textContent = new Date().getFullYear();

/* ---------------- Langue ---------------- */
applyStatic();
root.classList.remove('i18n-pending');
const langBtn = $('#lang-toggle');
function syncLangButton() {
  const other = lang === 'en' ? 'fr' : 'en';
  langBtn.firstElementChild.textContent = other.toUpperCase();
  langBtn.setAttribute('aria-label', t('lang.switch'));
  langBtn.setAttribute('lang', other);
}
syncLangButton();
langBtn.addEventListener('click', () => setLang(lang === 'en' ? 'fr' : 'en'));

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
  burger.setAttribute('aria-label', t(open ? 'menu.close' : 'menu.open'));
  navLinks.classList.toggle('open', open);
}
setMenu(false);
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

/* ---------------- Défilement : barre de progression, nav, frises ---------------- */
const progress = $('.scroll-progress');
const hero = $('#hero');
const aboutPhoto = $('#profile-photo');
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

  const mid = innerHeight * 0.6;
  $$('.timeline').forEach(line => {
    const r = line.getBoundingClientRect();
    if (!r.height) return;
    line.style.setProperty('--tl', Math.min(1, Math.max(0, (mid - r.top) / r.height)).toFixed(4));
    $$('.tl-item', line).forEach(item => item.classList.toggle('active', item.getBoundingClientRect().top + 12 < mid));
  });
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ---------------- Économie d'énergie : animations en pause hors de l'écran ---------------- */
// La zone cachée sous la barre de navigation fixe ne compte pas comme « visible »
const VISIBLE_ZONE = { rootMargin: '-90px 0px 0px 0px' };
const animIO = new IntersectionObserver(entries => {
  entries.forEach(e => e.target.classList.toggle('anim-off', !e.isIntersecting));
}, VISIBLE_ZONE);
$$('#hero, .ticker-wrap, #about, #competences, #contact').forEach(s => animIO.observe(s));

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
const splitTitles = () => { if (!reduceMotion) $$('.section-title').forEach(splitTitle); };
splitTitles();

function observeReveal(scope = document) {
  $$('.reveal:not(.visible)', scope).forEach(node => revealIO.observe(node));
}
observeReveal();
/** Nouvel élément révélable : visible tout de suite si sa section l'est déjà (pas de re-animation). */
function revealable(node, alreadyShown) {
  node.classList.add('reveal');
  if (alreadyShown) node.classList.add('visible');
  return node;
}

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

/* ---------------- Haut de page, présentation et coordonnées ---------------- */
function renderProfile() {
  const a = state.about;
  const avail = AVAILABILITY[state.info.availability] || AVAILABILITY.open;
  const tag = $('#availability');
  tag.hidden = state.info.availability === 'hidden';
  tag.dataset.tone = avail.tone;
  $('#availability-text').textContent = avail[lang] || avail.fr;
  const heroSub = $('#hero-sub');
  heroSub.textContent = pick(a, 'hero', lang);
  heroSub.lang = isFallback(a, 'hero', lang) ? 'fr' : '';
  const y = yearInfo(state.info.gmpYear);
  $('#stat-year').innerHTML = lang === 'en' ? y.statEn : y.stat;
  const paras = $('#about-paras');
  const shown = $('#about .eyebrow')?.classList.contains('visible');
  paras.replaceChildren(...richParagraphs(fillYear(pick(a, 'about', lang), state.info.gmpYear, lang)).map(html => {
    const p = revealable(document.createElement('p'), shown);
    p.innerHTML = html; // texte échappé par richParagraphs (seul le **gras** devient du HTML)
    return p;
  }));
  paras.lang = isFallback(a, 'about', lang) ? 'fr' : '';
  observeReveal(paras);
  $('#about-tags').replaceChildren(...splitList(pick(a, 'tags', lang)).map(tg => el('li', { text: lang === 'en' && isFallback(a, 'tags', lang) ? translateTerm(tg) : tg })));
  $('#cl-email').href = `mailto:${a.email}`;
  $('#cl-email-text').textContent = a.email;
  $('#cl-whatsapp').href = whatsappLink(a.phone);
  $('#cl-whatsapp-text').textContent = a.phone;
  const li = safeLink(a.linkedin);
  if (li) { $('#cl-linkedin').href = li; $('#cl-linkedin-text').textContent = li.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }
  $('#cl-location-text').textContent = pick(a, 'location', lang);
  // Boutons CV : visibles dès qu'un CV a été généré depuis l'administration
  $$('.cv-download').forEach(b => { b.hidden = !state.info.cv?.updatedAt; });
}

/* ---------------- Parcours : formations et expériences ---------------- */
function renderParcours() {
  const items = state.parcours ?? DEFAULT_PARCOURS;
  const shown = $('#formation .eyebrow')?.classList.contains('visible');
  const fill = (list, kind) => {
    const keep = list.querySelector('.tl-progress');
    list.replaceChildren(keep, ...items.filter(i => i.kind === kind).map(i => {
      const item = revealable(el('li', { class: 'tl-item' }, [
        el('span', { class: 'tl-dot', 'aria-hidden': 'true' }),
        el('p', { class: 'tl-year', text: pick(i, 'period', lang) }),
        el('h4', { class: 'tl-title', text: pick(i, 'title', lang) }),
        i.place ? el('p', { class: 'tl-place', text: pick(i, 'place', lang) }) : null,
        i.description ? el('p', { class: 'tl-desc', text: pick(i, 'description', lang) }) : null
      ]), shown);
      if (isFallback(i, 'title', lang)) item.lang = 'fr';
      return item;
    }));
    observeReveal(list);
  };
  fill($('#timeline-edu'), 'education');
  fill($('#timeline-exp'), 'experience');
  const hasExp = items.some(i => i.kind === 'experience');
  $('#path-exp').hidden = !hasExp;
  $('#path-grid').classList.toggle('two', hasExp);
  onScroll();
}

/* ---------------- Compétences ---------------- */
let skillsRendered = false;
function renderSkills() {
  // En français sans données Firebase, on garde les cartes écrites dans le HTML
  if (!state.skills && lang === 'fr' && !skillsRendered) return;
  const cards = state.skills ?? sanitizeSkills(DEFAULT_SKILLS);
  const sgrid = $('.skills-grid');
  const shown = $('#competences .eyebrow')?.classList.contains('visible');
  sgrid.replaceChildren(...cards.map(c => {
    const card = renderSkillCard(c, lang);
    if (shown) card.classList.add('visible');
    return card;
  }));
  spotlight(sgrid);
  observeReveal(sgrid);
  skillsRendered = true;
}

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

const grid = $('#projects-grid');
const staticExamples = [...grid.children];   // projets d'exemple écrits dans le HTML

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
const filtersEl = $('#filters');
const emptyMsg = $('#projects-empty');
let activeFilter = 'Tous';

function buildFilters() {
  const cats = [...new Set($$('.project-card', grid).map(c => c.dataset.category).filter(Boolean))];
  filtersEl.replaceChildren();
  if (cats.length < 2) { applyFilter('Tous', false); return; }
  if (!cats.includes(activeFilter)) activeFilter = 'Tous';
  ['Tous', ...cats].forEach(cat => {
    const b = el('button', { type: 'button', class: 'filter-btn', text: cat === 'Tous' ? t('all') : categoryLabel(cat, lang) });
    b.dataset.cat = cat;
    b.setAttribute('aria-pressed', String(cat === activeFilter));
    b.addEventListener('click', () => applyFilter(cat));
    filtersEl.append(b);
  });
  applyFilter(activeFilter, false);
}

function applyFilter(cat, animate = true) {
  activeFilter = cat;
  $$('.filter-btn', filtersEl).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
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

/* ---------------- Projets : rendu depuis Firestore ---------------- */
const projectsById = new Map();
const projectTags = p => {
  const tags = pick(p, 'tags', lang) || [];
  return lang === 'en' && isFallback(p, 'tags', lang) ? tags.map(translateTerm) : tags;
};

function renderProjectCard(p, index, shown) {
  const thumb = el('div', { class: 'project-thumb' });
  const cover = safeImage(p.cover);
  if (cover) {
    thumb.append(el('img', { src: cover, alt: '', loading: 'lazy', decoding: 'async' }));
  } else {
    thumb.classList.add('placeholder');
    thumb.dataset.glyph = String(index + 1).padStart(2, '0');
  }
  const count = Array.isArray(p.images) ? p.images.length : 0;
  if (count > 1) thumb.append(el('span', { class: 'thumb-count', text: t('photos', { n: count }) }));
  if (p.featured) thumb.append(el('span', { class: 'featured-flag', text: t('featured') }));

  const tags = projectTags(p).slice(0, 5).map(tg => el('li', { text: tg }));
  const body = el('div', { class: 'project-body' }, [
    el('p', { class: 'project-tag', text: categoryLabel(p.category, lang) || t('project') }),
    el('h3', { class: 'project-title' }, [
      el('button', { type: 'button', class: 'card-link', text: pick(p, 'title', lang) || t('untitled'), 'aria-haspopup': 'dialog' })
    ]),
    el('p', { class: 'project-desc', text: pick(p, 'summary', lang) || '' }),
    tags.length ? el('ul', { class: 'pills' }, tags) : null,
    el('span', { class: 'project-more', 'aria-hidden': 'true' }, [t('more') + ' ', el('span', { class: 'arrow', text: '→' })])
  ]);
  if (isFallback(p, 'title', lang)) body.lang = 'fr';
  const card = el('article', { class: 'project-card reveal is-clickable', 'data-category': p.category || 'Autre' }, [thumb, body]);
  if (shown) card.classList.add('visible');
  card.addEventListener('click', () => openProject(p.id));
  return card;
}

function renderProjects() {
  const shown = $('#projets .eyebrow')?.classList.contains('visible');
  if (state.projects?.length) {
    grid.replaceChildren(...state.projects.map((p, i) => renderProjectCard(p, i, shown)));
  } else if (grid.firstElementChild !== staticExamples[0]) {
    grid.replaceChildren(...staticExamples);
  }
  buildFilters();
  enhanceCards();
  observeReveal(grid);
}

/* ---------------- Chargement des contenus Firebase ---------------- */
const SETTINGS_DOCS = ['profile', 'skills', 'info', 'about', 'parcours'];

async function loadRemoteContent() {
  const safety = setTimeout(() => root.classList.remove('remote-loading'), 4000);
  try {
    const { db, fs } = await getDb();
    // Deux requêtes en parallèle : les projets publiés et tous les réglages d'un coup
    const [projectsSnap, settingsSnap] = (await Promise.allSettled([
      fs.getDocs(fs.query(fs.collection(db, 'projects'), fs.where('published', '==', true))),
      fs.getDocs(fs.query(fs.collection(db, 'settings'), fs.where(fs.documentId(), 'in', SETTINGS_DOCS)))
    ])).map(r => (r.status === 'fulfilled' ? r.value : null));

    const settings = Object.fromEntries((settingsSnap?.docs || []).map(d => [d.id, d.data()]));
    if (settings.skills) {
      const cards = sanitizeSkills(settings.skills.cards);
      if (cards.length) state.skills = cards;
    }
    if (settings.info) {
      state.info = {
        gmpYear: Number(settings.info.gmpYear) || 2,
        availability: AVAILABILITY[settings.info.availability] ? settings.info.availability : 'open',
        cv: settings.info.cv || null
      };
    }
    if (settings.about) state.about = sanitizeAbout(settings.about);
    if (settings.parcours && Array.isArray(settings.parcours.items)) state.parcours = sanitizeParcours(settings.parcours.items);

    const photo = settings.profile ? safeImage(settings.profile.photo) : '';
    if (photo) {
      aboutPhoto.removeAttribute('srcset');   // sinon le navigateur garderait la photo par défaut
      aboutPhoto.src = photo;
    }

    if (projectsSnap && !projectsSnap.empty) {
      state.projects = sortProjects(projectsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      state.projects.forEach(p => projectsById.set(p.id, p));
    }
    renderAll();
    openFromHash();
  } catch (err) {
    console.warn('Contenu Firebase indisponible, affichage des contenus par défaut.', err);
  } finally {
    clearTimeout(safety);
    root.classList.remove('remote-loading');
  }
}

function renderAll() {
  renderProfile();
  renderParcours();
  renderSkills();
  renderProjects();
}

// Rendu initial : en anglais, on traduit tout de suite les contenus par défaut
if (lang === 'en') renderAll();
else renderProjects();

// Les contenus Firebase sont plus bas dans la page : on les charge juste après l'affichage du haut de page,
// pour ne pas ralentir l'apparition du hero. Des squelettes s'affichent pendant l'attente.
if (isConfigured) {
  root.classList.add('remote-loading');
  const whenIdle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  let started = false;
  const start = () => { if (!started) { started = true; whenIdle(loadRemoteContent); } };
  if (document.readyState === 'complete') start();
  addEventListener('load', start, { once: true });
  setTimeout(start, 1500);   // sur connexion lente, on n'attend pas la fin du chargement des polices
}

/* ---------------- Fenêtre de détail d'un projet ---------------- */
const modal = $('#project-modal');
const stage = $('#pm-stage');
const pmImage = Object.assign(document.createElement('img'), { id: 'pm-image', alt: '' });
stage.prepend(pmImage);
const pmLoader = $('#pm-loader');
const pmThumbs = $('#pm-thumbs');
const imageCache = new Map();
let gallery = [];
let current = 0;
let openToken = 0;
let openId = null;
let pushedHash = false;

async function fetchImages(p) {
  if (imageCache.has(p.id)) return imageCache.get(p.id);
  const { db, fs } = await getDb();
  const snap = await fs.getDocs(fs.query(
    fs.collection(db, 'projectImages'),
    fs.where('projectId', '==', p.id),
    fs.where('published', '==', true)
  ));
  const byId = new Map(snap.docs.map(d => [d.id, d.data()]));
  const order = Array.isArray(p.images) ? p.images : [];
  const imgs = order
    .filter(i => byId.has(i.id))
    .map(i => ({ src: safeImage(byId.get(i.id).data), caption: i.caption || byId.get(i.id).caption || '', captionEn: i.captionEn || '' }))
    .filter(i => i.src);
  imageCache.set(p.id, imgs);
  return imgs;
}

function showImage(i) {
  if (!gallery.length) return;
  current = (i + gallery.length) % gallery.length;
  const img = gallery[current];
  const caption = pick(img, 'caption', lang) || '';
  pmImage.classList.add('loading');
  pmImage.onload = () => pmImage.classList.remove('loading');
  pmImage.src = img.src;
  pmImage.alt = caption || $('#pm-title').textContent;
  $('#pm-caption').textContent = caption;
  $('#pm-counter').textContent = gallery.length > 1 ? `${current + 1} / ${gallery.length}` : '';
  $$('button', pmThumbs).forEach((b, j) => b.setAttribute('aria-current', String(j === current)));
  pmThumbs.children[current]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}

function setGallery(imgs) {
  gallery = imgs;
  stage.classList.toggle('empty', !imgs.length);
  stage.dataset.empty = t('noPhoto');
  pmImage.hidden = !imgs.length;
  $('#pm-prev').hidden = $('#pm-next').hidden = imgs.length < 2;
  pmThumbs.replaceChildren(...(imgs.length > 1 ? imgs.map((img, j) => {
    const b = el('button', { type: 'button', 'aria-label': t('photo', { n: j + 1 }) }, [el('img', { src: img.src, alt: '' })]);
    b.addEventListener('click', () => showImage(j));
    return b;
  }) : []));
  if (imgs.length) showImage(Math.min(current, imgs.length - 1));
  else { $('#pm-caption').textContent = ''; $('#pm-counter').textContent = ''; }
}

const projectUrl = id => {
  const url = new URL(location.pathname, location.origin);
  if (lang === 'en') url.searchParams.set('lang', 'en');
  url.hash = `projet/${id}`;
  return url.href;
};

const SHARE_ICONS = {
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.9l7.6-4.4M8.2 13.1l7.6 4.4"/>'
};
function shareButton(kind, label, props) {
  const b = el(props.href ? 'a' : 'button', { class: 'share-btn', ...props });
  if (!props.href) b.type = 'button';
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SHARE_ICONS[kind]}</svg>`;
  b.append(el('span', { text: label }));
  return b;
}

function renderShare(p) {
  const url = projectUrl(p.id);
  const title = pick(p, 'title', lang) || t('project');
  const text = t('share.text', { title });
  const copy = shareButton('link', t('share.copy'), {});
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); } catch (e) {
      const ta = el('textarea', { value: url }); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    copy.lastElementChild.textContent = t('share.copied');
    setTimeout(() => { copy.lastElementChild.textContent = t('share.copy'); }, 2000);
  });
  const items = [
    el('span', { class: 'pm-share-label', text: t('share') }),
    shareButton('whatsapp', 'WhatsApp', { href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, target: '_blank', rel: 'noopener' }),
    shareButton('linkedin', 'LinkedIn', { href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, target: '_blank', rel: 'noopener' }),
    copy
  ];
  if (navigator.share && !finePointer) {
    const native = shareButton('share', `${t('share')}…`, {});
    native.addEventListener('click', () => navigator.share({ title, text, url }).catch(() => {}));
    items.push(native);
  }
  $('#pm-share').replaceChildren(...items);
}

function renderSpecs(p) {
  const specs = sanitizeSpecs(p.specs);
  const specsEn = sanitizeSpecs(p.specsEn);
  const rows = SPEC_FIELDS.filter(f => specs[f.key] || specsEn[f.key]).flatMap(f => [
    el('dt', { text: f[lang] }),
    el('dd', { text: (lang === 'en' && specsEn[f.key]) || specs[f.key] || specsEn[f.key] })
  ]);
  $('#pm-specs-list').replaceChildren(...rows);
  $('#pm-specs').hidden = !rows.length;
}

function fillModal(p) {
  $('#pm-category').textContent = categoryLabel(p.category, lang) || t('project');
  $('#pm-title').textContent = pick(p, 'title', lang) || t('untitled');
  $('#pm-date').textContent = formatMonth(p.date, lang);
  $('#pm-desc').textContent = pick(p, 'description', lang) || pick(p, 'summary', lang) || '';
  $('.pm-info').lang = isFallback(p, 'title', lang) ? 'fr' : '';
  $('#pm-tags').replaceChildren(...projectTags(p).map(tg => el('li', { text: tg })));
  const link = safeLink(p.link);
  const pmLink = $('#pm-link');
  pmLink.hidden = !link;
  pmLink.href = link || '#';
  renderSpecs(p);
  renderShare(p);
}

async function openProject(id, { fromHash = false } = {}) {
  const p = projectsById.get(id);
  if (!p) return;
  const token = ++openToken;
  openId = id;
  current = 0;
  fillModal(p);

  // Aperçu immédiat avec la miniature de couverture, puis photos en haute qualité
  const cover = safeImage(p.cover);
  setGallery(cover ? [{ src: cover, caption: '' }] : []);
  root.style.overflow = 'hidden';
  if (!modal.open) modal.showModal();
  // Lien direct partageable ; le bouton « retour » du téléphone ferme la fenêtre
  if (!fromHash && location.hash !== `#projet/${id}`) {
    history.pushState({ project: id }, '', `#projet/${id}`);
    pushedHash = true;
  }

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

function openFromHash() {
  const m = /^#projet\/([\w-]+)$/.exec(location.hash);
  if (m && projectsById.has(m[1])) openProject(m[1], { fromHash: true });
}
addEventListener('popstate', () => {
  if (modal.open && !/^#projet\//.test(location.hash)) { pushedHash = false; modal.close(); }
  else openFromHash();
});

$('#pm-prev').addEventListener('click', () => showImage(current - 1));
$('#pm-next').addEventListener('click', () => showImage(current + 1));
modal.addEventListener('close', () => {
  root.style.overflow = ''; openToken++; openId = null; pmLoader.hidden = true;
  if (/^#projet\//.test(location.hash)) {
    if (pushedHash) history.back();
    else history.replaceState(history.state, '', location.pathname + location.search);
  }
  pushedHash = false;
});
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

/* ---------------- CV à télécharger ---------------- */
async function downloadCv(btn) {
  const label = btn.querySelector('[data-i18n]');
  btn.classList.add('busy');
  label.textContent = t('cv.preparing');
  try {
    const { db, fs } = await getDb();
    let snap = await fs.getDoc(fs.doc(db, 'settings', `cv-${lang}`));
    if (!snap.exists() && lang === 'en') snap = await fs.getDoc(fs.doc(db, 'settings', 'cv-fr'));
    const pdf = snap.exists() ? snap.data().pdf : '';
    if (!/^data:application\/pdf;base64,/.test(pdf || '')) throw new Error('CV absent');
    const blob = await (await fetch(pdf)).blob();
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: t('cv.file') });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    console.warn(err);
    alert(t('cv.error'));
  } finally {
    btn.classList.remove('busy');
    applyStatic(btn);
  }
}
$$('.cv-download').forEach(b => b.addEventListener('click', () => downloadCv(b)));

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
  location.href = `mailto:${state.about.email}?subject=${encodeURIComponent(data.subject || t('mail.subject'))}&body=${encodeURIComponent(body)}`;
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
    setStatus(t('form.required'), 'err');
    form.elements[firstBad].focus();
    return;
  }
  if (fd.get('website')) { form.reset(); setStatus(t('form.sent'), 'ok'); return; }

  if (!isConfigured) { mailtoFallback(data); setStatus(t('form.mailto'), 'ok'); return; }

  try {
    const last = Number(localStorage.getItem('lastMessageAt') || 0);
    if (Date.now() - last < 60_000) { setStatus(t('form.wait'), 'err'); return; }
  } catch (e) { /* stockage indisponible */ }

  submitBtn.disabled = true;
  setStatus(t('form.sending'));
  try {
    const { db, fs } = await getDb();
    await fs.addDoc(fs.collection(db, 'messages'), { ...data, createdAt: fs.serverTimestamp(), read: false });
    try { localStorage.setItem('lastMessageAt', String(Date.now())); } catch (e) { /* ignoré */ }
    form.reset();
    setStatus(t('form.sent'), 'ok');
  } catch (err) {
    console.error(err);
    setStatus(t('form.failed'), 'err');
    setTimeout(() => mailtoFallback(data), 900);
  } finally {
    submitBtn.disabled = false;
  }
});
form.addEventListener('input', e => { if (e.target.hasAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); });

/* ---------------- Changement de langue : tout est réaffiché ---------------- */
document.addEventListener('langchange', () => {
  syncLangButton();
  setMenu(navLinks.classList.contains('open'));
  splitTitles();
  renderAll();
  if (openId && projectsById.has(openId)) {
    fillModal(projectsById.get(openId));
    if (gallery.length) showImage(current);
    stage.dataset.empty = t('noPhoto');
  }
  if (statusEl.textContent) setStatus('', '');
  restartTypewriter();
});

/* =====================================================
   EFFETS VISUELS
   ===================================================== */

/* ---- Texte qui s'écrit tout seul ---- */
let restartTypewriter = () => {};
(function typewriter() {
  const typed = $('#typed');
  if (!typed) return;
  if (reduceMotion) {
    typed.textContent = t('typed')[0];
    restartTypewriter = () => { typed.textContent = t('typed')[0]; };
    return;
  }
  let words = t('typed'), w = 0, c = words[0].length, deleting = true, timer;
  typed.textContent = words[0];
  const tick = () => {
    if (document.hidden || hero.classList.contains('anim-off')) { timer = setTimeout(tick, 600); return; }
    const word = words[w];
    c += deleting ? -1 : 1;
    typed.textContent = word.slice(0, c);
    let delay = deleting ? 35 : 70;
    if (!deleting && c === word.length) { deleting = true; delay = 2200; }
    else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
    timer = setTimeout(tick, delay);
  };
  timer = setTimeout(tick, 3200);
  restartTypewriter = () => {
    clearTimeout(timer);
    words = t('typed'); w = 0; c = words[0].length; deleting = true;
    typed.textContent = words[0];
    timer = setTimeout(tick, 2200);
  };
})();

/* ---- Champ d'étoiles interactif (clin d'œil à l'astronomie) ---- */
(function starfield() {
  const canvas = $('#hero-stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const LINK = 110, LINK2 = LINK * LINK, MOUSE = 170;
  const BUCKETS = 4;            // lignes et étoiles regroupées par opacité : 8 tracés par image au lieu de plusieurs centaines
  const FRAME_MS = 1000 / 30;   // 30 images/s suffisent pour un mouvement aussi lent
  let w = 0, h = 0, stars = [], running = false, visible = true, last = 0;
  const mouse = { x: -9999, y: -9999 };

  function seed() {
    const n = Math.round(Math.min(120, (w * h) / 12000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.3 + 0.3, t: Math.random() * Math.PI * 2
    }));
  }

  function resize() {
    const nw = hero.clientWidth, nh = hero.clientHeight;
    if (nw !== w || !stars.length) { w = nw; h = nh; seed(); }
    else if (nh !== h) {
      // Sur mobile, la barre d'adresse change la hauteur pendant le défilement : on garde les mêmes étoiles
      stars.forEach(s => { s.y *= nh / h; });
      h = nh;
    }
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(step = 0) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!step) break;
      s.x += s.vx * step; s.y += s.vy * step; s.t += 0.02 * step;
      if (s.x < -10) s.x = w + 10; else if (s.x > w + 10) s.x = -10;
      if (s.y < -10) s.y = h + 10; else if (s.y > h + 10) s.y = -10;
    }
    const links = Array.from({ length: BUCKETS }, () => new Path2D());
    const toMouse = Array.from({ length: BUCKETS }, () => new Path2D());
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          const k = Math.min(BUCKETS - 1, Math.floor((1 - Math.sqrt(d2) / LINK) * BUCKETS));
          links[k].moveTo(a.x, a.y); links[k].lineTo(b.x, b.y);
        }
      }
      const mx = a.x - mouse.x, my = a.y - mouse.y, m2 = mx * mx + my * my;
      if (m2 < MOUSE * MOUSE) {
        const k = Math.min(BUCKETS - 1, Math.floor((1 - Math.sqrt(m2) / MOUSE) * BUCKETS));
        toMouse[k].moveTo(a.x, a.y); toMouse[k].lineTo(mouse.x, mouse.y);
      }
    }
    ctx.lineWidth = 0.6;
    links.forEach((path, k) => { ctx.strokeStyle = `rgba(150, 190, 240, ${((k + 0.5) / BUCKETS) * 0.16})`; ctx.stroke(path); });
    if (mouse.x > -9999) toMouse.forEach((path, k) => { ctx.strokeStyle = `rgba(240, 160, 102, ${((k + 0.5) / BUCKETS) * 0.55})`; ctx.stroke(path); });
    const dots = Array.from({ length: BUCKETS }, () => new Path2D());
    for (const s of stars) {
      const k = Math.min(BUCKETS - 1, Math.floor((0.5 + 0.5 * Math.sin(s.t)) * BUCKETS));
      dots[k].moveTo(s.x + s.r, s.y); dots[k].arc(s.x, s.y, s.r, 0, Math.PI * 2);
    }
    dots.forEach((path, k) => { ctx.fillStyle = `rgba(225, 236, 250, ${0.35 + 0.45 * ((k + 0.5) / BUCKETS)})`; ctx.fill(path); });
  }

  function loop(ts) {
    if (!running) return;
    if (ts - last >= FRAME_MS) {
      const step = last ? Math.min(3, (ts - last) / (1000 / 60)) : 1;
      last = ts;
      draw(step);
    }
    requestAnimationFrame(loop);
  }
  function update() {
    const should = visible && !document.hidden && !reduceMotion;
    if (should && !running) { running = true; last = 0; requestAnimationFrame(loop); }
    else if (!should) running = false;
  }

  resize();
  draw();
  addEventListener('resize', () => { resize(); draw(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }, VISIBLE_ZONE).observe(hero);
  document.addEventListener('visibilitychange', update);
  if (finePointer) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  }
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
