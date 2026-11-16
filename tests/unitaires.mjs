// Contrôles automatiques sans navigateur : données, géométrie, échelle, textes.
// Usage : node tests/unitaires.mjs   (code de sortie 1 si un contrôle échoue)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RACINE } from './outils-navigateur.mjs';
import { genererCristal, genererSurface, voisins, bilan } from '../src/scenes/nacl/reseau.js';
import { SceneNaCl } from '../src/scenes/nacl/scene.js';
import { ecrireLongueur, barreEchelle } from '../src/moteur/echelle.js';
import { lireTextes } from '../outils/markdown.mjs';
import { norme, soustraire } from '../src/moteur/vec.js';
import { positionsElectrons } from '../src/scenes/nacl/atome.js';
import { planDissolution, etatDissolution, controler, positionIon, roleMolecule } from '../src/scenes/nacl/dissolution.js';

let echecs = 0, total = 0;
function verifier(nom, condition, detail = '') {
  total++;
  if (condition) console.log(`  ok   ${nom}`);
  else { echecs++; console.log(`  ÉCHEC ${nom}${detail ? ' — ' + detail : ''}`); }
}
const proche = (a, b, tol) => Math.abs(a - b) <= tol;

const d = JSON.parse(readFileSync(join(RACINE, 'scenes/nacl/donnees.json'), 'utf8'));

console.log('Données de la fiche NaCl (§4)');
verifier('rayon de Na⁺ = 102 pm', d.especes['Na+'].rayon_pm === 102);
verifier('rayon de Cl⁻ = 181 pm', d.especes['Cl-'].rayon_pm === 181);
verifier('arête de la maille = 564 pm', d.reseau.arete_maille_pm === 564);
verifier('cristal de 6 × 6 × 6 ions', d.reseau.ions_par_arete === 6);
verifier('grain de 0,3 mm', d.grain.arete_m === 3e-4);
verifier('charges +1 et −1', d.especes['Na+'].charge === 1 && d.especes['Cl-'].charge === -1);

console.log('Réseau');
const cristal = genererCristal(6, 564, d.reseau.ion_au_coin);
const b = bilan(cristal, d.especes);
verifier('108 Na⁺', b.compte['Na+'] === 108, JSON.stringify(b.compte));
verifier('108 Cl⁻', b.compte['Cl-'] === 108, JSON.stringify(b.compte));
verifier('charge totale nulle', b.charge === 0);
const v = voisins(cristal);
const interieurs = cristal.map((ion, i) => i).filter((i) => { const c = cristal[i]; return [c.i, c.j, c.k].every((x) => x > 0 && x < 5); });
verifier('chaque ion intérieur a 6 voisins', interieurs.every((i) => v[i].length === 6));
verifier('les voisins sont de signe opposé', cristal.every((ion, i) => v[i].every((j) => cristal[j].espece !== ion.espece)));
verifier('distance entre voisins = 282 pm', cristal.every((ion, i) => v[i].every((j) => proche(norme(soustraire(ion.pos, cristal[j].pos)), 282, 1e-9))));
let dmin = Infinity;
for (let i = 0; i < cristal.length; i++) for (let j = i + 1; j < cristal.length; j++) dmin = Math.min(dmin, norme(soustraire(cristal[i].pos, cristal[j].pos)));
verifier('aucun ion plus proche que 282 pm d\'un autre', proche(dmin, 282, 1e-9));
const surface = genererSurface(40, 6, 564, d.reseau.ion_au_coin);
verifier('le reste du grain ne recouvre pas le cristal affiché', surface.every((s) => !(s.i < 6 && s.j < 6 && s.k < 6)));
verifier('le reste du grain prolonge l\'alternance', surface.every((s) => s.espece === ((s.i + s.j + s.k) % 2 === 0 ? d.reseau.ion_au_coin : (d.reseau.ion_au_coin === 'Cl-' ? 'Na+' : 'Cl-'))));

