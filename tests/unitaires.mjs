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
