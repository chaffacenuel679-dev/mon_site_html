// Langue du site : français (texte écrit dans index.html) ou anglais (traductions ci-dessous).
// Priorité : ?lang= dans l'adresse > choix enregistré > langue du navigateur.

const LANGS = ['fr', 'en'];

function detect() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem('lang');
    if (LANGS.includes(saved)) return saved;
  } catch (e) { /* stockage indisponible */ }
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export let lang = detect();

/* ---------------- Textes produits par JavaScript ---------------- */
const UI = {
  fr: {
    'meta.title': 'Cénuel CHAFFA — Ingénieur en devenir',
    'lang.switch': 'Switch to English',
    'menu.open': 'Ouvrir le menu', 'menu.close': 'Fermer le menu',
    'typed': ['des pièces mécaniques', 'des modèles 3D', 'des montages Arduino', 'des sites web', "des solutions d'IA"],
    'photos': '{n} photos', 'featured': 'À la une', 'more': 'Voir le détail', 'project': 'Projet', 'untitled': 'Sans titre',
    'all': 'Tous', 'photo': 'Photo {n}', 'noPhoto': 'Aucune photo pour ce projet',
    'form.required': 'Merci de remplir votre nom, un email valide et votre message.',
    'form.sent': 'Merci ! Votre message a bien été envoyé. Je vous réponds rapidement.',
    'form.mailto': "Votre logiciel de messagerie va s'ouvrir pour envoyer le message.",
    'form.wait': "Message déjà envoyé. Patientez une minute avant d'en envoyer un autre.",
    'form.sending': 'Envoi en cours…', 'form.failed': "L'envoi a échoué. Ouverture de votre messagerie…",
    'mail.subject': 'Contact depuis le portfolio',
    'cv.preparing': 'Préparation…', 'cv.error': 'Le CV est momentanément indisponible. Réessayez plus tard.', 'cv.file': 'CV-Cenuel-CHAFFA.pdf',
    'specs': 'Fiche technique', 'share': 'Partager', 'share.copy': 'Copier le lien', 'share.copied': 'Lien copié !',
    'share.text': 'Découvrez ce projet de Cénuel CHAFFA : {title}'
  },
  en: {
    'meta.title': 'Cénuel CHAFFA — Engineer in the making',
    'lang.switch': 'Passer en français',
    'menu.open': 'Open menu', 'menu.close': 'Close menu',
    'typed': ['mechanical parts', '3D models', 'Arduino builds', 'websites', 'AI solutions'],
    'photos': '{n} photos', 'featured': 'Featured', 'more': 'View details', 'project': 'Project', 'untitled': 'Untitled',
    'all': 'All', 'photo': 'Photo {n}', 'noPhoto': 'No photos for this project',
    'form.required': 'Please enter your name, a valid email address and your message.',
    'form.sent': "Thank you! Your message has been sent. I'll get back to you soon.",
    'form.mailto': 'Your email app will open so you can send the message.',
    'form.wait': 'Message already sent. Please wait a minute before sending another one.',
    'form.sending': 'Sending…', 'form.failed': 'Sending failed. Opening your email app…',
    'mail.subject': 'Contact from your portfolio',
    'cv.preparing': 'Preparing…', 'cv.error': 'The CV is temporarily unavailable. Please try again later.', 'cv.file': 'CV-Cenuel-CHAFFA-EN.pdf',
    'specs': 'Technical sheet', 'share': 'Share', 'share.copy': 'Copy link', 'share.copied': 'Link copied!',
    'share.text': 'Check out this project by Cénuel CHAFFA: {title}'
  }
};

/** Texte d'interface dans la langue courante ; {n} et {title} sont remplacés. */
export function t(key, vars = {}) {
  const v = UI[lang][key] ?? UI.fr[key] ?? key;
  return typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : v;
}

/* ---------------- Textes fixes de la page (attribut data-i18n) ----------------
   Le français est lu directement dans index.html ; seules les traductions anglaises sont ici. */
