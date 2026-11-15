// Liste des textes obligatoires de chaque scène, lue par la construction (sans DOM).
function clesReferencees(donnees) {
  const cles = new Set();
  const parcourir = (o) => {
    if (Array.isArray(o)) o.forEach(parcourir);
    else if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if ((k === 'texte' || k === 'titre') && typeof v === 'string') cles.add(v);
        else parcourir(v);
      }
    }
  };
  parcourir(donnees);
  return [...cles];
}

export const SCENES = {
  nacl: {
    cles: (d) => [...new Set([
      'titre', 'sous-titre', 'coin-du-grain', 'aide-reseau', 'simplifications',
      ...clesReferencees(d.temps1 || {}),
    ])],
  },
};
