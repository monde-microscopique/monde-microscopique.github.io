// Chorégraphie de la dissolution de NaCl (fiche NaCl, temps 2, et décisions de Roger du 15.11.2026).
// Module sans DOM : l'état est une fonction du temps t (s). Mêmes données → même film, à chaque lecture.
// Unités : picomètres (pm), secondes (s).
//
// Cortèges (6 molécules d'eau en octaèdre autour de chaque ion) :
//  - Na⁺ : l'oxygène tourné vers l'ion, distance Na⁺–O 240 pm ;
//  - Cl⁻ : un hydrogène pointé vers l'ion, distance Cl⁻–H 230 pm, liaison hydrogène Cl⁻···H–O alignée.
// Les molécules d'eau sont des corps rigides : O–H et l'angle H–O–H ne changent jamais.

import { aleatoire } from './reseau.js';

const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [1, 0, 0]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lisse = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const fenetre = (t, a, b) => lisse((t - a) / (b - a));

function perpendiculaire(e, angle) {
  const a = Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = unit(cross(e, a));
  const v = cross(e, u);
  return add(mul(u, Math.cos(angle)), mul(v, Math.sin(angle)));
}

// Repère d'une molécule d'eau : b = bissectrice (de O vers le milieu des H), p = dans le plan, perpendiculaire.
function repereVersAxe(espece, e, u, angleHOH) {
  if (espece === 'Na+') return { b: e.slice(), p: u.slice() }; // O vers l'ion, H vers l'extérieur
  // Cl⁻ : la première liaison O–H pointe vers l'ion (direction −e).
  const h1 = mul(e, -1);
  const h2 = add(mul(h1, Math.cos(angleHOH)), mul(u, Math.sin(angleHOH)));
  return { b: unit(add(h1, h2)), p: unit(sub(h1, h2)) };
}

function repereAleatoire(r) {
  const b = unit([r() - 0.5, r() - 0.5, r() - 0.5]);
  return { b, p: perpendiculaire(b, r() * 6.283) };
}

function interpolerRepere(f0, f1, t) {
  if (t <= 0) return f0;
  if (t >= 1) return f1;
  const b = unit(mix(f0.b, f1.b, t));
  let p = mix(f0.p, f1.p, t);
  p = unit(sub(p, mul(b, dot(p, b))));
  return { b, p };
}

