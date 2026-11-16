// Zoom dans l'ion (fiche NaCl v0.3) : schéma de Bohr (standard) ou nuage électronique (avancé),
// le vide, puis le noyau à sa vraie taille.
// Conventions du schéma de Bohr reprises de l'outil de Roger « Lire le tableau périodique » :
// couches aux rayons 62, 98, 134, 168 ; 4 positions par couche (1 pour la couche K) ; électrons
// d'abord seuls, puis en paires ; noyau en boule annotée (p⁺, n⁰), ou nucléon par nucléon de près.
// Dessin 2D dans une couche au-dessus des ions ; positions calculées en double précision.

import { lisse } from '../../moteur/vec.js';

const log10 = Math.log10;
const RAYONS = [62, 98, 134, 168];
const POSITIONS = [1, 4, 4, 4];
const COUL = { proton: '#A8412D', neutron: '#7C8C8E', electron: '#0B6E7A', couche: '#AAB6B4', encre: '#4B5B5E', boule: '#E7EDEB' };

// Remplissage des positions d'une couche : un électron par position, puis des paires.
export function positionsElectrons(n, positions) {
  const b = new Array(positions).fill(0);
  let reste = n;
  for (let i = 0; i < positions && reste > 0; i++) { b[i] = 1; reste--; }
  for (let i = 0; i < positions && reste > 0; i++) { b[i] = 2; reste--; }
  return b;
}

// Opacités des représentations selon la largeur du champ W (m).
export function fondusAtome(W, avance = false) {
  const lw = log10(W);
  const apparition = lisse(log10(4e-10), log10(2.5e-10), lw);
  return {
    boule: 1 - lisse(log10(4e-10), log10(2.2e-10), lw),        // la boule de l'ion s'efface
    // Le schéma de Bohr n'est pas à l'échelle : il s'efface quand commence le vide. Le nuage (avancé) reste.
    schema: avance ? apparition : apparition * (1 - lisse(log10(1.2e-10), log10(6e-11), lw)),
    repere: lisse(log10(1.2e-10), log10(6e-11), lw) * (1 - lisse(log10(3e-13), log10(1.2e-13), lw)),
    noyau: lisse(log10(3e-13), log10(1.2e-13), lw),
  };
}

// ion : { centre (m), rayonAffiche (m), espece : données de l'espèce }.
export function dessinerAtome(ctx, camera, ion, options) {
  const W = camera.largeur;
  const f = fondusAtome(W, options.avance);
  const k = camera.pxParMetre;
  const c = camera.projeter(ion.centre);
  const e = ion.espece;
  const R = ion.rayonAffiche * k; // rayon de la couche externe du schéma, en px
  ctx.save();

  if (f.schema > 0.01) {
    if (options.avance) dessinerNuage(ctx, camera, c, R, f.schema);
    // Le schéma de Bohr n'est pas à l'échelle : il est limité à la taille de l'écran, pour rester entier
    // sur un écran bas (portable) et quand l'ion est dessiné à sa vraie taille (temps 2).
    else dessinerBohr(ctx, c, Math.min(R, 0.36 * Math.min(camera.ecran.l, camera.ecran.h)), e, f.schema);
  }

  // Le noyau à sa vraie taille : invisible tant qu'il fait moins de quelques pixels ; un repère montre où il est.
  const rn = e.noyau.rayon_fm * 1e-15 * k;
  if (f.repere > 0.01 && rn < 3) {
    ctx.globalAlpha = f.repere;
    ctx.strokeStyle = '#C0392B';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x - 18, c.y); ctx.lineTo(c.x - 12, c.y); ctx.moveTo(c.x + 12, c.y); ctx.lineTo(c.x + 18, c.y);
    ctx.moveTo(c.x, c.y - 18); ctx.lineTo(c.x, c.y - 12); ctx.moveTo(c.x, c.y + 12); ctx.lineTo(c.x, c.y + 18);
    ctx.stroke();
    ctx.fillStyle = '#C0392B';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(options.texteRepere, c.x + 24, c.y);
    ctx.globalAlpha = 1;
  }
  if (f.noyau > 0.01 && rn >= 0.5) dessinerNoyau(ctx, c, rn, e.noyau, f.noyau);
  ctx.restore();
}

