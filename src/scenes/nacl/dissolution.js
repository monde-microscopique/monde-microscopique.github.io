// Dissolution de NaCl (fiche NaCl, temps 2 ; décisions de Roger du 16.11.2026, fiche §12).
// Module sans DOM. Tout est calculé une fois au chargement à partir d'une graine fixe,
// puis l'état est une fonction du temps t (s) : même film à chaque lecture, retour en arrière possible.
// Unités : picomètres (pm), secondes (s).
//
// Modèle montré :
//  - l'eau est là dès le départ, autour du grain (une centaine de molécules au plus, dessinées) ;
//  - les molécules au contact du cristal s'orientent : O vers Na⁺ (Na⁺–O 240 pm),
//    un H vers Cl⁻ (Cl⁻–H 230 pm, Cl⁻···H–O aligné) ;
//  - un ion de surface se détache avec les molécules qui l'entouraient, son cortège se complète
//    (6 molécules en octaèdre), puis il diffuse : marche au hasard, avec un léger éloignement moyen ;
//  - les places libérées à la surface sont reprises par de l'eau venue de l'extérieur ;
//  - chaque ion dissous garde ses 6 molécules d'eau ; autour des deux ions suivis (un Na⁺, un Cl⁻),
//    une molécule du cortège est de temps en temps remplacée par une autre (échanges lents).
// Représentation compacte : ions et eau à leur vraie taille pendant la dissolution (décision du 16.11.2026).
// Les molécules d'eau sont des corps rigides : O–H et l'angle H–O–H ne changent jamais.

import { aleatoire } from './reseau.js';

