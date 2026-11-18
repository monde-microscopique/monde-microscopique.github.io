// Motif schématique de CuSO₄·5H₂O (fiche F-E ; décision de Roger du 18.11.2026 : option a).
// Ce n'est PAS la structure cristalline réelle (triclinique, complexe) : c'est un motif à proportions justes,
// annoncé comme tel. Ce qui est respecté (Ibrahim et Boeré, New J. Chem. 2022) :
//  - chaque ion Cu²⁺ est entouré de 4 molécules d'eau (dans un plan, Cu–O 196 pm) et de 2 atomes O
//    de deux ions sulfate (de part et d'autre, Cu–O 240 pm) ; les ions sulfate relient les Cu²⁺ en chaînes ;
//  - la 5e molécule d'eau n'est pas liée au cuivre : elle est retenue près d'un ion sulfate.
// Les coordonnées sont calculées ici à partir des distances et des angles des données, jamais écrites à la main.
// Unités : picomètres. Axe des chaînes : x. Plan des 4 molécules d'eau liées au cuivre : (y, z).

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

export const SITES = ['y+', 'y-', 'z+', 'z-', 'libre'];
const DIRECTION = { 'y+': [0, 1, 0], 'y-': [0, -1, 0], 'z+': [0, 0, 1], 'z-': [0, 0, -1] };

export function genererMotif(m) {
  const tetra = Math.acos(-1 / 3) / 2;              // demi-angle O–S–O d'un tétraèdre (54,74°)
  const dx = m.S_O_pm * Math.sin(tetra);            // demi-écart, le long de la chaîne, entre les 2 O liés aux Cu
  const dh = m.S_O_pm * Math.cos(tetra);            // décalage du S hors de l'axe de la chaîne
  const a = 2 * m.Cu_O_sulfate_pm + 2 * dx;         // distance Cu–Cu le long d'une chaîne
  const demi = (m.angle_HOH_deg * Math.PI) / 360;

  const atomes = [];   // { espece, pos, unite, role }
  const liaisons = []; // [i, j] (liaisons covalentes : S–O et O–H)
  const eaux = [];     // { unite, site, O, H: [i, j], pos, b, p } ; b : bissectrice O → H ; p : dans le plan, perpendiculaire
  const unites = [];
  const ajouter = (espece, pos, unite, role) => { atomes.push({ espece, pos, unite, role }); return atomes.length - 1; };
  const ajouterEau = (unite, site, o, b, p) => {
    const O = ajouter('O', o, unite, 'eau');
    const H = [1, -1].map((s) => ajouter('H', add(o, add(mul(b, m.O_H_pm * Math.cos(demi)), mul(p, s * m.O_H_pm * Math.sin(demi)))), unite, 'eau'));
    H.forEach((h) => liaisons.push([O, h]));
    eaux.push({ unite, site, O, H, pos: o, b, p });
  };

  let u = 0;
  for (let c = 0; c < m.chaines; c++) {
    const z0 = c * m.ecart_chaines_pm;
    for (let k = 0; k < m.unites_par_chaine; k++, u++) {
      const cu = [k * a, 0, z0];
      const iCu = ajouter('Cu2+', cu, u, 'Cu');
      // Ion sulfate à droite du Cu²⁺ : deux O pointent vers les Cu voisins (positions de part et d'autre),
      // les deux autres vers l'extérieur de la chaîne. Le S est décalé alternativement en +y et en −y.
      const sens = (k + c) % 2 ? -1 : 1;
      const S = [cu[0] + a / 2, sens * dh, z0];
      const iS = ajouter('S', S, u, 'S');
      const dirs = [[-dx, -sens * dh, 0], [dx, -sens * dh, 0], [0, sens * dh, dx], [0, sens * dh, -dx]];
      for (const d of dirs) {
        const iO = ajouter('O', add(S, d), u, 'sulfate');
        liaisons.push([iS, iO]);
      }
      // 4 molécules d'eau liées au Cu²⁺ : O vers le cuivre, H vers l'extérieur, dans le plan qui contient l'axe x.
      for (const site of ['y+', 'y-', 'z+', 'z-']) {
        const e = DIRECTION[site];
        ajouterEau(u, site, add(cu, mul(e, m.Cu_O_eau_pm)), e, [1, 0, 0]);
      }
      // 5e molécule d'eau : au-dessus du sulfate, ses deux H tournés vers les deux O libres du sulfate.
      ajouterEau(u, 'libre', add(S, [0, sens * m.O5_au_dessus_de_S_pm, 0]), [0, -sens, 0], [0, 0, 1]);
      unites.push({ Cu: iCu, S: iS, chaine: c });
    }
  }

  // Centre du motif à l'origine.
  const centre = mul(atomes.reduce((s, x) => add(s, x.pos), [0, 0, 0]), 1 / atomes.length);
  for (const x of atomes) x.pos = add(x.pos, mul(centre, -1));
  for (const e of eaux) e.pos = atomes[e.O].pos;
  const periodes = [a * m.unites_par_chaine, 1100, m.ecart_chaines_pm * m.chaines];
  return { atomes, liaisons, eaux, unites, a, periodes };
}

// Bilan du motif : nombres d'ions et charge totale (contrôles).
export function bilanMotif(motif, especes) {
  const compte = {};
  let charge = 0;
  for (const x of motif.atomes) {
    if (x.role === 'Cu') { compte['Cu2+'] = (compte['Cu2+'] || 0) + 1; charge += especes['Cu2+'].charge; }
    if (x.role === 'S') { compte['SO4'] = (compte['SO4'] || 0) + 1; charge -= 2; }
  }
  compte.H2O = motif.eaux.length;
  return { compte, charge };
}
