// Traductions anglaises préparées pour des contenus déjà publiés en français.
// L'administration propose de les appliquer en un clic, et ne remplit que les champs anglais restés vides.
// Le repère est le texte français : si tu modifies le titre d'un projet, sa proposition disparaît simplement.
// Ce fichier peut être vidé (liste vide) une fois les traductions appliquées.

export const PROJECT_TRANSLATIONS = [
  {
    title: "Prototype d'un Garage automatique",
    titleEn: 'Automatic Garage Door Prototype',
    summaryEn: 'Electronics combined with programming to automate a garage door.',
    descriptionEn: 'An ultrasonic sensor and a servo motor driven by an Arduino to open and close a garage door automatically.'
  },
  {
    title: 'Stage en atelier',
    titleEn: 'Workshop Internship',
    summaryEn: 'Many activities and manufacturing projects carried out during this internship, including welding, machining and the operation of machine tools.',
    descriptionEn: 'Workshop internship completed as part of the 2025–2026 academic year.'
  },
  {
    title: 'Exploration des LLMs & IA générative',
    titleEn: 'Exploring LLMs & Generative AI',
    summaryEn: 'Advanced use of language models for automation, research and technical content creation.',
    descriptionEn: 'Using artificial intelligence for coding, quick research, sourcing images from the internet and creating graphics.'
  }
];

const EN_FIELDS = ['titleEn', 'summaryEn', 'descriptionEn'];

/** Champs anglais proposés pour ce projet et encore vides. Renvoie {} s'il n'y a rien à compléter. */
export function missingTranslation(project) {
  const ready = PROJECT_TRANSLATIONS.find(x => x.title === String(project?.title || '').trim());
  if (!ready) return {};
  const patch = {};
  EN_FIELDS.forEach(f => {
    const current = String(project?.[f] || '').trim();
    // Le champ français doit exister : on ne traduit pas un contenu absent
    const source = String(project?.[f.replace(/En$/, '')] || '').trim();
    if (!current && source && ready[f]) patch[f] = ready[f];
  });
  return patch;
}
