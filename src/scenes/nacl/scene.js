// Scène NaCl, temps 1 : question, zoom continu de la salière aux ions, exploration du réseau.
// Ce module ne crée pas d'interface : il calcule l'état et dessine. L'interface (src/interface) le pilote.

import { Camera } from '../../moteur/camera.js';
import { baseDepuisVisee, interpolerBase, tourner, melanger, lisse, borner, couleurRvb, scalaire, soustraire } from '../../moteur/vec.js';
import { genererCristal, genererSurface, voisins, bilan, aleatoire } from './reseau.js';
import { creerDecor, dessinerMacro } from './macro.js';
import { dessinerAtome, fondusAtome } from './atome.js';

const PM = 1e-12;
const log10 = Math.log10;

export class SceneNaCl {
  constructor(donnees, rendu, ctxMacro, ctxAtome = null) {
    this.d = donnees;
    this.rendu = rendu;
    this.ctxMacro = ctxMacro;
    this.ctxAtome = ctxAtome;
    this.camera = new Camera();
    this.baseDepart = baseDepuisVisee([0.38, -0.42, 1]);
    this.camera.base = this.baseDepart;

    const r = this.d.reseau;
    this.demiArete = r.arete_maille_pm / 2; // distance entre voisins, pm
    this.L = this.d.grain.arete_m;
    this.decor = creerDecor(this.L);
    const n = r.ions_par_arete;
    this.centreCristalPm = [(n - 1) / 2 * this.demiArete, -(n - 1) / 2 * this.demiArete, (n - 1) / 2 * this.demiArete];

    // Ions
    this.cristal = genererCristal(n, r.arete_maille_pm, r.ion_au_coin);
    this.voisins = voisins(this.cristal);
    this.surface = genererSurface(40, n, r.arete_maille_pm, r.ion_au_coin);
    this.bilan = bilan(this.cristal, this.d.especes);
    const alea = aleatoire(2026);
    const sphere = (ion) => {
      const e = this.d.especes[ion.espece];
      return {
        pos: ion.pos, rayon: e.rayon_pm, couleur: couleurRvb(e.couleur),
        phase: [alea() * 6.283, alea() * 6.283, alea() * 6.283],
      };
    };
    this.spheresCristal = this.cristal.map(sphere);
    this.spheresSurface = this.surface.map(sphere);
    if (rendu) {
      this.lotSurface = rendu.creerLot(this.spheresSurface);
      this.lotCristal = rendu.creerLot(this.spheresCristal);
      rendu.creerAtlas(Object.values(this.d.especes).map((e) => e.etiquette));
      rendu.creerEtiquettes(this.cristal.map((ion, i) => ({ sphere: this.spheresCristal[i], texte: this.d.especes[ion.espece].etiquette })));
    }

    this.etapes = this.d.temps1.etapes;
    this.etat = {
      etape: 0,
      largeur: this.etapes[0].largeur_m,
      temps: 0,
      lecture: false,
      inter: { etiquettes: false, voisins: false, compteurs: false, tailles: false, maille: false, ion: false, avance: false },
      fonduIon: 0,
      selection: this.cristal.findIndex((ion) => ion.i === 2 && ion.j === 2 && ion.k === 2),
      retourBase: null,
    };
    // Maille : cube de 564 pm (3 ions par arête), ion Cl⁻ aux sommets (fiche v0.3).
    this.maille = this.calculerMaille();
    this.fonduSurface = -1;
    this.majEtatsCristal();
  }

  get etape() { return this.etapes[this.etat.etape]; }
  get fige() { return this.etape.type === 'question'; }

  // ---------------------------------------------------------------- navigation
  allerEtape(i) {
    i = borner(i, 0, this.etapes.length - 1);
    const e = this.etapes[i];
    const precedent = this.etape;
    this.etat.etape = i;
    this.etat.lecture = false;
    this.etat.retourBase = null; // un retour d'orientation en cours ne doit pas survivre au changement d'étape
    if (e.type === 'question') {
      this.etat.largeur = e.largeur_m;
      this.camera.base = this.baseDepart;
    } else if (e.type === 'zoom') {
      if (precedent.type === 'question') this.etat.largeur = e.depart_m;
      this.etat.largeur = borner(this.etat.largeur, this.minimum, e.max_m);
      if (precedent.type === 'exploration') this.etat.retourBase = { de: this.camera.base, t: 0 };
    } else if (e.type === 'exploration') {
      if (this.etat.largeur > e.max_m || (this.etat.largeur < 1e-9 && !this.etat.inter.ion)) this.etat.largeur = e.largeur_m;
    }
  }

  // Facteur > 1 : on s'éloigne ; < 1 : on s'approche.
  // Limite basse du zoom : 300 pm, ou 1 fm quand l'interrupteur « zoom dans l'ion » est activé.
  get minimum() {
    return this.etat.inter.ion ? this.d.echelle.regle_min_ion_m : this.etape.min_m;
  }

