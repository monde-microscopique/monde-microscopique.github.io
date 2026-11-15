# Monde microscopique

Voir la chimie à l'échelle des particules : un monde à explorer, toujours le même, pour les cours de chimie (apprentis technologues et laborantins CFC).

**Site :** https://monde-microscopique.github.io/
**Scènes en préparation (non relues) :** https://monde-microscopique.github.io/?brouillon

## Principes

- Une page statique, sans compte, sans collecte de données, sans ressource chargée depuis un autre serveur.
- Affichage 3D (WebGL1) ; si la 3D est désactivée, affichage 2D de secours (forçable avec `?2d`).
- Chaque scène suit le même déroulé : je prédis, j'observe, mise en commun, conclusion.
- Les scènes sont des données (`scenes/<scène>/donnees.json`) et des textes (`scenes/<scène>/textes.md`) ; le moteur est commun (`src/`).

## Modifier un texte

Voir [docs/modifier-un-texte.md](docs/modifier-un-texte.md). En bref : en mode brouillon, cliquer sur le crayon ✎ à côté d'un texte, corriger, puis « Commit changes ». Le site se met à jour en deux minutes environ. Si le fichier est abîmé, la publication est refusée et le site garde la version précédente.

## Tester une scène

Voir [docs/tester-une-scene.md](docs/tester-une-scene.md) : où tester, comment se servir de la scène, la grille de relecture, et comment transmettre un retour.

## Statut des scènes

Une scène est `brouillon` ou `validee` dans `scenes/catalogue.json`. Seules les scènes `validee` apparaissent sur la page publique. L'avancement et les questions ouvertes sont dans [AVANCEMENT.md](AVANCEMENT.md).

## Pour les développeurs

```
npm ci
npm run construire        # vérifie les textes et les données, assemble dist/
npm test                  # contrôles sans navigateur
npm run test:navigateur   # contrôles dans Chrome (critères d'acceptation)
```

Chaque envoi sur `main` déclenche la construction, les contrôles, puis la publication sur GitHub Pages (`.github/workflows/publier.yml`). Si un contrôle échoue, rien n'est publié.

## Licences

- Code (`src/`, `outils/`, `tests/`) : [MIT](LICENSE).
- Contenus (`scenes/`, `textes/`, `docs/`) : [CC BY 4.0](LICENSE-CONTENU).
