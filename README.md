# TheardX (extension ThreadShelf + Web/PWA)

> **Essayer TheardX :** https://theard-x.vercel.app — démonstration publique, lecture et bibliothèque web sur connexion Google ou GitHub. Voir [docs/WEB-PWA.md](docs/WEB-PWA.md). Le build web est indépendant de celui de l'extension.

Enregistrez, lisez, copiez et organisez les publications et threads de X.com, et les discussions Reddit (facultatif). Extension Manifest V3 conçue pour **Arc sur macOS**, compatible Chrome, Brave, Edge et autres navigateurs Chromium.

Pocket + mode lecture + gestionnaire de favoris, spécialisé pour X. **L'extension fonctionne localement sans compte** ; sa synchronisation Google Drive ou GitHub est facultative. **La PWA accepte Google ou GitHub pour une bibliothèque personnelle synchronisée** et peut utiliser Vercel pour les partages et la traduction distante sur consentement. Sur Google Drive, le mode de sauvegarde standard sans chiffrement de bout en bout est proposé par défaut ; le chiffrement reste activable dans les options de sécurité. Consultez [la politique de confidentialité](PRIVACY.md).

## Démarrer en 2 minutes

1. Sur ordinateur, ouvrez [le guide d'installation](https://theard-x.vercel.app/#installation), téléchargez le ZIP et décompressez-le dans un **dossier permanent**.
2. Dans Arc, Chrome, Brave ou Edge, activez le mode développeur dans le gestionnaire d'extensions et chargez le dossier contenant `manifest.json`.
3. Sur X ou Reddit, ouvrez une publication, utilisez le bouton de l'extension puis retrouvez l'article dans la bibliothèque.
4. Pour retrouver la même bibliothèque sur plusieurs appareils, connectez le même fournisseur (Google Drive ou GitHub) dans l'extension et la PWA. Pensez à conserver une sauvegarde JSON avant de changer d'installation.

**Mises à jour du ZIP :** remplacez le contenu du **même dossier d'extension** puis rechargez-la dans le gestionnaire et rafraîchissez les onglets X/Reddit. Une installation ZIP **ne se met pas à jour automatiquement**. Le Chrome Web Store est un chantier de distribution distinct, pas une publication déjà annoncée.

**Retour d'expérience :** [signaler un bug ou proposer une amélioration](https://github.com/lp460/TheardX/issues/new/choose). Ne joignez aucun jeton, code OAuth, phrase secrète ni export personnel.

## Fonctionnalités

- **Détection automatique, enregistrement sur action.** Sur x.com et twitter.com, ThreadShelf reconnaît les publications affichées par X, dans la mise en page actuelle comme dans la mise en page « classique » `data-testid`. Rien n'est enregistré sans action de votre part.
- **Un bouton ThreadShelf sur X.** Chaque publication reçoit un bouton ThreadShelf (violet) à la fin de sa barre d'actions. Un clic ouvre un menu avec **toutes les actions** : enregistrer le thread, la publication ou la publication avec ses références ; ajouter à une sélection ; copier (thread en Markdown, publication, texte brut) ; lire ; collection, tags et note ; bibliothèque ; supprimer la sauvegarde. Un **bouton flottant** « ThreadShelf », toujours visible en bas à droite, ouvre le même menu pour la publication en cours de lecture. Sous la publication ouverte, la barre `ThreadShelf · Enregistrer | Copier | Lire | •••` reste disponible. Les commandes natives de X ne sont jamais masquées.
- **Reddit (facultatif).** Paramètres → Général → « Activer ThreadShelf sur Reddit » : le navigateur demande l’accès à reddit.com. Ensuite, chaque post et chaque commentaire reçoit le bouton ThreadShelf.
  - **Discussion** : le post et ses commentaires chargés, en arbre.
  - **Message seul** : un post, ou un commentaire avec les messages auxquels il répond.
  - **Sélection** de commentaires.
  - Les réponses dépliées ensuite (« more replies ») sont ajoutées à la même entrée.
  - Le lecteur indente les commentaires par niveau. Les exports gardent l’arbre : citations imbriquées en Markdown, indentation en texte.
  - Seul le Reddit actuel (www.reddit.com) est pris en charge, pas old.reddit.com.
- **Articles X.** Les publications longues (Articles) sont enregistrées en entier : titre, couverture, intertitres, paragraphes, listes, citations, blocs de code, images.
- **Traduction.** Dans le lecteur, « Traduire » traduit le thread ou l’Article avec le traducteur intégré au navigateur (Google Chrome 138+), sur l’appareil et sans envoi de données. Les traductions sont gardées hors ligne, copiables et exportables. Si le navigateur ne le propose pas, un bouton ouvre Google Traduction, uniquement sur votre clic.
- **Quatre modes de capture :**
  - A, la publication seule ;
  - B, le thread de l'auteur ;
  - C, la publication avec ses citations et liens vers d'autres publications ;
  - D, une sélection manuelle.
- **Reconstruction honnête des threads.** Seules les relations affichées par X sont utilisées : lignes de connexion, chaîne des messages parents au-dessus d'une publication ouverte. Chaque thread reçoit un état : complet et vérifié, partiel, chargement supplémentaire nécessaire, ou reconstruction impossible. Les réponses d'autres comptes ne sont jamais mélangées au thread.
- **Capture progressive.** Si un thread enregistré est incomplet, les publications chargées pendant le défilement sont ajoutées à la même entrée, sans doublon. X retire les publications de la page pendant le défilement ; ThreadShelf, lui, les conserve.
- **Lecteur.** Mise en page éditoriale. Thème clair, sombre ou système, police serif ou sans-serif, taille et largeur réglables, sommaire, raccourcis clavier, note personnelle, vue d'impression et PDF.
- **Annotations personnelles.** Sélectionner un passage dans une publication du lecteur pour le surligner (4 couleurs) ou lui associer un commentaire, comme dans Word. Un volet permet de revenir à la phrase, modifier son commentaire, marquer l'annotation comme résolue ou la supprimer. Ces annotations restent privées : elles ne figurent pas dans les liens publics de partage ni dans les exports d'une publication. Elles sont conservées dans une sauvegarde complète personnelle et synchronisées avec la bibliothèque GitHub privée quand la synchronisation est activée.
- **Copie et export.** Copie en Markdown ou en texte brut, avec ou sans les URL des publications, ou d'une sélection de publications. Export en TXT, Markdown, HTML autonome (sans script, images intégrées), JSON structuré et PDF (vue d'impression).
- **Bibliothèque.** Cartes ou liste, recherche instantanée locale (`@auteur`, `#tag`, insensible aux accents). Filtres par auteur, catégorie, état de lecture et favoris. Tri, collections, catégories, tags, vue « À lire plus tard », sélection multiple et actions groupées, détection des doublons, indicateur de stockage.
- **Importer ses favoris X et Reddit.** Dans la bibliothèque, « Importer mes favoris » accepte les fichiers de signets X en CSV/JSON/JS et les exports de posts/commentaires enregistrés de Reddit en CSV. L'import détecte les doublons, peut être interrompu puis repris, et commence par sauvegarder les liens si les archives ne contiennent pas le texte. Dans le plugin, sur la page **Signets** de X ou **Enregistrés** de Reddit, la popup propose d'importer les publications déjà visibles et celles chargées pendant que vous faites défiler la page (sans navigation automatique). Ce procédé ne garantit pas tous les anciens favoris si le site ne les affiche plus.
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