console.log('Convention de taille (dossier §3)');
const f = d.affichage.facteur_reduction;
verifier('facteur unique entre 0,25 et 0,30', f >= 0.25 && f <= 0.30, String(f));
verifier('aucune boule en contact avec le facteur réduit', (102 + 181) * f < 282);
verifier('tailles réelles : Na⁺ et Cl⁻ au contact (102 + 181 ≈ 282 pm)', proche(102 + 181, 282, 2));

console.log('Échelle');
verifier('10 cm', ecrireLongueur(0.1) === '10 cm', ecrireLongueur(0.1));
verifier('300 µm', ecrireLongueur(3e-4) === '300 µm', ecrireLongueur(3e-4));
verifier('1,2 mm', ecrireLongueur(1.2e-3) === '1,2 mm', ecrireLongueur(1.2e-3));
verifier('282 pm', ecrireLongueur(282e-12) === '282 pm', ecrireLongueur(282e-12));
verifier('2 nm', ecrireLongueur(2e-9) === '2 nm', ecrireLongueur(2e-9));
let barreOk = true;
for (let e = -1; e >= -10; e -= 0.01) {
  const W = 10 ** e, br = barreEchelle(W);
  const m = br.longueur / 10 ** Math.floor(Math.log10(br.longueur) + 1e-9);
  if (!(br.fraction >= 0.12 - 1e-9 && br.fraction <= 0.3 + 1e-9) || ![1, 2, 5].some((x) => proche(m, x, 1e-6))) { barreOk = false; break; }
}
verifier('barre d\'échelle ronde (1, 2, 5) et lisible sur toute la plage', barreOk);

console.log('Caméra et zoom');
const scene = new SceneNaCl(d, null, null);
scene.allerEtape(1);
const cam = scene.camera;
cam.ecran = { l: 1000, h: 600 };
let continu = true, pire = 0;
let prec = null;
for (let e = -1; e >= Math.log10(3e-10); e -= 0.001) {
  const W = 10 ** e;
  const c = scene.centrePour(W);
  if (prec) {
    const saut = norme(soustraire(c, prec)) / W; // déplacement du centre, en largeurs de champ
    pire = Math.max(pire, saut);
    if (saut > 0.02) continu = false;
  }
  prec = c;
}
verifier('trajectoire continue (aucun saut du centre entre deux pas de 0,23 %)', continu, `pire saut : ${(pire * 100).toFixed(2)} % du champ`);
cam.largeur = 2e-9; cam.centre = scene.centrePour(2e-9);
const p0 = cam.projeter([0, 0, 0]);
const p1 = cam.projeter(cam.base.droite.map((x) => x * 282e-12));
verifier('282 pm le long de l\'écran = 282 pm × largeur écran / largeur champ', proche(p1.x - p0.x, 282e-12 * 1000 / 2e-9, 1e-6));
let monotone = true;
let fPrec = scene.fondus(0.1);
for (let e = -1; e >= -10; e -= 0.01) {
  const fo = scene.fondus(10 ** e);
  if (fo.ions < fPrec.ions - 1e-12 || fo.faces > fPrec.faces + 1e-12) monotone = false;
  fPrec = fo;
}
verifier('fondus monotones (les ions apparaissent, les faces s\'effacent, sans retour)', monotone);
verifier('ions visibles sous 8 nm', scene.fondus(8e-9).ions > 0.99);
verifier('faces du grain encore pleines à 7 nm', scene.fondus(7e-9).faces > 0.99);
const msgs = d.temps1.messages;
verifier('messages de zoom contigus de 10 cm à 100 pm', msgs.every((m, i) => i === 0 || m.de_m === msgs[i - 1].a_m) && msgs[0].de_m === 0.1 && msgs.at(-1).a_m <= 1e-10);