  zoomer(facteur) {
    if (this.fige) return;
    this.etat.largeur = borner(this.etat.largeur * facteur, this.minimum, this.etape.max_m);
  }

  definirLargeur(m) {
    if (this.fige) return;
    this.etat.largeur = borner(m, this.minimum, this.etape.max_m);
  }

  basculerLecture() {
    if (this.fige || this.etape.type !== 'zoom') { this.etat.lecture = false; return; }
    if (!this.etat.lecture && this.etat.largeur <= this.etape.fin_lecture_m * 1.01) this.etat.largeur = this.etape.depart_m;
    this.etat.lecture = !this.etat.lecture;
  }

  basculer(nom) {
    this.etat.inter[nom] = !this.etat.inter[nom];
    // Sans le zoom dans l'ion, on remonte à la limite habituelle (300 pm).
    if (nom === 'ion' && !this.etat.inter.ion && !this.fige) this.etat.largeur = Math.max(this.etat.largeur, this.etape.min_m);
    this.majEtatsCristal();
  }

  get rotationPermise() {
    return this.etape.type === 'exploration';
  }

  tourner(dxPx, dyPx) {
    if (!this.rotationPermise) return;
    const a = 0.008;
    const b = this.camera.base;
    // Glisser horizontal : rotation autour de l'axe vertical de l'écran ; vertical : autour de l'axe horizontal.
    let { droite, haut, avant } = b;
    avant = tourner(avant, haut, -dxPx * a); droite = tourner(droite, haut, -dxPx * a);
    avant = tourner(avant, droite, -dyPx * a); haut = tourner(haut, droite, -dyPx * a);
    this.camera.base = interpolerBase({ droite, haut, avant }, { droite, haut, avant }, 0);
  }