export const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// (Math.sqrt plutôt que Math.hypot : beaucoup plus rapide, et la précision suffit largement ici.)
const len = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const dist = (a, b) => { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
const unit = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [1, 0, 0]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lisse = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

function perpendiculaire(e, angle) {
  const a = Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = unit(cross(e, a));
  const v = cross(e, u);
  return add(mul(u, Math.cos(angle)), mul(v, Math.sin(angle)));
}

// Rotation de v autour de l'axe unitaire k, d'un angle a (formule de Rodrigues).
function tourner(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

// Repère d'une molécule d'eau : b = bissectrice (de O vers le milieu des H), p = dans le plan, perpendiculaire.
function repereVersAxe(espece, e, u, angleHOH) {
  if (espece === 'Na+') return { b: e.slice(), p: u.slice() }; // O vers l'ion, H vers l'extérieur
  // Cl⁻ : la première liaison O–H pointe vers l'ion (direction −e).
  const h1 = mul(e, -1);
  const h2 = add(mul(h1, Math.cos(angleHOH)), mul(u, Math.sin(angleHOH)));
  return { b: unit(add(h1, h2)), p: unit(sub(h1, h2)) };
}

function interpolerRepere(f0, f1, t) {
  if (t <= 0) return f0;
  if (t >= 1) return f1;
  const b = unit(mix(f0.b, f1.b, t));
  let p = mix(f0.p, f1.p, t);
  const q = sub(p, mul(b, dot(p, b)));
  p = len(q) > 1e-6 ? unit(q) : perpendiculaire(b, 0);
  return { b, p };
}

// Agitation : somme de sinus lents (position) et rotation irrégulière (orientation).
function agitation(r, amplitude) {
  return { ph: Array.from({ length: 6 }, () => r() * 6.283), A: amplitude };
}
function bruit(ag, t) {
  const { ph, A } = ag;
  return [
    A * (0.65 * Math.sin(0.9 * t + ph[0]) + 0.35 * Math.sin(2.1 * t + ph[3])),
    A * (0.65 * Math.sin(0.8 * t + ph[1]) + 0.35 * Math.sin(2.4 * t + ph[4])),
    A * (0.65 * Math.sin(1.0 * t + ph[2]) + 0.35 * Math.sin(1.9 * t + ph[5])),
  ];
}
function culbute(r) {
  const b0 = unit([r() - 0.5, r() - 0.5, r() - 0.5]);
  return { b0, p0: perpendiculaire(b0, r() * 6.283), axe: unit([r() - 0.5, r() - 0.5, r() - 0.5]), w: 0.5 + 0.5 * r(), phi: r() * 6.283 };
}
function repereCulbute(c, t) {
  const a = c.w * t + 0.7 * Math.sin(0.6 * t + c.phi);
  return { b: tourner(c.b0, c.axe, a), p: tourner(c.p0, c.axe, a) };
}

// Plan complet, calculé une fois au chargement.
export function planDissolution(donnees, cristal, voisinsDe) {
  const t2 = donnees.temps2;
  const eau = t2.eau, ch = t2.chronologie, dif = t2.diffusion, el = t2.eau_libre;
  const angle = (eau.angle_deg * Math.PI) / 180;
  const r = aleatoire(415);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(6.283185307 * r());
  const n = cristal.length;
  const cle = (i, j, k) => `${i},${j},${k}`;
  const index = new Map(cristal.map((ion, q) => [cle(ion.i, ion.j, ion.k), q]));
  const centre = mul(cristal.reduce((s, ion) => add(s, ion.pos), [0, 0, 0]), 1 / n);
  const rayonCristal = Math.max(...cristal.map((ion) => dist(ion.pos, centre)));
  const voisinSur = (q, a) => { const ion = cristal[q]; return index.get(cle(ion.i + a[0], ion.j - a[1], ion.k + a[2])); };

  // Ions suivis (étapes 2 et 3) : un Na⁺ et un Cl⁻ de surface, choisis dans les données.
  const suivis = {};
  for (const esp of ['Na+', 'Cl-']) {
    const q = index.get(t2.ions_suivis[esp].join(','));
    if (q === undefined || cristal[q].espece !== esp) throw new Error(`temps2.ions_suivis : pas de ${esp} en ${t2.ions_suivis[esp]}`);
    suivis[esp] = q;
  }
  const estSuivi = (q) => q === suivis['Na+'] || q === suivis['Cl-'];

  // 1. Ordre de départ : les deux ions suivis, puis toujours un ion qui a le moins de voisins restants
  //    (coins, arêtes, puis faces : le cristal rétrécit), Na⁺ et Cl⁻ en nombres égaux, en évitant
  //    deux voisins à la suite ; à égalité, tirage au sort.
  const prio = cristal.map(() => r());
  const reste = new Set(cristal.map((_, q) => q));
  const ordre = [suivis['Na+'], suivis['Cl-']];
  ordre.forEach((q) => reste.delete(q));
  const compte = { 'Na+': 1, 'Cl-': 1 };
  const recents = ordre.slice().reverse();
  const proximite = (q) => recents.reduce((s, j, k) => s + (dist(cristal[q].pos, cristal[j].pos) < 600 ? recents.length - k : 0), 0);
  while (reste.size) {
    let meilleur = -1, cleM = null;
    for (const q of reste) {
      const nv = voisinsDe[q].filter((j) => reste.has(j)).length;
      const esp = cristal[q].espece, autre = esp === 'Na+' ? 'Cl-' : 'Na+';
      const k = [compte[esp] > compte[autre] ? 1 : 0, nv, compte[esp], proximite(q), prio[q]];
      let mieux = !cleM;
      for (let x = 0; !mieux && x < k.length; x++) { if (k[x] < cleM[x]) mieux = true; else if (k[x] > cleM[x]) break; }
      if (mieux) { cleM = k; meilleur = q; }
    }
    recents.unshift(meilleur);
    if (recents.length > 12) recents.pop();
    ordre.push(meilleur);
    compte[cristal[meilleur].espece]++;
    reste.delete(meilleur);
  }
  const rang = new Array(n);
  ordre.forEach((q, k) => { rang[q] = k; });

  // 2. Instants de départ, alignés sur le pas de calcul Δ. Rythme irrégulier : intervalles tirés au hasard.
  const D = dif.pas_s;
  const gD = new Array(n);
  gD[suivis['Na+']] = Math.round(ch.depart_na / D);
  gD[suivis['Cl-']] = Math.round(ch.depart_cl / D);
  const m = n - 2;
  const cumul = [0];
  for (let k = 1; k < m; k++) cumul.push(cumul[k - 1] + 0.15 - Math.log(1 - 0.999 * r()));
  for (let k = 0; k < m; k++) {
    const t = ch.debut_dissolution + (ch.fin_dissolution - ch.debut_dissolution) * (cumul[k] / cumul[m - 1]);
    gD[ordre[k + 2]] = Math.round(t / D);
  }
  const tD = gD.map((g) => g * D);

  // 3. Trajets des ions : détachement le long de la normale extérieure, puis marche au hasard
  //    (pas de forces), avec un léger éloignement, sans retour dans le cristal ni chevauchement.
  const G = Math.round(ch.fin_simulation / D);
  const normale = cristal.map((ion, q) => {
    let s = [0, 0, 0];
    AXES.forEach((a) => { const j = voisinSur(q, a); if (j === undefined || rang[j] < rang[q]) s = add(s, a); });
    return len(s) > 1e-9 ? unit(s) : unit(sub(ion.pos, centre));
  });
  const nDet = (q) => (estSuivi(q) ? dif.detachement_suivi_pas : dif.detachement_pas);
  const lDet = (q) => (estSuivi(q) ? dif.detachement_suivi_pm : dif.detachement_pm);
  const dCristal = (q) => (estSuivi(q) ? dif.distance_cristal_suivi_pm : dif.distance_cristal_pm);
  const dIons = (a, b) => (estSuivi(a) || estSuivi(b) ? dif.distance_suivi_pm : dif.distance_ions_pm);
  const Rmax = dif.rayon_max_nm * 1000;
  const cur = cristal.map((ion) => ion.pos.slice());
  const chemins = cristal.map((_, q) => new Float64Array((G - gD[q] + 1) * 3));
  chemins.forEach((c, q) => c.set(cristal[q].pos, 0));
  // Grille de voisinage (cases de la taille de la plus grande distance imposée).
  const CASE = Math.max(dif.distance_suivi_pm, dif.distance_ions_pm);
  const caseDe = (p) => [Math.floor(p[0] / CASE), Math.floor(p[1] / CASE), Math.floor(p[2] / CASE)];
  const cleCase = (c) => ((c[0] + 512) * 1024 + (c[1] + 512)) * 1024 + (c[2] + 512);
  const grille = new Map();
  const caseIon = new Array(n).fill(null);
  const placer = (q) => {
    const k = cleCase(caseDe(cur[q]));
    if (caseIon[q] === k) return;
    if (caseIon[q] !== null) { const l = grille.get(caseIon[q]); l.splice(l.indexOf(q), 1); }
    if (!grille.has(k)) grille.set(k, []);
    grille.get(k).push(q);
    caseIon[q] = k;
  };
  const ordreMarche = cristal.map((_, q) => q);
  for (let k = ordreMarche.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ordreMarche[k], ordreMarche[j]] = [ordreMarche[j], ordreMarche[k]]; }
  const marge = (q, p, g, enCristal) => {
    // Plus petite marge (distance − distance imposée) avec le cristal restant et les autres ions dissous.
    let pire = Infinity;
    const dc = dCristal(q);
    if (enCristal.length && p[0] > boite[0] - dc && p[0] < boite[3] + dc && p[1] > boite[1] - dc && p[1] < boite[4] + dc && p[2] > boite[2] - dc && p[2] < boite[5] + dc) {
      // Plus petite distance au cristal restant ; on s'arrête dès qu'elle est trop petite.
      let min2 = Infinity;
      for (const j of enCristal) {
        const c = cristal[j].pos;
        const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
        const d2 = x * x + y * y + z * z;
        if (d2 < min2) { min2 = d2; gene = c; if (d2 < dc * dc) break; }
      }
      pire = Math.sqrt(min2) - dc;
      if (pire < 0) return pire;
    }
    const cx = Math.floor(p[0] / CASE), cy = Math.floor(p[1] / CASE), cz = Math.floor(p[2] / CASE);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
      const l = grille.get(((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512));
      if (!l) continue;
      for (const j of l) {
        if (j === q || gD[j] >= g) continue;
        const o = cur[j];
        const a = p[0] - o[0], b = p[1] - o[1], e = p[2] - o[2];
        const d = Math.sqrt(a * a + b * b + e * e) - dIons(q, j);
        if (d < pire) { pire = d; gene = o; }
      }
    }
    return pire;
  };
  const sigma = dif.ecart_pm;
  let boite = null; // boîte englobant le cristal restant
  let gene = null;  // position de ce qui gêne le plus (cristal ou autre ion), relevée par marge()
  for (let g = 1; g <= G; g++) {
    const enCristal = [];
    for (let q = 0; q < n; q++) if (gD[q] >= g) enCristal.push(q);
    boite = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const j of enCristal) for (let c = 0; c < 3; c++) { boite[c] = Math.min(boite[c], cristal[j].pos[c]); boite[c + 3] = Math.max(boite[c + 3], cristal[j].pos[c]); }
    // D'abord les ions qui se détachent (trajet imposé), puis les ions qui diffusent.
    for (let q = 0; q < n; q++) {
      const k = g - gD[q];
      if (k < 1 || k > nDet(q)) continue;
      cur[q] = add(cristal[q].pos, mul(normale[q], lDet(q) * lisse(k / nDet(q))));
      chemins[q].set(cur[q], k * 3);
      placer(q);
    }
    for (const q of ordreMarche) {
      const k = g - gD[q];
      if (k <= nDet(q)) continue;
      const prec = cur[q];
      const ext = unit(sub(prec, centre));
      // Près du cristal, un ion s'en écarte plus vite (sauf les ions suivis, qui restent dans le champ de la caméra).
      const pres = !estSuivi(q) && enCristal.length && dist(prec, centre) < rayonCristal + 1500;
      const derive = mul(ext, (dif.derive_pm_s + (pres ? dif.derive_pres_pm_s : 0)) * D);
      // Jusqu'à 10 pas tirés au hasard ; le premier qui respecte les distances est gardé.
      // Sinon, on garde le meilleur, ou on reste sur place si c'est mieux.
      let choix = null, meilleure = -Infinity;
      for (let essai = 0; essai < 10; essai++) {
        let p = add(add(prec, derive), [gauss() * sigma, gauss() * sigma, gauss() * sigma]);
        const rc = dist(p, centre);
        if (rc > Rmax) p = add(centre, mul(sub(p, centre), (2 * Rmax - rc) / rc));
        const mg = marge(q, p, g, enCristal);
        if (mg > meilleure) { meilleure = mg; choix = p; }
        if (mg >= 0) break;
      }
      if (meilleure < 0) {
        // Aucun pas ne convient : on reste, ou on s'écarte de ce qui gêne le plus.
        const mPrec = marge(q, prec, g, enCristal);
        if (mPrec > meilleure) { meilleure = mPrec; choix = prec; }
        if (mPrec < 0 && gene) {
          const p = add(prec, mul(unit(sub(prec, gene)), Math.min(2.5 * sigma, 10 - mPrec)));
          const mp = marge(q, p, g, enCristal);
          if (mp > meilleure) { meilleure = mp; choix = p; }
        }
      }
      cur[q] = choix;
      chemins[q].set(choix, k * 3);
      placer(q);
    }
  }

  // Lissage léger de la marche (après le détachement) : pas de zigzags brusques.
  if (dif.lissage) {
    chemins.forEach((W, q) => {
      const m = W.length / 3;
      const copie = W.slice();
      for (let k = nDet(q) + 2; k < m - 1; k++) for (let c = 0; c < 3; c++) {
        W[k * 3 + c] = (copie[(k - 1) * 3 + c] + 2 * copie[k * 3 + c] + copie[(k + 1) * 3 + c]) / 4;
      }
    });
  }

  const ions = cristal.map((ion, q) => ({
    espece: ion.espece, depart: ion.pos, tDepart: tD[q], chemin: chemins[q], rang: rang[q], suivi: estSuivi(q), normale: normale[q],
  }));
  const plan = { ions, ordre, centre, suivis, D, ch, eau: { OH: eau.OH_pm, demiAngle: angle / 2 }, molecules: [], repousse: el.repousse_pm };

  // 4. Eau dessinée : un ensemble de molécules réutilisables, chacune décrite par une suite de rôles.
  //    Rôles : « lie » (sur l'axe d'un ion, orientée), « libre » (agitation autour d'un point),
  //    « errant » (quitte un cortège), « absent » (effacée).
  const dO = {};
  for (const esp of ['Na+', 'Cl-']) {
    const c = t2.cortege[esp];
    dO[esp] = c.atome === 'O' ? c.distance_pm : c.distance_pm + eau.OH_pm;
  }
  plan.dO = dO;
  plan.reperesLies = [];
  for (let q = 0; q < n; q++) for (let k = 0; k < 6; k++) {
    plan.reperesLies.push(repereVersAxe(cristal[q].espece, AXES[k], perpendiculaire(AXES[k], r() * 6.283), angle));
  }
  const siteO = (q, k) => add(cristal[q].pos, mul(AXES[k], dO[cristal[q].espece]));
  const cheminDetachement = (q) => [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((f) => add(cristal[q].pos, mul(normale[q], lDet(q) * f)));
  const chemins3 = cristal.map((_, q) => cheminDetachement(q));
  const libreDepuis = (q, k) => { const j = voisinSur(q, AXES[k]); return j === undefined ? -Infinity : tD[j]; };

  const mol = plan.molecules;
  const allouer = (T) => {
    let m = mol.find((x) => x.libreA <= T + 1e-9);
    if (!m) { m = { segs: [{ t: -Infinity, duree: 0, role: 'absent' }], libreA: Infinity }; mol.push(m); }
    m.libreA = Infinity;
    return m;
  };
  const ajouter = (m, seg) => {
    const der = m.segs[m.segs.length - 1];
    if (seg.t < der.t + der.duree - 1e-9) seg.t = der.t + der.duree;
    m.segs.push(seg);
  };
  const libre = (home) => ({ role: 'libre', home, ag: agitation(r, el.agitation_pm), cu: culbute(r) });

  // Points possibles pour l'eau libre : grille irrégulière autour du cristal.
  const pas = el.grille_pm;
  const candidats = [];
  for (let x = -1100; x <= 2510; x += pas) for (let y = -2510; y <= 1100; y += pas) for (let z = -1100; z <= 2510; z += pas) {
    const p = [x + (r() - 0.5) * 140, y + (r() - 0.5) * 140, z + (r() - 0.5) * 140];
    const proches = [];
    for (let q = 0; q < n; q++) { const d = dist(p, cristal[q].pos); if (d < el.couche_pm[1] + 50) proches.push([d, q]); }
    if (!proches.length) continue;
    proches.sort((a, b) => a[0] - b[0]);
    candidats.push({ p, proches, prio: r(), m: null });
  }
  const dMinCristal = (c, T) => { for (const [d, q] of c.proches) if (tD[q] > T + 1e-9) return d; return Infinity; };

  const sites = new Map(); // q*6+k → molécule
  const prioSite = Array.from({ length: n * 6 }, () => r());
  const cortege = cristal.map(() => new Array(6).fill(null)); // molécules liées à chaque ion dissous
  const echanges = [];
  for (const q of [suivis['Na+'], suivis['Cl-']]) {
    const ordreAxes = [0, 1, 2, 3, 4, 5].sort(() => 0);
    for (let k = 5; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ordreAxes[k], ordreAxes[j]] = [ordreAxes[j], ordreAxes[k]]; }
    let t = tD[q] + ch.completion_s + ch.premier_echange_s, x = 0;
    while (t < ch.fin_simulation) {
      echanges.push({ g: Math.round(t / D), q, k: ordreAxes[x % 6] });
      x++;
      t += ch.echange_s[0] + (ch.echange_s[1] - ch.echange_s[0]) * r();
    }
  }
  const finEau = Math.round((ch.fin_dissolution + 6) / D);

  for (let g = 0; g <= G; g++) {
    const T = g * D;
    // a) Départs : les molécules liées à l'ion partent avec lui ; l'eau de surface voisine qui se trouve
    //    sur son chemin s'écarte (elle s'efface et sera remplacée plus tard).
    for (let q = 0; q < n; q++) {
      if (gD[q] !== g) continue;
      for (let k = 0; k < 6; k++) {
        const m = sites.get(q * 6 + k);
        if (!m) continue;
        sites.delete(q * 6 + k);
        cortege[q][k] = m;
      }
      const chemin = cheminDetachement(q);
      for (const [key, m] of [...sites]) {
        const o = siteO(Math.floor(key / 6), key % 6);
        if (!chemin.some((p) => dist(p, o) < el.ecart_chemin_pm)) continue;
        ajouter(m, { t: T, duree: 0.5, role: 'absent' });
        m.libreA = T + 0.5;
        sites.delete(key);
      }
    }
    // b) Cortège complété : les places tournées vers le cristal sont prises par de l'eau venue de l'extérieur,
    //    dès que le chemin d'arrivée est dégagé (aucun autre ion sur le trajet pendant 2 s).
    const enAttente = [];
    for (let q = 0; q < n; q++) if (g >= gD[q] + Math.round(ch.completion_s / D) && cortege[q].some((m) => !m)) enAttente.push(q);
    if (enAttente.length) {
      const instants = [T, T + 1, T + 2];
      const positions = instants.map((t) => cristal.map((_, j) => positionIon(plan, j, t)));
      const degage = (q, a, entree) => instants.every((t, x) => {
        const slot = add(positions[x][q], mul(a, dO[cristal[q].espece]));
        const debut = add(slot, mul(entree, 1 - lisse(x / 2)));
        return positions[x].every((p, j) => j === q || (dist(p, slot) > 420 && dist(p, debut) > 420));
      });
      for (const q of enAttente) {
        const nq = normale[q];
        let x = 0;
        for (let k = 0; k < 6; k++) {
          if (cortege[q][k]) continue;
          const a = AXES[k];
          const lat0 = sub(a, mul(nq, dot(a, nq)));
          const base = len(lat0) > 1e-6 ? unit(lat0) : perpendiculaire(a, 1);
          // Quatre directions d'arrivée possibles, autour de l'axe ; la première dégagée est prise.
          for (let essai = 0; essai < 4; essai++) {
            const lat = tourner(base, a, (essai * Math.PI) / 2);
            const entree = add(mul(lat, 360), mul(nq, 260));
            if (!degage(q, a, entree) && g < gD[q] + Math.round((ch.completion_s + 10) / D)) continue;
            const m = allouer(T);
            ajouter(m, { t: T + 0.4 * x++, duree: 2.0, role: 'lie', ion: q, k, entree });
            cortege[q][k] = m;
            break;
          }
        }
      }
    }
    // c) Échanges lents dans le cortège des ions suivis.
    for (const ex of echanges) {
      if (ex.g !== g) continue;
      const { q, k } = ex;
      const ancien = cortege[q][k];
      if (!ancien) continue;
      const a = AXES[k];
      const p0 = add(positionIon(plan, q, T), mul(a, dO[cristal[q].espece]));
      const v = mul(unit(add(a, mul(perpendiculaire(a, r() * 6.283), 0.4))), ch.vitesse_errant_pm_s);
      ajouter(ancien, { t: T, duree: 1.2, role: 'errant', p0, t0: T, v, ag: agitation(r, el.agitation_pm), cu: culbute(r), ion: q });
      ajouter(ancien, { t: T + 2.6, duree: 1.2, role: 'absent' });
      ancien.libreA = T + 3.8;
      const nouveau = allouer(T);
      const cote = perpendiculaire(a, r() * 6.283);
      ajouter(nouveau, { t: T + 0.7, duree: 2.2, role: 'lie', ion: q, k, entree: add(mul(cote, 330), mul(a, 260)) });
      cortege[q][k] = nouveau;
    }
    if (g > finEau && !sites.size && !candidats.some((c) => c.m)) continue;
    // L'eau de surface et l'eau libre sont revues toutes les 0,5 s (et à l'instant 0).
    if (g % Math.max(1, Math.round(0.5 / D)) !== 0) continue;

    // d) Ions dissous près du grain (on n'y met pas d'eau libre ni de nouvelle eau de surface).
    const proches = [];
    for (let q = 0; q < n; q++) {
      if (gD[q] >= g) continue;
      const p = positionIon(plan, q, T);
      if (dist(p, centre) < rayonCristal + 2500) proches.push({ q, p, p2: positionIon(plan, q, T + 1.5) });
    }
    const pres = (x, d, dSuivi) => proches.some((o) => Math.min(dist(x, o.p), dist(x, o.p2)) < (estSuivi(o.q) ? dSuivi : d));

    const bientot = [];
    for (let q = 0; q < n; q++) if (gD[q] >= g - Math.round(2.5 / D) && gD[q] <= g + Math.round(3 / D)) bientot.push(q);
    // e) Eau de surface voulue : axes libres des ions encore dans le cristal, espacées.
    const voulus = [];
    for (let q = 0; q < n; q++) {
      if (gD[q] <= g) continue;
      for (let k = 0; k < 6; k++) {
        const ld = libreDepuis(q, k);
        if (ld > T + 1e-9) continue; // l'axe est encore bouché par un voisin
        const key = q * 6 + k;
        const force = estSuivi(q);
        const occupe = sites.has(key);
        if (!force && !occupe && ld > -Infinity && T - ld < ch.delai_surface_s) continue;
        const o = siteO(q, k);
        if (!force && !occupe && pres(o, el.distance_ion_pm, el.distance_suivi_pm)) continue;
        // Pas de nouvelle eau de surface sur le chemin d'un ion qui va bientôt partir.
        if (!force && !occupe && bientot.some((j) => j !== q && chemins3[j].some((p) => dist(p, o) < el.ecart_chemin_pm))) continue;
        voulus.push({ key, q, k, o, rangP: force ? -2 : occupe ? -1 : prioSite[key] });
      }
    }
    voulus.sort((a, b) => a.rangP - b.rangP);
    const choisis = [];
    for (const v of voulus) if (v.rangP === -2 || choisis.every((c) => dist(c.o, v.o) >= el.ecart_surface_pm)) choisis.push(v);
    const cles = new Set(choisis.map((c) => c.key));
    // f) Eau libre voulue : une couche autour du cristal restant, espacée, sans dépasser le maximum.
    // Les molécules qui s'effacent encore (parties avec un ion) comptent aussi.
    const enCours = mol.filter((x) => x.libreA > T && x.libreA < Infinity).length;
    const plafond = Math.max(0, el.maximum - choisis.length - enCours);
    const libres = [];
    const tries = candidats.filter((c) => { const d = dMinCristal(c, T); return d >= el.couche_pm[0] && d <= el.couche_pm[1]; })
      .sort((a, b) => (a.m ? -1 : 0) - (b.m ? -1 : 0) || a.prio - b.prio);
    for (const c of tries) {
      if (libres.length >= plafond) break;
      if (choisis.some((s) => dist(s.o, c.p) < el.ecart_eau_surface_pm || dist(add(s.o, mul(AXES[s.k], 200)), c.p) < el.ecart_eau_surface_pm)) continue;
      if (!c.m && pres(c.p, el.distance_ion_pm + 100, el.distance_suivi_pm + 150)) continue;
      if (libres.some((l) => dist(l.p, c.p) < el.ecart_libres_pm)) continue;
      libres.push(c);
    }
    const libresSet = new Set(libres);

    // g) Ce qui n'est plus voulu s'efface ; ce qui est nouveau apparaît en venant de l'extérieur.
    for (const [key, m] of [...sites]) {
      if (cles.has(key)) continue;
      ajouter(m, { t: T, duree: 1.2, role: 'absent' });
      m.libreA = T + 1.2;
      sites.delete(key);
    }
    for (const c of candidats) {
      if (!c.m || libresSet.has(c)) continue;
      ajouter(c.m, { t: T, duree: 1.5, role: 'absent' });
      c.m.libreA = T + 1.5;
      c.m = null;
    }
    for (const s of choisis) {
      if (sites.has(s.key)) continue;
      const m = allouer(T);
      const a = AXES[s.k];
      if (g === 0) {
        // Au départ, la molécule est près de l'ion, pas encore orientée ; elle s'oriente pendant l'étape 1.
        m.segs = [{ t: -Infinity, duree: 0, ...libre(add(s.o, add(mul(a, 190), mul(perpendiculaire(a, r() * 6.283), 50)))) }];
        const to = ch.orientation_s[0] + (ch.orientation_s[1] - ch.orientation_s[0]) * r();
        ajouter(m, { t: to, duree: 2.2, role: 'lie', ion: s.q, k: s.k });
      } else {
        ajouter(m, { t: T, duree: 1.8, role: 'lie', ion: s.q, k: s.k, entree: add(mul(a, 380), mul(perpendiculaire(a, r() * 6.283), 120)) });
      }
      sites.set(s.key, m);
    }
    for (const c of libres) {
      if (c.m) continue;
      const m = allouer(T);
      if (g === 0) m.segs = [{ t: -Infinity, duree: 0, ...libre(c.p) }];
      else ajouter(m, { t: T, duree: 1.5, ...libre(c.p), entree: mul(unit(sub(c.p, centre)), 260) });
      c.m = m;
    }
  }
  return plan;
}