console.log('Zoom dans l\'ion et maille');
for (const [nom, e] of Object.entries(d.especes)) {
  const electrons = e.noyau.protons - e.charge;
  verifier(`${nom} : électrons du schéma de Bohr = protons − charge (${electrons})`, e.couches.reduce((a, b) => a + b, 0) === electrons);
  const A = e.noyau.protons + e.noyau.neutrons;
  verifier(`${nom} : rayon du noyau ≈ 1,2 × A^(1/3) fm (A = ${A})`, proche(e.noyau.rayon_fm, 1.2 * A ** (1 / 3), 0.1));
}
verifier('Bohr : couche K pleine = une paire', JSON.stringify(positionsElectrons(2, 1)) === '[2]');
verifier('Bohr : 8 électrons = 4 paires', JSON.stringify(positionsElectrons(8, 4)) === '[2,2,2,2]');
verifier('Bohr : célibataires avant les paires (5 → 2,1,1,1)', JSON.stringify(positionsElectrons(5, 4)) === '[2,1,1,1]');
verifier('Bohr : 3 électrons = 3 célibataires (1,1,1,0)', JSON.stringify(positionsElectrons(3, 4)) === '[1,1,1,0]');
verifier('Na⁺ : 11 protons, 12 neutrons (²³Na)', d.especes['Na+'].noyau.protons === 11 && d.especes['Na+'].noyau.neutrons === 12);
verifier('Cl⁻ : 17 protons', d.especes['Cl-'].noyau.protons === 17);
verifier('1 fm s\'écrit « 1 fm »', ecrireLongueur(1e-15) === '1 fm', ecrireLongueur(1e-15));
verifier('0,5 pm s\'écrit « 500 fm »', ecrireLongueur(5e-13) === '500 fm', ecrireLongueur(5e-13));
const sceneIon = new SceneNaCl(d, null, null);
sceneIon.allerEtape(2);
sceneIon.basculer('ion');
sceneIon.etat.fonduIon = 1;
let continuIon = true, pireIon = 0, precIon = null;
for (let e = -1; e >= -15; e -= 0.001) {
  const W = 10 ** e, c = sceneIon.centrePour(W);
  if (precIon) { const saut = norme(soustraire(c, precIon)) / W; pireIon = Math.max(pireIon, saut); if (saut > 0.02) continuIon = false; }
  precIon = c;
}
verifier('zoom dans l\'ion : trajectoire continue jusqu\'à 1 fm', continuIon, `pire saut : ${(pireIon * 100).toFixed(2)} % du champ`);
const cIon = sceneIon.centrePour(1e-15), pIon = sceneIon.centreIonSelectionne();
verifier('à 1 fm, la vue est centrée sur le noyau de l\'ion sélectionné', norme(soustraire(cIon, pIon)) < 1e-18);
sceneIon.definirLargeur(1e-16);
verifier('avec l\'interrupteur, le zoom descend jusqu\'à 1 fm (pas plus)', sceneIon.etat.largeur === 1e-15);
sceneIon.basculer('ion');
verifier('sans l\'interrupteur, retour à 300 pm', sceneIon.etat.largeur === 3e-10);
const ma = sceneIon.maille;
verifier('maille : 27 positions d\'ions', ma.membres.size === 27);
const sommets = [...ma.membres].map((i) => sceneIon.cristal[i]).filter((x) => [x.i, x.j, x.k].every((v, q) => v === ma.depart[q] || v === ma.depart[q] + 2));
verifier('maille : 8 sommets, tous Cl⁻', sommets.length === 8 && sommets.every((x) => x.espece === 'Cl-'));
verifier('maille : arête de 564 pm', proche(ma.max[0] - ma.min[0], 564, 1e-9) && proche(ma.max[1] - ma.min[1], 564, 1e-9) && proche(ma.max[2] - ma.min[2], 564, 1e-9));

