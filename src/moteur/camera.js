// Caméra orthographique multi-échelle.
// Toutes les positions du monde sont en mètres, en nombres JavaScript (double précision) :
// de 10 cm à 100 pm, soit 9 ordres de grandeur, l'erreur relative reste négligeable.
// La « largeur » est la largeur du champ visible, en mètres : c'est la valeur affichée par la règle.

import { scalaire, soustraire } from './vec.js';

export class Camera {
  constructor() {
    this.base = null;      // { droite, haut, avant } : vecteurs unitaires
    this.centre = [0, 0, 0];
    this.largeur = 0.1;    // m
    this.ecran = { l: 800, h: 600 }; // pixels CSS
  }

  get pxParMetre() {
    return this.ecran.l / this.largeur;
  }

  // Projection d'un point du monde (m) vers l'écran (px CSS). z : profondeur (m), positive vers l'avant.
  projeter(p) {
    const d = soustraire(p, this.centre);
    const k = this.pxParMetre;
    return {
      x: this.ecran.l / 2 + scalaire(d, this.base.droite) * k,
      y: this.ecran.h / 2 - scalaire(d, this.base.haut) * k,
      z: scalaire(d, this.base.avant),
    };
  }
}
