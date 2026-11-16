// Affichage de secours en dessin 2D (canvas), quand la 3D (WebGL) est désactivée.
// Même interface que Rendu (rendu.js) : la scène ne voit pas la différence.
// Sphères : disques ombrés (image préparée une fois par couleur) ; bâtons : traits épais ;
// le tout dessiné de l'arrière vers l'avant.

const TAILLE_SPRITE = 96;

function spriteSphere(rvb) {
  const c = document.createElement('canvas');
  c.width = c.height = TAILLE_SPRITE;
  const ctx = c.getContext('2d');
  const r = TAILLE_SPRITE / 2;
  const [R, V, B] = rvb.map((x) => Math.round(x * 255));
  const g = ctx.createRadialGradient(r * 0.62, r * 0.55, r * 0.05, r, r, r);
  const clair = (v) => Math.min(255, Math.round(v * 1.25 + 40));
  g.addColorStop(0, `rgb(${clair(R)},${clair(V)},${clair(B)})`);
  g.addColorStop(0.45, `rgb(${R},${V},${B})`);
  g.addColorStop(0.85, `rgb(${Math.round(R * 0.6)},${Math.round(V * 0.6)},${Math.round(B * 0.6)})`);
  g.addColorStop(1, `rgb(${Math.round(R * 0.45)},${Math.round(V * 0.45)},${Math.round(B * 0.45)})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(r, r, r - 0.5, 0, Math.PI * 2); ctx.fill();
  return c;
}

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

class Lot2D {
  constructor(spheres, dynamique) {
    this.spheres = spheres;
    this.n = spheres.length;
    this.dynamique = dynamique;
    this.positions = new Float32Array(this.n * 3);
    spheres.forEach((s, i) => this.positions.set(s.pos, i * 3));
    this.etats = spheres.map(() => [0, 0, 0]);
    this.visible = true;
  }
  majPositions(p) { if (p !== this.positions) this.positions.set(p); }
  definirEtats(etats) { this.etats = etats.map((e) => e.slice()); }
}

class Batons2D {
  constructor(batons, dynamique) {
    this.batons = batons;
    this.n = batons.length;
    this.dynamique = dynamique;
    this.extremites = new Float32Array(this.n * 6);
    batons.forEach((b, i) => { this.extremites.set(b.a, i * 6); this.extremites.set(b.b, i * 6 + 3); });
    this.fondus = new Float32Array(this.n);
    this.visible = true;
  }
  majPositions(e) { if (e !== this.extremites) this.extremites.set(e); }
  definirFondus(f) { this.fondus.set(f); }
}

class Etiquettes2D {
  constructor(lot, items) {
    this.lot = lot;
    this.items = items;
    this.n = items.length;
    this.fondus = new Float32Array(this.n);
    this.visible = true;
    this.opacite = 1;
    this.seuil = 9;
    this.parIndice = new Map(items.map((it, k) => [it.index, k]));
  }
  fondre(f) { this.fondus.set(f); }
}

export class Rendu2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D indisponible');
    this.mode2d = true;
    this.profondeurExacte = false;
    this.lots = [];
    this.lotsBatons = [];
    this.jeuxEtiquettes = [];
    this.sprites = new Map();
    this.ecran = { l: 1, h: 1, dpr: 1 };
  }

  creerLot(spheres, options = {}) {
    const lot = new Lot2D(spheres, !!options.dynamique);
    for (const s of spheres) {
      const cle = s.couleur.join(',');
      if (!this.sprites.has(cle)) this.sprites.set(cle, spriteSphere(s.couleur));
    }
    this.lots.push(lot);
    return lot;
  }

  creerBatons(batons, options = {}) {
    const lot = new Batons2D(batons, !!options.dynamique);
    this.lotsBatons.push(lot);
    return lot;
  }

  creerAtlas() { /* inutile en 2D : le texte est dessiné directement */ }

  creerEtiquettes(lot, items) {
    const jeu = new Etiquettes2D(lot, items);
    this.jeuxEtiquettes.push(jeu);
    return jeu;
  }

  definirBoite(min, max, teinte = [0.25, 0.45, 0.85, 0.13]) {
    this.boite = min ? { min, max, teinte } : null;
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
    const fond = rgb(vue.fond);
    const b = vue.brume || [0, 1, 0];
    const brume = (z) => { const u = Math.min(1, Math.max(0, (z - b[0]) / (b[1] - b[0]))); return u * u * (3 - 2 * u) * b[2]; };
    const proj = (x, y, z, ph) => {
      const dx = x + (ph ? A * Math.sin(t * 5.1 + ph[0]) : 0) - cx;
      const dy = y + (ph ? A * Math.sin(t * 4.3 + ph[1]) : 0) - cy;
      const dz = z + (ph ? A * Math.sin(t * 5.9 + ph[2]) : 0) - cz;
      return [l / 2 + (dx * droite[0] + dy * droite[1] + dz * droite[2]) * k, h / 2 - (dx * haut[0] + dy * haut[1] + dz * haut[2]) * k, dx * avant[0] + dy * avant[1] + dz * avant[2]];
    };
    const liste = [];
    for (const lot of this.lots) {
      if (!lot.visible) continue;
      const jeux = this.jeuxEtiquettes.filter((j) => j.lot === lot && j.visible && j.opacite > 0.01);
      for (let i = 0; i < lot.n; i++) {
        const s = lot.spheres[i];
        const e = lot.etats[i];
        if (e[0] >= 0.98) continue;
        const r = s.rayon * vue.facteur * k;
        if (r < 0.3) continue;
        const p = lot.positions;
        const [x, y, z] = proj(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], s.phase);
        if (x < -r || x > l + r || y < -r || y > h + r) continue;
        liste.push({ type: 's', x, y, z, r, s, e, i, jeux });
      }
    }
    for (const lot of this.lotsBatons) {
      if (!lot.visible) continue;
      for (let i = 0; i < lot.n; i++) {
        if (lot.fondus[i] >= 0.98) continue;
        const bt = lot.batons[i], ex = lot.extremites;
        const a = proj(ex[i * 6], ex[i * 6 + 1], ex[i * 6 + 2], bt.phase);
        const c = proj(ex[i * 6 + 3], ex[i * 6 + 4], ex[i * 6 + 5], bt.phase);
        liste.push({ type: 'b', a, c, z: (a[2] + c[2]) / 2 + 1e-3, r: bt.rayon * (vue.facteurBaton ?? 1) * k, bt, f: lot.fondus[i] });
      }
    }
    liste.sort((p, q) => q.z - p.z);
    const police = 'bold 1px system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
    for (const p of liste) {
      if (p.type === 'b') {
        const voile = brume(p.z);
        ctx.globalAlpha = 1 - p.f;
        ctx.lineWidth = Math.max(1, p.r * 2);
        ctx.lineCap = 'butt';
        const mx = (p.a[0] + p.c[0]) / 2, my = (p.a[1] + p.c[1]) / 2;
        ctx.strokeStyle = rgb(p.bt.couleurA.map((v, q) => v + (vue.fond[q] - v) * voile));
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(mx, my); ctx.stroke();
        ctx.strokeStyle = rgb(p.bt.couleurB.map((v, q) => v + (vue.fond[q] - v) * voile));
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(p.c[0], p.c[1]); ctx.stroke();
        continue;
      }
      ctx.globalAlpha = 1 - p.e[0];
      ctx.drawImage(this.sprites.get(p.s.couleur.join(',')), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      const voile = 1 - (1 - p.e[1]) * (1 - brume(p.z));
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
      for (const jeu of p.jeux) {
        const kk = jeu.parIndice.get(p.i);
        if (kk === undefined || p.r < jeu.seuil) continue;
        ctx.globalAlpha = jeu.opacite * (1 - jeu.fondus[kk]) * (1 - p.e[0]);
        if (ctx.globalAlpha < 0.01) continue;
        const texte = jeu.items[kk].texte;
        const taille = Math.min(30, Math.max(13, p.r * 0.9)) * 0.7;
        ctx.font = police.replace('1px', `${taille}px`);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = taille * 0.2;
        ctx.strokeStyle = 'rgba(20,20,30,0.9)';
        ctx.strokeText(texte, p.x, p.y);
        ctx.fillStyle = '#fff';
        ctx.fillText(texte, p.x, p.y);
      }
    }
    // Maille : faces translucides dessinées par-dessus (approximation du rendu 3D), sans trait.
    if (this.boite) {
      const { min, max, teinte } = this.boite;
      const P = [];
      for (const z of [min[2], max[2]]) for (const y of [min[1], max[1]]) for (const x of [min[0], max[0]]) P.push(proj(x, y, z, null));
      const faces = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
      ctx.fillStyle = rgb(teinte.slice(0, 3));
      ctx.globalAlpha = teinte[3];
      for (const f of faces) {
        ctx.beginPath();
        f.forEach((i, n) => (n ? ctx.lineTo(P[i][0], P[i][1]) : ctx.moveTo(P[i][0], P[i][1])));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