// Position d'un ion au temps t (pm), sans la vibration thermique.
// Entre deux points calculés, courbe d'Hermite (vitesse continue) ; vitesse nulle au départ.
export function positionIon(plan, q, t) {
  const ion = plan.ions[q];
  if (t <= ion.tDepart) return ion.depart;
  const W = ion.chemin;
  const der = W.length / 3 - 1;
  const u = (t - ion.tDepart) / plan.D;
  const k = Math.floor(u);
  if (k >= der) return [W[der * 3], W[der * 3 + 1], W[der * 3 + 2]];
  const s = u - k;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const p0 = W[k * 3 + c], p1 = W[(k + 1) * 3 + c];
    const m0 = k === 0 ? 0 : (p1 - W[(k - 1) * 3 + c]) / 2;
    const m1 = k + 1 >= der ? p1 - p0 : (W[(k + 2) * 3 + c] - p0) / 2;
    out[c] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  }
  return out;
}

export const dansLeCristal = (plan, q, t) => t <= plan.ions[q].tDepart;

// Rôle d'une molécule au temps t : indice du segment courant et avancement de la transition (0 à 1).
export function roleMolecule(m, t) {
  let j = m.segs.length - 1;
  while (j > 0 && m.segs[j].t > t) j--;
  const s = m.segs[j];
  return { j, seg: s, avance: s.duree > 0 ? clamp01((t - s.t) / s.duree) : 1 };
}