const sceneExp = new SceneNaCl(d, null, null);
sceneExp.allerEtape(2);
sceneExp.definirLargeur(1e-7);
verifier('exploration : on peut dézoomer jusqu\'à 15 nm (pas plus)', sceneExp.etat.largeur === 1.5e-8, String(sceneExp.etat.largeur));
const fe = sceneExp.fondus(1.5e-8);
verifier('exploration à 15 nm : cube seul, ions pleinement visibles, ni faces ni reste du grain', fe.ions === 1 && fe.faces === 0 && fe.surface === 1);
verifier('exploration : vue centrée sur le cube à toute échelle', norme(soustraire(sceneExp.centrePour(1.5e-8), sceneExp.centreCristalPm.map((v) => v * 1e-12))) < 1e-20);
verifier('exploration : instrument « modèle »', sceneExp.instrument() === 'instrument-modele');

console.log('Dissolution (temps 2)');
const plan = planDissolution(d, cristal, v);
const plan2 = planDissolution(d, cristal, v);
const naS = plan.suivis['Na+'], clS = plan.suivis['Cl-'];
verifier('ions suivis : un Na⁺ et un Cl⁻ de surface (coins, 3 voisins)', cristal[naS].espece === 'Na+' && cristal[clS].espece === 'Cl-' && v[naS].length === 3 && v[clS].length === 3);
verifier('le Na⁺ suivi part seul, puis le Cl⁻ suivi, puis les autres', plan.ordre[0] === naS && plan.ordre[1] === clS
  && plan.ions[naS].tDepart < plan.ions[clS].tDepart && plan.ions.every((ion, q) => q === naS || q === clS || ion.tDepart >= d.temps2.chronologie.debut_dissolution - 0.25));
let ecartNaCl = 0; const partis = { 'Na+': 0, 'Cl-': 0 };
plan.ordre.forEach((i) => { partis[cristal[i].espece]++; ecartNaCl = Math.max(ecartNaCl, Math.abs(partis['Na+'] - partis['Cl-'])); });
verifier('Na⁺ et Cl⁻ partent en nombres égaux (écart ≤ 1 à tout moment)', ecartNaCl <= 1, String(ecartNaCl));
const intervalles = plan.ordre.slice(2).map((q) => plan.ions[q].tDepart).sort((x, y) => x - y).map((t, k, l) => (k ? t - l[k - 1] : null)).slice(1);
const moy = intervalles.reduce((x, y) => x + y, 0) / intervalles.length;
const ecartType = Math.sqrt(intervalles.reduce((x, y) => x + (y - moy) ** 2, 0) / intervalles.length);
verifier('rythme des départs irrégulier', ecartType > 0.5 * moy, `moyenne ${moy.toFixed(2)} s, écart type ${ecartType.toFixed(2)} s`);
verifier('même plan à chaque chargement (graine fixe)', plan.molecules.length === plan2.molecules.length
  && [5, 30, 50, 80].every((t) => { const a = etatDissolution(plan, t), b = etatDissolution(plan2, t); return a.ions.every((x, k) => x === b.ions[k]) && a.O.every((x, k) => x === b.O[k]); }));
