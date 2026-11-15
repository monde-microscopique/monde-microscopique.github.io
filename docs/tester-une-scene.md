# Tester une scène et donner un retour

Durée : 15 à 20 minutes par livraison. Le but n'est pas de chercher des bugs informatiques (les contrôles automatiques s'en chargent), mais de juger **la chimie et ce que l'élève va comprendre**.

## 1. Où et sur quoi tester

- Adresse : https://monde-microscopique.github.io/?brouillon (puis la scène). Sans `?brouillon`, les scènes non validées n'apparaissent pas : c'est normal.
- **Ordinateur** (Chrome, Edge ou Firefox), en plein écran : c'est la situation de projection. Si possible, une fois **sur le projecteur de la salle**, vu du fond de la classe.
- **Ton téléphone**, tenu en hauteur : c'est la situation des devoirs.
- Si tu as accès à un **laptop Syngenta** : seulement vérifier que la page s'ouvre et ce qu'affiche le petit message en bas (« affichage simplifié en 2D » = la 3D y est désactivée).

## 2. Comment se servir de la scène

| Action | Ordinateur | Téléphone |
|---|---|---|
| Étape suivante / précédente | flèches → ←, ou boutons ◀ ▶ | boutons ◀ ▶ |
| Zoomer / dézoomer | molette, flèches ↑ ↓, ou glisser le repère rouge de la règle | pincer à deux doigts, ou glisser le repère de la règle |
| Lecture automatique du zoom | barre d'espace ou bouton Lecture | bouton Lecture |
| Tourner le cristal (étape 3) | cliquer-glisser | glisser un doigt |
| Voir les voisins d'un ion | cliquer sur l'ion | toucher l'ion |
| Interrupteurs | touches E, V, C, T ou boutons du bas | boutons du bas |
| Image pour le polycopié | bouton Capture (PNG sur fond blanc) | — |

## 3. Le parcours

1. Joue la scène **une fois comme un élève**, sans rien lire d'autre, du début à la fin.
2. Rejoue-la **comme enseignant**, avec la grille ci-dessous, et note ce qui ne va pas au fil de l'eau.
3. Ouvre le panneau **« À contrôler par Roger »** (en bas à droite) : valeurs utilisées, choix faits sans toi, écarts par rapport à la fiche. Coche ce qui est bon, signale le reste.

## 4. La grille

1. La chimie est-elle juste ?
2. Le vocabulaire est-il celui du polycopié ?
3. La scène peut-elle faire naître une conception erronée ?
4. La question de prédiction est-elle au bon niveau ?
5. Les valeurs sont-elles conformes aux tables CRM ?

Et deux questions pratiques : est-ce lisible en projection ? Est-ce fluide sur ton téléphone ?

## 5. Comment me donner le retour

Dans la conversation avec Claude, un point par ligne, sous cette forme :

> **où** (étape et valeur de la règle « vous êtes ici », par exemple « étape 2, vers 3 nm ») — **ce qui ne va pas** — **ce que tu veux à la place** (si tu le sais).

Ajoute une image quand c'est visuel : bouton **Capture**, ou capture d'écran du téléphone.

Classe chaque point :
- **bloquant** : faux ou trompeur, la scène ne peut pas être montrée ainsi ;
- **à corriger** : gênant mais montrable ;
- **idée** : pour plus tard.

**Une formulation à changer ?** Corrige-la toi-même avec le crayon ✎ (voir `modifier-un-texte.md`), ou donne-moi la phrase voulue.

**Tout est bon ?** Passe la scène à `validee` dans `scenes/catalogue.json` (voir `modifier-un-texte.md`), ou demande-moi de le faire.
