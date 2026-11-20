// Outil de développement : captures de la scène « Même composition, substances différentes ».
// Usage : node outils/captures-composition.mjs [largeur hauteur] [2d]   (après node outils/construire.mjs)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { servir, lancer, RACINE } from '../tests/outils-navigateur.mjs';

const args = process.argv.slice(2);
const mode2d = args.includes('2d');
const [l = 1280, h = 760] = args.filter((a) => a !== '2d').map(Number);
const dossier = join(RACINE, 'captures');
mkdirSync(dossier, { recursive: true });
const { serveur, url } = await servir();
const navigateur = await lancer();
const page = await navigateur.newPage({ viewport: { width: l, height: h } });
page.on('pageerror', (e) => console.log('erreur page :', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console :', m.text()); });
const suffixe = `${mode2d ? '2d-' : ''}${l}`;
// [étape, touches à presser, attente (ms), nom]
const vues = [
  ['question-1', [], 300, 'question'], ['modeles', [], 300, 'modeles'], ['modeles', ['e'], 300, 'etiquettes'],
  ['compter', [], 300, 'compter'], ['compter', ['h'], 300, 'sans-h'], ['compter', ['h', 'h'], 1500, 'h-apparaissent'],
  ['rapport', [], 300, 'rapport'], ['masses', [], 300, 'masses'], ['masses', ['k'], 300, 'compact'],
  ['masses', ['p'], 1500, 'plane'], ['mise-en-commun', [], 300, 'mise-en-commun'],
];
let n = 0;
for (const [id, touches, attente, nom] of vues) {
  await page.goto(url + `?brouillon${mode2d ? '&2d' : ''}#composition/${id}`);
  await page.reload();
  await page.waitForFunction(() => window.__monde && window.__monde.pret);
  for (const t of touches) await page.keyboard.press(t);
  await page.waitForTimeout(attente);
  await page.screenshot({ path: join(dossier, `co-${suffixe}-${String(n++).padStart(2, '0')}-${nom}.png`) });
}
await navigateur.close();
serveur.close();
console.log('Captures dans', dossier);
