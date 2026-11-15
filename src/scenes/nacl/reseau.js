// Géométrie du réseau de NaCl (sans DOM : utilisée aussi par les contrôles automatiques).
// Repère : le coin du grain est à l'origin ; le grain occupe x ≥ 0, y ≤ 0, z ≥ 0 (face du dessus : y = 0).
// Unités : picomètres (pm).

// Générateur pseudo-aléatoire déterministe (mêmes phases de vibration à chaque chargement).
export function aleatoire(graine) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Espèce de l'ion d'indices (i, j, k) : alternance stricte, l'ion du coin est donné par les données.
export function espece(i, j, k, ionAuCoin) {
  const autre = ionAuCoin === 'Cl-' ? 'Na+' : 'Cl-';
  return (i + j + k) % 2 === 0 ? ionAuCoin : autre;
}

export const position = (i, j, k, d) => [i * d, -j * d, k * d];

// Cristal affiché : cube de n × n × n ions.
export function genererCristal(n, aretePm, ionAuCoin) {
  const d = aretePm / 2;
  const ions = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    ions.push({ i, j, k, espece: espece(i, j, k, ionAuCoin), pos: position(i, j, k, d) });
  }
  return ions;
}

// Ions de surface du reste du grain, sur les trois faces visibles autour du coin,
// hors du cube affiché : ils montrent que le réseau continue pendant le zoom.
export function genererSurface(nTotal, nCube, aretePm, ionAuCoin) {
  const d = aretePm / 2;
  const ions = [];
  for (let i = 0; i < nTotal; i++) for (let j = 0; j < nTotal; j++) for (let k = 0; k < nTotal; k++) {
    if (Math.min(i, j, k) !== 0) continue;
    if (i < nCube && j < nCube && k < nCube) continue;
    ions.push({ i, j, k, espece: espece(i, j, k, ionAuCoin), pos: position(i, j, k, d), bord: Math.max(i, j, k) / (nTotal - 1) });
  }
  return ions;
}

// Voisins immédiats (distance d = arête / 2) de chaque ion du cristal.
export function voisins(ions) {
  const index = new Map(ions.map((ion, n) => [`${ion.i},${ion.j},${ion.k}`, n]));
  return ions.map((ion) => {
    const v = [];
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = index.get(`${ion.i + di},${ion.j + dj},${ion.k + dk}`);
      if (n !== undefined) v.push(n);
    }
    return v;
  });
}

// Bilan : nombre d'ions de chaque espèce et charge totale.
export function bilan(ions, especes) {
  const compte = {};
  let charge = 0;
  for (const ion of ions) {
    compte[ion.espece] = (compte[ion.espece] || 0) + 1;
    charge += especes[ion.espece].charge;
  }
  return { compte, charge };
}