// Plan de la chorégraphie, calculé une fois au chargement.
export function planDissolution(donnees, cristal, voisinsDe) {
  const t2 = donnees.temps2;
  const eau = t2.eau;
  const angle = (eau.angle_deg * Math.PI) / 180;
  const r = aleatoire(415);
  const n = cristal.length;
  const index = new Map(cristal.map((ion, i) => [`${ion.i},${ion.j},${ion.k}`, i]));
  const centre = mul(cristal.reduce((s, ion) => add(s, ion.pos), [0, 0, 0]), 1 / n);

  // 1. Ordre de départ : toujours un ion qui a le moins de voisins restants (coins, puis arêtes, puis faces),
  //    en alternant Na⁺ et Cl⁻ pour qu'ils partent en nombres égaux ; le premier est le coin tourné vers l'élève.
  const reste = new Set(cristal.map((_, i) => i));
  const parti = new Array(n).fill(-1);
  const ordre = [];
  const compte = { 'Na+': 0, 'Cl-': 0 };
  const vue = unit(t2.coin_depart_vers || [-0.38, 0.42, -1]);
  const recents = [];
  // Proximité avec les ions partis juste avant (on évite de faire partir deux voisins à la suite).
  const proximite = (i) => recents.reduce((s, j, q) => s + (len(sub(cristal[i].pos, cristal[j].pos)) < 600 ? recents.length - q : 0), 0);
  while (reste.size) {
    let meilleur = -1, cle = null;
    for (const i of reste) {
      const nv = voisinsDe[i].filter((j) => reste.has(j)).length;
      const esp = cristal[i].espece;
      const k = [nv, compte[esp], proximite(i), -dot(sub(cristal[i].pos, centre), vue)];
      let mieux = !cle;
      for (let q = 0; !mieux && q < k.length; q++) { if (k[q] < cle[q]) mieux = true; else if (k[q] > cle[q]) break; }
      if (mieux) { cle = k; meilleur = i; }
    }
    recents.unshift(meilleur);
    if (recents.length > 12) recents.pop();
    parti[meilleur] = ordre.length;
    ordre.push(meilleur);
    compte[cristal[meilleur].espece]++;
    reste.delete(meilleur);
  }

  // 2. Instants de départ, régulièrement répartis.
  const ch = t2.chronologie;
  const tDepart = new Array(n);
  ordre.forEach((i, rang) => {
    tDepart[i] = rang === 0 ? ch.premier_depart : ch.debut_demontage + (ch.fin_demontage - ch.debut_demontage) * ((rang - 1) / (n - 2));
  });

  // 3. Positions finales dans la solution : points tirés une fois pour toutes, à distance minimale les uns des autres.
  const sol = t2.solution;
  const points = [];
  let essais = 0;
  while (points.length < n * 1.6 && essais < 200000) {
    essais++;
    const d = unit([r() - 0.5, r() - 0.5, r() - 0.5]);
    const rayon = (sol.rayon_min_nm + (sol.rayon_max_nm - sol.rayon_min_nm) * Math.cbrt(r())) * 1000;
    const p = add(centre, mul(d, rayon));
    if (points.every((q) => len(sub(p, q)) >= sol.distance_min_nm * 1000)) points.push(p);
  }

  // 4. Pour chaque ion : directions libres au départ, trajectoire, point final.
  const voisinSur = (i, a) => { const ion = cristal[i]; return index.get(`${ion.i + a[0]},${ion.j - a[1]},${ion.k + a[2]}`); };
  const libre = (i, a, avant) => {
    const j = voisinSur(i, a);
    return j === undefined || (avant !== undefined && parti[j] < avant);
  };
  const libres0 = cristal.map((_, i) => AXES.map((a) => libre(i, a)));
  const ions = cristal.map((ion, i) => {
    const libresDepart = AXES.map((a) => libre(i, a, parti[i]));
    let nExp = AXES.reduce((s, a, k) => (libresDepart[k] ? add(s, a) : s), [0, 0, 0]);
    nExp = len(nExp) > 1e-9 ? unit(nExp) : unit(sub(ion.pos, centre));
    return { espece: ion.espece, depart: ion.pos, tDepart: tDepart[i], nExp, libres0: libres0[i], libresDepart, rang: parti[i],
      errance: [r() * 6.283, r() * 6.283, r() * 6.283], freq: [0.31 + 0.1 * r(), 0.27 + 0.1 * r(), 0.35 + 0.1 * r()] };
  });
  // Les premiers ions partis vont le plus loin : les suivants ne traversent pas ceux qui sont déjà installés.
  const parRayon = points.map((p, q) => q).sort((a, b) => len(sub(points[b], centre)) - len(sub(points[a], centre)));
  const pris = new Array(points.length).fill(false);
  for (const i of ordre) {
    const ion = ions[i];
    // Direction de départ : on s'écarte du centre du cristal, du côté des faces libres.
    const dirSouhaitee = unit(add(unit(sub(ion.depart, centre)), mul(ion.nExp, 0.7)));
    ion.dirDepart = dirSouhaitee;
    let best = -1, score = -Infinity, vus = 0;
    for (const q of parRayon) {
      if (pris[q]) continue;
      if (vus++ > 45) break; // parmi les places libres les plus éloignées
      const sc = dot(unit(sub(points[q], centre)), dirSouhaitee);
      if (sc > score) { score = sc; best = q; }
    }
    pris[best] = true;
    ion.fin = points[best];
    ion.controle = add(ion.depart, mul(dirSouhaitee, ch.elan_pm));
  }

  // 5. Molécules d'eau du cortège de chaque ion.
  const eaux = [];
  ions.forEach((ion, i) => {
    const c = t2.cortege[ion.espece];
    const distO = c.atome === 'O' ? c.distance_pm : c.distance_pm + eau.OH_pm;
    AXES.forEach((e, k) => {
      const u = perpendiculaire(e, r() * 6.283);
      const repere = repereVersAxe(ion.espece, e, u, angle);
      let groupe, debutApproche, finApproche, debutOrient, finOrient;
      if (ion.rang < ch.ions_precoces && ion.libres0[k]) {
        groupe = 'precoce';
        debutApproche = 0.3 + 1.2 * r(); finApproche = debutApproche + 3.6 + r();
        debutOrient = ch.debut_orientation + 1.2 * r(); finOrient = debutOrient + 3.5;
      } else if (ion.libresDepart[k] && (voisinSur(i, e) === undefined || tDepart[voisinSur(i, e)] < ion.tDepart - 5.5 - 1)) {
        // La place visée est libre depuis plus d'une seconde quand l'eau commence à approcher.
        groupe = 'approche';
        debutApproche = ion.tDepart - 5.5; finApproche = ion.tDepart - 2.2;
        debutOrient = ion.tDepart - 3.0; finOrient = ion.tDepart - 0.5;
      } else {
        groupe = 'tardive';
        // Le premier ion sort lentement : ses dernières molécules d'eau attendent qu'il soit dégagé.
        const retard = ion.rang === 0 ? 4.5 : 2.0;
        debutApproche = ion.tDepart + retard; finApproche = debutApproche + 2.6;
        debutOrient = debutApproche + 0.6; finOrient = finApproche;
      }
      const ecart = add(mul(e, 900 + 500 * r()), mul(perpendiculaire(e, r() * 6.283), 350 * r()));
      eaux.push({ ion: i, axe: e, decalage: mul(e, distO), repere, repere0: repereAleatoire(r), groupe, ecart,
        debutApproche, finApproche, debutOrient, finOrient, rebond: groupe === 'precoce' ? r() * 6.283 : null });
    });
  });

  return { ions, eaux, ordre, centre, eau: { OH: eau.OH_pm, demiAngle: angle / 2 }, ch, sol };
}

