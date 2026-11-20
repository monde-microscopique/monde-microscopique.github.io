// Scène « molécules » (visionneuse, fiche F-A), réutilisée par les scènes du chapitre 4 (F-D, puis F-C, F-B).
// Plusieurs molécules côte à côte ; on les fait tourner toutes ensemble, chacune autour de son centre.
// Rendus : boules et bâtons (par défaut), compact (vraies tailles), formule plane (développée).
// Interrupteurs : étiquettes (identité de chaque atome), compteurs d'atomes, formule brute et M, afficher les H.

import { Camera } from '../../moteur/camera.js';
import { lisse, borner, couleurRvb } from '../../moteur/vec.js';
import { aleatoire } from '../nacl/reseau.js';
import {
  IDENTITE, produit, appliquer, rotationX, rotationY, orthonormer, orientationPrincipale, orientationPlane,
  formuleIndices, rapportSimple, directionDecalage,
} from './visionneuse.js';

const PM = 1e-12;
const INTER_DEFAUT = { etiquettes: false, compteurs: false, formule: false, hydrogenes: true, compact: false, plane: false, avance: false };
const ECART_H = 0.35, DUREE_H = 0.25;
const BASE = { droite: [1, 0, 0], haut: [0, 1, 0], avant: [0, 0, -1] };

export class SceneMolecules {
  constructor(donnees, rendu, ctxMacro, ctxDessus) {
    this.d = donnees;
    this.rendu = rendu;
    this.ctxMacro = ctxMacro;
    this.ctx = ctxDessus;
    this.camera = new Camera();
    this.camera.base = BASE;
    this.compteursDansLaVue = true;

    const el = this.d.especes;
    const alea = aleatoire(31);
    this.mols = this.d.molecules.map((id) => {
      const m = this.d.bibliotheque[id];
      const local = m.atomes.map((a) => a.pos);
      const O = orientationPrincipale(local);
      // Formule plane : axe le plus long horizontal, longueur moyenne des liaisons égale à celle du modèle 3D.
      const tourne = orientationPlane(m.atomes.map((a) => a.plan));
      const moyenne = (f) => m.liaisons.reduce((s2, [i, j]) => s2 + f(i, j), 0) / m.liaisons.length;
      const echellePlan = moyenne((i, j) => Math.hypot(...local[i].map((v, k) => v - local[j][k])))
        / moyenne((i, j) => Math.hypot(m.atomes[i].plan[0] - m.atomes[j].plan[0], m.atomes[i].plan[1] - m.atomes[j].plan[1]));
      const plan = m.atomes.map((a) => [...tourne(a.plan).map((v) => v * echellePlan), 0]);
      const voisins = m.atomes.map(() => []);
      for (const [i, j] of m.liaisons) { voisins[i].push(j); voisins[j].push(i); }
      const orient = local.map((p) => appliquer(O, p));
      const rayon = Math.max(...orient.map((p) => Math.hypot(...p)), ...plan.map((p) => Math.hypot(p[0], p[1]))) + this.d.especes.H.rayon_pm + 40;
      return { ...m, orient, plan, voisins, rayon, phase: [alea() * 6.28, alea() * 6.28, alea() * 6.28], centre: [0, 0, 0] };
    });

    // Sphères : une par atome ; bâtons : un par liaison simple, deux par double, trois par triple.
    this.spheres = [];
    this.batons = [];
    this.mols.forEach((m, k) => {
      m.debut = this.spheres.length;
      m.atomes.forEach((a) => this.spheres.push({ pos: [0, 0, 0], rayon: el[a.el].rayon_pm, couleur: couleurRvb(el[a.el].couleur), phase: m.phase, mol: k, el: a.el }));
      m.batonsDebut = this.batons.length;
      for (const [i, j, ordre] of m.liaisons) {
        for (let o = 0; o < ordre; o++) {
          this.batons.push({
            a: [0, 0, 0], b: [0, 0, 0], rayon: this.d.affichage.rayon_baton_pm * (ordre > 1 ? 0.62 : 1),
            couleurA: couleurRvb(el[m.atomes[i].el].couleur), couleurB: couleurRvb(el[m.atomes[j].el].couleur), phase: m.phase,
            mol: k, i, j, ordre, o,
          });
        }
      }
    });
    this.positions = new Float32Array(this.spheres.length * 3);
    this.extremites = new Float32Array(this.batons.length * 6);

    if (rendu) {
      this.lot = rendu.creerLot(this.spheres, { dynamique: true });
      this.lotBatons = rendu.creerBatons(this.batons, { dynamique: true });
      rendu.creerAtlas(Object.keys(el));
      this.etiq = rendu.creerEtiquettes(this.lot, this.spheres.map((s, k) => ({ index: k, texte: s.el })));
      this.etiq.seuil = 3;
    }

    this.etapes = this.d.etapes.map((e) => ({ ...e }));
    this.etat = {
      etape: 0, largeur: 4e-9, temps: 0, tc: 0, lecture: false, zoom: 1,
      inter: { ...INTER_DEFAUT },
      rotation: IDENTITE.slice(),
      plan: 0,          // 0 = 3D, 1 = formule plane (fondu animé)
    };
    this.ecran = { l: 1280, h: 720 };
    this.cleEtats = '';
    this.allerEtape(0);
  }

