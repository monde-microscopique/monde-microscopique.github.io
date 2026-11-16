// Vue d'une scène : barre d'étapes, zone de dessin (2D + WebGL), règle d'échelle, encart macro,
// interrupteurs, panneaux. Pilotée au clavier, à la souris et au doigt.

import { el } from './dom.js';
import { Rendu } from '../moteur/rendu.js';
import { Rendu2D } from '../moteur/rendu2d.js';
import { Camera } from '../moteur/camera.js';
import { ecrireLongueur, barreEchelle, graduations } from '../moteur/echelle.js';
import { dessinerMacro, dessinerRepere } from '../scenes/nacl/macro.js';
import { dessinerBecher } from '../scenes/nacl/becher.js';

const INTERRUPTEURS = [
  { nom: 'etiquettes', cle: 'inter-etiquettes', touche: 'e' },
  { nom: 'voisins', cle: 'inter-voisins', touche: 'v' },
  { nom: 'compteurs', cle: 'inter-compteurs', touche: 'c' },
  { nom: 'tailles', cle: 'inter-tailles', touche: 't', temps1Seulement: true },
  { nom: 'maille', cle: 'inter-maille', touche: 'm' },
  { nom: 'ion', cle: 'inter-ion', touche: 'i' },
  { nom: 'avance', cle: 'inter-avance', touche: 'a' },
  { nom: 'equation', cle: 'inter-equation', touche: 'q' },
  { nom: 'delta', cle: 'inter-delta', touche: 'd', avanceSeulement: true },
];

