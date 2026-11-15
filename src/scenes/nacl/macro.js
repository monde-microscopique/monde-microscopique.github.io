// Couches macroscopiques de la scène NaCl, dessinées en 2D (canvas) avec la même caméra que les ions :
// table, salière, grains de sel. Les positions sont en mètres. Le grain étudié occupe [0, L] × [−L, 0] × [0, L].

import { aleatoire } from './reseau.js';
import { scalaire, normaliser } from '../../moteur/vec.js';

export function creerDecor(L) {
  const r = aleatoire(17);
  const grains = [{ centre: [L / 2, -L / 2, L / 2], taille: L, angle: 0, cible: true }];
  // Quelques grains renversés autour du grain étudié (positions fixes, tirées une fois pour toutes).
  const places = [
    [-2.2e-3, 1.6e-3], [3.1e-3, -1.2e-3], [1.4e-3, 4.2e-3], [-4.6e-3, -2.8e-3], [6.5e-3, 3.4e-3],
    [-7.5e-3, 5.1e-3], [9.0e-3, -4.0e-3], [-1.1e-2, -6.5e-3], [4.0e-3, 9.5e-3], [-3.5e-3, 1.05e-2],
    [1.25e-2, 6.0e-3], [-1.45e-2, 1.2e-3], [-2.2e-2, 1.6e-2], [-1.6e-2, 2.6e-2], [-3.0e-2, 1.2e-2],
  ];
  for (const [x, z] of places) {
    const s = L * (0.65 + 0.7 * r());
    grains.push({ centre: [x, -L + s / 2, z], taille: s, angle: r() * Math.PI / 2 });
  }
  return {
    L,
    grains,
    saliere: { base: [-3.0e-2, -L, 2.4e-2], hauteur: 4.0e-2, rayon: 1.1e-2, chapeau: 0.9e-2 },
    // Point visé au départ du zoom (champ de 10 cm) : salière et grains dans le cadre.
    centreVue: [-1.0e-2, 1.6e-2, 1.4e-2],
    table: { y: -L, x0: -0.16, x1: 0.12, z0: -0.09, z1: 0.18 },
  };
}

const LUMIERE = normaliser([-0.35, 0.85, -0.4]);

function sommetsCube(g) {
  const h = g.taille / 2;
  const c = Math.cos(g.angle), s = Math.sin(g.angle);
  const pts = [];
  for (const dx of [-h, h]) for (const dy of [-h, h]) for (const dz of [-h, h]) {
    pts.push([g.centre[0] + dx * c - dz * s, g.centre[1] + dy, g.centre[2] + dx * s + dz * c]);
  }
  return pts;
}

// Faces du cube : indices des sommets (ordre de sommetsCube : dx, dy, dz ∈ {−h, +h}) et normale locale.
const FACES = [
  { s: [0, 1, 3, 2], n: [-1, 0, 0] }, { s: [4, 6, 7, 5], n: [1, 0, 0] },
  { s: [0, 4, 5, 1], n: [0, -1, 0] }, { s: [2, 3, 7, 6], n: [0, 1, 0] },
  { s: [0, 2, 6, 4], n: [0, 0, -1] }, { s: [1, 5, 7, 3], n: [0, 0, 1] },
];

function tournerNormale(n, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c];
}

// Découpe d'un polygone (écran) par un rectangle élargi : évite les coordonnées gigantesques
// quand on zoome très fort sur une face (canvas n'aime pas les valeurs de l'ordre de 10^9 px).
function decouper(poly, x0, y0, x1, y1) {
  const bords = [
    (p) => p.x >= x0, (p) => p.x <= x1, (p) => p.y >= y0, (p) => p.y <= y1,
  ];
  const inter = [
    (a, b) => { const t = (x0 - a.x) / (b.x - a.x); return { x: x0, y: a.y + t * (b.y - a.y) }; },
    (a, b) => { const t = (x1 - a.x) / (b.x - a.x); return { x: x1, y: a.y + t * (b.y - a.y) }; },
    (a, b) => { const t = (y0 - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: y0 }; },
    (a, b) => { const t = (y1 - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: y1 }; },
  ];
  let sortie = poly;
  for (let k = 0; k < 4; k++) {
    const entree = sortie;
    sortie = [];
    for (let i = 0; i < entree.length; i++) {
      const a = entree[i], b = entree[(i + 1) % entree.length];
      const ia = bords[k](a), ib = bords[k](b);
      if (ia) sortie.push(a);
      if (ia !== ib) sortie.push(inter[k](a, b));
    }
    if (!sortie.length) break;
  }
  return sortie;
}

