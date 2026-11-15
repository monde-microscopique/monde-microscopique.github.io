// Zoom dans l'ion (fiche NaCl v0.3) : schéma de Bohr (standard) ou nuage électronique (avancé),
// le vide, puis le noyau dessiné comme une boule annotée (convention du polycopié).
// Dessin 2D dans une couche au-dessus des ions ; toutes les positions sont calculées en double précision.

import { lisse } from '../../moteur/vec.js';

const log10 = Math.log10;

// Opacités des représentations selon la largeur du champ W (m).
export function fondusAtome(W) {
  const lw = log10(W);
  return {
    boule: 1 - lisse(log10(4e-10), log10(2.2e-10), lw),       // la boule de l'ion s'efface
    schema: lisse(log10(4e-10), log10(2.5e-10), lw),          // schéma de Bohr ou nuage
    repere: lisse(log10(1.2e-10), log10(5e-11), lw) * (1 - lisse(log10(3e-13), log10(1.2e-13), lw)), // « le noyau est ici »
    noyau: lisse(log10(3e-13), log10(1.2e-13), lw),           // le noyau devient visible
  };
}

// ion : { centre (m), rayonAffiche (m), espece : données de l'espèce }, ecran : { l, h }.
export function dessinerAtome(ctx, camera, ion, options) {
  const W = camera.largeur;
  const f = fondusAtome(W);
  const k = camera.pxParMetre;
  const c = camera.projeter(ion.centre);
  const e = ion.espece;
  const R = ion.rayonAffiche * k; // rayon du schéma, en px
  ctx.save();

  if (f.schema > 0.01) {
    if (options.avance) {
      // Nuage électronique : densité la plus forte près du noyau, très diluée vers l'extérieur.
      const rMax = Math.max(R * 1.25, 1);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rMax);
      const coul = e.couleur;
      g.addColorStop(0, hexAlpha(coul, 0.26 * f.schema));
      g.addColorStop(0.35, hexAlpha(coul, 0.14 * f.schema));
      g.addColorStop(0.75, hexAlpha(coul, 0.05 * f.schema));
      g.addColorStop(1, hexAlpha(coul, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, camera.ecran.l, camera.ecran.h);
    } else {
      // Schéma de Bohr : une couche par cercle, électrons répartis régulièrement (choix provisoire).
      const couches = e.couches;
      ctx.globalAlpha = f.schema;
      couches.forEach((n, i) => {
        const r = (R * (i + 1)) / couches.length;
        if (r > Math.hypot(camera.ecran.l, camera.ecran.h) * 2) return;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(70,86,104,0.8)';
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
        for (let q = 0; q < n; q++) {
          const a = -Math.PI / 2 + (q * 2 * Math.PI) / n + i * 0.2;
          const x = c.x + r * Math.cos(a), y = c.y + r * Math.sin(a);
          if (x < -10 || y < -10 || x > camera.ecran.l + 10 || y > camera.ecran.h + 10) continue;
          ctx.fillStyle = '#1f4e9e';
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('−', x, y + 0.5);
        }
      });
      ctx.globalAlpha = 1;
    }
  }

  // Le noyau à sa vraie taille : invisible tant qu'il fait moins d'un pixel ; un repère montre où il est.
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
  if (f.noyau > 0.01 && rn >= 0.5) {
    ctx.globalAlpha = f.noyau;
    const g = ctx.createRadialGradient(c.x - rn * 0.35, c.y - rn * 0.35, rn * 0.05, c.x, c.y, rn);
    g.addColorStop(0, '#f2c4bd'); g.addColorStop(0.5, '#c0645a'); g.addColorStop(1, '#7a2f28');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, rn, 0, Math.PI * 2); ctx.fill();
    if (rn > 40) {
      const t = Math.max(11, Math.min(26, rn * 0.2));
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${t}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${e.noyau.protons} protons`, c.x, c.y - t * 0.7);
      ctx.fillText(`${e.noyau.neutrons} neutrons`, c.x, c.y + t * 0.7);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