function evaluer(plan, seg, t, posIons, dissous) {
  if (seg.role === 'lie') {
    const ion = plan.ions[seg.ion];
    return { o: add(posIons[seg.ion], mul(AXES[seg.k], plan.dO[ion.espece])), f: plan.reperesLies[seg.ion * 6 + seg.k] };
  }
  let o;
  if (seg.role === 'libre') o = add(seg.home, bruit(seg.ag, t));
  else o = add(add(seg.p0, mul(seg.v, Math.max(0, t - seg.t0))), mul(bruit(seg.ag, t), lisse((t - seg.t0) / 1.5)));
  // L'eau libre s'écarte des ions dissous qui passent (sauf de l'ion qu'elle vient de quitter).
  for (const q of dissous) {
    if (q === seg.ion) continue;
    const R = plan.repousse;
    const d = sub(o, posIons[q]);
    const l = len(d);
    if (l < R && l > 1e-6) o = add(o, mul(d, ((R - l) / l) * 0.9));
  }
  return { o, f: repereCulbute(seg.cu, t) };
}

// État complet au temps t : positions des ions, des atomes O et H, visibilité de l'eau.
// Au-delà de la fin du calcul, le film repart en arrière puis en avant sur sa dernière minute
// (une marche au hasard jouée à l'envers reste une marche au hasard).
export function tempsJoue(plan, t) {
  const F = plan.ch.fin_simulation, L = plan.ch.boucle_s;
  if (t <= F) return t;
  const u = (t - F) % (2 * L);
  return u < L ? F - u : F - 2 * L + u;
}

