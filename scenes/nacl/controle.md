<!--
Panneau « À contrôler par Roger » de la scène NaCl. Visible seulement en mode brouillon.
Ce fichier se modifie comme les textes (Markdown simple).
-->

## Ce qui est à relire dans cette livraison
Le **temps 1** seulement : la question 1, le zoom continu de la salière aux ions, l'exploration du cristal. La dissolution (temps 2) viendra ensuite.

Mode d'emploi du test : `docs/tester-une-scene.md` dans le dépôt.

## Nouveautés de cette version (retours du 15.11.2026)
- Zoom texturé selon le tableau validé (fiche v0.3), avec l'instrument affiché en bas à droite.
- Interrupteur **Maille** (touche M).
- Interrupteur **Zoom dans l'ion** (touche I) : on zoome dans l'ion sélectionné (cliquer un ion d'abord) jusqu'à 1 fm. Interrupteur **Avancé** (touche A) : nuage électronique au lieu du schéma de Bohr.
- Fond bleuté, grains blancs, vibration réduite.

## Points à regarder en priorité
1. **Le zoom de 5 mm à 12 nm** : les grains, puis un seul cube, les bulles, les marches, les paliers. Est-ce crédible pour un chimiste ? Est-ce que ça « se passe » assez ?
2. **Le zoom dans l'ion** : schéma de Bohr, puis le vide (repère du noyau), puis le noyau. L'élève suit-il ?
3. **La maille** : se lit-elle, avec les ions hors maille pâlis ? (faire tourner le cristal)
4. **La vibration** (10 pm, lente) : visible sans distraire ?

## Grille de relecture
1. La chimie est-elle juste ?
2. Le vocabulaire est-il celui du polycopié ?
3. La scène peut-elle faire naître une conception erronée ?
4. La question de prédiction est-elle au bon niveau ?
5. Les valeurs sont-elles conformes aux tables CRM ?

## Valeurs utilisées
| Grandeur | Valeur | Source |
|---|---|---|
| Rayon de Na⁺ (ion sodium) | 102 pm | fiche NaCl §4, validée le 15.11.2026 ; CRM non contrôlé |
| Rayon de Cl⁻ (ion chlorure) | 181 pm | fiche NaCl §4 ; CRM non contrôlé |
| Arête de la maille | 564 pm, soit 282 pm entre voisins | fiche NaCl §4 ; CRM non contrôlé |
| Arête du grain | 0,3 mm | fiche NaCl §4 |
| Cristal affiché | 6 × 6 × 6 ions = 108 Na⁺ + 108 Cl⁻ | fiche NaCl §4 |
| Facteur de réduction des boules | 0,28 (le même pour toutes) | dossier §3, valeur choisie dans la plage 25 à 30 % |
| Amplitude de vibration | 10 pm, ordre de grandeur réel (de mémoire, non vérifié), mouvement ralenti | réduite à la demande de Roger le 15.11.2026 |
| Couleur de Na | #AB5CF2 (violet) | palette usuelle des modèles moléculaires |
| Couleur de Cl | #1E9E1E (vert assombri) | validée par Roger le 15.11.2026 (le vert usuel #1FF01F contraste mal sur fond clair) |

| Texture du grain : marches concentriques | à 32, 60 et 85 µm des arêtes | **ordre de grandeur de mémoire, non vérifié** |
| Marches de quelques µm, puis fines | de 22 µm à 75 nm des arêtes | **ordre de grandeur de mémoire, non vérifié** |
| Marches d'une couche d'ions | 282 pm de haut (demi-arête de la maille), à 13 à 52 nm des arêtes | hauteur : géométrie du réseau ; positions : choix de l'exécutant |
| Bulles de saumure | 5 à 13 µm | **ordre de grandeur de mémoire, non vérifié** |
| Noyau de Na⁺ | ²³Na : 11 protons, 12 neutrons, rayon ≈ 3,4 fm | rayon ≈ 1,2 × A^(1/3) fm (ordre de grandeur) |
| Noyau de Cl⁻ | ³⁵Cl : 17 protons, 18 neutrons, rayon ≈ 3,9 fm | isotope 35, comme le défi 2 de ton artefact (« Cl⁻ formé à partir de l'isotope 35 ») |
| Schéma de Bohr | Na⁺ : 2, 8 ; Cl⁻ : 2, 8, 8 | électrons = protons − charge, contrôlé automatiquement |

pm = picomètre (10⁻¹² m) ; fm = femtomètre (10⁻¹⁵ m) ; µm = micromètre (10⁻⁶ m) ; A = nombre de masse.

## Choix de l'exécutant, à confirmer
1. **Question 1** : posée sur le grain isolé (champ de 1,2 mm) ; le zoom repart ensuite de la salière (10 cm).
2. **Coin du grain** : pendant le zoom, le réseau continue au-delà des 6 × 6 × 6 ions, puis s'efface entre 5 et 3 nm ; il reste le cube de 216 ions, annoncé comme « un coin du grain ».
3. **Ion au coin du cube** : Cl⁻ (sans effet sur les nombres : 108 de chaque).
4. **Lecture du relief** : les ions du fond sont légèrement pâlis (indice de profondeur), pour que le cube se lise même immobile.
5. **Repère** : un cercle rouge entoure le grain étudié tant qu'il est petit à l'écran.
6. **Textes rédigés par l'exécutant** : tous les messages du zoom (message-…), instrument-…, coin-du-grain, aide-reseau, aide-maille, repere-noyau, et les puces du bandeau sur les tailles et le cristal parfait.
7. **Zoom dans l'ion** : le schéma de Bohr a la taille de la boule dessinée (pas à l'échelle, c'est écrit). Conventions reprises de ton artefact « Lire le tableau périodique » : rayons des couches 62 : 98 : 134, électrons sur 4 positions, célibataires puis paires, couche externe soulignée, noyau compact (protons rouges, neutrons gris) annoté « p⁺ / n⁰ ». Le noyau est dessiné à sa vraie taille, d'où le repère « le noyau est ici » tant qu'il est invisible.
8. **Nuage électronique (avancé)** : dégradé plus dense au centre, très dilué vers l'extérieur ; il reste visible en zoomant (formulation du « vide » validée le 15.11.2026).
9. **Maille** : choisie au centre du cube de 216 ions ; volume teinté bleu, sans trait.
10. **Exploration** : dézoom possible jusqu'à 15 nm (demande de Roger du 16.11.2026) ; le cube de 216 ions reste seul, sans le reste du grain, et l'instrument affiché est « modèle ».

## Écart par rapport à la fiche
- Départ du zoom à 10 cm au lieu de 1 cm (validé le 15.11.2026).

## Pas encore construit
- Temps 2 (dissolution), équation, suivre une particule.
- Fichier HTML unique de repli.
