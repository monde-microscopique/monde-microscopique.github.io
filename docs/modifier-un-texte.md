# Modifier un texte

Tous les textes visibles par les élèves sont dans deux sortes de fichiers :

- `scenes/<scène>/textes.md` : les textes d'une scène (questions, messages, bandeau des simplifications) ;
- `textes/interface.md` : les textes communs (boutons, interrupteurs, accueil).

## La façon la plus simple

1. Ouvrir la scène en mode brouillon : https://monde-microscopique.github.io/?brouillon
2. À côté du texte à corriger, cliquer sur le crayon **✎**. GitHub s'ouvre directement sur le bon fichier, prêt à modifier (il faut être connecté au compte GitHub). Le nom du texte, par exemple `## question-1`, est rappelé quand on survole le crayon.
3. Trouver la ligne `## nom-du-texte`, puis corriger le texte **en dessous**.
4. Cliquer en haut à droite sur **Commit changes…**, puis encore sur **Commit changes** dans la fenêtre qui s'ouvre (le message proposé suffit).
5. Attendre environ deux minutes, puis recharger la page du site.

## Les trois règles

- **Ne pas modifier les lignes qui commencent par `##`.** Elles servent de nom au texte.
- Pour un mot en gras : `**mot**`. Pour une liste à puces : une ligne par puce, qui commence par `- `.
- Un texte peut tenir sur plusieurs lignes ; une ligne vide le sépare en paragraphes.

## Si quelque chose ne va pas

Si une ligne `##` est abîmée ou si un texte est vide, la publication est **refusée** et le site **garde la version précédente**. Rien de cassé n'est jamais mis en ligne.

Pour voir pourquoi : onglet **Actions** du dépôt, dernière ligne marquée d'une croix rouge, puis « construire-et-controler ». Le message d'erreur est en français et donne le fichier et le numéro de ligne. Il suffit alors de corriger le fichier de la même façon.

## Valider une scène

Quand une scène est relue et juste, ouvrir `scenes/catalogue.json` (crayon ✎ en haut à droite du fichier sur GitHub), remplacer `"brouillon"` par `"validee"` pour cette scène, puis « Commit changes ». La scène apparaît alors sur la page publique.
