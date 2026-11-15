// Rendu WebGL1 des sphères (atomes, ions) et de leurs étiquettes.
// Chaque sphère est un carré de deux triangles ; le fragment shader calcule la sphère (« imposteur »).
// Coordonnées en picomètres (pm), relatives à l'origine de la scène.
// La vibration est calculée dans le vertex shader : les tampons restent fixes tant que rien ne change.

const VS_SPHERE = `
attribute vec3 aCentre;
attribute vec2 aCoin;
attribute float aRayon;
attribute vec3 aCouleur;
attribute vec3 aPhase;
attribute vec3 aEtat;
uniform vec3 uDroite, uHaut, uAvant, uCentre;
uniform float uEchelle, uProf, uFacteur, uTemps, uAmp;
uniform vec2 uEcran;
varying vec2 vUV;
varying float vZ, vR, vRpx;
varying vec3 vCouleur, vEtat;
void main() {
  vec3 vib = uAmp * vec3(sin(uTemps * 5.1 + aPhase.x), sin(uTemps * 4.3 + aPhase.y), sin(uTemps * 5.9 + aPhase.z));
  vec3 d = aCentre + vib - uCentre;
  float r = aRayon * uFacteur;
  float rpx = max(r * uEchelle, 0.5);
  float marge = 1.5;
  vec2 p = vec2(dot(d, uDroite), dot(d, uHaut)) * uEchelle + aCoin * (rpx + marge);
  float z = dot(d, uAvant);
  gl_Position = vec4(p * 2.0 / uEcran, z / uProf, 1.0);
  vUV = aCoin * (rpx + marge) / rpx;
  vZ = z; vR = r; vRpx = rpx;
  vCouleur = aCouleur; vEtat = aEtat;
}`;

const FS_SPHERE = (profondeur) => `
${profondeur ? '#extension GL_EXT_frag_depth : enable' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uFond;
uniform vec3 uBrume;
uniform float uProf;
varying vec2 vUV;
varying float vZ, vR, vRpx;
varying vec3 vCouleur, vEtat;
void main() {
  float r = length(vUV);
  float px = 1.0 / vRpx;
  float a = 1.0 - smoothstep(1.0 - px, 1.0 + px, r);
  a *= 1.0 - vEtat.x;
  if (a < 0.02) discard;
  float rc = min(r, 1.0);
  vec3 n = vec3(vUV / max(r, 1.0), sqrt(max(1.0 - rc * rc, 0.0)));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  vec3 c = vCouleur * (0.42 + 0.62 * diff) + vec3(0.28) * spec;
  c = mix(c, c * 0.55, smoothstep(0.78, 1.0, r));
  // Indice de profondeur : les sphères du fond pâlissent un peu, le relief se lit même sans bouger.
  c = mix(c, uFond, smoothstep(uBrume.x, uBrume.y, vZ) * uBrume.z);
  c = mix(c, uFond, vEtat.y);
  if (vEtat.z > 0.5) {
    float anneau = smoothstep(0.80, 0.86, r);
    c = mix(c, vec3(0.08, 0.08, 0.12), anneau);
  }
  gl_FragColor = vec4(c * a, a);
  ${profondeur ? 'gl_FragDepthEXT = clamp(((vZ - vR * n.z) / uProf) * 0.5 + 0.5, 0.0, 1.0);' : ''}
}`;

const VS_ETIQ = `
attribute vec3 aCentre;
attribute vec2 aCoin;
attribute float aRayon;
attribute vec3 aPhase;
attribute vec4 aUV;
attribute float aRapport;
attribute float aFondu;
uniform vec3 uDroite, uHaut, uAvant, uCentre;
uniform float uEchelle, uProf, uFacteur, uTemps, uAmp;
uniform vec2 uEcran;
varying vec2 vTex;
varying float vFondu;
void main() {
  vec3 vib = uAmp * vec3(sin(uTemps * 5.1 + aPhase.x), sin(uTemps * 4.3 + aPhase.y), sin(uTemps * 5.9 + aPhase.z));
  vec3 d = aCentre + vib - uCentre;
  float r = aRayon * uFacteur;
  float rpx = r * uEchelle;
  float h = clamp(rpx * 0.9, 13.0, 30.0);
  vec2 p = vec2(dot(d, uDroite), dot(d, uHaut)) * uEchelle + aCoin * vec2(h * aRapport, h) * 0.5;
  float z = (dot(d, uAvant) - r * 1.05) / uProf;
  gl_Position = rpx < 9.0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p * 2.0 / uEcran, z, 1.0);
  vTex = vec2(mix(aUV.x, aUV.z, aCoin.x * 0.5 + 0.5), mix(aUV.w, aUV.y, aCoin.y * 0.5 + 0.5));
  vFondu = aFondu;
}`;

