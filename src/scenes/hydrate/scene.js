// Scène hydrate (fiche F-E) : l'eau dans le cristal de sulfate de cuivre(II) pentahydraté.
// Temps 1 : question, zoom continu des cristaux bleus au motif des particules, exploration du motif.
// Temps 2 : question, chauffage par paliers (5 → 3 → 1 → 0 molécule d'eau par unité CuSO₄), ajout d'eau,
// mise en commun. Ce module ne crée pas d'interface : il calcule l'état et dessine.

import { Camera } from '../../moteur/camera.js';
import { baseDepuisVisee, interpolerBase, tourner, lisse, borner, couleurRvb } from '../../moteur/vec.js';
import { aleatoire } from '../nacl/reseau.js';
import { genererMotif, bilanMotif } from './motif.js';
import { planChauffage, etatChauffage, temperature } from './deshydratation.js';
import { dessinerCristaux, dessinerTube } from './macro.js';

const PM = 1e-12;
const log10 = Math.log10;
const ETIQUETTE = { Cu: 'Cu²⁺', S: 'SO₄²⁻' };

// Couleur du solide selon le nombre moyen de molécules d'eau par unité CuSO₄ (interpolée entre les hydrates).
function couleurSolide(couleurs, n) {
  const niveaux = [0, 1, 3, 5];
  const rvb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  let a = 0;
  while (a < niveaux.length - 2 && n > niveaux[a + 1]) a++;
  const u = borner((n - niveaux[a]) / (niveaux[a + 1] - niveaux[a]), 0, 1);
  const c0 = rvb(couleurs[niveaux[a]]), c1 = rvb(couleurs[niveaux[a + 1]]);
  return '#' + c0.map((x, i) => Math.round(x + (c1[i] - x) * u).toString(16).padStart(2, '0')).join('');
}

export class SceneHydrate {
  constructor(donnees, rendu, ctxMacro) {
    this.d = donnees;
    this.rendu = rendu;
    this.ctxMacro = ctxMacro;
    this.camera = new Camera();
    this.baseDepart = baseDepuisVisee([-0.5, -0.35, -0.8]);
    this.camera.base = this.baseDepart;

    this.motif = genererMotif(this.d.motif);
    this.plan = planChauffage(this.d, this.motif);
    this.bilan = bilanMotif(this.motif, this.d.especes);
    this.etatEau = etatChauffage(this.plan, 0);

    const alea = aleatoire(2027);
    const phase = () => [alea() * 6.283, alea() * 6.283, alea() * 6.283];
    const esp = this.d.especes;
    const especeAtome = (x) => (x.espece === 'Cu2+' ? 'Cu2+' : x.espece);
    // Une phase de vibration par groupe rigide : Cu²⁺ seul, ion sulfate (S et ses 4 O), molécule d'eau.
    const phases = new Map();
    const groupe = (i) => {
      const x = this.motif.atomes[i];
      if (x.role === 'Cu') return `Cu${x.unite}`;
      if (x.role === 'S' || x.role === 'sulfate') return `S${x.unite}`;
      return `E${this.motif.eaux.findIndex((e) => e.O === i || e.H.includes(i))}`;
    };
    const phaseDe = (i) => { const g = groupe(i); if (!phases.has(g)) phases.set(g, phase()); return phases.get(g); };
    const sphere = (i, decalage = [0, 0, 0], ph = null) => {
      const x = this.motif.atomes[i];
      const e = esp[especeAtome(x)];
      return { pos: [x.pos[0] + decalage[0], x.pos[1] + decalage[1], x.pos[2] + decalage[2]], rayon: e.rayon_pm, couleur: couleurRvb(e.couleur), phase: ph || phaseDe(i) };
    };

    // Atomes fixes (Cu²⁺, ions sulfate) et molécules d'eau (mobiles).
    this.fixes = this.motif.atomes.map((x, i) => i).filter((i) => this.motif.atomes[i].role !== 'eau');
    this.spheresFixes = this.fixes.map((i) => sphere(i));
    this.spheresO = this.motif.eaux.map((e) => sphere(e.O));
    this.spheresH = this.motif.eaux.flatMap((e) => e.H.map((h) => sphere(h)));
    const rb = this.d.motif.rayon_baton_pm;
    const baton = (i, j, dec = [0, 0, 0]) => {
      const a = this.motif.atomes[i], b = this.motif.atomes[j];
      return {
        a: a.pos.map((v, q) => v + dec[q]), b: b.pos.map((v, q) => v + dec[q]), rayon: rb,
        couleurA: couleurRvb(esp[especeAtome(a)].couleur), couleurB: couleurRvb(esp[especeAtome(b)].couleur), phase: phaseDe(i),
      };
    };
    const liaisonsFixes = this.motif.liaisons.filter(([i]) => this.motif.atomes[i].role === 'S');
    this.batonsFixes = liaisonsFixes.map(([i, j]) => baton(i, j));
    this.batonsEau = this.motif.eaux.flatMap((e) => e.H.map((h) => baton(e.O, h)));

    // Copies du motif autour du motif étudié (zoom seulement) : le cristal continue, puis s'efface.
    const [px, py, pz] = this.motif.periodes;
    this.copies = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 0; j++) for (let k = -2; k <= 0; k++) {
      if (!i && !j && !k) continue;
      this.copies.push({ dec: [i * px, j * py, k * pz], bord: Math.max(Math.abs(i) / 2, -j / 2, -k / 2) });
    }
    this.spheresCopies = [];
    this.bordCopies = [];
    const batonsCopies = [];
    for (const c of this.copies) {
      const ph = new Map();
      const phc = (i) => { const g = groupe(i); if (!ph.has(g)) ph.set(g, phase()); return ph.get(g); };
      this.motif.atomes.forEach((_, i) => { this.spheresCopies.push(sphere(i, c.dec, phc(i))); this.bordCopies.push(c.bord); });
      for (const [i, j] of this.motif.liaisons) { const b = baton(i, j, c.dec); b.phase = phc(i); batonsCopies.push(b); }
    }

