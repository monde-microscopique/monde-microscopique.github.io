# Avancement

Mis à jour le 15 novembre 2026. Documents de référence (projet EPIC) : `monde-micro-protocole-execution.md`, `monde-micro-dossier-de-conception.md` (v0.3), `monde-micro-fiche-scene-nacl.md` (v0.2).

## Scènes

| Scène | Statut | Fait | Reste |
|---|---|---|---|
| NaCl — du grain de sel aux ions | brouillon | Temps 2 : question 2, dissolution chorégraphiée en 6 étapes, mise en commun, bécher, équation, δ+ δ− (avancé), suivre un ion. Temps 1 : question 1, zoom texturé de 10 cm à 300 pm avec instruments, exploration du cristal (rotation, étiquettes, voisins, compteurs, tailles réelles, maille), zoom dans l'ion jusqu'au noyau (Bohr / nuage), capture sur fond blanc | Fichier HTML unique de repli ; relecture de Roger |

## Livraisons

1. **J1a — le zoom, seul (en relecture).** C'est le point le plus risqué du projet : il est livré en premier. À relire : https://monde-microscopique.github.io/?brouillon#nacl
2. J1b — la dissolution (temps 2) : livrée le 16.11.2026, en relecture.
3. J1c — finitions : niveau avancé, suivre une particule, fichier HTML unique de repli, réglages de fluidité sur téléphone réel.

## Contrôles automatiques

À chaque envoi : 68 contrôles sans navigateur (données de la fiche, réseau, convention de taille, échelle, continuité du zoom, zoom dans l'ion, maille, dissolution : conservation à chaque étape, eau intacte, géométrie des cortèges, aucun chevauchement) et 49 contrôles dans Chrome (critères d'acceptation 1 à 8 sur les 11 étapes, téléphone tactile, affichage 2D de secours, aucune ressource externe). Si un contrôle échoue, rien n'est publié.

Non vérifiable automatiquement : fluidité sur un vrai téléphone d'entrée de gamme, confort au doigt, lisibilité en projection.

## Le moteur couvre-t-il le reste du catalogue ?

- **Étiquettes et bâtons de liaison.** Les étiquettes sur les boules existent déjà (Na⁺, Cl⁻), en 3D et en 2D, cachées correctement par les boules placées devant. Les bâtons des liaisons covalentes utilisent le même principe que les sphères : un rectangle tourné vers l'écran, ombré comme un cylindre, dessiné avec le même facteur de réduction (dossier §3). En 2D, ce sont des traits ombrés. Aucun bâton entre ions : c'est une règle des données, contrôlée automatiquement.
- **Brume d'électrons des métaux.** C'est une couche à part, dessinée après les ions : de nombreuses taches floues et translucides qui dérivent lentement, sans contour net et sans écrire la profondeur, si bien qu'aucune ne se lit comme une bille. En 2D : des dégradés transparents. Le zoom multi-échelle sert tel quel pour le fil de cuivre.
- **Scènes de population.** Elles ne peuvent pas être calculées depuis le temps comme une chorégraphie : chaque choc dépend des précédents. Le moteur les fera avancer à pas de temps fixe, avec un tirage aléatoire reproductible : même graine, même suite de chocs, même courbe, à chaque lecture et sur chaque appareil. Le générateur existe déjà (il fixe les phases de vibration). Pour le retour en arrière, l'état est enregistré à intervalles réguliers ; revenir à un instant revient à repartir de l'enregistrement le plus proche et à recalculer jusqu'à cet instant. La courbe de concentration vient de la même simulation, donc elle correspond toujours à ce qui est montré. Les positions changent à chaque image : le tampon est réécrit, ce qui reste léger pour quelques centaines de particules, en 3D comme en 2D.

## Décisions de Roger du 15.11.2026 pour le temps 2

- Cortège de Na⁺ : distance Na⁺–O environ 240 pm, 6 molécules d'eau en octaèdre, oxygène vers l'ion.
- Cortège de Cl⁻ : distance Cl⁻–H environ 230 pm, liaison hydrogène quasi linéaire Cl⁻···H–O, 6 molécules en pseudo-octaèdre (simplification assumée).
- Le cube de 216 ions est présenté comme « un cristal minuscule à la place du grain ».
- Couleur de Cl : #1E9E1E validée.

## Questions ouvertes pour Roger

- Isotope du chlore : ³⁵Cl repris de l'artefact de Roger (défi 2) ; à confirmer.
- Retour sur le temps 1 : voir le panneau « À contrôler par Roger » et `docs/tester-une-scene.md`.
