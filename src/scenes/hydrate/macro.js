// Dessins macroscopiques de la scène hydrate (canvas 2D) :
//  - les cristaux bleus vus de près, dans le plan de l'écran (pendant le zoom, la caméra ne tourne pas) ;
//  - l'encart : un tube à essai avec les cristaux, la flamme, la buée, la température.
// Positions en mètres, dans le plan de l'écran : u vers la droite, v vers le haut ; l'origine est le point visé
// par le zoom, sur une arête du cristal principal (le motif des particules y est placé).

// Cristal principal : face du dessus (au-dessus de l'arête v = 0) et face avant (en dessous).
// Les autres cristaux : prismes plus petits autour. Formes inclinées (cristaux tricliniques), schématiques.
const PRINCIPAL = {
  dessus: [[-4.6e-3, 0], [3.4e-3, 0], [5.6e-3, 3.1e-3], [-2.4e-3, 3.1e-3]],
  avant: [[-4.6e-3, 0], [3.4e-3, 0], [3.0e-3, -4.2e-3], [-5.0e-3, -4.2e-3]],
  cote: [[3.4e-3, 0], [5.6e-3, 3.1e-3], [5.2e-3, -1.1e-3], [3.0e-3, -4.2e-3]],
};
const AUTRES = [
  { c: [-7.6e-3, 2.4e-3], t: 2.6e-3, a: 0.4 }, { c: [8.2e-3, -2.0e-3], t: 3.2e-3, a: -0.3 }, { c: [-6.8e-3, -6.0e-3], t: 2.2e-3, a: 0.9 },
  { c: [6.4e-3, 5.6e-3], t: 2.0e-3, a: 1.4 }, { c: [0.6e-3, 7.4e-3], t: 2.4e-3, a: -0.8 }, { c: [1.6e-3, -7.6e-3], t: 2.8e-3, a: 0.2 },
  { c: [-1.2e-2, -1.2e-3], t: 3.0e-3, a: -1.1 }, { c: [1.25e-2, 4.0e-3], t: 2.6e-3, a: 0.6 },
];
// Marches de croissance : familles de traits parallèles à l'arête, de plus en plus serrés (ordres de grandeur).
const MARCHES = [
  { pas: 4e-4, etendue: 30 }, { pas: 5e-5, etendue: 30 }, { pas: 6e-6, etendue: 30 },
  { pas: 7e-7, etendue: 30 }, { pas: 8e-8, etendue: 30 }, { pas: 1.2e-8, etendue: 20 },
];

