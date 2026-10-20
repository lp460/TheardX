# ThreadShelf

Enregistrez, lisez, copiez et organisez les publications et threads de X.com. Extension Manifest V3 conçue pour **Arc sur macOS**, compatible Chrome, Brave, Edge et autres navigateurs Chromium.

Pocket + mode lecture + gestionnaire de favoris, spécialisé pour X. Tout reste dans votre navigateur : pas de compte, pas de serveur, aucune télémétrie.

## Fonctionnalités

- **Détection automatique, enregistrement sur action.** Sur x.com et twitter.com, ThreadShelf reconnaît les publications affichées par X, dans la mise en page actuelle comme dans la mise en page « classique » `data-testid`. Rien n'est enregistré sans action de votre part.
- **Interface discrète dans la page.** Sous la publication ouverte : `ThreadShelf · Enregistrer | Copier | Lire | •••`. Un petit bouton est ajouté à la fin de la barre d'actions de chaque publication. Les commandes natives de X ne sont jamais masquées.
- **Quatre modes de capture :**
  - A, la publication seule ;
  - B, le thread de l'auteur ;
  - C, la publication avec ses citations et liens vers d'autres publications ;
  - D, une sélection manuelle.
- **Reconstruction honnête des threads.** Seules les relations affichées par X sont utilisées : lignes de connexion, chaîne des messages parents au-dessus d'une publication ouverte. Chaque thread reçoit un état : complet et vérifié, partiel, chargement supplémentaire nécessaire, ou reconstruction impossible. Les réponses d'autres comptes ne sont jamais mélangées au thread.
- **Capture progressive.** Si un thread enregistré est incomplet, les publications chargées pendant le défilement sont ajoutées à la même entrée, sans doublon. X retire les publications de la page pendant le défilement ; ThreadShelf, lui, les conserve.
- **Lecteur.** Mise en page éditoriale. Thème clair, sombre ou système, police serif ou sans-serif, taille et largeur réglables, sommaire, raccourcis clavier, note personnelle, vue d'impression et PDF.
- **Copie et export.** Copie en Markdown ou en texte brut, avec ou sans les URL des publications, ou d'une sélection de publications. Export en TXT, Markdown, HTML autonome (sans script, images intégrées), JSON structuré et PDF (vue d'impression).
- **Bibliothèque.** Cartes ou liste, recherche instantanée locale (`@auteur`, `#tag`, insensible aux accents). Filtres par auteur, catégorie, état de lecture et favoris. Tri, collections, catégories, tags, vue « À lire plus tard », sélection multiple et actions groupées, détection des doublons, indicateur de stockage.
- **Hors ligne.** Les images des publications enregistrées sont stockées dans IndexedDB. Les vidéos restent des liens vers X, et cette limite est indiquée dans le lecteur.
- **Sauvegarde.** Export JSON complet et import validé et transactionnel : en cas d'échec, rien n'est modifié. Deux modes : fusion ou remplacement.

## Installation dans Arc (macOS)

1. Construire l'extension (ou utiliser le dossier `dist/` déjà présent) :
   ```bash
   npm install
   ```
   ```bash
   npm run build
   ```
2. Dans Arc, ouvrir `arc://extensions`.
3. Activer le **Mode développeur** (en haut à droite).
4. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier `dist` de ce projet.
5. Épingler ThreadShelf : barre latérale d'Arc → icône Extensions (pièce de puzzle) → épingler.
6. Ouvrir une publication sur x.com : la barre ThreadShelf apparaît dessous.

Raccourcis, modifiables dans `arc://extensions/shortcuts` :

| Raccourci | Action                              |
| --------- | ----------------------------------- |
| ⌥⇧T       | Ouvrir la popup ThreadShelf         |
| ⌥⇧S       | Enregistrer le thread affiché       |
| ⌥⇧C       | Copier le thread affiché (Markdown) |
| ⌥⇧L       | Ouvrir la bibliothèque              |
| ⌘K        | Rechercher (dans la bibliothèque)   |

Après une nouvelle compilation, cliquez sur l'icône de rechargement de la carte ThreadShelf dans `arc://extensions`, puis rechargez vos onglets X.

Pour Chrome, Brave et Edge, la procédure est la même via `chrome://extensions`, `brave://extensions` et `edge://extensions`.

## Utilisation

- **Enregistrer** : bouton _Enregistrer_ de la barre (thread de l'auteur), ou _•••_ pour choisir un autre mode, une collection, une catégorie, des tags ou une note. Vous pouvez aussi utiliser la popup, ⌥⇧S, ou le clic droit → « Enregistrer le thread dans ThreadShelf ».
- **Thread incomplet** : faites défiler la conversation. Les publications chargées sont ajoutées automatiquement à l'entrée et une notification indique le nouveau total.
- **Copier** : _Copier_ dans la barre (Markdown par défaut, modifiable dans les paramètres), ⌥⇧C, ou depuis la bibliothèque ou le lecteur.
- **Lire** : _Lire_ ouvre le lecteur dans un nouvel onglet. Raccourcis : `j`/`k` publication suivante/précédente, `+`/`−` taille, `[`/`]` largeur, `t` thème, `s` police, `c` copier, `f` favori, `p` imprimer, `?` aide.
- **Désactiver** : popup → « Activé sur X », ou Paramètres → Général : extension, détection automatique, interface dans la page, bouton par publication, notifications, et activation par domaine.

## Notes spécifiques à Arc

- L'interface principale ne dépend pas de `chrome.sidePanel`, qu'Arc n'affiche pas. Elle repose sur la popup de la barre d'outils, un panneau flottant injecté dans la page (Shadow DOM isolé) et des onglets dédiés pour la bibliothèque et le lecteur.
- Les capacités du navigateur sont détectées à l'exécution (visibles en bas des paramètres).

## Développement

```bash
npm run dev
```

`npm run dev` recompile `dist/` à chaque modification ; rechargez ensuite l'extension.

```bash
npm run check
```

`npm run check` enchaîne typecheck, lint, tests, build, validation et tests e2e. Chaque étape existe aussi séparément :

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm run test:e2e
npm run test:real
npm run zip
```

- `npm run test` : tests unitaires et d'intégration (Vitest)
- `npm run validate` : contrôles statiques de `dist/` (MV3, permissions, CSP, ni eval ni code distant)
- `npm run test:e2e` : Playwright, Chromium avec l'extension compilée, sur fixtures X
- `npm run test:real` : vérification facultative sur le vrai x.com (`HEADED=1` recommandé)
- `npm run zip` : produit `artifacts/threadshelf-<version>.zip`

Prérequis : Node 20+ et npm. Le Chromium de Playwright s'installe avec `npx playwright install chromium`.

## Confidentialité

ThreadShelf lit uniquement ce que X affiche dans votre onglet pendant votre navigation normale. Aucun appel aux API de X, aucune lecture de cookies ou de jetons, aucune collecte de profils. Les seules requêtes réseau sont les téléchargements d'images des publications que vous avez enregistrées (`pbs.twimg.com`), pour la lecture hors ligne ; c'est désactivable dans les paramètres. Voir [SECURITY.md](SECURITY.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) : modules, modèle de données, règles de reconstruction, choix techniques
- [TESTING.md](TESTING.md) : stratégie de test, couverture, distinction entre fixtures et site réel
- [SECURITY.md](SECURITY.md) : permissions, modèle de menace, traitement des données
- [CHANGELOG.md](CHANGELOG.md)

Aucune licence n'est incluse : les droits d'utilisation n'ont pas été définis par le propriétaire du projet.
