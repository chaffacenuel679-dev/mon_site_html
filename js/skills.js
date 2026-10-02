// Compétences : données par défaut, icônes et rendu des cartes.
// Partagé entre le site public (main.js) et l'administration (admin.js).

export const LEVELS = [
  { value: 0, label: 'Sans niveau (simple point)' },
  { value: 1, label: 'Notions' },
  { value: 2, label: 'Débutant' },
  { value: 3, label: 'Intermédiaire' },
  { value: 4, label: 'Avancé' },
  { value: 5, label: 'Expert' }
];
export const levelLabel = v => LEVELS.find(l => l.value === Number(v))?.label || '';

export const SKILL_ICONS = {
  gear: { label: 'Engrenage (mécanique)', svg: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="7"/>' },
  drafting: { label: 'Équerre (conception, DAO)', svg: '<path d="M3 21 21 3M7 21H3v-4M14 3h7v7"/><path d="M3 12h4M12 21v-4"/>' },
  wrench: { label: 'Clé (fabrication, atelier)', svg: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>' },
  chip: { label: 'Puce (électronique, informatique)', svg: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>' },
  bolt: { label: 'Éclair (électricité, énergie)', svg: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  code: { label: 'Code (programmation, web)', svg: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>' },
  ai: { label: 'Réseau (intelligence artificielle)', svg: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3 3.5M7 17l3-3.5M14 10.5l3-3.5M14 13.5l3 3.5"/>' },
  globe: { label: 'Globe (digital, langues)', svg: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  people: { label: 'Personnes (savoir-être, équipe)', svg: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>' },
  planet: { label: 'Planète (astronomie, sciences)', svg: '<circle cx="12" cy="12" r="5"/><path d="M3.5 15.5c-1.2-2 3.5-5.6 9-7.4s10-1.7 10.9.3-3.5 5.4-9 7.2-9.7 1.9-10.9-.1z"/>' }
};

// Les compétences actuelles du site (utilisées tant que rien n'est publié depuis l'admin)
export const DEFAULT_SKILLS = [
  {
    category: 'Mécanique', title: 'Génie Mécanique', icon: 'gear',
    items: [
      { name: 'Statique graphique', level: 4 },
      { name: 'Mécanique des solides', level: 4 },
      { name: 'Résistance des matériaux', level: 3 },
      { name: 'Thermodynamique', level: 3 }
    ]
  },
  {
    category: 'Conception', title: 'DAO & CAO 2D / 3D', icon: 'drafting',
    items: [
      { name: 'Dessin technique 2D', level: 4 },
      { name: 'Modélisation 3D', level: 4 },
      { name: 'Procédés de fabrication', level: 3 }
    ]
  },
  {
    category: 'Technologie', title: 'Informatique & IA', icon: 'chip',
    items: [
      { name: 'Modèles de langage (LLMs) & prompt engineering', level: 0 },
      { name: 'Outils IA : Claude, Grok, GPT', level: 0 },
      { name: 'Automatisation intelligente', level: 0 },
      { name: 'Développement & création de sites web', level: 0 },
      { name: 'Arduino & électronique', level: 0 }
    ]
  },
  {
    category: 'Digital & savoir-être', title: 'Outils & soft skills', icon: 'globe',
    items: [
      { name: 'Pack Office & Google Workspace', level: 0 },
      { name: 'Python, C++, HTML, CSS, JavaScript', level: 0 },
      { name: 'Français (courant) · Anglais (B1)', level: 0 },
      { name: "Esprit d'analyse & curiosité", level: 0 },
      { name: 'Travail en équipe', level: 0 }
    ]
  }
];

/** Nettoie une liste de cartes venant de Firestore. */
export function sanitizeSkills(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.slice(0, 24).map(c => ({
    category: String(c?.category || '').slice(0, 60),
    title: String(c?.title || '').slice(0, 80),
    icon: SKILL_ICONS[c?.icon] ? c.icon : 'gear',
    items: (Array.isArray(c?.items) ? c.items : []).slice(0, 20)
      .map(i => ({ name: String(i?.name || '').slice(0, 120), level: Math.max(0, Math.min(5, Math.round(Number(i?.level) || 0))) }))
      .filter(i => i.name)
  })).filter(c => c.title);
}

/** Construit une carte de compétences identique à celles écrites dans index.html. */
export function renderSkillCard(card) {
  const art = document.createElement('article');
  art.className = 'skill-card reveal';
  const head = document.createElement('div');
  head.className = 'skill-head';
  head.innerHTML = `<span class="skill-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${SKILL_ICONS[card.icon]?.svg || SKILL_ICONS.gear.svg}</svg></span><div><p class="skill-cat"></p><h3></h3></div>`;
  head.querySelector('.skill-cat').textContent = card.category;
  head.querySelector('h3').textContent = card.title;
  art.append(head);

  const leveled = card.items.filter(i => i.level > 0);
  const plain = card.items.filter(i => !i.level);
  if (leveled.length) {
    const ul = document.createElement('ul');
    ul.className = 'levels';
    leveled.forEach(i => {
      const li = document.createElement('li');
      li.dataset.level = i.level;
      const name = document.createElement('span'); name.textContent = i.name;
      const lab = document.createElement('em'); lab.textContent = levelLabel(i.level);
      li.append(name, lab, document.createElement('i'));
      ul.append(li);
    });
    art.append(ul);
  }
  if (plain.length) {
    const ul = document.createElement('ul');
    ul.className = 'skill-list';
    if (leveled.length) ul.style.marginTop = '.6rem';
    plain.forEach(i => { const li = document.createElement('li'); li.textContent = i.name; ul.append(li); });
    art.append(ul);
  }
  return art;
}

export const YEAR_OPTIONS = [
  { value: 1, stat: '1<sup>re</sup> année GMP', text: 'première année' },
  { value: 2, stat: '2<sup>e</sup> année GMP', text: 'deuxième année' },
  { value: 3, stat: '3<sup>e</sup> année GMP', text: 'troisième année' }
];