const FS_ETIQ = `
precision mediump float;
uniform sampler2D uAtlas;
uniform float uOpacite;
varying vec2 vTex;
varying float vFondu;
void main() {
  vec4 t = texture2D(uAtlas, vTex);
  float k = uOpacite * (1.0 - vFondu);
  if (t.a * k < 0.01) discard;
  gl_FragColor = t * k; // texture déjà prémultipliée
}`;

// Volume translucide (maille) : faces teintées, aucun trait.
const VS_BOITE = `
attribute vec3 aPos;
uniform vec3 uDroite, uHaut, uAvant, uCentre;
uniform float uEchelle, uProf;
uniform vec2 uEcran;
void main() {
  vec3 d = aPos - uCentre;
  vec2 p = vec2(dot(d, uDroite), dot(d, uHaut)) * uEchelle;
  gl_Position = vec4(p * 2.0 / uEcran, dot(d, uAvant) / uProf, 1.0);
}`;
const FS_BOITE = `
precision mediump float;
uniform vec4 uTeinte;
void main() { gl_FragColor = vec4(uTeinte.rgb * uTeinte.a, uTeinte.a); }`;

function compiler(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('Shader : ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function programme(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compiler(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compiler(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Programme : ' + gl.getProgramInfoLog(p));
  const attributs = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveAttrib(p, i);
    attributs[info.name] = gl.getAttribLocation(p, info.name);
  }
  const uniformes = {};
  const m = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < m; i++) {
    const info = gl.getActiveUniform(p, i);
    uniformes[info.name] = gl.getUniformLocation(p, info.name);
  }
  return { p, attributs, uniformes };
}

const COINS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// Un lot de sphères : tampons statiques (géométrie) + tampon d'état (fondu, atténuation, sélection).
class Lot {
  constructor(gl, spheres) {
    this.gl = gl;
    this.n = spheres.length;
    const STATIQUE = 12; // centre 3, coin 2, rayon 1, couleur 3, phase 3
    const donnees = new Float32Array(this.n * 4 * STATIQUE);
    let o = 0;
    for (const s of spheres) {
      for (const c of COINS) {
        donnees.set([s.pos[0], s.pos[1], s.pos[2], c[0], c[1], s.rayon, s.couleur[0], s.couleur[1], s.couleur[2], s.phase[0], s.phase[1], s.phase[2]], o);
        o += STATIQUE;
      }
    }
    this.statique = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.statique);
    gl.bufferData(gl.ARRAY_BUFFER, donnees, gl.STATIC_DRAW);
    this.etat = new Float32Array(this.n * 4 * 3);
    this.tamponEtat = gl.createBuffer();
    this.majEtat();
    this.positions = spheres.map((s) => s.pos);
    this.tableauIndices = new Uint16Array(this.n * 6);
    this.indices = gl.createBuffer();
    this.dernierAvant = null;
    this.trier([0, 0, 1]);
  }

  // Dessin de l'arrière vers l'avant : les bords adoucis des sphères se mélangent correctement.
  // Refait seulement quand l'orientation change.
  trier(avant) {
    const d = this.dernierAvant;
    if (d && Math.abs(d[0] - avant[0]) + Math.abs(d[1] - avant[1]) + Math.abs(d[2] - avant[2]) < 1e-4) return;
    this.dernierAvant = avant.slice();
    const prof = this.positions.map((p) => p[0] * avant[0] + p[1] * avant[1] + p[2] * avant[2]);
    const ordre = prof.map((_, i) => i).sort((a, b) => prof[b] - prof[a]);
    const t = this.tableauIndices;
    ordre.forEach((i, k) => t.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], k * 6));
    const gl = this.gl;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, t, gl.DYNAMIC_DRAW);
  }

  // etats : tableau de [fondu, attenuation, selection] par sphère.
  definirEtats(etats) {
    for (let i = 0; i < this.n; i++) {
      const e = etats[i];
      for (let k = 0; k < 4; k++) this.etat.set(e, (i * 4 + k) * 3);
    }
    this.majEtat();
  }

  majEtat() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponEtat);
    gl.bufferData(gl.ARRAY_BUFFER, this.etat, gl.DYNAMIC_DRAW);
  }
}

