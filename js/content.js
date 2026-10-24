// Contenus du portfolio : valeurs par défaut (reprises du site), catégories, traductions de termes.
// Partagé entre le site public (main.js), l'administration (admin.js) et le CV (cv.js).

export const SITE_URL = 'https://chaffacenuel679-dev.github.io/mon_site_html/';

/* ---------------- Catégories de projets ---------------- */
export const CATEGORIES = [
  { fr: 'Mécanique & CAO', en: 'Mechanical & CAD' },
  { fr: 'Fabrication & Atelier', en: 'Manufacturing & Workshop' },
  { fr: 'Électronique & Arduino', en: 'Electronics & Arduino' },
  { fr: 'Programmation & Web', en: 'Programming & Web' },
  { fr: 'Intelligence Artificielle', en: 'Artificial Intelligence' },
  { fr: 'Art & Astronomie', en: 'Art & Astronomy' },
  { fr: 'Autre', en: 'Other' }
];
export const categoryLabel = (cat, lang) =>
  lang === 'en' ? (CATEGORIES.find(c => c.fr === cat)?.en || cat) : cat;

/* ---------------- Glossaire : traduction automatique des termes courts ----------------
   Utilisé quand la version anglaise d'une compétence ou d'un mot-clé n'a pas été saisie. */
const GLOSSARY = {
  'mécanique': 'Mechanics', 'conception': 'Design', 'technologie': 'Technology', 'fabrication': 'Manufacturing',
  'génie mécanique': 'Mechanical engineering', 'dao & cao 2d / 3d': '2D / 3D CAD & drafting', 'dao & cao': 'CAD & drafting',
  'informatique & ia': 'Computing & AI', 'informatique & électronique': 'Computing & electronics',
  'digital & savoir-être': 'Digital & soft skills', 'outils & soft skills': 'Tools & soft skills',
  'statique graphique': 'Graphical statics', 'mécanique des solides': 'Solid mechanics',
  'résistance des matériaux': 'Strength of materials', 'rdm': 'Strength of materials', 'thermodynamique': 'Thermodynamics',
  'transferts de chaleur': 'Heat transfer', 'mécanique des fluides': 'Fluid mechanics',
  'dessin technique 2d': '2D technical drawing', 'dessin technique': 'Technical drawing', 'modélisation 3d': '3D modeling',
  'procédés de fabrication': 'Manufacturing processes', 'cotation': 'Dimensioning', 'métrologie': 'Metrology',
  'usinage': 'Machining', 'usinage sur tour': 'Lathe machining', 'tournage': 'Turning', 'fraisage': 'Milling',
  'soudure': 'Welding', 'soudage': 'Welding', 'ajustage': 'Fitting', 'perçage': 'Drilling', 'machines-outils': 'Machine tools',
  'modèles de langage (llms) & prompt engineering': 'Large language models (LLMs) & prompt engineering',
  'outils ia : claude, grok, gpt': 'AI tools: Claude, Grok, GPT', 'automatisation intelligente': 'Intelligent automation',
  'développement & création de sites web': 'Website development', 'développement web': 'Web development',
  'arduino & électronique': 'Arduino & electronics', 'arduino (electronique)': 'Arduino (electronics)',
  'arduino (électronique)': 'Arduino (electronics)', 'arduino (programmation)': 'Arduino (programming)',
  'électronique': 'Electronics', 'programmation': 'Programming', 'machine learning': 'Machine learning',
  'intelligence artificielle': 'Artificial intelligence', 'pack office & google workspace': 'Microsoft Office & Google Workspace',
  'français (courant) · anglais (b1)': 'French (fluent) · English (B1)', "esprit d'analyse & curiosité": 'Analytical mind & curiosity',
  'travail en équipe': 'Teamwork', 'autonomie': 'Autonomy', 'rigueur': 'Rigor', 'créativité': 'Creativity',
  'servo moteur': 'Servo motor', 'servomoteur': 'Servo motor', 'capteur ultrasons': 'Ultrasonic sensor',
  'capteur à ultrasons': 'Ultrasonic sensor', 'programme arduino': 'Arduino code', 'astronomie': 'Astronomy',
  'prototypage': 'Prototyping', 'cao': 'CAD', 'dao 2d & 3d': '2D & 3D drafting', 'dao 3d': '3D CAD', 'dao 2d/3d': '2D/3D CAD',
  'ia & llms': 'AI & LLMs', 'ia art': 'AI art', 'art numérique': 'Digital art', 'design': 'Design', 'gmp': 'MPE', 'insti': 'INSTI'
};
/** Traduit un terme court si le glossaire le connaît, sinon le renvoie tel quel. */
export const translateTerm = text => GLOSSARY[String(text || '').trim().toLowerCase()] || text;