  // Clic ou toucher sur l'écran : sélection de l'ion le plus proche de l'observateur sous le pointeur.
  cliquer(x, y) {
    if (this.fige || this.camera.largeur > 5e-9) return false;
    const c = this.camera;
    const facteur = this.facteurTaille;
    let meilleur = -1, zMin = Infinity;
    this.cristal.forEach((ion, i) => {
      const p = c.projeter(ion.pos.map((v) => v * PM));
      const r = this.d.especes[ion.espece].rayon_pm * PM * facteur * c.pxParMetre;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 <= Math.max(r, 8) ** 2 && p.z < zMin) { zMin = p.z; meilleur = i; }
    });
    if (meilleur < 0) return false;
    this.etat.selection = meilleur;
    if (!this.etat.inter.voisins) this.etat.inter.voisins = true;
    this.majEtatsCristal();
    return true;
  }

  get facteurTaille() {
    return this.etat.inter.tailles ? 1 : this.d.affichage.facteur_reduction;
  }

  // Maille choisie près du centre du cristal : indices de départ dont l'ion est l'espèce demandée aux sommets.
  calculerMaille() {
    const n = this.d.reseau.ions_par_arete;
    const sommet = 'Cl-';
    const depart = [1, 2].map((a) => [a, a, a]).find(([i, j, k]) => {
      const ion = this.cristal.find((x) => x.i === i && x.j === j && x.k === k);
      return ion && ion.espece === sommet && i + 2 < n;
    });
    const [i0, j0, k0] = depart;
    const membres = new Set();
    this.cristal.forEach((x, idx) => {
      if (x.i >= i0 && x.i <= i0 + 2 && x.j >= j0 && x.j <= j0 + 2 && x.k >= k0 && x.k <= k0 + 2) membres.add(idx);
    });
    const d = this.demiArete;
    const a = [i0 * d, -j0 * d, k0 * d], b = [(i0 + 2) * d, -(j0 + 2) * d, (k0 + 2) * d];
    return { depart, membres, min: a.map((v, q) => Math.min(v, b[q])), max: a.map((v, q) => Math.max(v, b[q])), sommet };
  }

  majEtatsCristal() {
    if (!this.lotCristal) return;
    const sel = this.etat.selection;
    const proches = new Set([sel, ...this.voisins[sel]]);
    const v = this.etat.inter.voisins;
    const m = this.etat.inter.maille;
    const attenuation = (i) => (m && !this.maille.membres.has(i) ? 0.88 : v && !proches.has(i) ? 0.78 : 0);
    const ion = this.etat.inter.ion;
    const fb = this.fonduBoule || 0;
    this.lotCristal.definirEtats(this.cristal.map((_, i) => [i === sel ? fb : 0, attenuation(i), (v || ion) && i === sel && fb < 0.5 ? 1 : 0]));
    this.rendu.fondreEtiquettes(this.cristal.map((_, i) => Math.max(attenuation(i) ? 0.85 : 0, i === sel ? fb : 0)));
    if (m) this.rendu.definirBoite(this.maille.min, this.maille.max);
    else this.rendu.definirBoite(null);
  }

  // ------------------------------------------------------------------- caméra
  // Centre de la vue en fonction de la largeur du champ (trajectoire du zoom).
  centrePour(W) {
    const L = this.L;
    const grain = [L / 2, -L / 2, L / 2];
    const lw = log10(W);
    let c;
    if (W >= 1e-3) {
      // Zoom vers un point fixe : le grain étudié garde la même place à l'écran de 10 cm à 1 mm.
      c = melanger(grain, this.decor.centreVue, (W - 1e-3) / (0.1 - 1e-3));
    } else {
      // En dessous d'un millimètre, c'est le coin du grain qui garde sa place à l'écran.
      c = melanger([0, 0, 0], grain, W / 1e-3);
    }
    const cristal = this.centreCristalPm.map((v) => v * PM);
    c = melanger(c, cristal, lisse(log10(2e-8), log10(3e-9), lw));
    // Zoom dans l'ion : on se rapproche de l'ion sélectionné, en suivant sa vibration.
    const fi = this.etat.fonduIon * lisse(log10(6e-10), log10(2.5e-10), lw);
    if (fi > 0) c = melanger(c, this.centreIonSelectionne(), fi);
    return c;
  }

  // Position (m) de l'ion sélectionné, vibration comprise (même formule que le rendu).
  centreIonSelectionne() {
    const s = this.spheresCristal[this.etat.selection];
    const t = this.etat.temps * (this.d.affichage.vitesse_vibration ?? 1);
    const A = this.d.affichage.vibration_pm;
    return [
      (s.pos[0] + A * Math.sin(t * 5.1 + s.phase[0])) * PM,
      (s.pos[1] + A * Math.sin(t * 4.3 + s.phase[1])) * PM,
      (s.pos[2] + A * Math.sin(t * 5.9 + s.phase[2])) * PM,
    ];
  }

  // Grandeurs de fondu entre représentations, selon la largeur du champ.
  fondus(W) {
    const lw = log10(W);
    const exploration = this.etape.type === 'exploration';
    return {
      ions: lisse(log10(3e-8), log10(8e-9), lw),                       // les ions apparaissent
      faces: 1 - lisse(log10(7e-9), log10(4e-9), lw),                  // les faces du grain s'effacent
      surface: exploration ? 1 : lisse(log10(5e-9), log10(2.8e-9), lw), // le reste du grain s'efface
    };
  }

  // ---------------------------------------------------------------- animation
  avancer(dt) {
    const e = this.etape;
    if (!this.fige) this.etat.temps += dt;
    const cibleIon = this.etat.inter.ion ? 1 : 0;
    if (this.etat.fonduIon !== cibleIon) {
      const pas = dt / 0.6;
      this.etat.fonduIon = cibleIon > this.etat.fonduIon ? Math.min(1, this.etat.fonduIon + pas) : Math.max(0, this.etat.fonduIon - pas);
    }
    if (this.etat.lecture && e.type === 'zoom') {
      // Vitesse logarithmique constante : environ 40 s de 10 cm à 2 nm.
      const decades = log10(e.depart_m) - log10(e.fin_lecture_m);
      this.etat.largeur *= 10 ** (-dt * decades / 40);
      if (this.etat.largeur <= e.fin_lecture_m) { this.etat.largeur = e.fin_lecture_m; this.etat.lecture = false; }
    }
    if (this.etat.retourBase) {
      const rb = this.etat.retourBase;
      rb.t = Math.min(1, rb.t + dt / 0.6);
      this.camera.base = interpolerBase(rb.de, this.baseDepart, lisse(0, 1, rb.t));
      if (rb.t >= 1) this.etat.retourBase = null;
    }
  }

  // Dessine les deux couches (2D et WebGL). fond : couleur de fond (capture : blanc).
  dessiner(ecran, options = {}) {
    const c = this.camera;
    c.ecran = { l: ecran.l, h: ecran.h };
    c.largeur = this.etat.largeur;
    c.centre = this.centrePour(c.largeur);
    const f = this.fondus(c.largeur);
    this.derniersFondus = f;

    // Couche 2D
    const ctx = this.ctxMacro;
    const dpr = ecran.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ecran.l, ecran.h);
    if (options.fondCapture) { ctx.fillStyle = options.fondCapture; ctx.fillRect(0, 0, ecran.l, ecran.h); }
    if (f.faces > 0.001 || c.largeur > 1e-8) dessinerMacro(ctx, c, this.decor, { couleurTable: this.d.affichage.couleur_support, opaciteFaces: f.faces, repereCible: this.etape.type === 'zoom' && !options.fondCapture });

    // Zoom dans l'ion : la boule de l'ion sélectionné s'efface, le schéma (ou le nuage) prend le relais.
    const fa = fondusAtome(c.largeur);
    const fb = this.etat.fonduIon > 0 ? (1 - fa.boule) * this.etat.fonduIon : 0;
    if (Math.abs(fb - (this.fonduBoule || 0)) > 0.01 || (fb === 0 && this.fonduBoule)) { this.fonduBoule = fb; this.majEtatsCristal(); }
    const ca = this.ctxAtome;
    if (ca) {
      ca.setTransform(dpr, 0, 0, dpr, 0, 0);
      ca.clearRect(0, 0, ecran.l, ecran.h);
      ca.canvas.style.opacity = String(this.etat.fonduIon);
      if (this.etat.fonduIon > 0 && c.largeur < 6e-10) {
        const ion = this.cristal[this.etat.selection];
        const esp = this.d.especes[ion.espece];
        dessinerAtome(ca, c, { centre: this.centreIonSelectionne(), rayonAffiche: esp.rayon_pm * PM * this.facteurTaille, espece: esp },
          { avance: this.etat.inter.avance, texteRepere: options.texteRepere || 'noyau' });
      }
    }

    // Couche WebGL : rien à dessiner tant que les ions ne sont pas visibles, ni au cœur de l'ion
    // (en dessous de 150 pm, la précision du calcul graphique ne suffit plus ; la couche 2D prend le relais).
    const r = this.rendu;
    if (!r) return;
    const visibleGl = c.largeur > 1.5e-10 ? f.ions : 0;
    r.canvas.style.opacity = String(visibleGl);
    if (visibleGl < 0.002) return;
    this.majFonduSurface(f.surface);
    const fond = couleurRvb(options.fondCapture || this.d.affichage.fond);
    r.dessiner({
      base: c.base,
      centrePm: c.centre.map((v) => v / PM),
      pxParPm: c.pxParMetre * PM,
      temps: this.etat.temps * (this.d.affichage.vitesse_vibration ?? 1),
      amp: this.d.affichage.vibration_pm,
      facteur: this.facteurTaille,
      fond,
      opaciteEtiquettes: this.etat.inter.etiquettes ? 1 : 0,
      profondeurPm: 4e4,
      brume: [-0.3 * c.largeur / PM, 0.5 * c.largeur / PM, 0.55],
    });
  }

  majFonduSurface(v) {
    if (!this.lotSurface) return;
    this.lotSurface.visible = v < 0.999;
    if (Math.abs(v - this.fonduSurface) < 0.01 && !(v === 1 && this.fonduSurface !== 1)) return;
    this.fonduSurface = v;
    // Les ions du bord de la zone dessinée s'effacent aussi, pour ne pas montrer de limite nette.
    this.lotSurface.definirEtats(this.surface.map((ion) => [Math.max(v, lisse(0.8, 1, ion.bord)), 0, 0]));
  }

  // Message à afficher selon la largeur du champ (étape de zoom seulement).
  message() {
    const e = this.etape;
    const W = this.etat.largeur;
    if (this.etat.inter.ion && W < 3e-10 * 1.0001) {
      const m = this.d.temps1.messages_ion.find((x) => W <= x.de_m * 1.0001 && W > x.a_m);
      if (m) return this.etat.inter.avance ? m.texte_avance : m.texte;
    }
    if (e.type !== 'zoom') return null;
    const m = this.d.temps1.messages.find((x) => W <= x.de_m * 1.0001 && W > x.a_m);
    return m ? m.texte : null;
  }

  // Instrument capable de montrer l'image à cette échelle (affiché sous la règle).
  instrument() {
    const W = this.etat.largeur;
    const m = (this.d.temps1.instruments || []).find((x) => W <= x.de_m * 1.0001 && W > x.a_m);
    return m ? m.texte : null;
  }

  // Contrôles (utilisés par les tests automatiques et la console) : écart entre deux ions voisins à l'écran.
  mesureVoisinsPx() {
    const a = this.cristal[0], b = this.cristal[this.voisins[0][0]];
    const pa = this.camera.projeter(a.pos.map((v) => v * PM));
    const pb = this.camera.projeter(b.pos.map((v) => v * PM));
    const ecart = soustraire([pa.x, pa.y, 0], [pb.x, pb.y, 0]);
    const vrai = soustraire(b.pos, a.pos).map((v) => v * PM);
    // Longueur projetée attendue du vecteur entre voisins.
    const attendu = Math.hypot(scalaire(vrai, this.camera.base.droite), scalaire(vrai, this.camera.base.haut)) * this.camera.pxParMetre;
    return { mesure: Math.hypot(ecart[0], ecart[1]), attendu };
  }
}
