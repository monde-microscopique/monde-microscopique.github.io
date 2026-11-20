# À contrôler par Roger : scène « Même composition, substances différentes » (fiches F-D et F-A)

Scène en **brouillon**. Seul Roger la passe à `validee` (fichier `scenes/catalogue.json`).

Ancrage : chapitre 4, section 4.3, activité « Même composition, substances différentes » (w(C) = 40,00 %, w(H) = 6,714 %, w(O) = 53,29 % ; M = 30,03, 60,05, 90,08 et 180,2 g/mol).

## Déroulé
1. **Prédiction** (molécules cachées, noms affichés) : « Sont-elles la même substance ? »
2. **Quatre molécules** côte à côte ; on les fait tourner toutes ensemble.
3. **Compter les atomes** : compteurs allumés, sous chaque molécule.
4. **Le rapport le plus simple** : C : H : O = 1 : 2 : 1 et « formule empirique : CH₂O » sous chaque molécule.
5. **Les masses molaires** : formule brute et M allumées.
6. **Mise en commun** : « La composition centésimale suffit-elle à identifier une substance ? Justifiez. »

Les étapes 3 à 6 allument elles-mêmes les interrupteurs utiles ; on peut les éteindre à la main.

## Molécules et valeurs
| Molécule | Notation SMILES | Forme montrée | Formule, M |
|---|---|---|---|
| formaldéhyde | `C=O` | — | CH₂O, 30,03 g/mol |
| acide acétique | `CC(=O)O` | — | C₂H₄O₂, 60,05 g/mol |
| acide lactique | `C[C@H](O)C(=O)O` | **L (S)** | C₃H₆O₃, 90,08 g/mol |
| glucose | `OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O` | **β-D-glucopyranose** (cyclique) | C₆H₁₂O₆, 180,2 g/mol |

- Les coordonnées sont **calculées** par RDKit (version 2026.09.2) : géométrie 3D par ETKDG puis champ de force MMFF94 (graine fixe, résultat reproductible) ; formule plane par CoordGen. Rien n'est écrit à la main. Fichiers : `molecules/sources.json` (notations), `outils/molecules.py` (calcul), `molecules/*.json` (résultat).
- Le calcul **s'arrête** si la formule brute ou M diffèrent des valeurs du polycopié. M est calculée avec les masses atomiques du polycopié et affichée avec 4 chiffres significatifs, comme dans le tableau de l'activité.
- Longueurs de liaison obtenues : C–H 109 à 110 pm ; C–C 149 à 154 pm ; C=O 122 pm ; C–O 135 pm (groupe carboxyle) et 142 à 144 pm (alcool, cycle) ; O–H 97 à 98 pm. Le calcul MMFF donne C=O 122 pm pour le formaldéhyde (mesuré environ 121 pm) : écart invisible à l'écran.
- Rayons des boules : C 170 pm, H 120 pm, O 152 pm (Van der Waals). **De mémoire, à contrôler (CRM).**

## Questions pour Roger
1. **Acide lactique : forme L.** Choix de l'exécutant (celle des muscles et du yogourt, cités dans le tableau de l'activité). Le bandeau dit que la forme D est l'image miroir. Garder, ou ne rien dire de la chiralité au chapitre 4 ?
2. **Glucose : β-D-glucopyranose.** Forme cyclique demandée par la fiche ; β est la forme majoritaire dans l'eau. Garder β, ou préférer α ?
3. **« formule empirique : CH₂O »** est écrit dès l'étape 4. C'est la réponse à la question 1 de l'activité : la scène sert donc **après** l'activité papier (ou en correction). D'accord ?

## Visionneuse (fiche F-A) : ce qui est fait, ce qui manque
Fait : rotation libre de toutes les molécules ensemble ; boules et bâtons (par défaut), compact (vraies tailles, sans bâtons), formule plane (les atomes glissent dans le plan, puis symboles et traits ; liaison double = deux traits) ; « Afficher les H » (les H apparaissent **un par un**, le compteur monte avec eux ; H masqués comptés « ? ») ; compteurs d'atomes par élément ; formule brute et M ; étiquettes = identité de chaque atome (règle du 20.11.2026).
Pas encore fait : **doublets non liants** (prévu avec la scène des liaisons, chapitre 5) ; bouton « superposer » (prévu pour la fiche F-B).

## Simplifications et choix de l'exécutant
1. **Une seule conformation** par molécule (celle du calcul) ; en réalité, les groupes tournent autour des liaisons simples. Dit dans le bandeau.
2. **Liaisons doubles** : deux bâtons parallèles, dans le plan d'un atome voisin. Les liaisons simples sont un seul bâton. Pas d'image des électrons.
3. **Disposition** : une rangée de quatre sur un ordinateur, deux rangées de deux sur un téléphone (molécules petites sur un téléphone : on peut zoomer).
4. **Vibration** : 4 pm, seulement pour que le modèle ne paraisse pas figé. Elle s'arrête en formule plane.
5. **Orientation de départ** : chaque molécule est tournée pour montrer sa plus grande étendue face à l'écran (calcul, sans miroir : l'acide lactique reste L).
6. Couleurs : C gris foncé, H blanc, O rouge (couleurs habituelles des modèles moléculaires).