  get etape() { return this.etapes[this.etat.etape]; }
  get fige() { return this.etape.type === 'question'; }
  get temps2() { return false; }

  allerEtape(i) {
    i = borner(i, 0, this.etapes.length - 1);
    this.etat.etape = i;
    this.etat.lecture = false;
    // Une étape peut imposer des interrupteurs (par exemple les compteurs pour « compter les atomes ») ;
    // en revenant en arrière, ces interrupteurs reprennent la valeur de l'étape (ou leur valeur par défaut).
    const imposes = new Set(this.etapes.flatMap((e) => Object.keys(e.inter || {})));
    for (const k of imposes) this.etat.inter[k] = this.etape.inter?.[k] ?? INTER_DEFAUT[k];
    if (this.etat.inter.plane) this.etat.inter.compact = false;
    this.etat.plan = this.etat.inter.plane ? 1 : 0;
    this.apparitionH = null;
    this.majPositions();
  }

  // ---------------------------------------------------------------- géométrie
  // Disposition : une rangée sur un écran large, deux colonnes sur un écran étroit.
  // Renvoie la largeur du champ (m) qui fait tout tenir, place pour les textes comprise.
  disposition() {
    const { l, h } = this.ecran;
    const n = this.mols.length;
    const colonnes = l / h >= 1.25 || n === 1 ? n : Math.min(2, n);
    const lignes = Math.ceil(n / colonnes);
    // Réserves en pixels : règle à droite ; message (en haut sur ordinateur, en bas sur téléphone) ;
    // textes sous chaque molécule. Sur un écran étroit, les textes rapetissent pour tenir dans leur colonne.
    const etroit = l < 600;
    const regle = 70;
    this.echelleTexte = etroit ? 0.74 : borner((l - regle) / colonnes / 200, 0.72, 1);
    this.ecartCompteurs = etroit ? 14 : 22;
    this.formuleSurDeuxLignes = etroit;
    const haut = etroit ? 16 : Math.min(110, 0.16 * h), bas = etroit ? 130 : Math.min(90, 0.13 * h);
    const texte = (etroit ? 6 : 5) * 19 * this.echelleTexte + 8;
    const dispo = Math.max(80, h - haut - bas - lignes * texte);
    const ecart = 0.12 * Math.max(...this.mols.map((m) => m.rayon));
    const textePx = etroit ? 165 : 215 * this.echelleTexte;
    // Chaque colonne est assez large pour sa molécule et pour ses textes (deux passes : l'échelle dépend des largeurs).
    let pxParPm = 1, rangees = [];
    for (let passe = 0; passe < 3; passe++) {
      const larg = this.mols.map((m) => Math.max(2 * m.rayon + ecart, textePx / pxParPm));
      rangees = [];
      for (let r = 0; r < lignes; r++) {
        const ks = [...Array(colonnes).keys()].map((c) => r * colonnes + c).filter((k) => k < n);
        rangees.push({ ks, larg, largeur: ks.reduce((s, k) => s + larg[k], 0), hauteur: 2 * Math.max(...ks.map((k) => this.mols[k].rayon)) });
      }
      pxParPm = Math.min((l - regle) / (1.03 * Math.max(...rangees.map((r) => r.largeur))), dispo / (1.04 * rangees.reduce((s, r) => s + r.hauteur, 0)));
    }
    const decalage = -regle / 2 / pxParPm;
    let ys = haut + (h - haut - bas - rangees.reduce((s, r) => s + r.hauteur * pxParPm + texte, 0)) / 2;
    for (const r of rangees) {
      const yc = ys + (r.hauteur * pxParPm) / 2;
      const larg = r.larg;
      let x = decalage - r.largeur / 2;
      for (const k of r.ks) {
        x += larg[k] / 2;
        this.mols[k].centre = [x, (h / 2 - yc) / pxParPm, 0];
        // Les textes d'une même rangée commencent à la même hauteur.
        this.mols[k].basRangee = (h / 2 - yc) / pxParPm - r.hauteur / 2;
        x += larg[k] / 2;
      }
      ys += r.hauteur * pxParPm + texte;
    }
    return (l / pxParPm) * PM;
  }

