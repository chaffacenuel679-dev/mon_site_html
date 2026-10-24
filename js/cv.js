// Génération du CV PDF (français ou anglais) à partir des contenus du portfolio.
// Utilisé uniquement par la page d'administration : le PDF produit est enregistré dans Firestore
// (settings/cv-fr et settings/cv-en) puis téléchargé tel quel par les visiteurs du site.
import { SITE_URL, pick, fillYear, splitList, categoryLabel, translateTerm, isFallback, cvKey } from './content.js';
import { skillText, levelLabel } from './skills.js';
import { formatMonth } from './firebase.js';

const INK = '#0b1a2b', ACCENT = '#c8682c', MUTED = '#5b6672', LINE = '#d9dee4';
// A4 = 595 pt de large ; marges 40 pt → 515 pt utiles = colonne principale + 22 pt + colonne latérale de 150 pt
const PAGE_WIDTH = 515, SIDE_WIDTH = 150, GAP = 22, MAIN_WIDTH = PAGE_WIDTH - SIDE_WIDTH - GAP;

const L = {
  fr: {
    profile: 'Profil', education: 'Formation', experience: 'Expériences professionnelles', projects: 'Projets & réalisations',
    skills: 'Compétences', languages: 'Langues', interests: "Centres d'intérêt", contact: 'Contact',
    portfolio: 'Portfolio', scan: 'Scannez pour voir mes projets', updated: 'CV mis à jour le {d}',
    file: 'CV de Cénuel CHAFFA'
  },
  en: {
    profile: 'Profile', education: 'Education', experience: 'Professional experience', projects: 'Projects',
    skills: 'Skills', languages: 'Languages', interests: 'Interests', contact: 'Contact',
    portfolio: 'Portfolio', scan: 'Scan to see my projects', updated: 'CV updated on {d}',
    file: 'CV of Cénuel CHAFFA'
  }
};

/** « texte avec **gras** » → morceaux pdfmake. */
function rich(text) {
  return String(text || '').split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    .map(part => (/^\*\*[^*]+\*\*$/.test(part) ? { text: part.slice(2, -2), bold: true } : part));
}
const plain = text => String(text || '').replace(/\*\*/g, '');

/** Prépare toutes les données utiles au CV (sert aussi à détecter les changements). */
export function cvData({ about, parcours, skills, projects, info, options }, lang) {
  const year = info?.gmpYear ?? 2;
  const hidden = new Set(options?.hidden || []);
  const list = (projects || []).filter(p => p.published && !hidden.has(cvKey.project(p))).slice(0, about.cvProjects);
  return {
    lang,
    name: 'Cénuel Oyéniran CHAFFA',
    title: pick(about, 'title', lang),
    summary: fillYear(pick(about, 'cvSummary', lang), year, lang),
    email: about.email, phone: about.phone, linkedin: about.linkedin,
    location: pick(about, 'location', lang),
    parcours: (parcours || []).filter(i => !hidden.has(cvKey.parcours(i))).map(i => ({
      kind: i.kind, period: pick(i, 'period', lang), title: pick(i, 'title', lang),
      place: pick(i, 'place', lang), description: pick(i, 'description', lang)
    })),
    skills: (skills || []).filter(c => !hidden.has(cvKey.skillCard(c))).map(c => ({
      title: skillText(c, 'title', lang),
      items: c.items.filter(i => !hidden.has(cvKey.skillItem(c, i))).map(i => ({ name: skillText(i, 'name', lang), level: i.level ? levelLabel(i.level, lang) : '' }))
    })).filter(c => c.items.length),
    sections: (options?.sections || []).map(x => ({
      title: pick(x, 'title', lang),
      lines: String(pick(x, 'text', lang) || '').split('\n').map(l => l.trim()).filter(Boolean)
    })).filter(x => x.title && x.lines.length),
    languages: (about.languages || []).map(l => ({ name: pick(l, 'name', lang), level: pick(l, 'level', lang) })),
    interests: splitList(pick(about, 'interests', lang)).map(s => (isFallback(about, 'interests', lang) ? translateTerm(s) : s)),
    projects: list.map(p => ({
      title: pick(p, 'title', lang) || '',
      category: categoryLabel(p.category, lang),
      date: formatMonth(p.date, lang),
      summary: pick(p, 'summary', lang) || ''
    })),
    photo: Boolean(about.cvPhoto)
  };
}