// Position d'un ion au temps t (pm), sans la vibration thermique.
export function positionIon(plan, i, t) {
  const ion = plan.ions[i];
  // Le premier ion part seul : départ plus lent et progressif, pour qu'on le voie quitter le cristal.
  const premier = ion.rang === 0;
  const D = premier ? (plan.ch.duree_trajet_premier ?? plan.ch.duree_trajet) : plan.ch.duree_trajet;
  if (t <= ion.tDepart) return ion.depart;
  // Les autres : départ rapide, arrivée douce ; l'ion dégage vite la surface et ne gêne pas le suivant.
  const x = clamp01((t - ion.tDepart) / D);
  const s = premier ? lisse(x) : 1 - (1 - x) ** 3;
  // Courbe de Bézier : d'abord hors du cristal (élan), puis vers la place dans la solution.
  const a = mix(ion.depart, ion.controle, s), b = mix(ion.controle, ion.fin, s);
  let p = mix(a, b, s);
  // Errance lente dans la solution : l'ion ne s'arrête jamais.
  const poids = fenetre(t, ion.tDepart + D * 0.6, ion.tDepart + D + 2);
  if (poids > 0) {
    const A = plan.sol.errance_pm;
    p = add(p, mul([Math.sin(t * ion.freq[0] + ion.errance[0]), Math.sin(t * ion.freq[1] + ion.errance[1]), Math.sin(t * ion.freq[2] + ion.errance[2])], A * poids));
  }
  return p;
}

export const dansLeCristal = (plan, i, t) => t <= plan.ions[i].tDepart;