    if (rendu) {
      this.lotCopies = rendu.creerLot(this.spheresCopies);
      this.batonsCopies = rendu.creerBatons(batonsCopies);
      this.lotFixes = rendu.creerLot(this.spheresFixes);
      this.lotBatonsFixes = rendu.creerBatons(this.batonsFixes);
      this.lotO = rendu.creerLot(this.spheresO, { dynamique: true });
      this.lotH = rendu.creerLot(this.spheresH, { dynamique: true });
      this.lotBatonsEau = rendu.creerBatons(this.batonsEau, { dynamique: true });
      rendu.creerAtlas(['Cu²⁺', 'SO₄²⁻', 'H₂O']);
      this.etiqFixes = rendu.creerEtiquettes(this.lotFixes, this.fixes.map((i, k) => ({ i, k }))
        .filter(({ i }) => ETIQUETTE[this.motif.atomes[i].role]).map(({ i, k }) => ({ index: k, texte: ETIQUETTE[this.motif.atomes[i].role] })));
      this.etiqEau = rendu.creerEtiquettes(this.lotO, this.motif.eaux.map((_, k) => ({ index: k, texte: 'H₂O' })));
      // Le Cu²⁺ est petit (rayon ionique 73 pm) : son étiquette doit rester visible même quand la boule est petite.
      this.etiqFixes.seuil = this.etiqEau.seuil = 3;
    }

