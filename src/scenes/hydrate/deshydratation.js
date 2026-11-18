// Chauffage de CuSO₄·5H₂O par paliers, puis réhydratation (fiche F-E ; décision de Roger du 18.11.2026 :
// paliers réels 5 → 3 → 1 → 0 molécule d'eau par unité CuSO₄, avec températures et explication).
// Module sans DOM. Tout est calculé une fois au chargement à partir d'une graine fixe ; l'état est une
// fonction du temps tc (s) : même film à chaque lecture, retour en arrière possible.
// Ce qui est mis en scène (choix de l'exécutant, signalé dans le panneau « à contrôler ») : quelles molécules
// d'eau partent à chaque palier ; on ne montre pas la réorganisation du solide entre deux hydrates.

import { aleatoire } from '../nacl/reseau.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [1, 0, 0]; };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lisse = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
function tourner(v, k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

export function planChauffage(donnees, motif) {
  const ch = donnees.chauffage;
  const r = aleatoire(404);
  const m = donnees.motif;
  const demi = (m.angle_HOH_deg * Math.PI) / 360;
  const centreChaine = (e) => [e.pos[0], 0, motif.atomes[motif.unites[e.unite].Cu].pos[2]];

  const eaux = motif.eaux.map((e) => ({ ...e, depart: Infinity, palier: -1, arrivee: Infinity }));
  // Départs : à chaque palier, les molécules des sites indiqués, dans un ordre tiré au hasard, à des instants
  // irréguliers dans la fenêtre du palier.
  ch.paliers.forEach((p, ip) => {
    const qui = eaux.filter((e) => p.quitte.includes(e.site));
    for (let k = qui.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [qui[k], qui[j]] = [qui[j], qui[k]]; }
    const cumul = [0];
    for (let k = 1; k < qui.length; k++) cumul.push(cumul[k - 1] + 0.3 + r());
    const total = cumul[cumul.length - 1] || 1;
    qui.forEach((e, k) => { e.depart = p.departs[0] + (p.departs[1] - p.departs[0]) * (cumul[k] / total); e.palier = ip; });
  });
  // Trajets de départ (vers le haut et vers l'extérieur, en vapeur) et d'arrivée (eau ajoutée).
  const rh = ch.rehydratation;
  const ordreArrivee = eaux.map((_, i) => i);
  for (let k = ordreArrivee.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ordreArrivee[k], ordreArrivee[j]] = [ordreArrivee[j], ordreArrivee[k]]; }
  ordreArrivee.forEach((i, k) => { eaux[i].arrivee = rh.arrivees[0] + (rh.arrivees[1] - rh.arrivees[0]) * (k / (eaux.length - 1)); });
  // Direction de sortie : parmi des directions tirées au hasard (vers l'extérieur et vers le haut), celle dont
  // le trajet passe le plus loin des autres atomes du motif. L'arrivée (eau ajoutée) suit le même couloir.
  const autres = (e) => motif.atomes.filter((_, i) => i !== e.O && !e.H.includes(i)).map((x) => x.pos);
  const degagement = (o, d, pts) => {
    let min = Infinity;
    for (let s = 0.15; s <= 1.0001; s += 0.05) {
      const q = add(o, mul(d, s * ch.trajet_vapeur_pm * 0.6));
      for (const pt of pts) min = Math.min(min, len(sub(q, pt)));
    }
    return min;
  };
  for (const e of eaux) {
    const dehors = unit(sub(e.pos, centreChaine(e)));
    const pts = autres(e);
    let meilleur = null, dMeilleur = -1;
    for (let essai = 0; essai < 80; essai++) {
      const d = unit(add(add(dehors, [0, 0.7, 0]), [(r() - 0.5) * 1.6, (r() - 0.3) * 1.2, (r() - 0.5) * 1.6]));
      const dg = degagement(e.pos, d, pts);
      if (dg > dMeilleur) { dMeilleur = dg; meilleur = d; }
    }
    e.dirDepart = meilleur;
    e.dirArrivee = meilleur;
    e.degagement = dMeilleur;
    e.lateral = unit(cross(e.dirDepart, [r() - 0.5, r() - 0.5, r() - 0.5]));
    e.axeRot = unit([r() - 0.5, r() - 0.5, r() - 0.5]);
    e.vitRot = (1.5 + 2 * r()) * (r() < 0.5 ? -1 : 1);
  }
  return { eaux, ch, OH: m.O_H_pm, demi, nUnites: motif.unites.length };
}

// Température affichée (°C) au temps tc. null pendant l'ajout d'eau (la scène dit seulement que le tube chauffe).
export function temperature(plan, tc) {
  const ch = plan.ch;
  let T = ch.temperature_depart_c;
  for (const p of ch.paliers) {
    if (tc < p.debut) return T;
    const u = lisse((tc - p.debut) / p.montee);
    T = T + (p.temperature_c - T) * u;
    if (tc < p.fin) return T;
    T = p.temperature_c;
  }
  const rh = ch.rehydratation;
  if (tc < rh.debut) return T;
  if (tc < rh.refroidi) return T + (ch.temperature_depart_c - T) * lisse((tc - rh.debut) / (rh.refroidi - rh.debut));
  return null;
}