const STATIC_EN = {
  'skip': 'Skip to content',
  'nav.about': 'About', 'nav.path': 'Background', 'nav.skills': 'Skills', 'nav.projects': 'Projects', 'nav.contact': 'Contact',
  'a.theme': 'Toggle light/dark theme', 'a.scroll': 'Scroll to the About section', 'a.close': 'Close',
  'a.prev': 'Previous photo', 'a.next': 'Next photo', 'a.logo': 'Back to top',
  'hero.hello': 'Hello, I’m', 'hero.role': 'I design',
  'hero.roleSr': 'I design mechanical parts, 3D models, Arduino builds, websites and AI solutions.',
  'cta.projects': 'See my projects', 'cta.contact': 'Contact me', 'cta.cv': 'My CV', 'cta.cvLong': 'Download my CV (PDF)',
  'stat.program': 'Program', 'stat.diploma': 'Diploma', 'stat.design': 'Design', 'stat.bac': 'Bac D', 'stat.cad': '2D/3D CAD', 'stat.elec': 'Electronics',
  'fig.title': 'SPUR GEAR m 14 · Z 20/12 · a 224', 'fig.drawn': 'DRAWN BY C. CHAFFA', 'fig.scale': 'SCALE 1:2',
  'fig.caption': 'Fig. 01 — Spur gear, module 14, ratio 20/12',
  'ticker.1': 'CAD design', 'ticker.2': '2D / 3D technical drawing', 'ticker.3': 'Solid mechanics', 'ticker.4': 'Manufacturing & machining',
  'ticker.5': 'Arduino', 'ticker.6': 'Electronics', 'ticker.7': 'Python · C++', 'ticker.8': 'Web development',
  'ticker.9': 'Artificial intelligence', 'ticker.10': 'Astronomy',
  'about.eyebrow': '01 — About me', 'about.title': 'Curious by nature,<br />rigorous by training.',
  'about.photoAlt': 'Cénuel CHAFFA in his INSTI Lokossa workshop coat', 'about.tagsLabel': 'Interests and skills',
  'path.eyebrow': '02 — Background', 'path.title': 'My background',
  'path.intro': 'Studies focused on industrial engineering and production technologies, alongside hands-on experience.',
  'path.education': 'Education', 'path.experience': 'Professional experience',
  'skills.eyebrow': '03 — What I can do', 'skills.title': 'Skills',
  'skills.intro': 'Solid technical foundations, fuelled by constant curiosity for new technologies.',
  'projects.eyebrow': '04 — Work', 'projects.title': 'Projects &amp; achievements',
  'projects.intro': 'Academic work, parts I designed and made, electronic builds and digital projects.',
  'projects.filters': 'Filter projects', 'projects.empty': 'No projects in this category yet.',
  'ex1.tag': 'Mechanical &amp; CAD', 'ex1.title': 'Designing a mechanical part',
  'ex1.desc': '3D modeling and design of a functional part, with stress analysis and suitable material selection.',
  'ex2.tag': 'Artificial Intelligence', 'ex2.title': 'Exploring LLMs &amp; generative AI',
  'ex2.desc': 'Advanced use of language models for automation, research and technical content creation.',
  'ex3.tag': 'Art &amp; Astronomy', 'ex3.title': 'Science-fiction art &amp; astronomy',
  'ex3.desc': 'Visual creations inspired by astronomy and science fiction, blending scientific rigor and artistic expression.',
  'ex4.tag': 'Mechanical &amp; CAD', 'ex4.title': 'MPE academic portfolio',
  'ex4.desc': 'A structured presentation of lab work, 2D/3D technical drawings and analyses completed at INSTI.',
  'contact.eyebrow': '05 — Contact me', 'contact.title': 'Let’s talk about your project.',
  'contact.lead': 'Open to collaborations, internship opportunities and conversations about engineering, AI and science.',
  'contact.location': 'Location',
  'form.name': 'Your name', 'form.email': 'Email', 'form.subject': 'Subject', 'form.message': 'Message',
  'form.namePh': 'John Smith', 'form.emailPh': 'john@example.com', 'form.subjectPh': 'Collaboration, internship, question…',
  'form.messagePh': 'Tell me about your project or request…', 'form.hp': 'Website', 'form.send': 'Send message',
  'footer.tagline': 'Mechanical engineer in training · Lokossa, Benin', 'footer.top': 'Back to top ↑',
  'modal.view': 'View project', 'modal.specs': 'Technical sheet'
};

/* Contenu français d'origine, mémorisé au premier passage */
const originals = new WeakMap();

/** Applique la langue courante aux textes fixes de la page. */
export function applyStatic(scope = document) {
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    if (!originals.has(el)) originals.set(el, el.innerHTML);
    const en = STATIC_EN[el.dataset.i18n];
    const next = lang === 'en' && en !== undefined ? en : originals.get(el);
    if (el.innerHTML !== next) el.innerHTML = next;   // ne réécrit que ce qui change (évite de redessiner la page)
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const pairs = el.dataset.i18nAttr.split(';').map(p => p.split(':').map(s => s.trim()));
    if (!originals.has(el)) originals.set(el, Object.fromEntries(pairs.map(([attr]) => [attr, el.getAttribute(attr)])));
    const fr = originals.get(el);
    pairs.forEach(([attr, key]) => {
      const en = STATIC_EN[key];
      const next = lang === 'en' && en !== undefined ? en : fr[attr];
      if (next !== null && el.getAttribute(attr) !== next) el.setAttribute(attr, next);
    });
  });
  document.documentElement.lang = lang;
  document.title = t('meta.title');
}

/** Change de langue, mémorise le choix et met à jour l'adresse (lien partageable). */
export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem('lang', next); } catch (e) { /* stockage indisponible */ }
  const url = new URL(location.href);
  if (next === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
  history.replaceState(history.state, '', url);
  applyStatic();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
}