// État complet au temps t : positions des ions, des atomes O et H, et visibilité des molécules d'eau.
export function etatDissolution(plan, t, sortie) {
  const nI = plan.ions.length, nE = plan.eaux.length;
  const s = sortie || {
    ions: new Float32Array(nI * 3), O: new Float32Array(nE * 3), H: new Float32Array(nE * 6),
    fonduEau: new Float32Array(nE), dansCristal: new Uint8Array(nI),
  };
  const posIons = [];
  for (let i = 0; i < nI; i++) {
    const p = positionIon(plan, i, t);
    posIons.push(p);
    s.ions.set(p, i * 3);
    s.dansCristal[i] = dansLeCristal(plan, i, t) ? 1 : 0;
  }
  const { OH, demiAngle } = plan.eau;
  const cb = Math.cos(demiAngle) * OH, sp = Math.sin(demiAngle) * OH;
  plan.eaux.forEach((w, k) => {
    const cible = add(posIons[w.ion], w.decalage);
    let o, repere, fondu;
    if (t < w.debutApproche) {
      o = add(add(w.groupe === 'tardive' ? add(positionIon(plan, w.ion, w.debutApproche), w.decalage) : cible, w.ecart), [0, 0, 0]);
      repere = w.repere0;
      fondu = w.groupe === 'precoce' ? 0 : 1;
    } else {
      const sa = lisse((t - w.debutApproche) / (w.finApproche - w.debutApproche));
      const depart = add(w.groupe === 'tardive' ? add(positionIon(plan, w.ion, w.debutApproche), w.decalage) : cible, w.ecart);
      o = mix(depart, cible, sa);
      // L'eau heurte le cristal : petit rebond amorti à l'arrivée (premières molécules).
      if (w.rebond !== null && t > w.finApproche && t < w.finApproche + 2.5) {
        const u = t - w.finApproche;
        o = add(o, mul(w.axe, 70 * Math.exp(-2.2 * u) * Math.sin(9 * u + w.rebond)));
      }
      repere = interpolerRepere(w.repere0, w.repere, (t - w.debutOrient) / (w.finOrient - w.debutOrient));
      fondu = w.groupe === 'precoce' ? 0 : 1 - clamp01((t - w.debutApproche) / 0.8);
    }
    s.O.set(o, k * 3);
    s.H.set(add(o, add(mul(repere.b, cb), mul(repere.p, sp))), k * 6);
    s.H.set(add(o, sub(mul(repere.b, cb), mul(repere.p, sp))), k * 6 + 3);
    s.fonduEau[k] = fondu;
  });
  return s;
}

// Contrôles de conservation (utilisés par les tests et le panneau) : nombre d'ions, charge, eau intacte.
export function controler(plan, etat, especes) {
  const compte = { 'Na+': 0, 'Cl-': 0 };
  let charge = 0;
  plan.ions.forEach((ion) => { compte[ion.espece]++; charge += especes[ion.espece].charge; });
  let pireOH = 0, pireAngle = 0;
  const OH = plan.eau.OH, angle = plan.eau.demiAngle * 2;
  for (let k = 0; k < plan.eaux.length; k++) {
    const o = [etat.O[k * 3], etat.O[k * 3 + 1], etat.O[k * 3 + 2]];
    const h1 = sub([etat.H[k * 6], etat.H[k * 6 + 1], etat.H[k * 6 + 2]], o);
    const h2 = sub([etat.H[k * 6 + 3], etat.H[k * 6 + 4], etat.H[k * 6 + 5]], o);
    pireOH = Math.max(pireOH, Math.abs(len(h1) - OH), Math.abs(len(h2) - OH));
    pireAngle = Math.max(pireAngle, Math.abs(Math.acos(dot(h1, h2) / (len(h1) * len(h2))) - angle));
  }
  return { compte, charge, pireOH, pireAngleDeg: (pireAngle * 180) / Math.PI };
}