function dessinerBohr(ctx, c, R, e, opacite) {
  const couches = e.couches;
  const echelle = R / RAYONS[couches.length - 1];
  const rayonElectron = Math.max(4, Math.min(9, 5.5 * echelle));
  ctx.globalAlpha = opacite;
  couches.forEach((n, i) => {
    const r = RAYONS[i] * echelle;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COUL.couche;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
    if (i === couches.length - 1) { // couche externe soulignée, comme dans l'outil de Roger
      ctx.save();
      ctx.globalAlpha = opacite * 0.55;
      ctx.lineWidth = 3;
      ctx.strokeStyle = COUL.electron;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const remplis = positionsElectrons(n, POSITIONS[i]);
    remplis.forEach((nb, s) => {
      const angle = -Math.PI / 2 + (s * 2 * Math.PI) / POSITIONS[i];
      const ecart = nb === 2 ? 10 / RAYONS[i] : 0;
      for (let j = 0; j < nb; j++) {
        const a = angle + (nb === 2 ? (j === 0 ? -ecart : ecart) : 0);
        ctx.fillStyle = COUL.electron;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x + r * Math.cos(a), c.y + r * Math.sin(a), rayonElectron, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    });
  });
  // Noyau du schéma (pas à l'échelle) : boule annotée, convention d'épreuve.
  const rr = 44.8 * echelle;
  ctx.fillStyle = COUL.boule;
  ctx.strokeStyle = COUL.encre;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const fs = Math.min(rr * 0.46, 34);
  if (fs >= 7) {
    ctx.font = `600 ${fs}px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COUL.proton;
    ctx.fillText(`${e.noyau.protons} p⁺`, c.x, c.y - fs * 0.15);
    ctx.fillStyle = COUL.encre;
    ctx.fillText(`${e.noyau.neutrons} n⁰`, c.x, c.y + fs * 1.05);
  }
  ctx.globalAlpha = 1;
}

function dessinerNuage(ctx, camera, c, R, opacite) {
  // Nuage électronique : densité la plus forte près du noyau, très diluée vers l'extérieur.
  const rMax = Math.max(R * 1.25, 1);
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rMax);
  g.addColorStop(0, rgba(COUL.electron, 0.30 * opacite));
  g.addColorStop(0.35, rgba(COUL.electron, 0.16 * opacite));
  g.addColorStop(0.75, rgba(COUL.electron, 0.06 * opacite));
  g.addColorStop(1, rgba(COUL.electron, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, camera.ecran.l, camera.ecran.h);
}

// Noyau à sa vraie taille : boule annotée (p⁺, n⁰) ; de très près, les nucléons un à un.
function dessinerNoyau(ctx, c, rn, noyau, opacite) {
  const detail = lisse(120, 220, rn);
  if (detail < 0.99) {
    ctx.globalAlpha = opacite * (1 - detail);
    ctx.fillStyle = COUL.boule;
    ctx.strokeStyle = COUL.encre;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, rn, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const fs = Math.min(28, rn * 0.42);
    if (fs >= 8) {
      ctx.font = `600 ${fs}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = COUL.proton;
      ctx.fillText(`${noyau.protons} p⁺`, c.x, c.y - fs * 0.15);
      ctx.fillStyle = COUL.encre;
      ctx.fillText(`${noyau.neutrons} n⁰`, c.x, c.y + fs * 1.05);
    }
  }
  if (detail > 0.01) {
    // Nucléons en empilement compact (vue à plat), protons et neutrons alternés.
    const A = noyau.protons + noyau.neutrons;
    const r = rn / (Math.sqrt(A) * 1.05);
    const pos = [];
    for (let q = -7; q <= 7; q++) for (let s = -7; s <= 7; s++) {
      const x = 2 * r * (q + s / 2), y = 2 * r * (s * Math.sqrt(3) / 2);
      pos.push({ x, y, d: x * x + y * y });
    }
    pos.sort((a, b) => a.d - b.d);
    let np = noyau.protons, nn = noyau.neutrons;
    ctx.globalAlpha = opacite * detail;
    for (let i = 0; i < A; i++) {
      const estProton = np > 0 && nn > 0 ? i % 2 === 0 : np > 0;
      if (estProton) np--; else nn--;
      ctx.fillStyle = estProton ? COUL.proton : COUL.neutron;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.arc(c.x + pos[i].x, c.y + pos[i].y, r * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Légende
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const x0 = c.x + rn + 18, y0 = c.y - 12;
    ctx.fillStyle = COUL.proton; ctx.beginPath(); ctx.arc(x0, y0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(`${noyau.protons} protons (p⁺)`, x0 + 12, y0);
    ctx.fillStyle = COUL.neutron; ctx.beginPath(); ctx.arc(x0, y0 + 24, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COUL.encre;
    ctx.fillText(`${noyau.neutrons} neutrons (n⁰)`, x0 + 12, y0 + 24);
  }
  ctx.globalAlpha = 1;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
