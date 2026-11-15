// Petits outils de géométrie : vecteurs 3D (tableaux [x, y, z]).

export const ajouter = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const soustraire = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const multiplier = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const scalaire = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vectoriel = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norme = (a) => Math.hypot(a[0], a[1], a[2]);
export const normaliser = (a) => multiplier(a, 1 / norme(a));
export const melanger = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const borner = (x, a, b) => Math.min(b, Math.max(a, x));
export function lisse(a, b, x) {
  const t = borner((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Base d'observation (droite, haut, avant) à partir d'une direction de visée et du haut du monde.
export function baseDepuisVisee(avant, hautMonde = [0, 1, 0]) {
  const f = normaliser(avant);
  const d = normaliser(vectoriel(f, hautMonde));
  const h = vectoriel(d, f);
  return { droite: d, haut: h, avant: f };
}

// Interpolation entre deux bases d'observation (pour revenir en douceur à l'orientation de départ).
export function interpolerBase(b0, b1, t) {
  const f = normaliser(melanger(b0.avant, b1.avant, t));
  const hApprox = normaliser(melanger(b0.haut, b1.haut, t));
  const d = normaliser(vectoriel(f, hApprox));
  return { droite: d, haut: vectoriel(d, f), avant: f };
}

// Rotation d'un vecteur v autour de l'axe unitaire k d'un angle a (formule de Rodrigues).
export function tourner(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const kv = vectoriel(k, v);
  const kd = scalaire(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}

export function couleurRvb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