export function etatDissolution(plan, tReel, sortie) {
  const t = tempsJoue(plan, tReel);
  const nI = plan.ions.length, nM = plan.molecules.length;
  const s = sortie || {
    ions: new Float32Array(nI * 3), O: new Float32Array(nM * 3), H: new Float32Array(nM * 6),
    fonduEau: new Float32Array(nM), dansCristal: new Uint8Array(nI),
  };
  const posIons = [];
  const dissous = [];
  for (let q = 0; q < nI; q++) {
    const p = positionIon(plan, q, t);
    posIons.push(p);
    s.ions.set(p, q * 3);
    const dans = dansLeCristal(plan, q, t);
    s.dansCristal[q] = dans ? 1 : 0;
    if (!dans) dissous.push(q);
  }
  const { OH, demiAngle } = plan.eau;
  const cb = Math.cos(demiAngle) * OH, sp = Math.sin(demiAngle) * OH;
  plan.molecules.forEach((m, k) => {
    const { j, seg, avance } = roleMolecule(m, t);
    const prec = j > 0 ? m.segs[j - 1] : null;
    let o, f, vis;
    if (seg.role === 'absent') {
      if (!prec || prec.role === 'absent') { o = [0, 0, 0]; f = { b: [1, 0, 0], p: [0, 1, 0] }; vis = 0; }
      else { ({ o, f } = evaluer(plan, prec, t, posIons, dissous)); vis = 1 - lisse(avance); }
    } else {
      const B = evaluer(plan, seg, t, posIons, dissous);
      const sl = lisse(avance);
      if (!prec || prec.role === 'absent') {
        o = seg.entree ? add(B.o, mul(seg.entree, 1 - sl)) : B.o;
        f = B.f;
        vis = seg.t === -Infinity ? 1 : sl;
      } else {
        const A = evaluer(plan, prec, t, posIons, dissous);
        o = mix(A.o, B.o, sl);
        f = interpolerRepere(A.f, B.f, sl);
        vis = 1;
      }
    }
    s.O.set(o, k * 3);
    s.H.set(add(o, add(mul(f.b, cb), mul(f.p, sp))), k * 6);
    s.H.set(add(o, sub(mul(f.b, cb), mul(f.p, sp))), k * 6 + 3);
    s.fonduEau[k] = 1 - vis;
  });
  return s;
}

