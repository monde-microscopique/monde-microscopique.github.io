// Outil de développement : captures de la scène hydrate à des instants choisis.
// Usage : node outils/captures-hydrate.mjs [largeur hauteur] [2d]   (après node outils/construire.mjs)
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
await page.goto(url + `?brouillon${mode2d ? '&2d' : ''}#hydrate/question-1`);
await page.waitForFunction(() => window.__monde && window.__monde.pret);
// [étape, largeur (m) ou null, tc]
const vues = [['question-1', null, 0], ['zoom', 2e-2, 0], ['zoom', 2e-3, 0], ['zoom', 1e-5, 0], ['zoom', 2.5e-8, 0], ['zoom', 9e-9, 0], ['motif', null, 0],
  ['palier-1', null, 10], ['palier-2', null, 22], ['palier-3', null, 37], ['ajout-eau', null, 52], ['mise-en-commun', null, 60]];
let n = 0;
for (const [id, W, tc] of vues) {
  const i = await page.evaluate((id) => window.__monde.scene.etapes.findIndex((e) => e.id === id), id);
  if (await page.locator('.pastille').nth(i).isVisible()) await page.locator('.pastille').nth(i).click();
  else {
    // Téléphone : les pastilles sont cachées ; on passe par l'adresse directe de l'étape.
    await page.goto(url + `?brouillon${mode2d ? '&2d' : ''}#hydrate/${id}`);
    await page.reload();
    await page.waitForFunction(() => window.__monde && window.__monde.pret);
  }
  await page.evaluate(([W, tc]) => {
    const s = window.__monde.scene;
    s.etat.lecture = false;
    if (W) s.etat.largeur = W;
    if (s.temps2) { s.etat.tc = tc; s.appliquerTemps(); }
  }, [W, tc]);
  if (id === 'motif' || id === 'palier-1') { await page.keyboard.press('e'); await page.keyboard.press('c'); }
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(dossier, `hy-${mode2d ? '2d-' : ''}${String(n++).padStart(2, '0')}-${id}.png`) });
}
await navigateur.close();
serveur.close();
console.log('Captures dans', dossier);
