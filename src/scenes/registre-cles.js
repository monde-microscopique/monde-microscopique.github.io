// Liste des textes obligatoires de chaque scène, lue par la construction (sans DOM).
function clesReferencees(donnees) {
  const cles = new Set();
  const parcourir = (o) => {
    if (Array.isArray(o)) o.forEach(parcourir);
    else if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (['texte', 'titre', 'texte_avance', 'message', 'message_avance'].includes(k) && typeof v === 'string') cles.add(v);
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
      'titre', 'sous-titre', 'coin-du-grain', 'aide-reseau', 'aide-maille', 'repere-noyau', 'simplifications',
      ...clesReferencees(d.temps1 || {}),
      ...clesReferencees(d.temps2 || {}),
      'equation-dissolution',
    ])],
  },
  hydrate: {
    cles: (d) => [...new Set([
      'titre', 'sous-titre', 'simplifications', 'instrument-modele', 'formule-hydrate', 'equation-hydrate',
      'compteur-eau-solide', 'compteur-eau-dehors', 'compteur-par-unite',
      ...clesReferencees(d.etapes || []),
      ...clesReferencees(d.zoom || {}),
      ...(d.etapes || []).filter((e) => e.equation).map((e) => e.equation),
    ])],
  },
};
