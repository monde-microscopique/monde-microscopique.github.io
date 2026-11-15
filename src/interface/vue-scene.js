// Vue d'une scène : barre d'étapes, zone de dessin (2D + WebGL), règle d'échelle, encart macro,
// interrupteurs, panneaux. Pilotée au clavier, à la souris et au doigt.

import { el } from './dom.js';
import { Rendu } from '../moteur/rendu.js';
import { Rendu2D } from '../moteur/rendu2d.js';
import { Camera } from '../moteur/camera.js';
import { ecrireLongueur, barreEchelle, graduations } from '../moteur/echelle.js';
import { dessinerMacro, dessinerRepere } from '../scenes/nacl/macro.js';

const INTERRUPTEURS = [
  { nom: 'etiquettes', cle: 'inter-etiquettes', touche: 'e' },
  { nom: 'voisins', cle: 'inter-voisins', touche: 'v' },
  { nom: 'compteurs', cle: 'inter-compteurs', touche: 'c' },
  { nom: 'tailles', cle: 'inter-tailles', touche: 't' },
];

export function afficherScene(racine, contenu, textes, brouillon, id, ClasseScene, sousEtape) {
  racine.innerHTML = '';
  const infos = contenu.scenes[id];
  const T = (cle, attrs = {}, tag = 'span') => textes.bloc(tag, cle, id, attrs);

  // ------------------------------------------------------------ structure DOM
  const canvasMacro = el('canvas', { class: 'couche couche-macro', 'aria-hidden': 'true' });
  const canvasGl = el('canvas', { class: 'couche couche-gl', 'aria-hidden': 'true' });
  const message = el('div', { class: 'message', 'aria-live': 'polite' });
  const compteurs = el('div', { class: 'compteurs', hidden: true });
  const encartCanvas = el('canvas', { class: 'encart-canvas' });
  const encartLegende = el('div', { class: 'encart-legende' });
  const encart = el('div', { class: 'encart' }, encartCanvas, encartLegende);
  const regleRepere = el('div', { class: 'regle-repere' }, el('span', { class: 'regle-valeur' }), el('span', { class: 'regle-ici' }, textes.brut('regle-ici')));
  const regleRail = el('div', { class: 'regle-rail' });
  const regle = el('div', { class: 'regle', role: 'slider', tabindex: '0', 'aria-label': 'Échelle : largeur du champ visible' }, regleRail, regleRepere);
  const barre = el('div', { class: 'barre-echelle' }, el('div', { class: 'barre-trait' }), el('div', { class: 'barre-texte' }));
  const question = el('div', { class: 'question', hidden: true });
  const vue = el('div', { class: 'vue' }, canvasMacro, canvasGl, encart, message, compteurs, regle, barre, question);

  const btnPrec = el('button', { class: 'bouton', type: 'button', 'aria-label': textes.brut('bouton-precedent') }, '◀', el('span', { class: 'mot' }, ' ' + textes.brut('bouton-precedent')));
  const btnSuiv = el('button', { class: 'bouton', type: 'button', 'aria-label': textes.brut('bouton-suivant') }, el('span', { class: 'mot' }, textes.brut('bouton-suivant') + ' '), '▶');
  const btnLecture = el('button', { class: 'bouton bouton-lecture', type: 'button' });
  const btnCapture = el('button', { class: 'bouton', type: 'button', title: 'Image PNG sur fond blanc' }, textes.brut('bouton-capture'));
  const titreEtape = el('div', { class: 'titre-etape' });
  const pastilles = el('div', { class: 'pastilles' });

  const barreHaut = el('header', { class: 'barre-haut' },
    el('a', { class: 'lien-accueil', href: brouillon ? '?brouillon#' : '#' }, '⌂ ', textes.brut('retour-accueil')),
    el('div', { class: 'titre-scene-barre' }, T('titre', {}, 'strong'), titreEtape),
    el('div', { class: 'commandes' }, btnPrec, pastilles, btnSuiv, btnLecture, btnCapture),
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
  const scene = new ClasseScene(infos.donnees, rendu, canvasMacro.getContext('2d'));
  const ech = infos.donnees.echelle;
  vue.style.background = infos.donnees.affichage.fond;

  // Règle : graduations d'une décade à l'autre.
  const lmax = Math.log10(ech.regle_max_m), lmin = Math.log10(ech.regle_min_m);
  const fraction = (m) => (lmax - Math.log10(m)) / (lmax - lmin);
  for (const g of graduations(ech.regle_max_m, ech.regle_min_m)) {
    regleRail.append(el('div', { class: 'graduation', style: `top:${fraction(g) * 100}%` }, el('span', {}, ecrireLongueur(g, 1))));
  }

  // Pastilles d'étapes
  scene.etapes.forEach((e, i) => {
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
    else if (e.type === 'question') titreEtape.append(`Prédiction`);
    [...pastilles.children].forEach((p, k) => p.setAttribute('aria-current', k === i ? 'step' : 'false'));
    btnPrec.disabled = i === 0;
    btnSuiv.disabled = i === scene.etapes.length - 1;
    btnLecture.hidden = e.type !== 'zoom';
    if (e.type === 'question') {
      question.innerHTML = '';
      question.append(
        T(e.texte, { class: 'question-texte' }, 'p'),
        textes.bloc('p', 'image-arretee', null, { class: 'question-note' }),
        el('button', { class: 'bouton bouton-principal', type: 'button', onclick: () => { scene.allerEtape(i + 1); majEtape(); } }, textes.brut('bouton-observer')),
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
    compteurs.hidden = !scene.etat.inter.compteurs;
    if (!compteurs.hidden) {
      compteurs.innerHTML = '';
      const b = scene.bilan;
      for (const [esp, n] of Object.entries(b.compte)) {
        compteurs.append(el('div', {}, el('span', { class: 'puce', style: `background:${infos.donnees.especes[esp].couleur}` }), `${infos.donnees.especes[esp].etiquette} : `, el('strong', {}, String(n))));
      }
      compteurs.append(el('div', {}, `${textes.brut('compteur-charge')} : `, el('strong', {}, String(b.charge))));
    }
  }

  for (const i of INTERRUPTEURS) {
    boutonsInter[i.nom].addEventListener('click', () => { scene.basculer(i.nom); majInterrupteurs(); });
  }
  btnPrec.addEventListener('click', () => { scene.allerEtape(scene.etat.etape - 1); majEtape(); });
  btnSuiv.addEventListener('click', () => { scene.allerEtape(scene.etat.etape + 1); majEtape(); });
  btnLecture.addEventListener('click', () => scene.basculerLecture());
  btnCapture.addEventListener('click', () => capturer());

  // ------------------------------------------------------------ entrées
  const pointeurs = new Map();
  let distPince = 0, deplace = 0;
  vue.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    scene.zoomer(Math.exp(dy * 0.0015));
    scene.etat.lecture = false;
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
      scene.etat.lecture = false;
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
    scene.etat.lecture = false;
  };
  regle.addEventListener('pointerdown', (ev) => { regle.setPointerCapture(ev.pointerId); regler(ev); });
  regle.addEventListener('pointermove', (ev) => { if (regle.hasPointerCapture(ev.pointerId)) regler(ev); });

  const clavier = (ev) => {
    if (ev.target.closest('input, textarea')) return;
    const k = ev.key;
    let traite = true;
    if (k === 'ArrowRight' || k === 'PageDown') { scene.allerEtape(scene.etat.etape + 1); majEtape(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { scene.allerEtape(scene.etat.etape - 1); majEtape(); }
    else if (k === 'ArrowUp' || k === '+' || k === '=') { scene.zoomer(0.8); scene.etat.lecture = false; }
    else if (k === 'ArrowDown' || k === '-') { scene.zoomer(1.25); scene.etat.lecture = false; }
    else if (k === ' ') { if (scene.fige) { scene.allerEtape(scene.etat.etape + 1); majEtape(); } else scene.basculerLecture(); }
    else if (k === 'Escape') fermerPanneau();
    else {
      const i = INTERRUPTEURS.find((x) => x.touche === k.toLowerCase());
      if (i && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { scene.basculer(i.nom); majInterrupteurs(); } else traite = false;
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
    // Message
    let cle = scene.message();
    if (scene.etape.type === 'exploration') cle = 'coin-du-grain';
    if (cle !== derniereCle) {
      derniereCle = cle;
      message.innerHTML = '';
      if (cle) {
        message.append(T(cle, {}, 'span'));
        if (cle === 'coin-du-grain') message.append(el('br'), T('aide-reseau', { class: 'aide' }));
      }
      message.classList.toggle('vide', !cle);
    }
    btnLecture.textContent = scene.etat.lecture ? '❚❚ ' + textes.brut('bouton-pause') : '▶ ' + textes.brut('bouton-lecture');
    // Encart macro
    const ctx = encartCanvas.getContext('2d');
    const dpr = ecran.dpr;
    const ew = encartCanvas.width / dpr, eh = encartCanvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ew, eh);
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

  let precedent = performance.now();
  let actif = true;
  function boucle(t) {
    if (!actif) return;
    const dt = Math.min(0.1, (t - precedent) / 1000);
    precedent = t;
    scene.avancer(dt);
    scene.dessiner(ecran);
    majHabillage();
    requestAnimationFrame(boucle);
  }

  function capturer() {
    // Rendu sur fond blanc, à la résolution de l'écran, avec la barre d'échelle.
    scene.dessiner(ecran, { fondCapture: infos.donnees.affichage.fond_capture });
    const c = document.createElement('canvas');
    c.width = canvasMacro.width; c.height = canvasMacro.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = infos.donnees.affichage.fond_capture;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvasMacro, 0, 0);
    if (rendu) { ctx.globalAlpha = Number(canvasGl.style.opacity || 1); ctx.drawImage(canvasGl, 0, 0); ctx.globalAlpha = 1; }
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
