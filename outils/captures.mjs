// Outil de développement : captures d'écran de la scène NaCl à plusieurs échelles.
// Usage : node outils/captures.mjs [largeur hauteur]   (après node outils/construire.mjs)

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { servir, lancer, RACINE } from '../tests/outils-navigateur.mjs';

const [l = 1280, h = 760] = process.argv.slice(2).map(Number);
const dossier = join(RACINE, 'captures');
mkdirSync(dossier, { recursive: true });
const { serveur, url } = await servir();
const navigateur = await lancer();
const page = await navigateur.newPage({ viewport: { width: l, height: h } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console :', m.text()); });
page.on('pageerror', (e) => console.log('erreur page :', e.message));

await page.goto(url + '?brouillon#nacl');
await page.waitForFunction(() => window.__monde && window.__monde.pret);
await page.waitForTimeout(400);
await page.screenshot({ path: join(dossier, `${l}-0-question.png`) });

await page.evaluate(() => { const m = window.__monde; m.scene.allerEtape(1); });
await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
const largeurs = [0.1, 3e-2, 1e-2, 3e-3, 1e-3, 3e-4, 1e-4, 1e-5, 1e-6, 1e-7, 3e-8, 1.2e-8, 6e-9, 3e-9, 2e-9, 1e-9, 5e-10];
for (const W of largeurs) {
  await page.evaluate((W) => window.__monde.scene.definirLargeur(W), W);
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(dossier, `${l}-1-zoom-${W.toExponential(0)}.png`) });
}
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
await page.keyboard.press('e');
await page.keyboard.press('c');
await page.waitForTimeout(300);
await page.screenshot({ path: join(dossier, `${l}-2-reseau-etiquettes.png`) });
await page.keyboard.press('e');
await page.keyboard.press('v');
await page.mouse.move(l / 2, h / 2);
await page.mouse.down(); await page.mouse.move(l / 2 + 120, h / 2 + 40, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: join(dossier, `${l}-3-reseau-voisins-tourne.png`) });
await page.keyboard.press('t');
await page.waitForTimeout(300);
await page.screenshot({ path: join(dossier, `${l}-4-tailles-reelles.png`) });
await navigateur.close();
serveur.close();
console.log('Captures dans', dossier);
