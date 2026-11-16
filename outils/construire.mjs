// Construction du site : vérifie les textes et les données, puis assemble dist/.
// Usage : node outils/construire.mjs
// En cas d'erreur, le message est en français et la construction s'arrête (rien n'est publié).

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { lireTextes, markdownVersHtml } from './markdown.mjs';
import { estEquation, equationSvg } from './equations.mjs';
import { CLES_INTERFACE } from '../src/interface/cles.js';
import { SCENES } from '../src/scenes/registre-cles.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RACINE, 'dist');
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');

const erreurs = [];
const avertissements = [];

function exiger(textes, cles, fichier) {
  for (const c of cles) {
    if (!textes[c]) erreurs.push(`${fichier} : le texte « ## ${c} » manque (il a peut-être été renommé ou effacé).`);
  }
  for (const c of Object.keys(textes)) {
    if (!cles.includes(c)) avertissements.push(`${fichier} : le texte « ## ${c} » n'est utilisé nulle part.`);
  }
}

function lireTextesSurs(chemin) {
  try {
    const textes = lireTextes(lire(chemin), chemin);
    // Un texte qui n'est qu'une équation \ce{...} est rendu en image vectorielle (notation mhchem).
    for (const [nom, t] of Object.entries(textes)) {
      if (!estEquation(t.source)) continue;
      try { t.html = equationSvg(t.source); } catch (e) { erreurs.push(`${chemin}, ligne ${t.ligne} : l'équation « ${nom} » est illisible (${e.message}).`); }
    }
    return textes;
  } catch (e) {
    if (e.erreursTextes) { erreurs.push(...e.erreursTextes); return {}; }
    throw e;
  }
}

function verifierDonnees(d, chemin) {
  const err = (m) => erreurs.push(`${chemin} : ${m}`);
  if (!d.id) err('identifiant « id » manquant.');
  if (!['structure', 'etiquette'].includes(d.mode)) err(`mode « ${d.mode} » inconnu (structure ou etiquette).`);
  for (const [nom, e] of Object.entries(d.especes || {})) {
    if (!(e.rayon_pm > 0)) err(`rayon de ${nom} invalide.`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(e.couleur || '')) err(`couleur de ${nom} invalide (format #RRVVBB).`);
    if (!e.source_rayon) err(`source du rayon de ${nom} manquante.`);
    if (!Number.isInteger(e.charge)) err(`charge de ${nom} invalide.`);
  }
}

// --- Catalogue -------------------------------------------------------------
let catalogue;
try {
  catalogue = JSON.parse(lire('scenes/catalogue.json'));
} catch (e) {
  erreurs.push(`scenes/catalogue.json : fichier illisible (${e.message}). Vérifie les guillemets et les virgules.`);
  catalogue = { scenes: [] };
}
for (const s of catalogue.scenes) {
  if (!['brouillon', 'validee'].includes(s.statut)) {
    erreurs.push(`scenes/catalogue.json : statut « ${s.statut} » de la scène ${s.id} inconnu. Écrire exactement brouillon ou validee.`);
  }
  if (!SCENES[s.id]) erreurs.push(`scenes/catalogue.json : la scène « ${s.id} » n'existe pas dans le moteur.`);
}

// --- Textes et données -------------------------------------------------------
const interface_ = lireTextesSurs('textes/interface.md');
exiger(interface_, CLES_INTERFACE, 'textes/interface.md');

const scenes = {};
for (const s of catalogue.scenes) {
  if (!SCENES[s.id]) continue;
  const dossier = `scenes/${s.id}`;
  let donnees = {};
  try {
    donnees = JSON.parse(lire(`${dossier}/donnees.json`));
  } catch (e) {
    erreurs.push(`${dossier}/donnees.json : fichier illisible (${e.message}).`);
  }
  verifierDonnees(donnees, `${dossier}/donnees.json`);
  const textes = lireTextesSurs(`${dossier}/textes.md`);
  exiger(textes, SCENES[s.id].cles(donnees), `${dossier}/textes.md`);
  const controle = existsSync(join(RACINE, dossier, 'controle.md'))
    ? markdownVersHtml(lire(`${dossier}/controle.md`)) : '';
  scenes[s.id] = { statut: s.statut, chapitre: s.chapitre, donnees, textes, controle };
}

for (const a of avertissements) console.warn('Avertissement : ' + a);
if (erreurs.length) {
  console.error('\nLa construction a échoué. Rien n\'est publié ; le site garde sa version précédente.\n');
  for (const e of erreurs) console.error(' - ' + e);
  console.error('');
  process.exit(1);
}

// --- Assemblage ------------------------------------------------------------
const depot = process.env.GITHUB_REPOSITORY || 'monde-microscopique/monde-microscopique.github.io';
const contenu = {
  depot,
  branche: 'main',
  construit: new Date().toISOString(),
  version: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local',
  interface: interface_,
  scenes,
};

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [join(RACINE, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2017'],
  outfile: join(DIST, 'app.js'),
  legalComments: 'none',
  plugins: [{
    name: 'contenu',
    setup(b) {
      b.onResolve({ filter: /^contenu:genere$/ }, () => ({ path: 'contenu', namespace: 'contenu' }));
      b.onLoad({ filter: /.*/, namespace: 'contenu' }, () => ({
        contents: 'export default ' + JSON.stringify(contenu) + ';',
        loader: 'js',
      }));
    },
  }],
});

copyFileSync(join(RACINE, 'src/index.html'), join(DIST, 'index.html'));
copyFileSync(join(RACINE, 'src/style.css'), join(DIST, 'style.css'));
writeFileSync(join(DIST, '.nojekyll'), '');
console.log(`Construction réussie : ${Object.keys(scenes).length} scène(s), version ${contenu.version}.`);