  // Positions des atomes et des bâtons selon la rotation et le passage à la formule plane.
  majPositions() {
    this.ajustement = this.disposition();
    this.etat.largeur = this.ajustement / this.etat.zoom;
    const R = this.etat.rotation;
    const s = lisse(0, 1, this.etat.plan);
    const P = this.positions;
    this.mols.forEach((m) => {
      const pos = m.orient.map((p, a) => {
        const q = appliquer(R, p);
        const pl = m.plan[a];
        return [m.centre[0] + q[0] + (pl[0] - q[0]) * s, m.centre[1] + q[1] + (pl[1] - q[1]) * s, m.centre[2] + q[2] * (1 - s)];
      });
      m.pos = pos;
      pos.forEach((p, a) => P.set(p, (m.debut + a) * 3));
    });
    const E = this.extremites;
    const ecartBaton = this.d.affichage.rayon_baton_pm * this.d.affichage.facteur_reduction * 1.7;
    this.batons.forEach((b, k) => {
      const m = this.mols[b.mol];
      const A = m.pos[b.i], B = m.pos[b.j];
      let dx = 0, dy = 0, dz = 0;
      if (b.ordre > 1) {
        const n = directionDecalage(m.pos, m.voisins, b.i, b.j);
        const f = b.ordre === 2 ? (b.o - 0.5) * 2 * ecartBaton : (b.o - 1) * 2 * ecartBaton;
        dx = n[0] * f; dy = n[1] * f; dz = n[2] * f;
      }
      E.set([A[0] + dx, A[1] + dy, A[2] + dz, B[0] + dx, B[1] + dy, B[2] + dz], k * 6);
    });
    if (!this.lot) return;
    this.lot.majPositions(P);
    this.lotBatons.majPositions(E);
    this.majEtats();
  }

  // Fondu de chaque H (0 visible, 1 caché). Quand on affiche les H, ils apparaissent un par un
  // (fiche F-A), dans chaque molécule en même temps, pour qu'on puisse les compter.
  fonduH(k) {
    if (!this.etat.inter.hydrogenes) return 1;
    const a = this.apparitionH;
    if (!a) return 0;
    const rang = this.rangH[k];
    return 1 - lisse(0, 1, (this.etat.temps - a - rang * ECART_H) / DUREE_H);
  }