export class Rendu {
  constructor(canvas) {
    const options = { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    if (!gl) throw new Error('WebGL indisponible');
    this.gl = gl;
    this.canvas = canvas;
    const ext = gl.getExtension('EXT_frag_depth');
    this.profondeurExacte = !!ext;
    this.prSphere = programme(gl, VS_SPHERE, FS_SPHERE(!!ext));
    this.prEtiq = programme(gl, VS_ETIQ, FS_ETIQ);
    this.prBoite = programme(gl, VS_BOITE, FS_BOITE);
    this.boite = null;
    this.lots = [];
    this.etiquettes = null;
    this.atlas = null;
  }

  // Boîte (min, max en pm) dessinée en volume translucide, ou null pour l'effacer.
  definirBoite(min, max, teinte = [0.25, 0.45, 0.85, 0.13]) {
    const gl = this.gl;
    if (!min) { this.boite = null; return; }
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    const d = [];
    for (const f of faces) for (const i of [0, 1, 2, 0, 2, 3]) d.push(...P[f[i]]);
    if (!this.boite) this.boite = { tampon: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boite.tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STATIC_DRAW);
    this.boite.n = d.length / 3;
    this.boite.teinte = teinte;
  }

  creerLot(spheres) {
    const lot = new Lot(this.gl, spheres);
    lot.visible = true;
    this.lots.push(lot);
    return lot;
  }

  // Atlas de textures des étiquettes (texte blanc cerné de sombre).
  creerAtlas(textes) {
    const gl = this.gl;
    const c = document.createElement('canvas');
    const H = 64;
    const police = `bold ${H * 0.7}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
    const ctx = c.getContext('2d');
    ctx.font = police;
    const largeurs = textes.map((t) => Math.ceil(ctx.measureText(t).width) + 16);
    // Attention : changer la taille du canvas remet le contexte à zéro (police comprise).
    c.width = 512;
    c.height = H * textes.length;
    const ctx2 = c.getContext('2d');
    ctx2.font = police;
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.lineJoin = 'round';
    const zones = {};
    textes.forEach((t, i) => {
      const w = largeurs[i];
      const y = i * H + H / 2;
      ctx2.lineWidth = 9;
      ctx2.strokeStyle = 'rgba(20,20,30,0.9)';
      ctx2.strokeText(t, w / 2, y + 2);
      ctx2.fillStyle = '#ffffff';
      ctx2.fillText(t, w / 2, y + 2);
      zones[t] = { u0: 0, v0: (i * H) / c.height, u1: w / c.width, v1: ((i + 1) * H) / c.height, rapport: w / H };
    });
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlas = { tex, zones };
  }

  // Étiquettes d'un lot : items = [{ sphere, texte }] (sphere = objet passé à creerLot).
  creerEtiquettes(items) {
    const gl = this.gl;
    const STRIDE = 3 + 2 + 1 + 3 + 4 + 1 + 1;
    const d = new Float32Array(items.length * 4 * STRIDE);
    let o = 0;
    for (const it of items) {
      const z = this.atlas.zones[it.texte];
      const s = it.sphere;
      for (const c of COINS) {
        d.set([s.pos[0], s.pos[1], s.pos[2], c[0], c[1], s.rayon, s.phase[0], s.phase[1], s.phase[2], z.u0, z.v0, z.u1, z.v1, z.rapport, 0], o);
        o += STRIDE;
      }
    }
    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
    const indices = new Uint16Array(items.length * 6);
    for (let i = 0; i < items.length; i++) indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.etiquettes = { tampon, ib, n: items.length, donnees: d, stride: STRIDE };
  }

  // Fondu individuel des étiquettes (même ordre que les items).
  fondreEtiquettes(fondus) {
    const e = this.etiquettes;
    for (let i = 0; i < e.n; i++) for (let k = 0; k < 4; k++) e.donnees[(i * 4 + k) * e.stride + e.stride - 1] = fondus[i];
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, e.tampon);
    gl.bufferData(gl.ARRAY_BUFFER, e.donnees, gl.DYNAMIC_DRAW);
  }

  redimensionner(l, h, dpr) {
    const w = Math.round(l * dpr), hh = Math.round(h * dpr);
    if (this.canvas.width !== w || this.canvas.height !== hh) {
      this.canvas.width = w;
      this.canvas.height = hh;
    }
    this.ecran = { l, h, dpr };
  }

  // vue : { base, centrePm, pxParPm, temps, amp, facteur, fond:[r,g,b], opaciteEtiquettes, profondeurPm }
  dessiner(vue) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const communs = (pr) => {
      const u = pr.uniformes;
      gl.uniform3fv(u.uDroite, vue.base.droite);
      gl.uniform3fv(u.uHaut, vue.base.haut);
      gl.uniform3fv(u.uAvant, vue.base.avant);
      gl.uniform3fv(u.uCentre, vue.centrePm);
      gl.uniform1f(u.uEchelle, vue.pxParPm);
      gl.uniform1f(u.uProf, vue.profondeurPm);
      gl.uniform1f(u.uFacteur, vue.facteur);
      gl.uniform1f(u.uTemps, vue.temps);
      gl.uniform1f(u.uAmp, vue.amp);
      gl.uniform2f(u.uEcran, this.ecran.l, this.ecran.h);
    };

    const ps = this.prSphere;
    gl.useProgram(ps.p);
    communs(ps);
    gl.uniform3fv(ps.uniformes.uFond, vue.fond);
    gl.uniform3fv(ps.uniformes.uBrume, vue.brume || [0, 1, 0]);
    gl.depthMask(true);
    const a = ps.attributs;
    for (const lot of this.lots) {
      if (!lot.visible) continue;
      lot.trier(vue.base.avant);
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.statique);
      const T = 12 * 4;
      gl.enableVertexAttribArray(a.aCentre); gl.vertexAttribPointer(a.aCentre, 3, gl.FLOAT, false, T, 0);
      gl.enableVertexAttribArray(a.aCoin); gl.vertexAttribPointer(a.aCoin, 2, gl.FLOAT, false, T, 12);
      gl.enableVertexAttribArray(a.aRayon); gl.vertexAttribPointer(a.aRayon, 1, gl.FLOAT, false, T, 20);
      gl.enableVertexAttribArray(a.aCouleur); gl.vertexAttribPointer(a.aCouleur, 3, gl.FLOAT, false, T, 24);
      gl.enableVertexAttribArray(a.aPhase); gl.vertexAttribPointer(a.aPhase, 3, gl.FLOAT, false, T, 36);
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.tamponEtat);
      gl.enableVertexAttribArray(a.aEtat); gl.vertexAttribPointer(a.aEtat, 3, gl.FLOAT, false, 12, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lot.indices);
      gl.drawElements(gl.TRIANGLES, lot.n * 6, gl.UNSIGNED_SHORT, 0);
    }
    for (const k of Object.values(a)) gl.disableVertexAttribArray(k);

    if (this.boite) {
      const pb = this.prBoite;
      gl.useProgram(pb.p);
      const u = pb.uniformes;
      gl.uniform3fv(u.uDroite, vue.base.droite);
      gl.uniform3fv(u.uHaut, vue.base.haut);
      gl.uniform3fv(u.uAvant, vue.base.avant);
      gl.uniform3fv(u.uCentre, vue.centrePm);
      gl.uniform1f(u.uEchelle, vue.pxParPm);
      gl.uniform1f(u.uProf, vue.profondeurPm);
      gl.uniform2f(u.uEcran, this.ecran.l, this.ecran.h);
      gl.uniform4fv(u.uTeinte, this.boite.teinte);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.boite.tampon);
      gl.enableVertexAttribArray(pb.attributs.aPos);
      gl.vertexAttribPointer(pb.attributs.aPos, 3, gl.FLOAT, false, 12, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.boite.n);
      gl.disableVertexAttribArray(pb.attributs.aPos);
      gl.depthMask(true);
    }

    const e = this.etiquettes;
    if (e && vue.opaciteEtiquettes > 0.01) {
      const pe = this.prEtiq;
      gl.useProgram(pe.p);
      communs(pe);
      gl.uniform1f(pe.uniformes.uOpacite, vue.opaciteEtiquettes);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas.tex);
      gl.uniform1i(pe.uniformes.uAtlas, 0);
      gl.depthMask(false);
      const b = pe.attributs;
      const T = e.stride * 4;
      gl.bindBuffer(gl.ARRAY_BUFFER, e.tampon);
      gl.enableVertexAttribArray(b.aCentre); gl.vertexAttribPointer(b.aCentre, 3, gl.FLOAT, false, T, 0);
      gl.enableVertexAttribArray(b.aCoin); gl.vertexAttribPointer(b.aCoin, 2, gl.FLOAT, false, T, 12);
      gl.enableVertexAttribArray(b.aRayon); gl.vertexAttribPointer(b.aRayon, 1, gl.FLOAT, false, T, 20);
      gl.enableVertexAttribArray(b.aPhase); gl.vertexAttribPointer(b.aPhase, 3, gl.FLOAT, false, T, 24);
      gl.enableVertexAttribArray(b.aUV); gl.vertexAttribPointer(b.aUV, 4, gl.FLOAT, false, T, 36);
      gl.enableVertexAttribArray(b.aRapport); gl.vertexAttribPointer(b.aRapport, 1, gl.FLOAT, false, T, 52);
      gl.enableVertexAttribArray(b.aFondu); gl.vertexAttribPointer(b.aFondu, 1, gl.FLOAT, false, T, 56);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e.ib);
      gl.drawElements(gl.TRIANGLES, e.n * 6, gl.UNSIGNED_SHORT, 0);
      for (const k of Object.values(b)) gl.disableVertexAttribArray(k);
      gl.depthMask(true);
    }
  }
}
