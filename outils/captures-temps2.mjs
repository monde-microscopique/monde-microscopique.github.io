// Outil de développement : captures du temps 2 (dissolution) à des instants choisis.
// Usage : node outils/captures-temps2.mjs [largeur hauteur] [2d]   (après node outils/construire.mjs)

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
await page.goto(url + `?brouillon${mode2d ? '&2d' : ''}#nacl/question-2`);
await page.waitForFunction(() => window.__monde && window.__monde.pret);
const instants = [['question-2', 0], ['grain-dans-eau', 1], ['grain-dans-eau', 7], ['cation-solvate', 11], ['cation-solvate', 14], ['cation-solvate', 19],
  ['anion-solvate', 27], ['anion-solvate', 33], ['dissolution-graduelle', 45], ['dissolution-graduelle', 60], ['dissolution-graduelle', 75], ['solution', 95]];
for (const [id, t] of instants) {
  const i = await page.evaluate((id) => window.__monde.scene.etapes.findIndex((e) => e.id === id), id);
  await page.locator('.pastille').nth(i).click();
  await page.evaluate(([id, t]) => {
    const s = window.__monde.scene;
    s.etat.lecture = false;
    s.etat.tc = t;
    s.etat.largeur = s.largeurAuto(t);
    s.appliquerTemps();
  }, [id, t]);
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(dossier, `t2-${mode2d ? '2d-' : ''}${l}-${String(t).padStart(2, '0')}-${id}.png`) });
}
await navigateur.close();
serveur.close();
console.log('Captures dans', dossier);