const etapes2 = d.temps2.etapes.filter((e) => e.type === 'choregraphie');
const instants = [...new Set([0, ...etapes2.flatMap((e) => [e.debut, (e.debut + e.fin) / 2, e.fin]), 200, 400])];
let conserve = true, rigide = true, pireOH = 0, pireAngle = 0, maxEau = 0, maxEauGrain = 0;
for (let t = 0; t <= 160; t += 0.5) {
  const e = etatDissolution(plan, t);
  const k = controler(plan, e, d.especes);
  if (k.compte['Na+'] !== 108 || k.compte['Cl-'] !== 108 || k.charge !== 0 || e.ions.some((x) => !Number.isFinite(x))) conserve = false;
  pireOH = Math.max(pireOH, k.pireOH); pireAngle = Math.max(pireAngle, k.pireAngleDeg);
  if (k.pireOH > 0.01 || k.pireAngleDeg > 0.01) rigide = false;
  maxEau = Math.max(maxEau, k.visibles);
  let pres = 0;
  plan.molecules.forEach((m, q) => { const { seg, j } = roleMolecule(m, t); const ion = seg.role === 'absent' ? m.segs[j - 1]?.ion : seg.ion; if (e.fonduEau[q] < 0.5 && !(ion !== undefined && plan.ions[ion].suivi)) pres++; });
  maxEauGrain = Math.max(maxEauGrain, pres);
}
for (const t of instants) { const k = controler(plan, etatDissolution(plan, t), d.especes); if (k.compte['Na+'] !== 108 || k.charge !== 0) conserve = false; }
verifier('conservation toutes les 0,5 s et à chaque étape : 108 Na⁺, 108 Cl⁻, charge 0', conserve);
verifier('aucune molécule d\'eau modifiée : O–H = 96 pm et H–O–H = 104,5° à 0,01 près', rigide, `écarts : ${pireOH.toExponential(1)} pm, ${pireAngle.toExponential(1)}°`);
const e0 = etatDissolution(plan, 0);
const eauDepart = controler(plan, e0, d.especes).visibles;
verifier('eau présente dès le départ : une centaine de molécules au plus autour du grain', eauDepart >= 80 && eauDepart <= d.temps2.eau_libre.maximum, String(eauDepart));
verifier('jamais plus de 100 molécules dessinées autour du grain (cortèges des 2 ions suivis à part)', maxEauGrain <= d.temps2.eau_libre.maximum, String(maxEauGrain));
verifier('au total, jamais plus de 100 + 12 molécules (+ 2 pendant un échange)', maxEau <= d.temps2.eau_libre.maximum + 14, String(maxEau));
const fin = etatDissolution(plan, 88);
verifier('solution : plus aucun ion dans le cristal', fin.dansCristal.every((x) => x === 0));
verifier('solution : chaque ion non suivi a son halo, les 2 ions suivis n\'en ont pas', plan.ions.every((ion, q) => (ion.suivi ? fin.fonduHalo[q] === 1 : fin.fonduHalo[q] === 0)));
verifier('solution : seuls les cortèges des ions suivis restent dessinés (12 molécules)', controler(plan, fin, d.especes).visibles <= 14, String(controler(plan, fin, d.especes).visibles));

// Géométrie des molécules installées (sur le cristal ou dans un cortège).
let geoNa = true, geoCl = true, nGeo = 0, cortegeComplet = true;
const pos = (A, k) => [A[k * 3], A[k * 3 + 1], A[k * 3 + 2]];
for (const t of [9, 16, 20, 30, 45, 60, 88]) {
  const e = etatDissolution(plan, t);
  const autour = { [naS]: 0, [clS]: 0 };
  plan.molecules.forEach((m, k) => {
    const { seg, avance } = roleMolecule(m, t);
    const prec = m.segs[m.segs.indexOf(seg) - 1];
    if (seg.role !== 'lie' || avance < 1) return;
    if (seg.ion in autour) autour[seg.ion]++;
    nGeo++;
    const ion = pos(e.ions, seg.ion), o = pos(e.O, k), h1 = pos(e.H, k * 2), h2 = pos(e.H, k * 2 + 1);
    if (plan.ions[seg.ion].espece === 'Na+') {
      const dNaO = norme(soustraire(o, ion));
      if (Math.abs(dNaO - 240) > 0.5 || norme(soustraire(h1, ion)) <= dNaO || norme(soustraire(h2, ion)) <= dNaO) geoNa = false;
    } else {
      const dH = Math.min(norme(soustraire(h1, ion)), norme(soustraire(h2, ion)));
      const dO = norme(soustraire(o, ion));
      if (Math.abs(dH - 230) > 0.5 || Math.abs(dO - (230 + 96)) > 0.5) geoCl = false; // Cl⁻···H–O aligné : dO = dH + O–H
    }
  });
  if (t >= 16 && autour[naS] < 5) cortegeComplet = false;
  if (t >= 30 && autour[clS] < 5) cortegeComplet = false;
}
verifier(`eau orientée vers Na⁺ : O à 240 pm, hydrogènes vers l'extérieur (${nGeo} positions contrôlées)`, geoNa);
verifier('eau orientée vers Cl⁻ : H à 230 pm, Cl⁻···H–O aligné (O à 326 pm)', geoCl);
verifier('cortège des ions suivis complet (6 molécules ; 5 pendant un échange)', cortegeComplet);
const echangesNa = plan.molecules.filter((m) => m.segs.some((s) => s.role === 'errant' && s.ion === naS && s.t < 22)).length;
verifier('échanges lents : une molécule du cortège du Na⁺ est remplacée pendant l\'étape 2', echangesNa >= 1, String(echangesNa));

