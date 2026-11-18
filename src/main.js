// Point d'entrée unique : accueil ou scène selon l'adresse (#nacl, #nacl/zoom…).
// Mode brouillon : ajouter ?brouillon à l'adresse (scènes non relues visibles, crayons d'édition).

import contenu from 'contenu:genere';
import { Textes } from './interface/dom.js';
import { afficherAccueil } from './interface/accueil.js';
import { afficherScene } from './interface/vue-scene.js';
import { SceneNaCl } from './scenes/nacl/scene.js';
import { SceneHydrate } from './scenes/hydrate/scene.js';

const CLASSES = { nacl: SceneNaCl, hydrate: SceneHydrate };

const brouillon = new URLSearchParams(location.search).has('brouillon');
const textes = new Textes(contenu, brouillon);
const racine = document.getElementById('app');
let arreter = null;

function router() {
  if (arreter) { arreter(); arreter = null; }
  const [id, sous] = location.hash.replace(/^#/, '').split('/');
  const s = id && contenu.scenes[id];
  if (!s) { afficherAccueil(racine, contenu, textes, brouillon); window.__monde = { sceneId: null, pret: true }; return; }
  if (s.statut !== 'validee' && !brouillon) {
    racine.innerHTML = '';
    const p = textes.bloc('p', 'non-publiee', null, { class: 'non-publiee' });
    racine.append(p);
    window.__monde = { sceneId: id, pret: true, nonPubliee: true };
    return;
  }
  arreter = afficherScene(racine, contenu, textes, brouillon, id, CLASSES[id], sous);
  window.__monde.sceneId = id;
}

window.addEventListener('hashchange', () => {
  // Les changements d'étape mettent à jour l'adresse sans recharger la scène.
  const [id] = location.hash.replace(/^#/, '').split('/');
  if (!window.__monde || window.__monde.sceneId !== id) router();
});
router();