  get rangH() {
    if (!this._rangH) {
      this._rangH = this.spheres.map(() => 0);
      for (const m of this.mols) {
        let r = 0;
        m.atomes.forEach((a, i) => { if (a.el === 'H') this._rangH[m.debut + i] = r++; });
      }
    }
    return this._rangH;
  }

  // Fondus : molécules cachées pendant la question ; H masqués ; bâtons masqués en mode compact.
  majEtats() {
    if (!this.lot) return;
    const cache = this.etape.cacher_molecules ? 1 : 0;
    const compact = this.etat.inter.compact;
    const fs = this.spheres.map((s, k) => Math.max(cache, s.el === 'H' ? this.fonduH(k) : 0));
    const cle = `${cache}|${compact}|${fs.map((f) => f.toFixed(2)).join(',')}`;
    if (cle === this.cleEtats) return;
    this.cleEtats = cle;
    this.fondus = fs;
    this.lot.definirEtats(fs.map((f) => [f, 0, 0]));
    this.etiq.fondre(fs);
    this.lotBatons.definirFondus(this.batons.map((b) => {
      const m = this.mols[b.mol];
      const h = Math.max(fs[m.debut + b.i], fs[m.debut + b.j]);
      return Math.max(cache, compact ? 1 : 0, h);
    }));
  }

  // ---------------------------------------------------------------- commandes
  get minimum() { return this.ajustement / 4; }
  get maximum() { return this.ajustement / 0.6; }

  zoomer(f) {
    if (this.fige) return;
    this.etat.zoom = borner(this.etat.zoom / f, 0.6, 4);
    this.etat.largeur = this.ajustement / this.etat.zoom;
  }

  definirLargeur(m) {
    if (this.fige) return;
    this.etat.zoom = borner(this.ajustement / m, 0.6, 4);
    this.etat.largeur = this.ajustement / this.etat.zoom;
  }

  basculerLecture() { this.etat.lecture = false; }

  basculer(nom) {
    this.etat.inter[nom] = !this.etat.inter[nom];
    if (nom === 'hydrogenes') this.apparitionH = this.etat.inter.hydrogenes ? this.etat.temps : null;
    // Compact et formule plane s'excluent.
    if (nom === 'compact' && this.etat.inter.compact) this.etat.inter.plane = false;
    if (nom === 'plane' && this.etat.inter.plane) this.etat.inter.compact = false;
    this.majEtats();
  }

  get rotationPermise() { return !this.fige && !this.etat.inter.plane && this.etat.plan < 0.01; }

  tourner(dxPx, dyPx) {
    if (!this.rotationPermise) return;
    const a = 0.008;
    this.etat.rotation = orthonormer(produit(produit(rotationY(dxPx * a), rotationX(dyPx * a)), this.etat.rotation));
    this.majPositions();
  }

  cliquer() { return false; }

  get facteurTaille() { return this.etat.inter.compact ? 1 : this.d.affichage.facteur_reduction; }

  // ---------------------------------------------------------------- animation et dessin
  avancer(dt) {
    this.etat.temps += dt;
    if (this.apparitionH !== null) {
      this.majEtats();
      const nMax = Math.max(...this.mols.map((m) => m.compte.H || 0));
      if (this.etat.temps - this.apparitionH > nMax * ECART_H + DUREE_H) this.apparitionH = null;
    }
    const cible = this.etat.inter.plane ? 1 : 0;
    if (this.etat.plan !== cible) {
      this.etat.plan = cible > this.etat.plan ? Math.min(1, this.etat.plan + dt / 0.9) : Math.max(0, this.etat.plan - dt / 0.9);
      this.majPositions();
    }
  }

