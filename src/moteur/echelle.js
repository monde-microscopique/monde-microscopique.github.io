// Outils d'échelle : écriture des longueurs en français et choix de la barre d'échelle.

const UNITES = [
  { m: 1e-2, nom: 'cm' },
  { m: 1e-3, nom: 'mm' },
  { m: 1e-6, nom: 'µm' },
  { m: 1e-9, nom: 'nm' },
  { m: 1e-12, nom: 'pm' },
  { m: 1e-15, nom: 'fm' },
];

// Écrit une longueur (en mètres) avec l'unité la plus lisible : 0,0003 → « 300 µm ».
export function ecrireLongueur(m, chiffres = 3) {
  let u = UNITES[UNITES.length - 1];
  for (const x of UNITES) {
    if (m >= x.m * 0.9999) { u = x; break; }
  }
  // Au-delà de 1000 unités, on remonte d'une unité (1000 µm → 1 mm) sauf pour le cm.
  let v = m / u.m;
  if (u.nom === 'cm' && v >= 100) return formater(m, chiffres) + ' m';
  const p = Number(v.toPrecision(chiffres));
  return formater(p, chiffres) + ' ' + u.nom;
}

function formater(v, chiffres) {
  const p = Number(v.toPrecision(chiffres));
  return String(p).replace('.', ',');
}

// Barre d'échelle : longueur « ronde » (1, 2 ou 5 × 10^n) dont la taille à l'écran est
// comprise entre fractionMin et fractionMax de la largeur du champ.
export function barreEchelle(largeurChamp, fractionMin = 0.12, fractionMax = 0.3) {
  const cible = largeurChamp * fractionMin;
  const n = Math.floor(Math.log10(cible));
  for (let e = n; e <= n + 1; e++) {
    for (const c of [1, 2, 5]) {
      const v = c * 10 ** e;
      if (v >= cible && v <= largeurChamp * fractionMax) return { longueur: v, fraction: v / largeurChamp };
    }
  }
  const v = 10 ** Math.ceil(Math.log10(cible));
  return { longueur: v, fraction: v / largeurChamp };
}

// Graduations de la règle verticale : une par décade, de max à min (en mètres).
export function graduations(max, min) {
  const g = [];
  for (let e = Math.round(Math.log10(max)); e >= Math.round(Math.log10(min)); e--) g.push(10 ** e);
  return g;
}