/** Choisit la version anglaise d'un champ (champEn) si elle existe, sinon la version française. */
export function pick(obj, field, lang) {
  if (!obj) return '';
  if (lang === 'en') {
    const en = obj[field + 'En'];
    if (Array.isArray(en) ? en.length : typeof en === 'string' && en.trim()) return en;
  }
  return obj[field];
}
/** Vrai si la valeur affichée en anglais est en fait le texte français (traduction manquante). */
export const isFallback = (obj, field, lang) => lang === 'en' && !(obj?.[field + 'En'] && String(obj[field + 'En']).trim());

/* ---------------- Année d'étude ---------------- */
export const YEAR_OPTIONS = [
  { value: 1, stat: '1<sup>re</sup> année GMP', text: 'première année', statEn: 'Year 1 · Mech. Eng.', textEn: 'first-year' },
  { value: 2, stat: '2<sup>e</sup> année GMP', text: 'deuxième année', statEn: 'Year 2 · Mech. Eng.', textEn: 'second-year' },
  { value: 3, stat: '3<sup>e</sup> année GMP', text: 'troisième année', statEn: 'Year 3 · Mech. Eng.', textEn: 'third-year' }
];
export const yearInfo = n => YEAR_OPTIONS.find(y => y.value === Number(n)) || YEAR_OPTIONS[1];

/* ---------------- Disponibilité (badge du haut de page) ---------------- */
export const AVAILABILITY = {
  open: { fr: 'Disponible pour stages & collaborations', en: 'Open to internships & collaborations', tone: 'green' },
  internship: { fr: 'En stage actuellement', en: 'Currently on an internship', tone: 'orange' },
  unavailable: { fr: 'Non disponible pour le moment', en: 'Not available at the moment', tone: 'grey' },
  hidden: { fr: 'Masquer le badge', en: '', tone: 'none' }
};

/* ---------------- Profil et textes de présentation ---------------- */
export const DEFAULT_ABOUT = {
  hero: "Étudiant en Génie Mécanique et Productique à l'INSTI Lokossa (Bénin), titulaire d'un Bac scientifique série D. Je relie l'ingénierie et la technologie : de la conception CAO à l'électronique embarquée et au web.",
  heroEn: 'Mechanical and Production Engineering student at INSTI Lokossa (Benin), with a scientific baccalaureate (series D). I bridge engineering and technology: from CAD design to embedded electronics and the web.',
  about: "Je suis **Cénuel Oyéniran CHAFFA**, étudiant en {annee} de Génie Mécanique et Productique à l'Institut National Supérieur de Technologie Industrielle (INSTI) de Lokossa, au Bénin. Titulaire d'un **Baccalauréat Scientifique série D**, j'ai bâti une solide base scientifique qui nourrit mes études d'ingénieur.\n\nJe maîtrise le **dessin technique assisté par ordinateur en 2D et 3D** (DAO/CAO), compétence clé que j'applique dans mes travaux de conception et de modélisation.\n\nMa passion pour l'ingénierie dépasse les salles de cours : je me forme en autodidacte à l'informatique appliquée, à l'électronique (Arduino) et à l'intelligence artificielle avec la mise en place de projets de Machine Learning.\n\nJe m'exprime avec aisance en **français et en anglais**, à l'oral comme à l'écrit.",
  aboutEn: "I'm **Cénuel Oyéniran CHAFFA**, a {year} student in Mechanical and Production Engineering at the Institut National Supérieur de Technologie Industrielle (INSTI) in Lokossa, Benin. With a **scientific baccalaureate (series D)**, I have built a solid scientific foundation for my engineering studies.\n\nI am proficient in **2D and 3D computer-aided design and drafting** (CAD), a key skill I apply in my design and modeling work.\n\nMy passion for engineering goes beyond the classroom: I am teaching myself applied computing, electronics (Arduino) and artificial intelligence, building Machine Learning projects along the way.\n\nI communicate comfortably in **French and English**, both spoken and written.",
  tags: 'DAO 2D & 3D, CAO, Mécanique, Prototypage, Arduino, Électronique, Développement web, IA & LLMs, Astronomie',
  tagsEn: '2D & 3D drafting, CAD, Mechanics, Prototyping, Arduino, Electronics, Web development, AI & LLMs, Astronomy',
  title: 'Étudiant en Génie Mécanique et Productique',
  titleEn: 'Mechanical and Production Engineering student',
  cvSummary: "Étudiant en {annee} de Génie Mécanique et Productique à l'INSTI Lokossa, je conçois et modélise des pièces en DAO/CAO 2D et 3D et je réalise des prototypes électroniques (Arduino). Rigoureux et curieux, je souhaite mettre mes compétences en conception et en fabrication au service d'une équipe lors d'un stage.",
  cvSummaryEn: 'A {year} student in Mechanical and Production Engineering at INSTI Lokossa, I design and model parts in 2D/3D CAD and build electronic prototypes (Arduino). Rigorous and curious, I am looking for an internship where I can put my design and manufacturing skills to work for a team.',
  email: 'chaffacenuel679@gmail.com',
  phone: '+229 01 59 16 82 83',
  linkedin: 'https://linkedin.com/in/cenuel-chaffa',
  location: 'Lokossa, Bénin',
  locationEn: 'Lokossa, Benin',
  languages: [
    { name: 'Français', nameEn: 'French', level: 'Courant', levelEn: 'Fluent' },
    { name: 'Anglais', nameEn: 'English', level: 'Intermédiaire (B1)', levelEn: 'Intermediate (B1)' }
  ],
  interests: 'Astronomie, Intelligence artificielle, Art numérique, Électronique',
  interestsEn: 'Astronomy, Artificial intelligence, Digital art, Electronics',
  cvPhoto: false,
  cvProjects: 4
};