  dessiner(ecran, options = {}) {
    if (ecran.l !== this.ecran.l || ecran.h !== this.ecran.h) { this.ecran = { l: ecran.l, h: ecran.h }; this.majPositions(); }
    const c = this.camera;
    c.ecran = { l: ecran.l, h: ecran.h };
    c.largeur = this.etat.largeur;
    c.centre = [0, 0, 0];
    const dpr = ecran.dpr;
    for (const ctx of [this.ctxMacro, this.ctx]) {
      if (!ctx) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ecran.l, ecran.h);
    }
    if (options.fondCapture) { this.ctxMacro.fillStyle = options.fondCapture; this.ctxMacro.fillRect(0, 0, ecran.l, ecran.h); }
    // Passage à la formule plane : les atomes glissent dans le plan, puis les boules laissent place aux symboles.
    const s = lisse(0, 1, this.etat.plan);
    const opaciteGl = 1 - lisse(0.75, 1, this.etat.plan);
    const r = this.rendu;
    if (r) {
      r.canvas.style.opacity = String(opaciteGl);
      this.etiq.opacite = this.etat.inter.etiquettes ? 1 : 0;
      if (opaciteGl > 0.002) {
        r.dessiner({
          base: c.base, centrePm: c.centre.map((v) => v / PM), pxParPm: c.pxParMetre * PM,
          temps: this.etat.temps * (this.d.affichage.vitesse_vibration ?? 1), amp: this.d.affichage.vibration_pm * (1 - s),
          facteur: this.facteurTaille, facteurBaton: this.d.affichage.facteur_reduction,
          fond: couleurRvb(options.fondCapture || this.d.affichage.fond), profondeurPm: 2e4,
        });
      }
    }
    if (s > 0.7) this.dessinerFormulesPlanes(lisse(0.7, 1, this.etat.plan));
    this.dessinerTextes();
  }

  // Formule développée : symboles des atomes et traits des liaisons (doubles et triples en traits parallèles).
  dessinerFormulesPlanes(opacite) {
    const ctx = this.ctx;
    const c = this.camera;
    const el = this.d.especes;
    const P = (p) => { const q = c.projeter(p.map((v) => v * PM)); return [q.x, q.y]; };
    const f = this.fondus || [];
    const taille = borner(c.pxParMetre * PM * 48, 7, 26);
    ctx.save();
    ctx.globalAlpha = opacite;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#26323F';
    ctx.lineWidth = Math.max(1.2, taille / 10);
    for (const m of this.mols) {
      if (this.etape.cacher_molecules) continue;
      for (const [i, j, ordre] of m.liaisons) {
        const fl = Math.max(f[m.debut + i] || 0, f[m.debut + j] || 0);
        if (fl > 0.99) continue;
        ctx.globalAlpha = opacite * (1 - fl);
        const a = P(m.pos[i]), b = P(m.pos[j]);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        const raccourci = taille * 0.62;
        const ecart = taille * 0.22;
        const decal = ordre === 1 ? [0] : ordre === 2 ? [-ecart, ecart] : [-1.6 * ecart, 0, 1.6 * ecart];
        for (const d of decal) {
          ctx.beginPath();
          ctx.moveTo(a[0] + ux * raccourci + nx * d, a[1] + uy * raccourci + ny * d);
          ctx.lineTo(b[0] - ux * raccourci + nx * d, b[1] - uy * raccourci + ny * d);
          ctx.stroke();
        }
      }
      ctx.font = `600 ${taille}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      m.atomes.forEach((a, k) => {
        const fa = f[m.debut + k] || 0;
        if (fa > 0.99) return;
        ctx.globalAlpha = opacite * (1 - fa);
        const p = P(m.pos[k]);
        ctx.fillStyle = el[a.el].couleur_texte || '#26323F';
        ctx.fillText(a.el, p[0], p[1]);
      });
    }
    ctx.restore();
  }

  // Sous chaque molécule : son nom ; avec les compteurs, le nombre d'atomes de chaque élément ;
  // avec « formule brute », la formule et la masse molaire ; à l'étape prévue, le rapport le plus simple.
  dessinerTextes() {
    const ctx = this.ctx;
    const c = this.camera;
    const el = this.d.especes;
    const k = this.echelleTexte ?? 1;
    const pas = 19 * k;
    const police = (t, gras) => `${gras ? '600 ' : ''}${Math.round(t * k)}px system-ui, sans-serif`;
    const cache = this.etape.cacher_molecules;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const m of this.mols) {
      const bas = c.projeter([m.centre[0] * PM, m.basRangee * PM, 0]);
      let y = bas.y + 6;
      const x = bas.x;
      ctx.fillStyle = '#26323F';
      ctx.font = police(15, true);
      ctx.fillText(this.texte(`nom-${m.id}`, m.nom), x, y);
      y += pas + 1;
      const els = Object.keys(m.compte).sort((a, b) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b)));
      if (this.etat.inter.compteurs && !cache) {
        ctx.font = police(14);
        // Les H masqués ne sont pas comptés : « ? » ; pendant leur apparition, le compte monte.
        const visibles = (e) => (e !== 'H' ? m.compte[e]
          : m.atomes.reduce((s2, a, i) => s2 + (a.el === 'H' && (this.fondus?.[m.debut + i] ?? 0) < 0.5 ? 1 : 0), 0));
        const morceaux = els.map((e) => (e === 'H' && !this.etat.inter.hydrogenes ? 'H : ?' : `${e} : ${visibles(e)}`));
        const r0 = 5 * k, ecart = (this.ecartCompteurs ?? 22) * k;
        const largeur = morceaux.reduce((s2, t) => s2 + 13 * k + ctx.measureText(t).width + ecart, -ecart);
        let xx = x - largeur / 2;
        ctx.textAlign = 'left';
        for (let i = 0; i < els.length; i++) {
          ctx.fillStyle = el[els[i]].couleur;
          ctx.beginPath(); ctx.arc(xx + r0, y + pas * 0.42, r0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#26323F';
          ctx.fillText(morceaux[i], xx + 13 * k, y);
          xx += 13 * k + ctx.measureText(morceaux[i]).width + ecart;
        }
        ctx.textAlign = 'center';
        y += pas;
      }
      if (this.etat.inter.formule && !cache) {
        ctx.font = police(14);
        ctx.fillStyle = '#26323F';
        const f = formuleIndices(m.formule), M = `M = ${m.M.toPrecision(4).replace('.', ',')} g/mol`;
        if (this.formuleSurDeuxLignes) { ctx.fillText(f, x, y); y += pas; ctx.fillText(M, x, y); } else ctx.fillText(`${f}   ${M}`, x, y);
        y += pas;
      }
      if (this.etape.rapport && !cache && this.etat.inter.hydrogenes && this.apparitionH === null) {
        const r = rapportSimple(m.compte);
        ctx.font = police(14, true);
        ctx.fillStyle = '#1F5FA8';
        ctx.fillText(`${r.elements.join(' : ')} = ${r.valeurs.join(' : ')}`, x, y);
        y += pas;
        if (this.etape.empirique) {
          const fe = r.elements.map((e, i) => e + (r.valeurs[i] > 1 ? r.valeurs[i] : '')).join('');
          ctx.fillText(`${this.texte('formule-empirique', 'formule empirique')} : ${formuleIndices(fe)}`, x, y);
        }
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- textes
  // Texte brut de textes.md (fourni par l'interface) ; valeur de secours pour les tests sans interface.
  texte(cle, defaut) { return this.brut ? this.brut(cle) : defaut; }

  message() {
    const e = this.etape;
    if (e.type === 'question') return null;
    return (this.etat.inter.avance && e.message_avance) || e.message || null;
  }

  instrument() { return 'instrument-modele'; }
  get cleEquation() { return null; }
  lignesCompteurs() { return { cle: '', lignes: [] }; }
}