// Nombre de molécules d'eau encore (ou de nouveau) dans le solide, à la fin de chaque déplacement.
function dansLeSolide(e, tc, D) {
  if (tc >= e.arrivee + D * 0.5) return true;   // revenue (réhydratation)
  return tc < e.depart + D * 0.15;              // pas encore partie (elle quitte le solide au début de son trajet)
}

// État au temps tc : positions des O et des H de chaque molécule d'eau, fondu (1 = invisible),
// nombre de molécules dans le solide et en vapeur.
export function etatChauffage(plan, tc, sortie) {
  const n = plan.eaux.length;
  const s = sortie || { O: new Float32Array(n * 3), H: new Float32Array(n * 6), fondu: new Float32Array(n), dansSolide: new Uint8Array(n) };
  const ch = plan.ch;
  const D = ch.duree_trajet_s, L = ch.trajet_vapeur_pm;
  const cb = Math.cos(plan.demi) * plan.OH, sp = Math.sin(plan.demi) * plan.OH;
  let solide = 0;
  plan.eaux.forEach((e, k) => {
    let o = e.pos, b = e.b, p = e.p, fondu = 0;
    const arriveeCommencee = tc >= e.arrivee;
    if (!arriveeCommencee && tc > e.depart) {
      // Départ : la molécule quitte sa place, monte en tournant sur elle-même, puis sort de la zone dessinée.
      const u = (tc - e.depart) / D;
      const d = lisse(u) * L + Math.max(0, u - 1) * L * 0.3;
      o = add(add(e.pos, mul(e.dirDepart, d)), mul(e.lateral, Math.sin(u * 4.2) * 30 * clamp01(u * 3)));
      const ang = e.vitRot * (tc - e.depart) * clamp01(u * 2);
      b = tourner(e.b, e.axeRot, ang); p = tourner(e.p, e.axeRot, ang);
      fondu = lisse((u - 0.6) / 0.4);
    } else if (arriveeCommencee) {
      if (e.depart === Infinity) {
        // Pas partie : rien ne change (cas impossible avec trois paliers qui vident tout ; gardé pour la sûreté).
      } else {
        // Arrivée (eau ajoutée) : la molécule descend vers la place vide et s'y oriente.
        const u = (tc - e.arrivee) / D;
        const v = 1 - lisse(u);
        o = add(add(e.pos, mul(e.dirArrivee, v * L)), mul(e.lateral, Math.sin(u * 3.1) * 25 * v));
        const ang = e.vitRot * 2.5 * v;
        b = tourner(e.b, e.axeRot, ang); p = tourner(e.p, e.axeRot, ang);
        fondu = 1 - lisse(u / 0.4);
      }
    }
    const dans = arriveeCommencee ? tc >= e.arrivee + D * 0.5 : dansLeSolide(e, tc, D);
    if (dans) solide++;
    s.dansSolide[k] = dans ? 1 : 0;
    s.O.set(o, k * 3);
    s.H.set(add(o, add(mul(b, cb), mul(p, sp))), k * 6);
    s.H.set(add(o, sub(mul(b, cb), mul(p, sp))), k * 6 + 3);
    s.fondu[k] = fondu;
  });
  s.solide = solide;
  s.vapeur = n - solide;
  return s;
}

// Niveau d'hydratation du solide (nombre de molécules d'eau par unité CuSO₄, nombre entier) pour la couleur.
export function niveau(plan, tc) {
  const e = etatChauffage(plan, tc);
  return e.solide / plan.nUnites;
}

// Contrôles : molécules d'eau conservées (solide + vapeur), molécules intactes.
export function controler(plan, etat) {
  let pire = 0, pireAngle = 0;
  for (let k = 0; k < plan.eaux.length; k++) {
    const o = [etat.O[k * 3], etat.O[k * 3 + 1], etat.O[k * 3 + 2]];
    const h1 = sub([etat.H[k * 6], etat.H[k * 6 + 1], etat.H[k * 6 + 2]], o);
    const h2 = sub([etat.H[k * 6 + 3], etat.H[k * 6 + 4], etat.H[k * 6 + 5]], o);
    pire = Math.max(pire, Math.abs(len(h1) - plan.OH), Math.abs(len(h2) - plan.OH));
    pireAngle = Math.max(pireAngle, Math.abs(Math.acos(dot(h1, h2) / (len(h1) * len(h2))) - 2 * plan.demi));
  }
  return { total: etat.solide + etat.vapeur, solide: etat.solide, vapeur: etat.vapeur, pireOH: pire, pireAngleDeg: (pireAngle * 180) / Math.PI };
}