const str = (v, max) => String(v ?? '').slice(0, max);
/** Nettoie le document « settings/about » et complète avec les valeurs par défaut. */
export function sanitizeAbout(raw) {
  const d = DEFAULT_ABOUT, r = raw || {};
  const has = k => typeof r[k] === 'string' && r[k].trim() !== '';
  const text = (k, max) => (has(k) ? str(r[k], max) : d[k]);
  // Les champs anglais ne reprennent la valeur par défaut que si le français n'a pas été personnalisé
  const textEn = (k, max) => (has(k + 'En') ? str(r[k + 'En'], max) : has(k) && r[k] !== d[k] ? '' : d[k + 'En']);
  const langs = Array.isArray(r.languages) ? r.languages : d.languages;
  return {
    hero: text('hero', 400), heroEn: textEn('hero', 400),
    about: text('about', 3000), aboutEn: textEn('about', 3000),
    tags: text('tags', 400), tagsEn: textEn('tags', 400),
    title: text('title', 120), titleEn: textEn('title', 120),
    cvSummary: text('cvSummary', 700), cvSummaryEn: textEn('cvSummary', 700),
    email: text('email', 200), phone: text('phone', 40), linkedin: text('linkedin', 300),
    location: text('location', 120), locationEn: textEn('location', 120),
    languages: langs.slice(0, 8).map(l => ({ name: str(l?.name, 40), nameEn: str(l?.nameEn, 40), level: str(l?.level, 60), levelEn: str(l?.levelEn, 60) })).filter(l => l.name),
    interests: text('interests', 300), interestsEn: textEn('interests', 300),
    cvPhoto: typeof r.cvPhoto === 'boolean' ? r.cvPhoto : d.cvPhoto,
    cvProjects: Number.isFinite(Number(r.cvProjects)) && r.cvProjects !== '' && r.cvProjects != null ? Math.max(0, Math.min(8, Math.round(Number(r.cvProjects)))) : d.cvProjects
  };
}