export function afficherScene(racine, contenu, textes, brouillon, id, ClasseScene, sousEtape) {
  racine.innerHTML = '';
  const infos = contenu.scenes[id];
  const T = (cle, attrs = {}, tag = 'span') => textes.bloc(tag, cle, id, attrs);

  // ------------------------------------------------------------ structure DOM
  const canvasMacro = el('canvas', { class: 'couche couche-macro', 'aria-hidden': 'true' });
  const canvasGl = el('canvas', { class: 'couche couche-gl', 'aria-hidden': 'true' });
  const canvasAtome = el('canvas', { class: 'couche couche-atome', 'aria-hidden': 'true' });
  const message = el('div', { class: 'message', 'aria-live': 'polite' });
  const compteurs = el('div', { class: 'compteurs', hidden: true });
  const encartCanvas = el('canvas', { class: 'encart-canvas' });
  const encartLegende = el('div', { class: 'encart-legende' });
  const encart = el('div', { class: 'encart' }, encartCanvas, encartLegende);
  const regleRepere = el('div', { class: 'regle-repere' }, el('span', { class: 'regle-valeur' }), el('span', { class: 'regle-ici' }, textes.brut('regle-ici')));
  const instrument = el('div', { class: 'instrument', 'aria-live': 'polite' });
  const regleRail = el('div', { class: 'regle-rail' });
  const regle = el('div', { class: 'regle', role: 'slider', tabindex: '0', 'aria-label': 'Échelle : largeur du champ visible' }, regleRail, regleRepere);
  const barre = el('div', { class: 'barre-echelle' }, el('div', { class: 'barre-trait' }), el('div', { class: 'barre-texte' }));
  const question = el('div', { class: 'question', hidden: true });
  const equation = el('div', { class: 'equation', hidden: true });
  const vue = el('div', { class: 'vue' }, canvasMacro, canvasGl, canvasAtome, encart, message, compteurs, regle, instrument, barre, equation, question);

  const btnPrec = el('button', { class: 'bouton', type: 'button', 'aria-label': textes.brut('bouton-precedent') }, '◀', el('span', { class: 'mot' }, ' ' + textes.brut('bouton-precedent')));
  const btnSuiv = el('button', { class: 'bouton', type: 'button', 'aria-label': textes.brut('bouton-suivant') }, el('span', { class: 'mot' }, textes.brut('bouton-suivant') + ' '), '▶');
  const btnLecture = el('button', { class: 'bouton bouton-lecture', type: 'button' });
  const btnCapture = el('button', { class: 'bouton', type: 'button', title: 'Image PNG sur fond blanc' }, textes.brut('bouton-capture'));
  const titreEtape = el('div', { class: 'titre-etape' });
  const pastilles = el('div', { class: 'pastilles' });
  const numeroEtape = el('span', { class: 'numero-etape', 'aria-hidden': 'true' });

  const barreHaut = el('header', { class: 'barre-haut' },
    el('a', { class: 'lien-accueil', href: brouillon ? '?brouillon#' : '#' }, '⌂ ', textes.brut('retour-accueil')),
    el('div', { class: 'titre-scene-barre' }, T('titre', {}, 'strong'), titreEtape),
    el('div', { class: 'commandes' }, btnPrec, pastilles, numeroEtape, btnSuiv, btnLecture, btnCapture),
  );

  const boutonsInter = {};
  const interrupteurs = el('footer', { class: 'barre-bas' },
    el('div', { class: 'interrupteurs' }, INTERRUPTEURS.map((i) => {
      const b = el('button', { class: 'inter', type: 'button', 'aria-pressed': 'false', title: `Touche ${i.touche.toUpperCase()}` }, textes.brut(i.cle));
      boutonsInter[i.nom] = b;
      return b;
    })),
    el('div', { class: 'panneaux-boutons' },
      el('button', { class: 'bouton-lien', type: 'button', onclick: () => ouvrirPanneau('simplifications') }, textes.brut('bouton-simplifications')),
      brouillon ? el('button', { class: 'bouton-lien controle', type: 'button', onclick: () => ouvrirPanneau('controle') }, textes.brut('bouton-controle')) : null,
    ),
  );

  const panneau = el('aside', { class: 'panneau', hidden: true },
    el('button', { class: 'fermer', type: 'button', 'aria-label': 'Fermer', onclick: () => fermerPanneau() }, '×'),
    el('div', { class: 'panneau-contenu' }),
  );

  const page = el('div', { class: 'page-scene' },
    brouillon ? T('brouillon-bandeau', { class: 'bandeau-brouillon' }, 'div') : null,
    barreHaut, vue, interrupteurs, panneau,
  );
  racine.append(page);
  document.title = `${textes.brut('titre', id)} · ${textes.brut('site-titre')}`;

  // -------------------------------------------------------------- moteur
  // 3D (WebGL1) si possible, sinon dessin 2D de secours. « ?2d » dans l'adresse force le 2D (pour tester).
  let rendu = null;
  const force2d = new URLSearchParams(location.search).has('2d');
  if (!force2d) {
    try { rendu = new Rendu(canvasGl); } catch (e) { rendu = null; }
  }
  if (!rendu) {
    try {
      rendu = new Rendu2D(canvasGl);
      if (!force2d) vue.prepend(T('webgl-absent', { class: 'erreur-webgl' }, 'div'));
    } catch (e) {
      vue.prepend(T('webgl-absent', { class: 'erreur-webgl' }, 'div'));
    }
  }
  const scene = new ClasseScene(infos.donnees, rendu, canvasMacro.getContext('2d'), canvasAtome.getContext('2d'));
  const ech = infos.donnees.echelle;
  vue.style.background = infos.donnees.affichage.fond;

  // Règle : graduations d'une décade à l'autre. Elle descend jusqu'à 1 fm avec le zoom dans l'ion.
  const lmax = Math.log10(ech.regle_max_m);
  let lmin = Math.log10(ech.regle_min_m);
  const fraction = (m) => (lmax - Math.log10(m)) / (lmax - lmin);
  let regleIon = null;
  function construireRegle() {
    const ion = scene.etat.inter.ion;
    if (ion === regleIon) return;
    regleIon = ion;
    const min = ion ? ech.regle_min_ion_m : ech.regle_min_m;
    lmin = Math.log10(min);
    regleRail.querySelectorAll('.graduation').forEach((g) => g.remove());
    const pas = ion ? 2 : 1; // une graduation toutes les deux décades quand la règle est longue
    graduations(ech.regle_max_m, min).forEach((g, i) => {
      const fin = Math.abs(Math.log10(g) - lmin) < 1e-9;
      if (i % pas && !fin) return;
      regleRail.append(el('div', { class: 'graduation', style: `top:${fraction(g) * 100}%` }, el('span', {}, ecrireLongueur(g, 1))));
    });
  }
  construireRegle();

  // Pastilles d'étapes
  scene.etapes.forEach((e, i) => {
    if (i > 0 && e.temps !== scene.etapes[i - 1].temps) pastilles.append(el('span', { class: 'separateur-temps', 'aria-hidden': 'true' }));
    pastilles.append(el('button', { class: 'pastille', type: 'button', 'aria-label': `Étape ${i + 1}`, onclick: () => { scene.allerEtape(i); majEtape(); } }, String(i + 1)));
  });

  // ------------------------------------------------------------ panneaux
  function ouvrirPanneau(quoi) {
    const c = panneau.querySelector('.panneau-contenu');
    c.innerHTML = '';
    if (quoi === 'simplifications') {
      c.append(el('h2', {}, textes.brut('bouton-simplifications')), T('simplifications', {}, 'div'));
    } else {
      c.append(el('h2', {}, textes.brut('bouton-controle')), el('div', { html: infos.controle }),
        el('p', { class: 'technique' }, `Version ${contenu.version}, construite le ${new Date(contenu.construit).toLocaleString('fr-CH')}. `,
          `Rendu : ${rendu?.mode2d ? 'dessin 2D de secours' : 'WebGL1' + (rendu?.profondeurExacte ? ', profondeur exacte' : '')}.`),
        el('p', {}, el('a', { href: `https://github.com/${contenu.depot}/edit/${contenu.branche}/scenes/${id}/controle.md`, target: '_blank', rel: 'noopener' }, '✎ Modifier ce panneau')));
    }
    panneau.hidden = false;
  }
  function fermerPanneau() { panneau.hidden = true; }

  // ------------------------------------------------------------ étapes
  function majEtape() {
    const e = scene.etape;
    const i = scene.etat.etape;
    titreEtape.innerHTML = '';
    if (e.titre) titreEtape.append(T(e.titre));
    else if (e.type === 'question') titreEtape.append(e.id === 'mise-en-commun' ? 'Mise en commun' : 'Prédiction');
    [...pastilles.querySelectorAll('.pastille')].forEach((p, k) => p.setAttribute('aria-current', k === i ? 'step' : 'false'));
    numeroEtape.textContent = `${i + 1} / ${scene.etapes.length}`;
    btnPrec.disabled = i === 0;
    btnSuiv.disabled = i === scene.etapes.length - 1;
    btnLecture.hidden = e.type !== 'zoom' && e.type !== 'choregraphie';
    if (e.type === 'question') {
      question.innerHTML = '';
      question.append(
        T(e.texte, { class: 'question-texte' }, 'p'),
        textes.bloc('p', 'image-arretee', null, { class: 'question-note' }),
        // Pas de bouton « Observer » après la dernière question (un « null » s'affichait).
        ...(i < scene.etapes.length - 1
          ? [el('button', { class: 'bouton bouton-principal', type: 'button', onclick: () => { scene.allerEtape(i + 1); majEtape(); } }, textes.brut('bouton-observer'))]
          : []),
      );
      question.hidden = false;
    } else {
      question.hidden = true;
    }
    page.classList.toggle('fige', scene.fige);
    majInterrupteurs();
    const nouvelle = `#${id}/${e.id}`;
    if (location.hash !== nouvelle) history.replaceState(null, '', location.search + nouvelle);
  }

  function majInterrupteurs() {
    for (const [nom, b] of Object.entries(boutonsInter)) b.setAttribute('aria-pressed', String(scene.etat.inter[nom]));
    // δ+ δ− : seulement au niveau avancé (fiche NaCl §6).
    for (const i of INTERRUPTEURS) if (i.avanceSeulement) boutonsInter[i.nom].hidden = !scene.etat.inter.avance;
    // « Tailles réelles » : inutile pendant la dissolution, où tout est déjà à sa vraie taille.
    for (const i of INTERRUPTEURS) if (i.temps1Seulement) boutonsInter[i.nom].hidden = !!scene.temps2;
    equation.hidden = !scene.etat.inter.equation;
    if (!equation.hidden && !equation.dataset.rempli) {
      equation.append(T('equation-dissolution', { class: 'equation-formule' }, 'div'));
      equation.dataset.rempli = '1';
    }
    compteurs.hidden = !scene.etat.inter.compteurs;
    majCompteurs();
  }

  let cleCompteurs = '';
  function majCompteurs() {
    if (compteurs.hidden) return;
    const b = scene.compteurs();
    const cle = `${b.dansCristal}|${scene.temps2}`;
    if (cle === cleCompteurs && compteurs.childElementCount) return;
    cleCompteurs = cle;
    compteurs.innerHTML = '';
    for (const [esp, n] of Object.entries(b.compte)) {
      compteurs.append(el('div', {}, el('span', { class: 'puce', style: `background:${infos.donnees.especes[esp].couleur}` }), `${infos.donnees.especes[esp].etiquette} : `, el('strong', {}, String(n))));
    }
    compteurs.append(el('div', {}, `${textes.brut('compteur-charge')} : `, el('strong', {}, String(b.charge))));
    if (scene.temps2) compteurs.append(el('div', { class: 'compteur-detail' }, `${textes.brut('compteur-cristal')} : `, el('strong', {}, String(b.dansCristal)), ` / ${b.total}`));
  }

  for (const i of INTERRUPTEURS) {
    boutonsInter[i.nom].addEventListener('click', () => { scene.basculer(i.nom); majInterrupteurs(); construireRegle(); });
  }
  btnPrec.addEventListener('click', () => { scene.allerEtape(scene.etat.etape - 1); majEtape(); });
  btnSuiv.addEventListener('click', () => { scene.allerEtape(scene.etat.etape + 1); majEtape(); });
  btnLecture.addEventListener('click', () => scene.basculerLecture());
  btnCapture.addEventListener('click', () => capturer());

  // ------------------------------------------------------------ entrées
  // Zoomer arrête la lecture pendant le zoom guidé (temps 1), où la lecture est le zoom lui-même ;
  // pendant une animation (temps 2), le film continue.
  const zoomArrete = () => { if (scene.etape.type === 'zoom') scene.etat.lecture = false; };
  const pointeurs = new Map();
  let distPince = 0, deplace = 0;
  vue.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    scene.zoomer(Math.exp(dy * 0.0015));
    zoomArrete();
  }, { passive: false });
  vue.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.question, .regle, .encart, .compteurs')) return;
    vue.setPointerCapture(ev.pointerId);
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    deplace = 0;
    if (pointeurs.size === 2) {
      const [a, b] = [...pointeurs.values()];
      distPince = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  vue.addEventListener('pointermove', (ev) => {
    const p = pointeurs.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    deplace += Math.abs(dx) + Math.abs(dy);
    p.x = ev.clientX; p.y = ev.clientY;
    if (pointeurs.size === 2) {
      const [a, b] = [...pointeurs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (distPince > 0 && d > 0) scene.zoomer(distPince / d);
      distPince = d;
      zoomArrete();
    } else {
      scene.tourner(dx, dy);
    }
  });
  const fin = (ev) => {
    if (!pointeurs.has(ev.pointerId)) return;
    pointeurs.delete(ev.pointerId);
    if (pointeurs.size === 0 && deplace < 6 && ev.type === 'pointerup') {
      const r = vue.getBoundingClientRect();
      if (scene.cliquer(ev.clientX - r.left, ev.clientY - r.top)) majInterrupteurs();
    }
    if (pointeurs.size < 2) distPince = 0;
  };
  vue.addEventListener('pointerup', fin);
  vue.addEventListener('pointercancel', fin);

  // Règle : glisser pour régler l'échelle.
  const regler = (ev) => {
    const r = regleRail.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
    scene.definirLargeur(10 ** (lmax - f * (lmax - lmin)));
    zoomArrete();
  };
  regle.addEventListener('pointerdown', (ev) => { regle.setPointerCapture(ev.pointerId); regler(ev); });
  regle.addEventListener('pointermove', (ev) => { if (regle.hasPointerCapture(ev.pointerId)) regler(ev); });

  const clavier = (ev) => {
    if (ev.target.closest('input, textarea')) return;
    const k = ev.key;
    let traite = true;
    if (k === 'ArrowRight' || k === 'PageDown') { scene.allerEtape(scene.etat.etape + 1); majEtape(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { scene.allerEtape(scene.etat.etape - 1); majEtape(); }
    else if (k === 'ArrowUp' || k === '+' || k === '=') { scene.zoomer(0.8); zoomArrete(); }
    else if (k === 'ArrowDown' || k === '-') { scene.zoomer(1.25); zoomArrete(); }
    else if (k === ' ') { if (scene.fige) { scene.allerEtape(scene.etat.etape + 1); majEtape(); } else scene.basculerLecture(); }
    else if (k === 'Escape') fermerPanneau();
    else {
      const i = INTERRUPTEURS.find((x) => x.touche === k.toLowerCase());
      if (i && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { scene.basculer(i.nom); majInterrupteurs(); construireRegle(); } else traite = false;
    }
    if (traite) ev.preventDefault();
  };
  document.addEventListener('keydown', clavier);

  // ------------------------------------------------------------ dessin
  const camEncart = new Camera();
  let ecran = { l: 1, h: 1, dpr: 1 };
  function dimensionner() {
    const r = vue.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ecran = { l: Math.max(1, r.width), h: Math.max(1, r.height), dpr };
    canvasMacro.width = Math.round(ecran.l * dpr);
    canvasMacro.height = Math.round(ecran.h * dpr);
    canvasAtome.width = canvasMacro.width;
    canvasAtome.height = canvasMacro.height;
    if (rendu) rendu.redimensionner(ecran.l, ecran.h, dpr);
    const er = encartCanvas.getBoundingClientRect();
    encartCanvas.width = Math.round(er.width * dpr);
    encartCanvas.height = Math.round(er.height * dpr);
  }
  const observateur = new ResizeObserver(dimensionner);
  observateur.observe(vue);
  dimensionner();

  let derniereCle = undefined;
  function majHabillage() {
    const W = scene.etat.largeur;
    // Règle
    const f = fraction(W);
    regleRepere.style.top = `${f * 100}%`;
    regleRepere.querySelector('.regle-valeur').textContent = ecrireLongueur(W, 2);
    regle.setAttribute('aria-valuetext', ecrireLongueur(W, 2));
    // Barre d'échelle
    const b = barreEchelle(W);
    barre.querySelector('.barre-trait').style.width = `${b.fraction * ecran.l}px`;
    barre.querySelector('.barre-texte').textContent = ecrireLongueur(b.longueur, 1);
    // Instrument
    const cleInstr = scene.instrument();
    if (cleInstr !== instrument.dataset.cle) {
      instrument.dataset.cle = cleInstr || '';
      instrument.innerHTML = '';
      if (cleInstr) instrument.append(T(cleInstr));
    }
    // Message
    let cle = scene.message();
    if (!cle && scene.etape.type === 'exploration') cle = scene.etat.inter.maille ? 'aide-maille' : 'coin-du-grain';
    if (cle !== derniereCle) {
      derniereCle = cle;
      message.innerHTML = '';
      if (cle) {
        message.append(T(cle, {}, 'span'));
        if (cle === 'coin-du-grain') message.append(el('br'), T('aide-reseau', { class: 'aide' }));
        if (cle === 'aide-maille') message.append(el('br'), T('aide-reseau', { class: 'aide' }));
      }
      message.classList.toggle('vide', !cle);
    }
    btnLecture.textContent = scene.etat.lecture ? '❚❚ ' + textes.brut('bouton-pause') : '▶ ' + textes.brut('bouton-lecture');
    majCompteurs();
    // Encart macro
    const ctx = encartCanvas.getContext('2d');
    const dpr = ecran.dpr;
    const ew = encartCanvas.width / dpr, eh = encartCanvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ew, eh);
    if (scene.temps2) {
      dessinerBecher(ctx, ew, eh, scene.fractionCristal, scene.etat.tc, infos.donnees.affichage.fond);
      encartLegende.textContent = 'bécher';
      return;
    }
    camEncart.base = scene.baseDepart;
    camEncart.ecran = { l: ew, h: eh };
    const grand = W > 4e-3;
    camEncart.largeur = grand ? 0.13 : 1.4e-3;
    camEncart.centre = grand ? scene.centrePour(0.1) : [scene.L / 2, -scene.L / 2, scene.L / 2];
    ctx.fillStyle = infos.donnees.affichage.fond;
    ctx.fillRect(0, 0, ew, eh);
    dessinerMacro(ctx, camEncart, scene.decor, { couleurTable: infos.donnees.affichage.couleur_support, opaciteFaces: 1 });
    dessinerRepere(ctx, camEncart, scene.camera);
    encartLegende.textContent = grand ? 'salière' : 'grain de sel';
  }

  const texteRepere = textes.brut('repere-noyau', id);
  let precedent = performance.now();
  let actif = true;
  function boucle(t) {
    if (!actif) return;
    const dt = Math.min(0.1, (t - precedent) / 1000);
    precedent = t;
    scene.avancer(dt);
    scene.dessiner(ecran, { texteRepere });
    majHabillage();
    requestAnimationFrame(boucle);
  }

  function capturer() {
    // Rendu sur fond blanc, à la résolution de l'écran, avec la barre d'échelle.
    scene.dessiner(ecran, { fondCapture: infos.donnees.affichage.fond_capture, texteRepere });
    const c = document.createElement('canvas');
    c.width = canvasMacro.width; c.height = canvasMacro.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = infos.donnees.affichage.fond_capture;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvasMacro, 0, 0);
    if (rendu) { ctx.globalAlpha = Number(canvasGl.style.opacity || 1); ctx.drawImage(canvasGl, 0, 0); ctx.globalAlpha = 1; }
    ctx.globalAlpha = Number(canvasAtome.style.opacity || 0); ctx.drawImage(canvasAtome, 0, 0); ctx.globalAlpha = 1;
    const dpr = ecran.dpr;
    const b = barreEchelle(scene.etat.largeur);
    const x0 = 24 * dpr, y0 = c.height - 28 * dpr, w = b.fraction * ecran.l * dpr;
    ctx.fillStyle = '#222';
    ctx.fillRect(x0, y0, w, 4 * dpr);
    ctx.font = `${14 * dpr}px system-ui, sans-serif`;
    ctx.fillText(ecrireLongueur(b.longueur, 1), x0, y0 - 8 * dpr);
    const a = document.createElement('a');
    a.download = `monde-microscopique-${id}-${scene.etape.id}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }

  // Étape demandée par l'adresse (#nacl/zoom…)
  const iDemande = scene.etapes.findIndex((e) => e.id === sousEtape);
  if (iDemande >= 0) scene.allerEtape(iDemande);
  majEtape();
  requestAnimationFrame(boucle);

  window.__monde = { scene, rendu, ecran: () => ecran, capturer, pret: true };
  return () => {
    actif = false;
    observateur.disconnect();
    document.removeEventListener('keydown', clavier);
  };
}