function tracer(ctx, poly) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function teinte(base, f) {
  return `rgb(${base.map((v) => Math.round(v * f)).join(',')})`;
}

// Dessine le décor vu par la caméra. opaciteFaces : fondu des faces du grain étudié (zoom vers les ions).
export function dessinerMacro(ctx, camera, decor, options = {}) {
  const { l, h } = camera.ecran;
  const M = Math.max(l, h) * 2;
  const bx0 = -M, by0 = -M, bx1 = l + M, by1 = h + M;
  const opaciteFaces = options.opaciteFaces ?? 1;
  const k = camera.pxParMetre;

  // Table
  const t = decor.table;
  const coinsTable = [[t.x0, t.y, t.z0], [t.x1, t.y, t.z0], [t.x1, t.y, t.z1], [t.x0, t.y, t.z1]].map((p) => camera.projeter(p));
  const polyTable = decouper(coinsTable, bx0, by0, bx1, by1);
  if (polyTable.length) {
    ctx.fillStyle = options.couleurTable || '#E4DED2';
    tracer(ctx, polyTable);
    ctx.fill();
  }

  // Objets triés de l'arrière vers l'avant.
  const objets = decor.grains.map((g) => ({ type: 'grain', g, z: camera.projeter(g.centre).z }));
  const s = decor.saliere;
  objets.push({ type: 'saliere', z: camera.projeter([s.base[0], s.base[1] + s.hauteur / 2, s.base[2]]).z });
  objets.sort((a, b) => b.z - a.z);

  for (const o of objets) {
    if (o.type === 'saliere') { dessinerSaliere(ctx, camera, s); continue; }
    const g = o.g;
    // Grain trop petit à l'écran : un point suffit.
    const taillePx = g.taille * k;
    if (taillePx < 0.6) continue;
    const pts = sommetsCube(g).map((p) => camera.projeter(p));
    const alpha = g.cible ? opaciteFaces : 1;
    if (alpha <= 0.002) continue;
    ctx.globalAlpha = alpha;
    for (const f of FACES) {
      const n = tournerNormale(f.n, g.angle);
      if (scalaire(n, camera.base.avant) >= 0) continue; // face cachée
      const poly = decouper(f.s.map((i) => pts[i]), bx0, by0, bx1, by1);
      if (poly.length < 3) continue;
      const e = 0.8 + 0.2 * Math.max(0, scalaire(n, LUMIERE));
      tracer(ctx, poly);
      ctx.fillStyle = teinte([252, 251, 248], e);
      ctx.fill();
      ctx.lineWidth = taillePx > 40 ? 1.2 : 0.6;
      ctx.strokeStyle = 'rgba(150,146,138,0.85)';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Repère autour du grain étudié tant qu'il est petit à l'écran.
    if (g.cible && options.repereCible && taillePx < 60) {
      const c = camera.projeter(g.centre);
      ctx.save();
      ctx.strokeStyle = 'rgba(192,57,43,' + Math.min(1, (60 - taillePx) / 30) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(14, taillePx * 0.9), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

function dessinerSaliere(ctx, camera, s) {
  const k = camera.pxParMetre;
  const r = s.rayon * k;
  if (r < 0.5) return;
  const bas = camera.projeter(s.base);
  const corps = camera.projeter([s.base[0], s.base[1] + s.hauteur - s.chapeau, s.base[2]]);
  const haut = camera.projeter([s.base[0], s.base[1] + s.hauteur, s.base[2]]);
  // Raccourci de l'ellipse : dépend de l'inclinaison de la visée.
  const e = r * Math.abs(camera.base.avant[1]);
  if (bas.y < -r * 4 || haut.y > camera.ecran.h + r * 4 || bas.x + r < -10 || bas.x - r > camera.ecran.l + 10) return;
  ctx.save();
  // Ombre douce sur la table
  ctx.fillStyle = 'rgba(80,70,60,0.10)';
  ctx.beginPath(); ctx.ellipse(bas.x + r * 0.25, bas.y + e * 0.15, r * 1.25, e * 1.25, 0, 0, Math.PI * 2); ctx.fill();
  // Verre
  ctx.beginPath();
  ctx.moveTo(bas.x - r, corps.y);
  ctx.lineTo(bas.x - r, bas.y);
  ctx.ellipse(bas.x, bas.y, r, e, 0, Math.PI, 0, true);
  ctx.lineTo(bas.x + r, corps.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(205,222,232,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,155,0.9)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  // Sel à l'intérieur (60 % de la hauteur du verre)
  const niveau = bas.y + (corps.y - bas.y) * 0.6;
  ctx.beginPath();
  ctx.moveTo(bas.x - r * 0.93, niveau);
  ctx.lineTo(bas.x - r * 0.93, bas.y);
  ctx.ellipse(bas.x, bas.y, r * 0.93, e * 0.93, 0, Math.PI, 0, true);
  ctx.lineTo(bas.x + r * 0.93, niveau);
  ctx.ellipse(bas.x, niveau, r * 0.93, e * 0.93, 0, 0, Math.PI, false);
  ctx.fillStyle = 'rgba(250,250,247,0.95)';
  ctx.fill();
  // Reflet
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(bas.x - r * 0.72, corps.y + (bas.y - corps.y) * 0.08, r * 0.12, (bas.y - corps.y) * 0.8);
  // Chapeau métallique
  const g = ctx.createLinearGradient(bas.x - r, 0, bas.x + r, 0);
  g.addColorStop(0, '#8d9298'); g.addColorStop(0.35, '#e4e7ea'); g.addColorStop(0.6, '#b8bdc3'); g.addColorStop(1, '#7c8187');
  ctx.beginPath();
  ctx.moveTo(bas.x - r * 1.02, haut.y);
  ctx.lineTo(bas.x - r * 1.02, corps.y);
  ctx.ellipse(bas.x, corps.y, r * 1.02, e * 1.02, 0, Math.PI, 0, true);
  ctx.lineTo(bas.x + r * 1.02, haut.y);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bas.x, haut.y, r * 1.02, e * 1.02, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d3d7db';
  ctx.fill();
  ctx.strokeStyle = '#7c8187';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.stroke();
  // Trous
  ctx.fillStyle = '#4b4f55';
  for (const [u, v] of [[0, 0], [-0.4, 0], [0.4, 0], [-0.2, -0.45], [0.2, -0.45], [-0.2, 0.45], [0.2, 0.45]]) {
    ctx.beginPath();
    ctx.ellipse(bas.x + u * r, haut.y + v * e, r * 0.06, e * 0.06 + 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Rectangle du champ de la caméra principale, vu par la caméra de l'encart (repère de zoom).
export function dessinerRepere(ctx, cameraEncart, cameraPrincipale) {
  const c = cameraPrincipale;
  const lw = c.largeur / 2, hw = (c.largeur * c.ecran.h) / c.ecran.l / 2;
  const coins = [[-lw, -hw], [lw, -hw], [lw, hw], [-lw, hw]].map(([a, b]) => cameraEncart.projeter([
    c.centre[0] + c.base.droite[0] * a + c.base.haut[0] * b,
    c.centre[1] + c.base.droite[1] * a + c.base.haut[1] * b,
    c.centre[2] + c.base.droite[2] * a + c.base.haut[2] * b,
  ]));
  const w = Math.abs(coins[1].x - coins[0].x);
  ctx.save();
  ctx.strokeStyle = '#C0392B';
  ctx.lineWidth = 2;
  if (w >= 8) {
    tracer(ctx, coins);
    ctx.stroke();
  } else {
    const x = (coins[0].x + coins[2].x) / 2, y = (coins[0].y + coins[2].y) / 2;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12); ctx.stroke();
  }
  ctx.restore();
}
