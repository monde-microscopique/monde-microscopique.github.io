// Affichage de secours en dessin 2D (canvas), quand la 3D (WebGL) est désactivée.
// Même interface que Rendu (rendu.js) : la scène ne voit pas la différence.
// Chaque sphère est un disque ombré (image préparée une fois par couleur), dessiné de l'arrière vers l'avant.

const TAILLE_SPRITE = 96;

function spriteSphere(rvb) {
  const c = document.createElement('canvas');
  c.width = c.height = TAILLE_SPRITE;
  const ctx = c.getContext('2d');
  const r = TAILLE_SPRITE / 2;
  const [R, V, B] = rvb.map((x) => Math.round(x * 255));
  const g = ctx.createRadialGradient(r * 0.62, r * 0.55, r * 0.05, r, r, r);
  const clair = (f) => `rgb(${Math.min(255, Math.round(R * f + 70 * (f - 1) + 40))},${Math.min(255, Math.round(V * f + 40))},${Math.min(255, Math.round(B * f + 40))})`;
  g.addColorStop(0, clair(1.25));
  g.addColorStop(0.45, `rgb(${R},${V},${B})`);
  g.addColorStop(0.85, `rgb(${Math.round(R * 0.6)},${Math.round(V * 0.6)},${Math.round(B * 0.6)})`);
  g.addColorStop(1, `rgb(${Math.round(R * 0.45)},${Math.round(V * 0.45)},${Math.round(B * 0.45)})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(r, r, r - 0.5, 0, Math.PI * 2); ctx.fill();
  return c;
}

class Lot2D {
  constructor(spheres) {
    this.spheres = spheres;
    this.n = spheres.length;
    this.etats = spheres.map(() => [0, 0, 0]);
    this.visible = true;
  }
  definirEtats(etats) { this.etats = etats.map((e) => e.slice()); }
}

export class Rendu2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D indisponible');
    this.mode2d = true;
    this.profondeurExacte = false;
    this.lots = [];
    this.sprites = new Map();
    this.etiquettes = new Map(); // sphère → { texte, fondu }
    this.ecran = { l: 1, h: 1, dpr: 1 };
  }

  creerLot(spheres) {
    const lot = new Lot2D(spheres);
    for (const s of spheres) {
      const cle = s.couleur.join(',');
      if (!this.sprites.has(cle)) this.sprites.set(cle, spriteSphere(s.couleur));
    }
    this.lots.push(lot);
    return lot;
  }

  creerAtlas() { /* inutile en 2D : le texte est dessiné directement */ }

  creerEtiquettes(items) {
    this.listeEtiquettes = items.map((it) => {
      const e = { texte: it.texte, fondu: 0 };
      this.etiquettes.set(it.sphere, e);
      return e;
    });
  }

  fondreEtiquettes(fondus) {
    fondus.forEach((f, i) => { this.listeEtiquettes[i].fondu = f; });
  }

  redimensionner(l, h, dpr) {
    const w = Math.round(l * dpr), hh = Math.round(h * dpr);
    if (this.canvas.width !== w || this.canvas.height !== hh) { this.canvas.width = w; this.canvas.height = hh; }
    this.ecran = { l, h, dpr };
  }

  dessiner(vue) {
    const { ctx } = this;
    const { l, h, dpr } = this.ecran;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, l, h);
    const { droite, haut, avant } = vue.base;
    const [cx, cy, cz] = vue.centrePm;
    const k = vue.pxParPm, t = vue.temps, A = vue.amp;
    const fond = `rgb(${vue.fond.map((v) => Math.round(v * 255)).join(',')})`;
    const liste = [];
    for (const lot of this.lots) {
      if (!lot.visible) continue;
      for (let i = 0; i < lot.n; i++) {
        const s = lot.spheres[i];
        const e = lot.etats[i];
        if (e[0] >= 0.98) continue;
        const dx = s.pos[0] + A * Math.sin(t * 5.1 + s.phase[0]) - cx;
        const dy = s.pos[1] + A * Math.sin(t * 4.3 + s.phase[1]) - cy;
        const dz = s.pos[2] + A * Math.sin(t * 5.9 + s.phase[2]) - cz;
        const r = s.rayon * vue.facteur * k;
        if (r < 0.3) continue;
        const x = l / 2 + (dx * droite[0] + dy * droite[1] + dz * droite[2]) * k;
        const y = h / 2 - (dx * haut[0] + dy * haut[1] + dz * haut[2]) * k;
        if (x < -r || x > l + r || y < -r || y > h + r) continue;
        liste.push({ x, y, z: dx * avant[0] + dy * avant[1] + dz * avant[2], r, s, e });
      }
    }
    liste.sort((a, b) => b.z - a.z);
    const police = 'bold 1px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
    for (const p of liste) {
      ctx.globalAlpha = 1 - p.e[0];
      ctx.drawImage(this.sprites.get(p.s.couleur.join(',')), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      const b = vue.brume || [0, 1, 0];
      const tb = Math.min(1, Math.max(0, (p.z - b[0]) / (b[1] - b[0])));
      const brume = tb * tb * (3 - 2 * tb) * b[2];
      const voile = 1 - (1 - p.e[1]) * (1 - brume);
      if (voile > 0.01) {
        ctx.globalAlpha = (1 - p.e[0]) * voile;
        ctx.fillStyle = fond;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (p.e[2] > 0.5) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#141420';
        ctx.lineWidth = Math.max(2, p.r * 0.14);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.92, 0, Math.PI * 2); ctx.stroke();
      }
      const et = this.etiquettes.get(p.s);
      if (et && vue.opaciteEtiquettes > 0.01 && p.r >= 9) {
        ctx.globalAlpha = vue.opaciteEtiquettes * (1 - et.fondu) * (1 - p.e[0]);
        const taille = Math.min(30, Math.max(13, p.r * 0.9)) * 0.7;
        ctx.font = police.replace('1px', `${taille}px`);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = taille * 0.2;
        ctx.strokeStyle = 'rgba(20,20,30,0.9)';
        ctx.strokeText(et.texte, p.x, p.y);
        ctx.fillStyle = '#fff';
        ctx.fillText(et.texte, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
  }
}
