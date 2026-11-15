// Contrôles dans un vrai navigateur (Chrome sans écran) : critères d'acceptation de la fiche NaCl, temps 1.
// Usage : node outils/construire.mjs && node tests/navigateur.mjs

import { servir, lancer } from './outils-navigateur.mjs';

let echecs = 0, total = 0;
function verifier(nom, condition, detail = '') {
  total++;
  if (condition) console.log(`  ok   ${nom}`);
  else { echecs++; console.log(`  ÉCHEC ${nom}${detail ? ' — ' + detail : ''}`); }
}

const { serveur, url } = await servir();
const origine = new URL(url).origin;
const navigateur = await lancer();
const externes = [];
const erreurs = [];

async function nouvellePage(options = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 760 }, ...options });
  const page = await ctx.newPage();
  page.on('request', (r) => { if (!r.url().startsWith(origine) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externes.push(r.url()); });
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erreurs.push(m.text()); });
  return page;
}
const attendre = (page) => page.waitForFunction(() => window.__monde && window.__monde.pret, null, { timeout: 15000 });

try {
  console.log('Accueil et publication');
  let page = await nouvellePage();
  await page.goto(url);
  await attendre(page);
  verifier('accueil public : aucune scène brouillon listée', (await page.locator('.carte-scene').count()) === 0);
  await page.goto(url + '#nacl');
  await page.waitForTimeout(200);
  verifier('scène brouillon inaccessible sans ?brouillon', (await page.locator('.non-publiee').count()) === 1);
  await page.goto(url + '?brouillon');
  await page.reload();
  await attendre(page);
  verifier('mode brouillon : la scène est listée', (await page.locator('.carte-scene').count()) === 1);

  console.log('Scène NaCl, temps 1 (WebGL)');
  await page.goto(url + '?brouillon#nacl');
  await page.reload();
  await attendre(page);
  const etat = () => page.evaluate(() => ({ ...window.__monde.scene.etat, etape: window.__monde.scene.etape.id, type: window.__monde.scene.etape.type }));
  verifier('rendu WebGL actif', await page.evaluate(() => !window.__monde.rendu.mode2d));
  verifier('bandeau brouillon affiché', (await page.locator('.bandeau-brouillon').count()) === 1);
  verifier('la scène commence par la question 1', (await etat()).etape === 'question-1');

  // Critère 5 : rien ne bouge pendant une question.
  const vue = page.locator('.vue');
  await page.waitForTimeout(600); // fin des transitions d'interface au chargement
  const a = await vue.screenshot();
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(600);
  const b2 = await vue.screenshot();
  verifier('question : image strictement identique après 0,6 s et un coup de molette', a.equals(b2));
  verifier('question : la molette ne change pas l\'échelle', (await etat()).largeur === 1.2e-3);

  // Navigation
  await page.keyboard.press('ArrowRight');
  verifier('flèche droite : étape de zoom', (await etat()).etape === 'zoom');
  verifier('adresse mise à jour (#nacl/zoom)', page.url().endsWith('#nacl/zoom'));
  verifier('le zoom part de 10 cm', (await etat()).largeur === 0.1);

  // Critère 1 : règle juste à chaque instant + barre d'échelle cohérente.
  let regleOk = true, barreOk = true, detail = '';
  for (const W of [0.1, 0.02, 3e-3, 4e-4, 5e-5, 6e-6, 7e-7, 8e-8, 9e-9, 3e-9, 1e-9, 4e-10]) {
    await page.evaluate((W) => window.__monde.scene.definirLargeur(W), W);
    // Attendre deux images dessinées : la caméra, la règle et la barre sont mises à jour dans la même image.
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
    const r = await page.evaluate(() => {
      const s = window.__monde.scene;
      const barre = document.querySelector('.barre-trait').getBoundingClientRect().width;
      const texte = document.querySelector('.barre-texte').textContent;
      const vue = document.querySelector('.vue').getBoundingClientRect().width;
      return { W: s.camera.largeur, barre, texte, vue, valeur: document.querySelector('.regle-valeur').textContent };
    });
    const [nv, uv] = r.valeur.split(' ');
    const fv = { cm: 1e-2, mm: 1e-3, 'µm': 1e-6, nm: 1e-9, pm: 1e-12 }[uv];
    if (Math.abs(parseFloat(nv.replace(',', '.')) * fv - r.W) / r.W > 0.05) { regleOk = false; detail = JSON.stringify(r); }
    const [n, u] = r.texte.split(' ');
    const f = { cm: 1e-2, mm: 1e-3, 'µm': 1e-6, nm: 1e-9, pm: 1e-12 }[u];
    const longueur = parseFloat(n.replace(',', '.')) * f;
    if (Math.abs(r.barre / r.vue - longueur / r.W) > 0.004) { barreOk = false; detail = JSON.stringify(r); }
    if (Math.abs(r.W - W) / W > 1e-9) { regleOk = false; detail = JSON.stringify(r); }
  }
  verifier('règle : la largeur affichée est celle de la caméra', regleOk, detail);
  verifier('barre d\'échelle : longueur à l\'écran = longueur annoncée (±0,4 %)', barreOk, detail);

  // Critère 2 : tailles à l'échelle entre elles.
  const tailles = await page.evaluate(() => {
    const s = window.__monde.scene;
    return s.spheresCristal.slice(0, 2).map((x) => x.rayon);
  });
  verifier('rayons transmis au rendu : 181 et 102 pm', tailles.includes(181) && tailles.includes(102), JSON.stringify(tailles));

  // Lecture automatique
  await page.evaluate(() => window.__monde.scene.definirLargeur(0.1));
  await page.keyboard.press(' ');
  await page.waitForTimeout(1500);
  const enLecture = await etat();
  verifier('lecture : le zoom avance tout seul', enLecture.lecture && enLecture.largeur < 0.08, String(enLecture.largeur));
  await page.keyboard.press(' ');

  // Zoom au clavier et à la molette
  await page.evaluate(() => window.__monde.scene.definirLargeur(1e-6));
  await page.keyboard.press('ArrowUp');
  verifier('flèche haut : on s\'approche', (await etat()).largeur < 1e-6);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(100);
  verifier('molette : on s\'éloigne', (await etat()).largeur > 1e-6);

  // Critère 4 : tous les interrupteurs à toutes les étapes, retour en arrière.
  let interOk = true;
  for (const i of [0, 1, 2]) {
    await page.evaluate((i) => { window.__monde.scene.allerEtape(i); }, i);
    await page.locator('.pastille').nth(i).click();
    for (const [touche, nom] of [['e', 'etiquettes'], ['v', 'voisins'], ['c', 'compteurs'], ['t', 'tailles'], ['m', 'maille'], ['i', 'ion'], ['a', 'avance']]) {
      const avant = (await etat()).inter[nom];
      await page.keyboard.press(touche);
      await page.waitForTimeout(40);
      const apres = (await etat()).inter[nom];
      const bouton = await page.locator('.inter').nth(['etiquettes', 'voisins', 'compteurs', 'tailles', 'maille', 'ion', 'avance'].indexOf(nom)).getAttribute('aria-pressed');
      if (apres === avant || bouton !== String(apres)) interOk = false;
      await page.keyboard.press(touche);
    }
  }
  verifier('les 7 interrupteurs fonctionnent aux 3 étapes (clavier et état des boutons)', interOk);
  await page.locator('.pastille').nth(2).click();
  await page.keyboard.press('c');
  const compteurs = await page.locator('.compteurs').innerText();
  verifier('compteurs : 108 Na⁺, 108 Cl⁻, charge totale 0', /Na⁺ : 108/.test(compteurs) && /Cl⁻ : 108/.test(compteurs) && /Charge totale : 0/.test(compteurs), compteurs);
  await page.keyboard.press('c');
  await page.keyboard.press('ArrowLeft');
  verifier('retour en arrière : exploration → zoom', (await etat()).etape === 'zoom');
  await page.keyboard.press('ArrowLeft');
  verifier('retour en arrière : zoom → question', (await etat()).etape === 'question-1');

  // Exploration : rotation à la souris, sélection d'un ion au clic.
  await page.locator('.pastille').nth(2).click();
  const base0 = await page.evaluate(() => window.__monde.scene.camera.base.avant.slice());
  await page.mouse.move(640, 420); await page.mouse.down(); await page.mouse.move(760, 460, { steps: 6 }); await page.mouse.up();
  const base1 = await page.evaluate(() => window.__monde.scene.camera.base.avant.slice());
  verifier('exploration : glisser fait tourner le cristal', Math.abs(base0[0] - base1[0]) + Math.abs(base0[1] - base1[1]) + Math.abs(base0[2] - base1[2]) > 0.05, JSON.stringify({ base0, base1, etape: (await etat()).etape }));
  // Ion le plus en avant parmi ceux projetés près du centre de la vue (loin de la règle et des encarts).
  const ionCentral = () => page.evaluate(() => {
    const s = window.__monde.scene;
    const r = document.querySelector('.vue').getBoundingClientRect();
    let meilleur = null;
    s.cristal.forEach((ion, i) => {
      const p = s.camera.projeter(ion.pos.map((v) => v * 1e-12));
      if (Math.hypot(p.x - r.width / 2, p.y - r.height / 2) < 90 && (!meilleur || p.z < meilleur.z)) meilleur = { i, x: p.x + r.left, y: p.y + r.top, z: p.z };
    });
    return meilleur;
  });
  const cible = await ionCentral();
  await page.mouse.click(cible.x, cible.y);
  const sel = await etat();
  verifier('exploration : un clic sur un ion le sélectionne et allume ses voisins', sel.inter.voisins && sel.selection === cible.i, JSON.stringify({ cible, selection: sel.selection, voisins: sel.inter.voisins }));

  // Zoom dans l'ion
  await page.keyboard.press('i');
  await page.evaluate(() => window.__monde.scene.definirLargeur(3e-14));
  await page.waitForTimeout(900);
  const ionEtat = await page.evaluate(() => ({ W: window.__monde.scene.etat.largeur, regle: [...document.querySelectorAll('.graduation span')].map((x) => x.textContent).at(-1), message: document.querySelector('.message').textContent, opacite: document.querySelector('.couche-atome').style.opacity }));
  verifier('zoom dans l\'ion : on descend sous 300 pm', ionEtat.W === 3e-14, JSON.stringify(ionEtat));
  verifier('zoom dans l\'ion : la règle va jusqu\'à 1 fm', ionEtat.regle === '1 fm', ionEtat.regle);
  verifier('zoom dans l\'ion : message sur le noyau', /noyau/.test(ionEtat.message), ionEtat.message);
  await page.keyboard.press('i');
  verifier('interrupteur coupé : retour à 300 pm', (await etat()).largeur === 3e-10);
  await page.evaluate(() => window.__monde.scene.definirLargeur(2e-9));

  // Critère 8 : capture sur fond blanc.
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.locator('button', { hasText: 'Capture' }).click()]);
  verifier('capture : un fichier PNG est produit', /\.png$/.test(telechargement.suggestedFilename()), telechargement.suggestedFilename());
  await page.context().close();

  // Critère 6 : au doigt (écran tactile de téléphone).
  console.log('Téléphone (tactile, 390 × 760)');
  page = await nouvellePage({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  await page.goto(url + '?brouillon#nacl/reseau');
  await attendre(page);
  const cibleT = await ionCentral();
  await page.touchscreen.tap(cibleT.x, cibleT.y);
  await page.waitForTimeout(100);
  const etatT = await page.evaluate(() => window.__monde.scene.etat);
  verifier('toucher un ion le sélectionne', etatT.inter.voisins === true && etatT.selection === cibleT.i, JSON.stringify({ cibleT, sel: etatT.selection }));
  await page.locator('.inter').first().tap();
  verifier('toucher un interrupteur l\'active', (await page.locator('.inter').first().getAttribute('aria-pressed')) === 'true');
  const hauteurVue = await page.locator('.vue').evaluate((e) => e.getBoundingClientRect().height);
  verifier('téléphone : la zone de dessin garde au moins la moitié de l\'écran', hauteurVue >= 380, String(hauteurVue));
  await page.context().close();

  console.log('Affichage 2D de secours');
  page = await nouvellePage();
  await page.goto(url + '?brouillon&2d#nacl/reseau');
  await attendre(page);
  verifier('mode 2D actif', await page.evaluate(() => window.__monde.rendu.mode2d === true));
  await page.waitForTimeout(300);
  const pixels = await page.evaluate(() => {
    const c = document.querySelector('.couche-gl');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++;
    return n;
  });
  verifier('mode 2D : les ions sont dessinés', pixels > 100, String(pixels));
  await page.context().close();
} catch (e) {
  echecs++;
  console.error('Erreur pendant les contrôles :', e);
}

verifier('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
verifier('aucune ressource chargée depuis un autre serveur', externes.length === 0, externes.join(', '));

await navigateur.close();
serveur.close();
console.log(`\n${total - echecs}/${total} contrôles réussis.`);
if (echecs) { console.error(`${echecs} contrôle(s) en échec.`); process.exit(1); }