    this.etapes = this.d.etapes.map((e) => ({ ...e }));
    this.etat = {
      etape: 0,
      largeur: this.etapes[0].largeur_m,
      temps: 0,
      tc: 0,
      lecture: false,
      zoomManuel: false,
      inter: { etiquettes: false, compteurs: false, tailles: false, avance: false, equation: false },
      retourBase: null,
    };
    this.fonduCopies = -1;
    this.extremites = new Float32Array(this.batonsEau.length * 6);
    this.appliquerTemps();
  }

  get etape() { return this.etapes[this.etat.etape]; }
  get fige() { return this.etape.type === 'question'; }
  get temps2() { return this.etape.temps === 2; }

  // ---------------------------------------------------------------- navigation
  allerEtape(i) {
    i = borner(i, 0, this.etapes.length - 1);
    const e = this.etapes[i];
    const precedent = this.etape;
    this.etat.etape = i;
    this.etat.lecture = false;
    this.etat.zoomManuel = false;
    this.etat.retourBase = null;
    if (e.temps === 2) {
      this.etat.tc = e.type === 'question' ? e.t : e.debut;
      if (e.type === 'question') this.camera.base = this.baseDepart;
      if (e.type === 'choregraphie') this.etat.lecture = true;
      if (this.etat.largeur > 1.2e-8 || this.etat.largeur < 1e-9 || precedent.temps !== 2) this.etat.largeur = this.d.largeur_temps2_m || 5.5e-9;
    } else if (e.type === 'question') {
      this.etat.largeur = e.largeur_m;
      this.camera.base = this.baseDepart;
      this.etat.tc = 0;
    } else if (e.type === 'zoom') {
      this.etat.tc = 0;
      if (precedent.type === 'question') this.etat.largeur = e.depart_m;
      this.etat.largeur = borner(this.etat.largeur, e.min_m, e.max_m);
      if (precedent.type !== 'question') this.etat.retourBase = { de: this.camera.base, t: 0 };
    } else if (e.type === 'exploration') {
      this.etat.tc = 0;
      // En arrivant du zoom ou de la question, on se place à la largeur prévue (motif lisible).
      if (precedent.type !== 'exploration' || this.etat.largeur > e.max_m || this.etat.largeur < e.min_m) this.etat.largeur = e.largeur_m;
    }
    this.appliquerTemps();
  }

  // Positions des molécules d'eau selon le temps de la chorégraphie (rien ne bouge au temps 1).
  appliquerTemps() {
    const tc = this.temps2 ? this.etat.tc : 0;
    this.etatEau = etatChauffage(this.plan, tc, this.etatEau);
    if (!this.lotO) return;
    const e = this.etatEau;
    this.lotO.majPositions(e.O);
    this.lotH.majPositions(e.H);
    const x = this.extremites;
    for (let k = 0; k < this.motif.eaux.length; k++) {
      for (let h = 0; h < 2; h++) {
        x.set(e.O.subarray(k * 3, k * 3 + 3), (k * 2 + h) * 6);
        x.set(e.H.subarray(k * 6 + h * 3, k * 6 + h * 3 + 3), (k * 2 + h) * 6 + 3);
      }
    }
    this.lotBatonsEau.majPositions(x);
    const f = e.fondu;
    const cle = f.reduce((s, v, k) => s + v * (k + 1), 0);
    if (cle !== this.cleFondus) {
      this.cleFondus = cle;
      const fe = Array.from(f);
      this.lotO.definirEtats(fe.map((v) => [v, 0, 0]));
      this.lotH.definirEtats(fe.flatMap((v) => [[v, 0, 0], [v, 0, 0]]));
      this.lotBatonsEau.definirFondus(fe.flatMap((v) => [v, v]));
      this.etiqEau.fondre(fe);
    }
  }

  get minimum() { return this.etape.min_m ?? 1e-9; }
  get maximum() { return this.etape.max_m ?? 1.2e-8; }

  zoomer(facteur) {
    if (this.fige) return;
    this.etat.largeur = borner(this.etat.largeur * facteur, this.minimum, this.maximum);
    this.etat.zoomManuel = true;
  }

  definirLargeur(m) {
    if (this.fige) return;
    this.etat.largeur = borner(m, this.minimum, this.maximum);
    this.etat.zoomManuel = true;
  }

  basculerLecture() {
    const e = this.etape;
    if (this.fige || (e.type !== 'zoom' && e.type !== 'choregraphie')) { this.etat.lecture = false; return; }
    if (e.type === 'zoom' && !this.etat.lecture && this.etat.largeur <= e.fin_lecture_m * 1.01) this.etat.largeur = e.depart_m;
    if (e.type === 'choregraphie' && !this.etat.lecture && this.etat.tc >= e.fin - 1e-6) this.etat.tc = e.debut;
    this.etat.lecture = !this.etat.lecture;
  }

  basculer(nom) {
    this.etat.inter[nom] = !this.etat.inter[nom];
  }

  tourner(dxPx, dyPx) {
    if (this.etape.type !== 'exploration' && this.etape.type !== 'choregraphie') return;
    const a = 0.008;
    let { droite, haut, avant } = this.camera.base;
    avant = tourner(avant, haut, -dxPx * a); droite = tourner(droite, haut, -dxPx * a);
    avant = tourner(avant, droite, -dyPx * a); haut = tourner(haut, droite, -dyPx * a);
    this.camera.base = interpolerBase({ droite, haut, avant }, { droite, haut, avant }, 0);
  }

  cliquer() { return false; }

  get facteurTaille() { return this.etat.inter.tailles ? 1 : this.d.affichage.facteur_reduction; }

  // Fondus selon la largeur du champ : cristaux (dessin), particules, copies du motif autour.
  fondus(W) {
    if (this.etape.type !== 'zoom' && this.etape.type !== 'question') return { cristaux: 0, particules: 1, copies: 1 };
    if (this.temps2) return { cristaux: 0, particules: 1, copies: 1 };
    const lw = log10(W);
    return {
      cristaux: 1 - lisse(log10(1.5e-8), log10(5e-9), lw),
      particules: lisse(log10(4e-8), log10(1.2e-8), lw),
      copies: lisse(log10(7e-9), log10(4e-9), lw), // 1 = effacées
    };
  }

  get tcAffiche() { return this.temps2 ? this.etat.tc : 0; }

  // Nombre moyen de molécules d'eau par unité CuSO₄ encore dans le solide.
  get eauParUnite() { return this.etatEau.solide / this.plan.nUnites; }

  // ---------------------------------------------------------------- animation
  avancer(dt) {
    const e = this.etape;
    if (!this.fige) this.etat.temps += dt;
    if (this.etat.lecture && e.type === 'zoom') {
      const decades = log10(e.depart_m) - log10(e.fin_lecture_m);
      this.etat.largeur *= 10 ** (-dt * decades / 28);
      if (this.etat.largeur <= e.fin_lecture_m) { this.etat.largeur = e.fin_lecture_m; this.etat.lecture = false; }
    }
    if (e.type === 'choregraphie' && this.etat.lecture) {
      this.etat.tc += dt;
      if (this.etat.tc >= e.fin) { this.etat.tc = e.fin; this.etat.lecture = false; }
    }
    if (this.temps2) this.appliquerTemps();
    if (this.etat.retourBase) {
      const rb = this.etat.retourBase;
      rb.t = Math.min(1, rb.t + dt / 0.6);
      this.camera.base = interpolerBase(rb.de, this.baseDepart, lisse(0, 1, rb.t));
      if (rb.t >= 1) this.etat.retourBase = null;
    }
  }

  dessiner(ecran, options = {}) {
    const c = this.camera;
    c.ecran = { l: ecran.l, h: ecran.h };
    c.largeur = this.etat.largeur;
    c.centre = [0, 0, 0];
    const f = this.fondus(c.largeur);

    const ctx = this.ctxMacro;
    const dpr = ecran.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ecran.l, ecran.h);
    if (options.fondCapture) { ctx.fillStyle = options.fondCapture; ctx.fillRect(0, 0, ecran.l, ecran.h); }
    dessinerCristaux(ctx, ecran, c.largeur, f.cristaux, this.d.chauffage.couleurs_solide['5']);
    // Pendant le zoom, un repère montre le point visé (pas sur les captures).
    if (this.etape.type === 'zoom' && c.largeur > 2e-8 && !options.fondCapture) {
      ctx.strokeStyle = 'rgba(192,57,43,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ecran.l / 2, ecran.h / 2, 14, 0, Math.PI * 2); ctx.stroke();
    }

    const r = this.rendu;
    if (!r) return;
    r.canvas.style.opacity = String(f.particules);
    if (f.particules < 0.002) return;
    this.majCopies(f.copies);
    const T = this.temps2 ? (temperature(this.plan, this.etat.tc) ?? 20) : 20;
    this.etiqFixes.opacite = this.etiqEau.opacite = this.etat.inter.etiquettes ? 1 : 0;
    r.dessiner({
      base: c.base,
      centrePm: c.centre.map((v) => v / PM),
      pxParPm: c.pxParMetre * PM,
      temps: this.etat.temps * (this.d.affichage.vitesse_vibration ?? 1),
      // L'agitation augmente avec la température (amplitude proportionnelle à la racine de T en kelvins).
      amp: this.d.affichage.vibration_pm * Math.sqrt((T + 273) / 293),
      facteur: this.facteurTaille,
      facteurBaton: this.facteurTaille,
      fond: couleurRvb(options.fondCapture || this.d.affichage.fond),
      profondeurPm: 4e4,
      brume: [-0.3 * c.largeur / PM, 0.6 * c.largeur / PM, 0.5],
    });
  }

  majCopies(v) {
    if (!this.lotCopies) return;
    this.lotCopies.visible = this.batonsCopies.visible = v < 0.999;
    if (Math.abs(v - this.fonduCopies) < 0.01 && !(v === 1 && this.fonduCopies !== 1)) return;
    this.fonduCopies = v;
    const fondu = this.bordCopies.map((b) => Math.max(v, 0.6 * lisse(0.6, 1, b)));
    this.lotCopies.definirEtats(fondu.map((x) => [x, 0, 0]));
    const parCopie = this.motif.atomes.length, liaisons = this.motif.liaisons.length;
    this.batonsCopies.definirFondus(this.copies.flatMap((_, k) => Array(liaisons).fill(fondu[k * parCopie])));
  }

  // ---------------------------------------------------------------- textes
  message() {
    const e = this.etape;
    const W = this.etat.largeur;
    if (e.type === 'choregraphie' || e.type === 'exploration') return (this.etat.inter.avance && e.message_avance) || e.message;
    if (e.type !== 'zoom') return null;
    const m = this.d.zoom.messages.find((x) => W <= x.de_m * 1.0001 && W > x.a_m);
    return m ? m.texte : null;
  }

  instrument() {
    if (this.etape.type !== 'zoom' && this.etape.type !== 'question') return 'instrument-modele';
    if (this.temps2) return 'instrument-modele';
    const W = this.etat.largeur;
    const m = this.d.zoom.instruments.find((x) => W <= x.de_m * 1.0001 && W > x.a_m);
    return m ? m.texte : null;
  }

  get cleEquation() {
    const e = this.etape;
    if (e.equation) return e.equation;
    return e.id === 'mise-en-commun' ? 'equation-hydrate' : 'formule-hydrate';
  }

  lignesCompteurs(t) {
    const esp = this.d.especes;
    const b = this.bilan.compte;
    const n = this.etatEau.solide;
    const parUnite = n / this.plan.nUnites;
    const lignes = [
      { couleur: esp['Cu2+'].couleur, texte: 'Cu²⁺', valeur: b['Cu2+'] },
      { couleur: esp.S.couleur, texte: 'SO₄²⁻', valeur: b.SO4 },
      { texte: t('compteur-charge'), valeur: this.bilan.charge },
      { couleur: esp.O.couleur, texte: t('compteur-eau-solide'), valeur: n },
    ];
    if (this.temps2) lignes.push({ couleur: '#9FB4C8', texte: t('compteur-eau-dehors'), valeur: this.etatEau.vapeur });
    lignes.push({ detail: true, texte: t('compteur-par-unite'), valeur: Number.isInteger(parUnite) ? parUnite : parUnite.toFixed(1).replace('.', ',') });
    return { cle: `${n}|${this.temps2}`, lignes };
  }

  dessinerEncart(ctx, w, h) {
    const tc = this.temps2 ? this.etat.tc : 0;
    const ch = this.d.chauffage;
    const rh = ch.rehydratation;
    const premierDepart = ch.paliers[0].departs[0];
    dessinerTube(ctx, w, h, {
      couleur: couleurSolide(ch.couleurs_solide, this.eauParUnite),
      flamme: this.temps2 && this.etape.type === 'choregraphie' ? 1 - lisse(rh.debut, rh.debut + 1, tc) : 0,
      buee: this.temps2 ? lisse(premierDepart, premierDepart + 4, tc) * (1 - 0.6 * lisse(rh.refroidi, rh.fin, tc)) : 0,
      gouttes: this.temps2 ? lisse(rh.refroidi, rh.refroidi + 1, tc) : 0,
      temperature: this.temps2 ? temperature(this.plan, tc) : null,
      chaud: this.temps2 && tc > rh.arrivees[0] + 1,
    }, this.d.affichage.fond);
    return 'tube à essai';
  }
}