/** Empreinte des données : le CV n'est régénéré que si elle change. */
export async function cvHash(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- Chargement de pdfmake (≈ 830 Ko, seulement quand on génère) ---------------- */
let pdfMakePromise;
function loadPdfMake() {
  pdfMakePromise ??= new Promise((resolve, reject) => {
    const base = new URL('.', import.meta.url).href;         // …/js/
    const s = document.createElement('script');
    s.src = base + 'vendor/pdfmake.min.js';
    s.onload = () => {
      const fonts = new URL('../assets/fonts/', import.meta.url).href;
      const manrope = { normal: fonts + 'manrope-latin-400-normal.ttf', bold: fonts + 'manrope-latin-700-normal.ttf' };
      const fraunces = fonts + 'fraunces-latin-600-normal.ttf';
      window.pdfMake.addFonts({
        Manrope: { ...manrope, italics: manrope.normal, bolditalics: manrope.bold },
        Fraunces: { normal: fraunces, bold: fraunces, italics: fraunces, bolditalics: fraunces }
      });
      resolve(window.pdfMake);
    };
    s.onerror = () => { pdfMakePromise = null; reject(new Error('Impossible de charger le générateur de PDF.')); };
    document.head.append(s);
  });
  return pdfMakePromise;
}

/** Convertit une image (data URL WebP/PNG ou chemin) en JPEG carré, format accepté par pdfmake. */
async function toJpeg(src, size = 360) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Recadrage centré, légèrement vers le haut (visage)
  ctx.drawImage(img, (img.naturalWidth - side) / 2, Math.max(0, (img.naturalHeight - side) * 0.25), side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/* ---------------- Mise en page ---------------- */
function heading(text) {
  return {
    stack: [
      { text: text.toUpperCase(), font: 'Manrope', bold: true, fontSize: 8.5, characterSpacing: 1.4, color: ACCENT },
      { canvas: [{ type: 'line', x1: 0, y1: 3, x2: MAIN_WIDTH, y2: 3, lineWidth: 0.6, lineColor: LINE }] }
    ],
    margin: [0, 14, 0, 6]
  };
}
function sideHeading(text) {
  return { text: text.toUpperCase(), bold: true, fontSize: 8, characterSpacing: 1.3, color: ACCENT, margin: [0, 12, 0, 5] };
}

function timeline(items) {
  return items.map(i => ({
    columns: [
      { width: 92, text: i.period, fontSize: 8.5, color: MUTED, margin: [0, 1, 0, 0] },
      {
        width: '*',
        stack: [
          { text: i.title, bold: true, fontSize: 10.5, color: INK },
          i.place ? { text: i.place, fontSize: 9, color: ACCENT, margin: [0, 1, 0, 0] } : null,
          i.description ? { text: plain(i.description), fontSize: 9, color: MUTED, margin: [0, 3, 0, 0], lineHeight: 1.25 } : null
        ].filter(Boolean)
      }
    ],
    columnGap: 10,
    margin: [0, 0, 0, 8],
    unbreakable: true
  }));
}

function definition(d, photo) {
  const t = L[d.lang];
  const site = d.lang === 'en' ? `${SITE_URL}?lang=en` : SITE_URL;
  const contact = [
    d.email && { text: d.email, link: `mailto:${d.email}` },
    d.phone && { text: d.phone },
    d.location && { text: d.location },
    d.linkedin && { text: d.linkedin.replace(/^https?:\/\/(www\.)?/, ''), link: d.linkedin }
  ].filter(Boolean);

  const education = d.parcours.filter(i => i.kind === 'education');
  const experience = d.parcours.filter(i => i.kind === 'experience');

  const projectItems = d.projects.map(p => ({
    stack: [
      { text: [{ text: p.title, bold: true, color: INK }, { text: [p.category, p.date].filter(Boolean).length ? `  ·  ${[p.category, p.date].filter(Boolean).join(' · ')}` : '', color: MUTED, fontSize: 8.5 }], fontSize: 10 },
      p.summary ? { text: plain(p.summary), fontSize: 9, color: MUTED, margin: [0, 2, 0, 0], lineHeight: 1.25 } : null
    ].filter(Boolean),
    margin: [0, 0, 0, 7],
    unbreakable: true
  }));
  // Un titre de section est toujours collé à son premier élément (jamais seul en bas de page)
  const section = (title, items) => (items.length ? [{ stack: [heading(title), items[0]], unbreakable: true }, ...items.slice(1)] : []);

  const main = [
    ...(d.summary ? [{ stack: [heading(t.profile), { text: rich(d.summary), fontSize: 9.5, lineHeight: 1.3, color: INK }], unbreakable: true }] : []),
    ...section(t.experience, timeline(experience)),
    ...section(t.education, timeline(education)),
    ...section(t.projects, projectItems),
    ...d.sections.flatMap(x => section(x.title, x.lines.map(line => ({ text: rich(line), fontSize: 9, color: MUTED, margin: [0, 0, 0, 3], lineHeight: 1.25 }))))
  ];

  const side = [
    sideHeading(t.skills),
    ...d.skills.map(c => ({
      stack: [
        { text: c.title, bold: true, fontSize: 9.5, color: INK, margin: [0, 0, 0, 2] },
        ...c.items.map(i => ({
          text: [{ text: i.name }, i.level ? { text: `  ${i.level}`, color: ACCENT, fontSize: 7.5 } : ''],
          fontSize: 8.5, color: MUTED, margin: [0, 1, 0, 0]
        }))
      ],
      margin: [0, 0, 0, 8],
      unbreakable: true
    })),
    d.languages.length && sideHeading(t.languages),
    ...d.languages.map(l => ({ text: [{ text: l.name, bold: true, color: INK }, l.level ? { text: ` — ${l.level}`, color: MUTED } : ''], fontSize: 8.5, margin: [0, 1, 0, 0] })),
    d.interests.length && sideHeading(t.interests),
    d.interests.length && { text: d.interests.join(' · '), fontSize: 8.5, color: MUTED, lineHeight: 1.3 },
    sideHeading(t.portfolio),
    { qr: site, fit: 84, foreground: INK, margin: [0, 2, 0, 4] },
    { text: t.scan, fontSize: 7.5, color: MUTED },
    { text: site.replace(/^https:\/\//, ''), link: site, fontSize: 7, color: ACCENT, margin: [0, 2, 0, 0] }
  ].filter(Boolean);

  const header = {
    columns: [
      photo ? { width: 74, image: photo, fit: [74, 74] } : null,
      {
        width: '*',
        stack: [
          { text: d.name, font: 'Fraunces', fontSize: 25, color: INK },
          { text: d.title, bold: true, fontSize: 11, color: ACCENT, margin: [0, 3, 0, 6] },
          { text: contact.flatMap((c, i) => (i ? [{ text: '   |   ', color: LINE }, c] : [c])), fontSize: 8.5, color: MUTED }
        ]
      }
    ].filter(Boolean),
    columnGap: 14
  };

  const date = new Date().toLocaleDateString(d.lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    pageSize: 'A4',
    pageMargins: [40, 36, 40, 40],
    info: { title: t.file, author: 'Cénuel CHAFFA', subject: d.title, keywords: 'CV, GMP, mécanique' },
    defaultStyle: { font: 'Manrope', fontSize: 9.5, color: INK },
    footer: (page, count) => ({
      columns: [
        { text: t.updated.replace('{d}', date), fontSize: 7, color: MUTED },
        { text: count > 1 ? `${page} / ${count}` : '', alignment: 'right', fontSize: 7, color: MUTED }
      ],
      margin: [40, 12, 40, 0]
    }),
    content: [
      header,
      { canvas: [{ type: 'line', x1: 0, y1: 10, x2: PAGE_WIDTH, y2: 10, lineWidth: 1.2, lineColor: INK }], margin: [0, 0, 0, 4] },
      { columns: [{ width: MAIN_WIDTH, stack: main }, { width: SIDE_WIDTH, stack: side }], columnGap: GAP }
    ]
  };
}

/**
 * Génère le CV et renvoie { dataUrl, size } (PDF encodé en base64).
 * photoSrc : photo de profil (data URL ou chemin), utilisée seulement si « photo sur le CV » est coché.
 */
export async function generateCv(data, photoSrc) {
  const pdfMake = await loadPdfMake();
  let photo = null;
  if (data.photo && photoSrc) {
    try { photo = await toJpeg(photoSrc); } catch (e) { console.warn('Photo du CV ignorée', e); }
  }
  const b64 = await pdfMake.createPdf(definition(data, photo)).getBase64();
  return { dataUrl: `data:application/pdf;base64,${b64}`, size: Math.round(b64.length * 0.75) };
}
