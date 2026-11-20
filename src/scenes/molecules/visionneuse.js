// Visionneuse de molécules (fiche F-A) : calculs sans DOM.
// Une molécule vient de molecules/<id>.json (coordonnées calculées hors ligne par outils/molecules.py).
// Unités : picomètres. Repère de la caméra : x vers la droite, y vers le haut, z vers l'observateur.

export const IDENTITE = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// Matrices 3 × 3 rangées par lignes.
export function produit(A, B) {
  const C = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return C;
}
export const appliquer = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
export function rotationX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
export function rotationY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
export function rotationZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }

// Remet une matrice de rotation d'aplomb (les erreurs d'arrondi s'accumulent quand on tourne longtemps).
export function orthonormer(M) {
  const n = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const x = n([M[0], M[3], M[6]]);
  let y = [M[1], M[4], M[7]];
  const d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  y = n(y.map((v, i) => v - d * x[i]));
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

// Axes principaux (méthode de Jacobi) : orientation de départ « la plus étalée » face à l'écran.
export function orientationPrincipale(points) {
  const n = points.length;
  const m = [0, 0, 0];
  for (const p of points) for (let k = 0; k < 3; k++) m[k] += p[k] / n;
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of points) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i * 3 + j] += (p[i] - m[i]) * (p[j] - m[j]);
  let V = IDENTITE.slice();
  for (let iter = 0; iter < 30; iter++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(A[i * 3 + j]) > Math.abs(A[p * 3 + q])) { p = i; q = j; }
    if (Math.abs(A[p * 3 + q]) < 1e-9) break;
    const th = 0.5 * Math.atan2(2 * A[p * 3 + q], A[q * 3 + q] - A[p * 3 + p]);
    const c = Math.cos(th), s = Math.sin(th);
    const J = IDENTITE.slice();
    J[p * 3 + p] = c; J[q * 3 + q] = c; J[p * 3 + q] = s; J[q * 3 + p] = -s;
    const Jt = [J[0], J[3], J[6], J[1], J[4], J[7], J[2], J[5], J[8]];
    const B = produit(produit(Jt, A), J);
    for (let k = 0; k < 9; k++) A[k] = B[k];
    V = produit(V, J);
  }
  const vals = [A[0], A[4], A[8]];
  const ordre = [0, 1, 2].sort((a, b) => vals[b] - vals[a]);
  // Lignes de la rotation : axes principaux, du plus étalé au moins étalé (x, y, z de l'écran).
  let R = ordre.flatMap((k) => [V[k], V[3 + k], V[6 + k]]);
  const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]);
  if (det < 0) R = [...R.slice(0, 6), -R[6], -R[7], -R[8]];
  return R;
}

// Orientation plane : axe le plus long horizontal.
export function orientationPlane(points2) {
  const n = points2.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of points2) { sxx += x * x / n; syy += y * y / n; sxy += x * y / n; }
  const a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const c = Math.cos(-a), s = Math.sin(-a);
  return (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

// Formule brute écrite avec des indices (C₂H₄O₂).
const INDICES = '₀₁₂₃₄₅₆₇₈₉';
export function formuleIndices(f) { return f.replace(/\d/g, (d) => INDICES[d]); }

// Rapport le plus simple entre les nombres d'atomes (formule empirique), éléments dans l'ordre de Hill.
export function rapportSimple(compte) {
  const els = Object.keys(compte).sort((a, b) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b)));
  const pgcd = (a, b) => (b ? pgcd(b, a % b) : a);
  const g = els.reduce((x, e) => pgcd(x, compte[e]), 0);
  return { elements: els, valeurs: els.map((e) => compte[e] / g) };
}

// Écart du bâton d'une liaison multiple : direction perpendiculaire à la liaison, dans le plan d'un voisin.
export function directionDecalage(pos, voisins, i, j) {
  const u = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
  const lu = Math.hypot(...u);
  u.forEach((_, k) => { u[k] /= lu; });
  const k = voisins[i].find((x) => x !== j) ?? voisins[j].find((x) => x !== i);
  let v = k === undefined ? [0, 0, 1] : [pos[k][0] - pos[i][0], pos[k][1] - pos[i][1], pos[k][2] - pos[i][2]];
  let d = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  let n = [v[0] - d * u[0], v[1] - d * u[1], v[2] - d * u[2]];
  if (Math.hypot(...n) < 1e-6) { v = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; d = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]; n = [v[0] - d * u[0], v[1] - d * u[1], v[2] - d * u[2]]; }
  const ln = Math.hypot(...n);
  return n.map((x) => x / ln);
}