// Contrôles (tests et panneau) : nombre d'ions, charge, eau intacte, nombre de molécules dessinées.
export function controler(plan, etat, especes) {
  const compte = { 'Na+': 0, 'Cl-': 0 };
  let charge = 0;
  plan.ions.forEach((ion) => { compte[ion.espece]++; charge += especes[ion.espece].charge; });
  let pireOH = 0, pireAngle = 0, visibles = 0;
  const OH = plan.eau.OH, angle = plan.eau.demiAngle * 2;
  for (let k = 0; k < plan.molecules.length; k++) {
    if (etat.fonduEau[k] < 0.5) visibles++;
    const o = [etat.O[k * 3], etat.O[k * 3 + 1], etat.O[k * 3 + 2]];
    const h1 = sub([etat.H[k * 6], etat.H[k * 6 + 1], etat.H[k * 6 + 2]], o);
    const h2 = sub([etat.H[k * 6 + 3], etat.H[k * 6 + 4], etat.H[k * 6 + 5]], o);
    pireOH = Math.max(pireOH, Math.abs(len(h1) - OH), Math.abs(len(h2) - OH));
    pireAngle = Math.max(pireAngle, Math.abs(Math.acos(Math.max(-1, Math.min(1, dot(h1, h2) / (len(h1) * len(h2))))) - angle));
  }
  return { compte, charge, pireOH, pireAngleDeg: (pireAngle * 180) / Math.PI, visibles };
}