- **Toutes les actions** : cliquez sur le bouton ThreadShelf d'une publication, ou sur le bouton flottant en bas à droite.
- **Enregistrer** : bouton _Enregistrer_ de la barre (thread de l'auteur), ou le menu _•••_ pour choisir un autre mode, une collection, une catégorie, des tags ou une note. Vous pouvez aussi utiliser la popup, ⌥⇧S, ou le clic droit → « Enregistrer le thread dans ThreadShelf ».
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

## Synchronisation entre PC (GitHub)

La bibliothèque (entrées, publications, notes, tags, collections, catégories, suppressions) se synchronise entre vos PC via un dépôt **privé** de votre compte GitHub, **créé automatiquement**. Aucun jeton à copier.

**Sur chaque PC** : Paramètres → **Synchronisation entre PC (GitHub)** → **Se connecter avec GitHub**.

1. Le navigateur demande l'accès à GitHub : cliquez **Autoriser**.
2. ThreadShelf affiche un code de 8 caractères, déjà copié, et ouvre github.com/login/device.
3. Collez le code, puis cliquez **Continue** et **Authorize**.

Le dépôt `threadshelf-data` est créé (privé) au premier PC, retrouvé sur les suivants, et la première synchronisation démarre.

**Application GitHub (déjà faite)** : l'application OAuth « ThreadShelf » est déclarée sur GitHub et son Client ID (`Ov23liLkMRkSELNiYB2U`, public) est intégré dans `src/sync/github-app.ts`. Il n'y a donc aucune étape de configuration sur les PC. Pour information, ou pour recréer l'application sur un autre compte (<https://github.com/settings/applications/new>), voici les réglages utilisés :

| Champ                     | Valeur                                              |
| ------------------------- | --------------------------------------------------- |
| Application name          | `ThreadShelf`                                       |
| Homepage URL              | `https://github.com`                                |
| Redirect URI              | `https://github.com` (obligatoire, non utilisé)     |
| Allow wildcard matching   | décoché                                             |
| Enable Device Flow        | **coché**                                           |
| Expire user access tokens | **décoché** (sinon reconnexion toutes les 8 heures) |

Si vous recréez l'application, remplacez le Client ID dans `src/sync/github-app.ts` (ou dans Paramètres → Synchronisation → Options avancées), puis recompilez. Aucun _client secret_ n'est utilisé.

Fonctionnement :

- La synchronisation a lieu environ une minute après chaque modification, à intervalle régulier (15 min par défaut), au démarrage du navigateur, ou à la demande avec **Synchroniser maintenant**.
- Le fichier `threadshelf/library.json` du dépôt est lu, fusionné, puis renvoyé s'il a changé. La version la plus récente d'une entrée l'emporte, sans doublon ; le même thread enregistré sur deux PC ne fait qu'une entrée.
- Les **suppressions se propagent** et ne reviennent pas. Une restauration manuelle depuis une sauvegarde JSON l'emporte sur une suppression antérieure.
- Deux PC qui envoient en même temps : le conflit est détecté (`sha` du fichier) et la fusion recommence, rien n'est perdu.
- Chaque envoi crée un **commit** : l'historique du dépôt sert aussi de sauvegarde versionnée.
- Facultatif (Options avancées) : **chiffrement de bout en bout** avec une phrase secrète identique sur chaque PC.
- Les images et les préférences restent propres à chaque PC.
- **Se déconnecter** efface l'accès GitHub de ce navigateur ; la bibliothèque locale est conservée. L'autorisation peut aussi être révoquée sur GitHub (_Settings → Applications → Authorized OAuth Apps_).

## Confidentialité

L'extension lit ce que X ou Reddit affiche dans votre onglet, sans utiliser leurs API privées ni leurs cookies de connexion. La synchronisation et la traduction distante éventuelles sont des actions distinctes, détaillées dans [PRIVACY.md](PRIVACY.md) et [SECURITY.md](SECURITY.md).

## Distribution aux clients et mises à jour

Via le Chrome Web Store (Arc, Chrome, Brave, Edge), avec mises à jour automatiques : voir [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md). Pour préparer une version :

```bash
npm run release -- minor
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) : modules, modèle de données, règles de reconstruction, choix techniques
- [TESTING.md](TESTING.md) : stratégie de test, couverture, distinction entre fixtures et site réel
- [SECURITY.md](SECURITY.md) : permissions, modèle de menace, traitement des données
- [CHANGELOG.md](CHANGELOG.md)
- [PRIVACY.md](PRIVACY.md) : confidentialité de l'extension et de la PWA (coordonnées à compléter avant diffusion Store)
- [CONTRIBUTING.md](CONTRIBUTING.md) : installation de développement, tests, propositions et signalement des bugs
- [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) et [docs/store-listing.md](docs/store-listing.md) : publication et mises à jour

Aucune licence n'est incluse : les droits d'utilisation n'ont pas été définis par le propriétaire du projet.
