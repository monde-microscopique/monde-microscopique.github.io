// Rendu WebGL1 des sphères (atomes, ions), des bâtons de liaison et des étiquettes.
// Chaque sphère est un carré de deux triangles ; le fragment shader calcule la sphère (« imposteur »).
// Chaque bâton est un rectangle tourné vers l'écran, ombré comme un cylindre.
// Coordonnées en picomètres (pm), relatives à l'origine de la scène.
// La vibration est calculée dans le vertex shader. Les positions sont dans un tampon séparé :
// fixe pour un cristal, réécrit à chaque image pour une chorégraphie (lot « dynamique »).

const VIBRATION = `
vec3 vibration(vec3 phase) {
  return uAmp * vec3(sin(uTemps * 5.1 + phase.x), sin(uTemps * 4.3 + phase.y), sin(uTemps * 5.9 + phase.z));
}`;

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
${VIBRATION}
void main() {
  // Sphère effacée : hors de l'écran, pour ne rien calculer (sinon des centaines de carrés invisibles
  // se superposent et coûtent cher sur une carte graphique lente).
  if (aEtat.x > 0.995) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 d = aCentre + vibration(aPhase) - uCentre;
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

// Halo : disque translucide plus dense vers le bord (une coquille vue de face). Sert à représenter,
// autour d'un ion, un cortège d'eau qui n'est pas dessiné. Il n'écrit pas dans la profondeur.
const FS_HALO = `
precision mediump float;
uniform vec3 uBrume;
varying vec2 vUV;
varying float vZ, vR, vRpx;
varying vec3 vCouleur, vEtat;
void main() {
  float r = length(vUV);
  if (r > 1.0) discard;
  float a = (0.035 + 0.16 * smoothstep(0.55, 0.97, r)) * (1.0 - smoothstep(0.95, 1.0, r)) * (1.0 - vEtat.x);
  a *= 1.0 - smoothstep(uBrume.x, uBrume.y, vZ) * uBrume.z * 0.6;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCouleur * a, a);
}`;

// Bâton : aCoin.x = position le long du bâton (0 en A, 1 en B), aCoin.y = côté (−1 ou 1).
const VS_BATON = `
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aCoin;
attribute float aRayon;
attribute vec3 aCouleurA;
attribute vec3 aCouleurB;
attribute vec3 aPhase;
attribute float aFondu;
uniform vec3 uDroite, uHaut, uAvant, uCentre;
uniform float uEchelle, uProf, uTemps, uAmp, uFacteurBaton;
uniform vec2 uEcran;
varying float vCote, vZ, vR, vT, vRpx, vFondu;
varying vec3 vCouleurA, vCouleurB;
${VIBRATION}
void main() {
  vec3 v = vibration(aPhase);
  vec3 da = aA + v - uCentre, db = aB + v - uCentre;
  vec2 pa = vec2(dot(da, uDroite), dot(da, uHaut)) * uEchelle;
  vec2 pb = vec2(dot(db, uDroite), dot(db, uHaut)) * uEchelle;
  vec2 dir = pb - pa;
  float l = length(dir);
  dir = l > 1e-4 ? dir / l : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float r = aRayon * uFacteurBaton;
  float rpx = max(r * uEchelle, 0.5);
  vec2 p = mix(pa, pb, aCoin.x) + perp * aCoin.y * (rpx + 1.0);
  float z = mix(dot(da, uAvant), dot(db, uAvant), aCoin.x);
  gl_Position = vec4(p * 2.0 / uEcran, z / uProf, 1.0);
  vCote = aCoin.y * (rpx + 1.0) / rpx;
  vZ = z; vR = r; vT = aCoin.x; vRpx = rpx; vFondu = aFondu;
  vCouleurA = aCouleurA; vCouleurB = aCouleurB;
}`;

const FS_BATON = (profondeur) => `
${profondeur ? '#extension GL_EXT_frag_depth : enable' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uFond;
uniform vec3 uBrume;
uniform float uProf;
varying float vCote, vZ, vR, vT, vRpx, vFondu;
varying vec3 vCouleurA, vCouleurB;
void main() {
  float s = abs(vCote);
  float a = (1.0 - smoothstep(1.0 - 1.0 / vRpx, 1.0 + 1.0 / vRpx, s)) * (1.0 - vFondu);
  if (a < 0.02) discard;
  float nz = sqrt(max(1.0 - min(s, 1.0) * min(s, 1.0), 0.0));
  vec3 base = vT < 0.5 ? vCouleurA : vCouleurB;
  vec3 c = base * (0.5 + 0.55 * nz) + vec3(0.15) * pow(nz, 12.0);
  c = mix(c, c * 0.6, smoothstep(0.75, 1.0, s));
  c = mix(c, uFond, smoothstep(uBrume.x, uBrume.y, vZ) * uBrume.z);
  gl_FragColor = vec4(c * a, a);
  ${profondeur ? 'gl_FragDepthEXT = clamp(((vZ - vR * nz) / uProf) * 0.5 + 0.5, 0.0, 1.0);' : ''}
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
uniform float uEchelle, uProf, uFacteur, uTemps, uAmp, uSeuil;
uniform vec2 uEcran;
varying vec2 vTex;
varying float vFondu;
${VIBRATION}
void main() {
  vec3 d = aCentre + vibration(aPhase) - uCentre;
  float r = aRayon * uFacteur;
  float rpx = r * uEchelle;
  float h = clamp(rpx * 0.9, 13.0, 30.0);
  vec2 p = vec2(dot(d, uDroite), dot(d, uHaut)) * uEchelle + aCoin * vec2(h * aRapport, h) * 0.5;
  float z = (dot(d, uAvant) - r * 1.05) / uProf;
  gl_Position = rpx < uSeuil || aFondu > 0.995 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p * 2.0 / uEcran, z, 1.0);
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
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader : ' + gl.getShaderInfoLog(s));
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
const COINS_BATON = [[0, -1], [1, -1], [1, 1], [0, 1]];

function indicesQuads(n) {
  const t = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) t.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  return t;
}

// Écrit les mêmes valeurs pour les 4 sommets de chaque élément.
function etendre(source, largeur, cible) {
  const n = source.length / largeur;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) for (let c = 0; c < largeur; c++) cible[(i * 4 + k) * largeur + c] = source[i * largeur + c];
  return cible;
}

// Lot de sphères : tampon fixe (coin, rayon, couleur, phase), tampon des positions, tampon d'état.
class Lot {
  constructor(gl, spheres, dynamique) {
    this.gl = gl;
    this.n = spheres.length;
    this.dynamique = dynamique;
    this.visible = true;
    const F = 9;
    const d = new Float32Array(this.n * 4 * F);
    let o = 0;
    for (const s of spheres) for (const c of COINS) {
      d.set([c[0], c[1], s.rayon, s.couleur[0], s.couleur[1], s.couleur[2], s.phase[0], s.phase[1], s.phase[2]], o);
      o += F;
    }
    this.fixe = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fixe);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    this.positions = new Float32Array(this.n * 3);
    spheres.forEach((s, i) => this.positions.set(s.pos, i * 3));
    this.positionsSommets = new Float32Array(this.n * 4 * 3);
    this.tamponPositions = gl.createBuffer();
    this.majPositions(this.positions);
    this.etat = new Float32Array(this.n * 4 * 3);
    this.tamponEtat = gl.createBuffer();
    this.envoyerEtat();
    this.tableauIndices = new Uint16Array(this.n * 6);
    this.indices = gl.createBuffer();
    this.dernierAvant = null;
  }

  // positions : Float32Array de n × 3 (pm).
  majPositions(positions) {
    if (positions !== this.positions) this.positions.set(positions);
    etendre(this.positions, 3, this.positionsSommets);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponPositions);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionsSommets, this.dynamique ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    this.aTrier = true;
  }

  // etats : tableau de [fondu, attenuation, selection] par sphère.
  definirEtats(etats) {
    for (let i = 0; i < this.n; i++) for (let k = 0; k < 4; k++) this.etat.set(etats[i], (i * 4 + k) * 3);
    this.envoyerEtat();
  }

  envoyerEtat() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponEtat);
    gl.bufferData(gl.ARRAY_BUFFER, this.etat, gl.DYNAMIC_DRAW);
  }

  // Dessin de l'arrière vers l'avant : les bords adoucis se mélangent correctement.
  trier(avant) {
    const d = this.dernierAvant;
    if (!this.aTrier && d && Math.abs(d[0] - avant[0]) + Math.abs(d[1] - avant[1]) + Math.abs(d[2] - avant[2]) < 1e-4) return;
    this.dernierAvant = avant.slice();
    this.aTrier = false;
    const p = this.positions;
    const prof = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) prof[i] = p[i * 3] * avant[0] + p[i * 3 + 1] * avant[1] + p[i * 3 + 2] * avant[2];
    const ordre = Array.from({ length: this.n }, (_, i) => i).sort((a, b) => prof[b] - prof[a]);
    const t = this.tableauIndices;
    ordre.forEach((i, k) => t.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], k * 6));
    const gl = this.gl;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, t, gl.DYNAMIC_DRAW);
  }
}

// Lot de bâtons (liaisons covalentes) : extrémités A et B (pm), rayon, couleur de chaque moitié.
class LotBatons {
  constructor(gl, batons, dynamique) {
    this.gl = gl;
    this.n = batons.length;
    this.dynamique = dynamique;
    this.visible = true;
    const F = 13; // coin 2, rayon 1, couleurA 3, couleurB 3, phase 3, fondu 1
    this.F = F;
    this.donnees = new Float32Array(this.n * 4 * F);
    let o = 0;
    for (const b of batons) for (const c of COINS_BATON) {
      this.donnees.set([c[0], c[1], b.rayon, ...b.couleurA, ...b.couleurB, ...b.phase, 0], o);
      o += F;
    }
    this.fixe = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fixe);
    gl.bufferData(gl.ARRAY_BUFFER, this.donnees, gl.DYNAMIC_DRAW);
    this.extremites = new Float32Array(this.n * 6);
    batons.forEach((b, i) => { this.extremites.set(b.a, i * 6); this.extremites.set(b.b, i * 6 + 3); });
    this.extremitesSommets = new Float32Array(this.n * 4 * 6);
    this.tampon = gl.createBuffer();
    this.majPositions(this.extremites);
    this.indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesQuads(this.n), gl.STATIC_DRAW);
  }

  // extremites : Float32Array de n × 6 (A puis B, pm).
  majPositions(extremites) {
    if (extremites !== this.extremites) this.extremites.set(extremites);
    etendre(this.extremites, 6, this.extremitesSommets);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tampon);
    gl.bufferData(gl.ARRAY_BUFFER, this.extremitesSommets, this.dynamique ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  }

  // fondus : un nombre par bâton (0 visible, 1 invisible).
  definirFondus(fondus) {
    for (let i = 0; i < this.n; i++) for (let k = 0; k < 4; k++) this.donnees[(i * 4 + k) * this.F + this.F - 1] = fondus[i];
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fixe);
    gl.bufferData(gl.ARRAY_BUFFER, this.donnees, gl.DYNAMIC_DRAW);
  }
}

// Jeu d'étiquettes attaché à un lot de sphères : elles suivent les positions du lot.
class JeuEtiquettes {
  constructor(gl, lot, items, atlas, spheres) {
    this.gl = gl;
    this.lot = lot;
    this.items = items;
    this.n = items.length;
    this.visible = true;
    this.opacite = 1;
    const F = 13; // coin 2, uv 4, rapport 1, rayon 1, phase 3, fondu 1, (réserve) 1
    this.F = F;
    this.donnees = new Float32Array(this.n * 4 * F);
    let o = 0;
    for (const it of items) {
      const z = atlas.zones[it.texte];
      const s = spheres[it.index];
      for (const c of COINS) {
        this.donnees.set([c[0], c[1], z.u0, z.v0, z.u1, z.v1, z.rapport, s.rayon, s.phase[0], s.phase[1], s.phase[2], 0, 0], o);
        o += F;
      }
    }
    this.fixe = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fixe);
    gl.bufferData(gl.ARRAY_BUFFER, this.donnees, gl.DYNAMIC_DRAW);
    this.positionsSommets = new Float32Array(this.n * 4 * 3);
    this.tamponPositions = gl.createBuffer();
    this.indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indicesQuads(this.n), gl.STATIC_DRAW);
    this.synchroniser();
  }

  synchroniser() {
    const p = this.lot.positions;
    this.items.forEach((it, i) => {
      for (let k = 0; k < 4; k++) {
        this.positionsSommets[(i * 4 + k) * 3] = p[it.index * 3];
        this.positionsSommets[(i * 4 + k) * 3 + 1] = p[it.index * 3 + 1];
        this.positionsSommets[(i * 4 + k) * 3 + 2] = p[it.index * 3 + 2];
      }
    });
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tamponPositions);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionsSommets, gl.DYNAMIC_DRAW);
  }

  fondre(fondus) {
    for (let i = 0; i < this.n; i++) for (let k = 0; k < 4; k++) this.donnees[(i * 4 + k) * this.F + 11] = fondus[i];
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fixe);
    gl.bufferData(gl.ARRAY_BUFFER, this.donnees, gl.DYNAMIC_DRAW);
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
    this.prHalo = programme(gl, VS_SPHERE, FS_HALO);
    this.prBaton = programme(gl, VS_BATON, FS_BATON(!!ext));
    this.prEtiq = programme(gl, VS_ETIQ, FS_ETIQ);
    this.prBoite = programme(gl, VS_BOITE, FS_BOITE);
    this.lots = [];
    this.lotsBatons = [];
    this.jeuxEtiquettes = [];
    this.boite = null;
    this.atlas = null;
  }

  // options.halo : sphères dessinées en halos translucides, de rayon fixe (non réduit par le facteur).
  creerLot(spheres, options = {}) {
    const lot = new Lot(this.gl, spheres, !!options.dynamique);
    lot.spheres = spheres;
    lot.halo = !!options.halo;
    this.lots.push(lot);
    return lot;
  }

  creerBatons(batons, options = {}) {
    const lot = new LotBatons(this.gl, batons, !!options.dynamique);
    this.lotsBatons.push(lot);
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

  // Étiquettes d'un lot : items = [{ index, texte }]. Elles suivent les positions du lot.
  creerEtiquettes(lot, items) {
    const jeu = new JeuEtiquettes(this.gl, lot, items, this.atlas, lot.spheres);
    this.jeuxEtiquettes.push(jeu);
    return jeu;
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

  redimensionner(l, h, dpr) {
    const w = Math.round(l * dpr), hh = Math.round(h * dpr);
    if (this.canvas.width !== w || this.canvas.height !== hh) { this.canvas.width = w; this.canvas.height = hh; }
    this.ecran = { l, h, dpr };
  }

  // vue : { base, centrePm, pxParPm, temps, amp, facteur, facteurBaton, fond, brume, profondeurPm,
  //         opaciteEtiquettes (défaut des jeux), seuilEtiquettes }
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
      if (u.uFacteur) gl.uniform1f(u.uFacteur, vue.facteur);
      if (u.uTemps) gl.uniform1f(u.uTemps, vue.temps);
      if (u.uAmp) gl.uniform1f(u.uAmp, vue.amp);
      gl.uniform2f(u.uEcran, this.ecran.l, this.ecran.h);
      if (u.uFond) gl.uniform3fv(u.uFond, vue.fond);
      if (u.uBrume) gl.uniform3fv(u.uBrume, vue.brume || [0, 1, 0]);
    };
    const attacher = (loc, taille, stride, offset) => {
      if (loc === undefined || loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, taille, gl.FLOAT, false, stride, offset);
    };
    const detacher = (pr) => { for (const k of Object.values(pr.attributs)) gl.disableVertexAttribArray(k); };

    // Bâtons d'abord (ils sont en grande partie cachés par les sphères à leurs extrémités).
    const pb = this.prBaton;
    gl.useProgram(pb.p);
    communs(pb);
    gl.uniform1f(pb.uniformes.uFacteurBaton, vue.facteurBaton ?? 1);
    for (const lot of this.lotsBatons) {
      if (!lot.visible || !lot.n) continue;
      const a = pb.attributs;
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.fixe);
      const T = lot.F * 4;
      attacher(a.aCoin, 2, T, 0); attacher(a.aRayon, 1, T, 8); attacher(a.aCouleurA, 3, T, 12);
      attacher(a.aCouleurB, 3, T, 24); attacher(a.aPhase, 3, T, 36); attacher(a.aFondu, 1, T, 48);
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.tampon);
      attacher(a.aA, 3, 24, 0); attacher(a.aB, 3, 24, 12);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lot.indices);
      gl.drawElements(gl.TRIANGLES, lot.n * 6, gl.UNSIGNED_SHORT, 0);
    }
    detacher(pb);

    const dessinerLot = (pr, lot) => {
      lot.trier(vue.base.avant);
      const a = pr.attributs;
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.fixe);
      const T = 9 * 4;
      attacher(a.aCoin, 2, T, 0); attacher(a.aRayon, 1, T, 8); attacher(a.aCouleur, 3, T, 12); attacher(a.aPhase, 3, T, 24);
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.tamponPositions);
      attacher(a.aCentre, 3, 12, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, lot.tamponEtat);
      attacher(a.aEtat, 3, 12, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lot.indices);
      gl.drawElements(gl.TRIANGLES, lot.n * 6, gl.UNSIGNED_SHORT, 0);
    };
    const ps = this.prSphere;
    gl.useProgram(ps.p);
    communs(ps);
    gl.depthMask(true);
    for (const lot of this.lots) if (lot.visible && lot.n && !lot.halo) dessinerLot(ps, lot);
    detacher(ps);

    // Halos après les sphères, sans écrire la profondeur : un ion reste net dans son halo.
    const halos = this.lots.filter((lot) => lot.visible && lot.n && lot.halo);
    if (halos.length) {
      const ph = this.prHalo;
      gl.useProgram(ph.p);
      communs(ph);
      gl.uniform1f(ph.uniformes.uFacteur, 1);
      gl.depthMask(false);
      for (const lot of halos) dessinerLot(ph, lot);
      detacher(ph);
      gl.depthMask(true);
    }

    if (this.boite) {
      const pbx = this.prBoite;
      gl.useProgram(pbx.p);
      communs(pbx);
      gl.uniform4fv(pbx.uniformes.uTeinte, this.boite.teinte);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.boite.tampon);
      attacher(pbx.attributs.aPos, 3, 12, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.boite.n);
      detacher(pbx);
      gl.depthMask(true);
    }

    const pe = this.prEtiq;
    let actif = false;
    for (const jeu of this.jeuxEtiquettes) {
      const opacite = jeu.opacite ?? 1;
      if (!jeu.visible || !jeu.lot.visible || opacite < 0.01 || !jeu.n) continue;
      if (!actif) {
        gl.useProgram(pe.p);
        communs(pe);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlas.tex);
        gl.uniform1i(pe.uniformes.uAtlas, 0);
        gl.depthMask(false);
        actif = true;
      }
      if (jeu.lot.dynamique) jeu.synchroniser();
      gl.uniform1f(pe.uniformes.uOpacite, opacite);
      gl.uniform1f(pe.uniformes.uSeuil, jeu.seuil ?? 9);
      gl.uniform1f(pe.uniformes.uFacteur, vue.facteur);
      const b = pe.attributs;
      gl.bindBuffer(gl.ARRAY_BUFFER, jeu.fixe);
      const T = jeu.F * 4;
      attacher(b.aCoin, 2, T, 0); attacher(b.aUV, 4, T, 8); attacher(b.aRapport, 1, T, 24);
      attacher(b.aRayon, 1, T, 28); attacher(b.aPhase, 3, T, 32); attacher(b.aFondu, 1, T, 44);
      gl.bindBuffer(gl.ARRAY_BUFFER, jeu.tamponPositions);
      attacher(b.aCentre, 3, 12, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, jeu.indices);
      gl.drawElements(gl.TRIANGLES, jeu.n * 6, gl.UNSIGNED_SHORT, 0);
    }
    if (actif) { detacher(pe); gl.depthMask(true); }
  }
}