/** Remplace {annee} / {year} par l'année d'étude. */
export const fillYear = (text, gmpYear, lang) =>
  String(text || '').replace(/\{annee\}|\{year\}/g, lang === 'en' ? yearInfo(gmpYear).textEn : yearInfo(gmpYear).text);

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Texte simple → HTML sûr : **gras** et paragraphes séparés par une ligne vide. */
export function richParagraphs(text) {
  return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => escapeHtml(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'));
}
export const splitList = s => String(s || '').split(',').map(t => t.trim()).filter(Boolean);
export const whatsappLink = phone => `https://wa.me/${String(phone || '').replace(/\D/g, '')}`;

/* ---------------- Parcours : formations et expériences ---------------- */
export const PARCOURS_KINDS = { education: { fr: 'Formation', en: 'Education' }, experience: { fr: 'Expérience pro.', en: 'Professional experience' } };

export const DEFAULT_PARCOURS = [
  {
    kind: 'education', period: '2025 — En cours', periodEn: '2025 — Present',
    title: 'Génie Mécanique et Productique', titleEn: 'Mechanical and Production Engineering',
    place: 'INSTI Lokossa · Bénin', placeEn: 'INSTI Lokossa · Benin',
    description: 'Mécanique industrielle, productique, conception et dessin technique assisté par ordinateur (2D et 3D), systèmes de fabrication. Accent sur les technologies de production et la mécanique des solides. Thermodynamique et transferts de chaleur.',
    descriptionEn: 'Industrial mechanics, production engineering, computer-aided design and drafting (2D and 3D), manufacturing systems. Focus on production technologies and solid mechanics. Thermodynamics and heat transfer.'
  },
  {
    kind: 'education', period: '2025', periodEn: '2025',
    title: 'Baccalauréat Scientifique — Série D', titleEn: 'Scientific Baccalaureate — Series D',
    place: 'Bénin', placeEn: 'Benin',
    description: "Sciences de la vie et de la terre, mathématiques et physique-chimie : une fondation scientifique solide pour les études d'ingénieur.",
    descriptionEn: 'Life and earth sciences, mathematics, physics and chemistry: a solid scientific foundation for engineering studies.'
  },
  {
    kind: 'education', period: 'Auto-formation continue', periodEn: 'Ongoing self-learning',
    title: 'Informatique appliquée, électronique & IA', titleEn: 'Applied computing, electronics & AI',
    place: 'Plateformes en ligne · Projets personnels', placeEn: 'Online platforms · Personal projects',
    description: "Programmation (Python, C++, HTML/CSS/JS), Arduino et électronique, création de sites web, fondements de l'IA et des modèles de langage — en parallèle de ma formation.",
    descriptionEn: 'Programming (Python, C++, HTML/CSS/JS), Arduino and electronics, website development, foundations of AI and language models — alongside my studies.'
  }
];

export function sanitizeParcours(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 40).map(i => ({
    kind: i?.kind === 'experience' ? 'experience' : 'education',
    period: str(i?.period, 60), periodEn: str(i?.periodEn, 60),
    title: str(i?.title, 140), titleEn: str(i?.titleEn, 140),
    place: str(i?.place, 140), placeEn: str(i?.placeEn, 140),
    description: str(i?.description, 1200), descriptionEn: str(i?.descriptionEn, 1200)
  })).filter(i => i.title);
}

/* ---------------- Fiche technique des projets ---------------- */
export const SPEC_FIELDS = [
  { key: 'software', fr: 'Logiciels & outils', en: 'Software & tools', hint: 'SolidWorks, AutoCAD, Arduino IDE…' },
  { key: 'materials', fr: 'Matériaux & composants', en: 'Materials & components', hint: 'Acier S235, Arduino Uno, servomoteur…' },
  { key: 'process', fr: 'Procédés & méthodes', en: 'Processes & methods', hint: 'Tournage, soudure, impression 3D…' },
  { key: 'duration', fr: 'Durée', en: 'Duration', hint: '3 semaines' },
  { key: 'role', fr: 'Mon rôle', en: 'My role', hint: 'Conception, fabrication, tests…' },
  { key: 'result', fr: 'Résultat', en: 'Outcome', hint: 'Prototype fonctionnel, pièce conforme aux cotes…' }
];
export function sanitizeSpecs(specs) {
  const out = {};
  SPEC_FIELDS.forEach(f => { const v = str(specs?.[f.key], 300).trim(); if (v) out[f.key] = v; });
  return out;
}

/* ---------------- Personnalisation du CV (settings/cvOptions) ----------------
   Le CV reprend tout le contenu du site automatiquement ; ces réglages permettent seulement
   de masquer des éléments et d'ajouter des rubriques libres. Les nouveaux contenus restent ajoutés tout seuls. */
export const cvKey = {
  parcours: i => `p:${i.kind}:${i.title}`,
  skillCard: c => `s:${c.title}`,
  skillItem: (c, i) => `s:${c.title}:${i.name}`,
  project: p => `j:${p.id}`
};
export function sanitizeCvOptions(raw) {
  const hidden = Array.isArray(raw?.hidden) ? raw.hidden.map(k => str(k, 220)).filter(Boolean).slice(0, 400) : [];
  const sections = (Array.isArray(raw?.sections) ? raw.sections : []).slice(0, 4)
    .map(x => ({ title: str(x?.title, 60).trim(), titleEn: str(x?.titleEn, 60).trim(), text: str(x?.text, 1500), textEn: str(x?.textEn, 1500) }))
    .filter(x => x.title && (x.text.trim() || x.textEn.trim()));
  return { hidden, sections };
}
