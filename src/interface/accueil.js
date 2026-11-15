// Page d'accueil : liste des scènes publiées (toutes, en mode brouillon).

import { el } from './dom.js';

export function afficherAccueil(racine, contenu, textes, brouillon) {
  racine.innerHTML = '';
  const suffixe = brouillon ? '?brouillon' : '';
  const scenes = Object.entries(contenu.scenes).filter(([, s]) => brouillon || s.statut === 'validee');
  const page = el('main', { class: 'accueil' },
    brouillon ? textes.bloc('div', 'brouillon-accueil', null, { class: 'bandeau-brouillon' }) : null,
    el('header', {},
      textes.bloc('h1', 'site-titre'),
      textes.bloc('p', 'site-sous-titre', null, { class: 'sous-titre' }),
    ),
    scenes.length
      ? el('section', {},
          textes.bloc('h2', 'accueil-liste'),
          el('ul', { class: 'liste-scenes' }, scenes.map(([id, s]) => el('li', {},
            el('a', { href: `${suffixe}#${id}`, class: 'carte-scene' },
              el('span', { class: 'titre-scene', html: s.textes.titre?.html || id }),
              el('span', { class: 'sous-titre-scene', html: s.textes['sous-titre']?.html || '' }),
              el('span', { class: 'meta' }, `Chapitre ${s.chapitre}`, s.statut === 'brouillon' ? el('span', { class: 'etiquette-brouillon' }, 'brouillon') : null),
            ),
          ))),
        )
      : textes.bloc('p', 'accueil-vide', null, { class: 'vide' }),
    el('footer', { class: 'pied' }, textes.bloc('span', 'pied-de-page'), el('span', { class: 'version' }, ` · version ${contenu.version}`)),
  );
  racine.append(page);
  document.title = textes.brut('site-titre');
}