function rvb(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
function teinte(c, f) { return `rgb(${c.map((x) => Math.round(Math.min(255, x * f))).join(',')})`; }

function chemin(ctx, pts, P) {
  ctx.beginPath();
  pts.forEach((p, i) => { const q = P(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
  ctx.closePath();
}

// opacite : 0 à 1 ; couleur : couleur du solide (#RRVVBB).
export function dessinerCristaux(ctx, ecran, largeur, opacite, couleur) {
  if (opacite <= 0.002) return;
  const k = ecran.l / largeur;
  const P = (p) => [ecran.l / 2 + p[0] * k, ecran.h / 2 - p[1] * k];
  const c = rvb(couleur);
  ctx.save();
  ctx.globalAlpha = opacite;
  ctx.lineJoin = 'round';
  // Petits cristaux
  for (const g of AUTRES) {
    const ca = Math.cos(g.a), sa = Math.sin(g.a);
    const R = (x, y) => [g.c[0] + (x * ca - y * sa) * g.t, g.c[1] + (x * sa + y * ca) * g.t];
    const dessus = [R(-0.5, 0), R(0.4, 0), R(0.65, 0.35), R(-0.25, 0.35)];
    const avant = [R(-0.5, 0), R(0.4, 0), R(0.35, -0.5), R(-0.55, -0.5)];
    chemin(ctx, avant, P); ctx.fillStyle = teinte(c, 0.78); ctx.fill();
    chemin(ctx, dessus, P); ctx.fillStyle = teinte(c, 1.05); ctx.fill();
    ctx.strokeStyle = teinte(c, 0.55); ctx.lineWidth = 1;
    chemin(ctx, avant, P); ctx.stroke(); chemin(ctx, dessus, P); ctx.stroke();
  }
  // Cristal principal
  const faces = [['cote', 0.66], ['avant', 0.8], ['dessus', 1.06]];
  for (const [nom, f] of faces) { chemin(ctx, PRINCIPAL[nom], P); ctx.fillStyle = teinte(c, f); ctx.fill(); }
  // Marches de croissance sur les deux faces, parallèles à l'arête ; visibles quand leur écart à l'écran
  // vaut de 6 à 400 pixels.
  for (const [nom, signe] of [['dessus', 1], ['avant', -1]]) {
    ctx.save();
    chemin(ctx, PRINCIPAL[nom], P);
    ctx.clip();
    for (const m of MARCHES) {
      const px = m.pas * k;
      if (px < 5 || px > 600) continue;
      const a = Math.min(1, (px - 5) / 15) * Math.min(1, (600 - px) / 300);
      ctx.strokeStyle = `rgba(${c.map((x) => Math.round(x * 0.5)).join(',')},${0.35 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= m.etendue; i++) {
        const v = signe * i * m.pas * (1 + 0.23 * Math.sin(i * 1.7));
        const L = m.pas * m.etendue * (1.2 + 0.4 * Math.sin(i));
        const a0 = P([-L, v]), a1 = P([L * 0.8, v]);
        ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = teinte(c, 0.5);
  ctx.lineWidth = 1.2;
  for (const nom of ['avant', 'dessus', 'cote']) { chemin(ctx, PRINCIPAL[nom], P); ctx.stroke(); }
  ctx.restore();
}

// Encart : tube à essai. etat : { couleur, flamme (0 à 1), buee (0 à 1), gouttes (0 à 1), temperature (°C ou null), chaud }
export function dessinerTube(ctx, w, h, etat, fond) {
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, w, h);
  const cx = w * 0.42, haut = h * 0.08, bas = h * 0.72, r = Math.min(w * 0.13, h * 0.12);
  // Flamme
  if (etat.flamme > 0.01) {
    ctx.save();
    ctx.globalAlpha = etat.flamme;
    const fy = bas + r + 4;
    const g = ctx.createLinearGradient(0, fy + h * 0.2, 0, fy);
    g.addColorStop(0, 'rgba(40,90,220,0.9)'); g.addColorStop(1, 'rgba(250,170,40,0.85)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, fy + h * 0.2);
    ctx.quadraticCurveTo(cx - r * 0.8, fy + h * 0.05, cx, fy - 2);
    ctx.quadraticCurveTo(cx + r * 0.8, fy + h * 0.05, cx + r * 0.7, fy + h * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Cristaux au fond du tube
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - r, haut); ctx.lineTo(cx - r, bas); ctx.arc(cx, bas, r, Math.PI, 0, true); ctx.lineTo(cx + r, haut);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(cx - r, haut, 2 * r, bas + r - haut);
  ctx.fillStyle = etat.couleur;
  ctx.fillRect(cx - r, bas - r * 0.9, 2 * r, 2 * r);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 9; i++) {
    const x = cx - r + ((i * 37) % 19) / 19 * 2 * r, y = bas - r * 0.8 + ((i * 23) % 13) / 13 * r * 1.4;
    ctx.strokeRect(x, y, r * 0.35, r * 0.25);
  }
  // Buée et gouttelettes sur la paroi, au-dessus des cristaux
  if (etat.buee > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${0.55 * etat.buee})`;
    ctx.fillRect(cx - r, haut + (bas - haut) * 0.25, 2 * r, (bas - haut) * 0.45);
    ctx.fillStyle = `rgba(120,160,210,${0.8 * etat.buee})`;
    for (let i = 0; i < 12; i++) {
      const x = cx - r + 3 + ((i * 41) % 17) / 17 * (2 * r - 6), y = haut + (bas - haut) * (0.3 + ((i * 29) % 11) / 11 * 0.38);
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Eau ajoutée
  if (etat.gouttes > 0.01) {
    ctx.fillStyle = `rgba(90,150,230,${0.35 * etat.gouttes})`;
    ctx.fillRect(cx - r, bas - r * 1.2, 2 * r, r * 0.4);
  }
  ctx.restore();
  // Paroi du tube
  ctx.strokeStyle = '#5A6878';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - r, haut); ctx.lineTo(cx - r, bas); ctx.arc(cx, bas, r, Math.PI, 0, true); ctx.lineTo(cx + r, haut);
  ctx.stroke();
  // Température (texte) et « chaud »
  ctx.fillStyle = '#26323F';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (etat.temperature !== null && etat.temperature !== undefined) ctx.fillText(`≈ ${Math.round(etat.temperature / 5) * 5} °C`, cx + r + 6, h * 0.42);
  if (etat.chaud) { ctx.fillStyle = '#B03A1E'; ctx.fillText('chaud', cx + r + 6, h * 0.62); }
}