// Pas de chevauchement, pas de retour dans le cristal, mouvement continu.
let dIon = Infinity, dEau = Infinity, retour = false, saut = 0;
const fr = d.affichage.facteur_reduction;
for (let t = 0; t <= 100; t += 0.25) {
  const e = etatDissolution(plan, t);
  for (let i = 0; i < 216; i++) for (let j = i + 1; j < 216; j++) {
    if (e.dansCristal[i] && e.dansCristal[j]) continue;
    dIon = Math.min(dIon, norme(soustraire(pos(e.ions, i), pos(e.ions, j))));
  }
  for (let i = 0; i < 216; i++) {
    if (e.dansCristal[i] || t - plan.ions[i].tDepart < 1.5) continue;
    for (let j = 0; j < 216; j++) if (e.dansCristal[j] && norme(soustraire(pos(e.ions, i), pos(e.ions, j))) < 450) retour = true;
  }
  plan.molecules.forEach((m, k) => {
    if (e.fonduEau[k] > 0.5) return;
    const { seg } = roleMolecule(m, t);
    for (let i = 0; i < 216; i++) if (i !== seg.ion) dEau = Math.min(dEau, norme(soustraire(pos(e.O, k), pos(e.ions, i))));
  });
  const e2 = etatDissolution(plan, t + 0.02);
  for (let i = 0; i < 216; i++) saut = Math.max(saut, norme(soustraire(pos(e.ions, i), pos(e2.ions, i))));
}
verifier('aucun chevauchement d\'ions à l\'écran (boules réduites)', dIon > (181 + 181) * fr, `distance minimale ${dIon.toFixed(0)} pm`);
verifier('aucune molécule d\'eau dans un autre ion à l\'écran (boules réduites)', dEau > (181 + 152) * fr, `distance minimale ${dEau.toFixed(0)} pm`);
verifier('un ion parti ne revient pas dans le cristal (toujours à plus de 450 pm)', !retour);
verifier('mouvement continu : pas de saut (moins de 25 pm en 0,02 s)', saut < 25, `${saut.toFixed(1)} pm`);
verifier('un ion dissous bouge encore longtemps après (diffusion)', norme(soustraire(positionIon(plan, 100, 80), positionIon(plan, 100, 85))) > 50);
const loinA = etatDissolution(plan, 149.9), loinB = etatDissolution(plan, 150.1), loinC = etatDissolution(plan, 450);
verifier('au-delà de la fin du calcul, le film continue sans saut (aller-retour)', loinA.ions.every((x, k) => Math.abs(x - loinB.ions[k]) < 5) && loinC.ions.every(Number.isFinite));

console.log('Textes');
let refuse = false;
try { lireTextes('## bon-titre\nTexte\n## titre abîmé\nTexte', 'essai.md'); } catch { refuse = true; }
verifier('un titre « ## » abîmé est refusé', refuse);
let refuseOrphelin = false;
try { lireTextes('Texte sans titre\n## a\nb', 'essai.md'); } catch { refuseOrphelin = true; }
verifier('un texte sans titre est refusé', refuseOrphelin);
const t = lireTextes('## a\nUn **mot** fort.\n\n## b\n- un\n- deux', 'essai.md');
verifier('gras et listes rendus', t.a.html === 'Un <strong>mot</strong> fort.' && t.b.html === '<ul><li>un</li><li>deux</li></ul>', JSON.stringify(t));

console.log(`\n${total - echecs}/${total} contrôles réussis.`);
if (echecs) { console.error(`${echecs} contrôle(s) en échec.`); process.exit(1); }
