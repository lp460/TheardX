# Architecture

## Vue d'ensemble

```
x.com (onglet)                                     Extension (origine chrome-extension://…)
┌───────────────────────────────┐   messages    ┌──────────────────────────────────────────┐
│ content script (content.js)   │  validés zod  │ service worker (background.js)            │
│  extraction → observe →       │ ───────────▶  │  handlers → Repository (Dexie/IndexedDB) │
│  CaptureSession (graphe)      │ ◀───────────  │  media-cache (pbs.twimg.com)             │
│  UI : barre, boutons, panneau │               │  commands, menus contextuels             │
└───────────────────────────────┘               └──────────────────────────────────────────┘
                                                   ▲ IndexedDB partagé (même origine)
                                                   │
                                   popup · bibliothèque · lecteur · options (React)
```

Un content script ne peut pas ouvrir l'IndexedDB de l'extension (il s'exécute dans l'origine de x.com). Toutes ses écritures passent donc par le service worker. Les pages de l'extension lisent et écrivent directement via `Repository` ; les mises à jour se propagent entre contextes grâce à `liveQuery` de Dexie.

## Modules (`src/`)

| Dossier                                     | Rôle                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types/`                                    | Modèle de domaine (`Tweet`, `Entry`, `Relation`, `Completeness`…), indépendant du DOM de X                                                                                                                                                                         |
| `utils/`                                    | URL (normalisation, routes, liens sûrs), snowflake (date d'un ID), texte, formats, presse-papiers, téléchargement, détection des capacités                                                                                                                         |
| `extraction/`                               | Lecture du DOM : stratégies `xds` (mise en page actuelle de X) et `classic` (`data-testid`), texte structuré, médias, cartes, citations, **lignes de thread** (`connectors.ts`)                                                                                    |
| `thread-engine/`                            | `observe` (scan → preuves), `ThreadGraph` (fusion, déduplication, refus des cycles), `reconstruct` (modes A–D, états de complétude), libellés                                                                                                                      |
| `storage/`                                  | Schéma Dexie versionné + migrations, `Repository` (transactions), recherche, cache média, sauvegarde/import, validation zod                                                                                                                                        |
| `export/`                                   | Markdown, texte, HTML autonome, JSON — fonctions pures sur un `EntryBundle`                                                                                                                                                                                        |
| `messaging/`                                | Protocole typé et validé (zod) entre contextes                                                                                                                                                                                                                     |
| `background/`                               | Service worker : routage des messages, contrôle de l'expéditeur, raccourcis, menus contextuels                                                                                                                                                                     |
| `content/`                                  | Contrôleur (observer, session, actions), UI injectée (Shadow DOM)                                                                                                                                                                                                  |
| `components/`                               | Composants partagés : `TweetCard`, `ThreadCard`, `ExportDialog`, `SettingsPanel`, `CollectionManager`, `SearchCommand`, `ToastNotification`, primitives (Radix)                                                                                                    |
| `library/`, `reader/`, `popup/`, `options/` | Pages de l'extension                                                                                                                                                                                                                                               |
| `settings/`                                 | Schéma des préférences (zod, valeurs par défaut, récupération des valeurs corrompues) et stockage                                                                                                                                                                  |
| `adapters/`                                 | Contrat `ContentAdapter` et adaptateur X (prévu pour d'autres sites)                                                                                                                                                                                               |
| `ai/`                                       | Interface pour l'IA facultative — aucun fournisseur livré, consentement obligatoire                                                                                                                                                                                |
| `sync/`                                     | Synchronisation GitHub : client REST et création du dépôt (`github.ts`), connexion Device Flow (`device-flow.ts`, `github-app.ts`), chiffrement (`crypto.ts`), moteur de fusion (`engine.ts`), secrets locaux ; côté service worker : `background/sync-service.ts` |

Composants demandés et leur emplacement : `CaptureAction` correspond à `CaptureBar` dans `content/ui/inline.ts` (vanilla, Shadow DOM). `FloatingPanel` se trouve dans `content/ui/FloatingPanel.tsx`, `LibraryView` dans `library/LibraryView.tsx`, `ThreadReader` dans `reader/ThreadReader.tsx`.

## Extraction

X a changé de mise en page. En octobre 2026, la version servie aux visiteurs non connectés n'utilise plus `article[data-testid="tweet"]` : elle repose sur des classes utilitaires, des `article` de premier niveau dans `main ul > li`, des citations sous forme d'`article` imbriqué dans `[role=link][data-href]`, et `data-engagement-action`. Les deux mises en page sont prises en charge :

| Donnée           | Mise en page actuelle (`xds`)                                                                                    | Classique                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ID               | `[data-engagement-action=reply] a[href*=in_reply_to=]`, puis lien horaire                                        | `a[href*=/status/]` contenant `time`                                               |
| Date             | JSON d'un script en ligne (`"timestamp"`), sinon snowflake                                                       | `time[datetime]`, sinon snowflake                                                  |
| Auteur           | `img[alt="@handle"]` de l'avatar, lien du nom                                                                    | `[data-testid=User-Name]`                                                          |
| Texte            | `div[dir=auto].whitespace-pre-wrap`                                                                              | `[data-testid=tweetText]`                                                          |
| Citation         | `article` imbriqué + `data-href`                                                                                 | `[role=link]` contenant un second `User-Name`                                      |
| Lignes de thread | `span.absolute.w-0.5` dans la colonne de l'avatar (`top-5 -bottom-3` = vers le bas, `-top-3 h-8` = vers le haut) | élément de 2 px à côté de l'avatar (style calculé, puis géométrie, puis ordre DOM) |

Le texte est stocké sous forme de **segments** (texte, lien, mention, hashtag, cashtag), jamais en HTML. Le bouton « Voir plus » est ignoré et marque le texte comme tronqué. Les textes alternatifs génériques (« Image ») ne sont pas conservés comme description.

La date vient de la page ou, à défaut, de l'ID snowflake ; c'est une donnée vérifiable, la source est conservée (`createdAtSource`). Rien n'est inventé : un champ absent reste absent.

## Reconstruction des threads

Principe : **une succession de publications du même auteur n'est pas une preuve.** `observe()` ne crée une relation de réponse que si X l'affiche :

1. **Ligne de connexion** : la cellule A a une ligne vers le bas et la suivante B une ligne vers le haut, donc A → B.
2. **Chaîne des parents** : sur une page de statut, X affiche au-dessus de la publication ouverte ses parents successifs, de façon ininterrompue.
3. **Publication supprimée entre deux** : la relation est conservée et marquée `gap`.

Des **faits** sont aussi enregistrés par publication :

- `isRoot` : rien n'est connecté au-dessus d'elle sur sa page de statut ;
- `continuation` : `none`, `more` (ligne vers le bas mais suite non chargée) ou `unknown` ;
- `parentUnavailable` : le parent est une publication supprimée ou indisponible.

`reconstructAuthorThread()` remonte puis descend par les relations vérifiées, en restant sur le même auteur. Le message auquel répond un thread devient `contextTweetIds` : il est affiché comme contexte et jamais mélangé au thread.

| État                | Condition                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `complete`          | début vérifié (racine, ou parent d'un autre auteur) **et** fin vérifiée (`continuation: none`), sans trou ni branche |
| `needs_more`        | début ou suite non chargés (ligne présente mais publication absente)                                                 |
| `partial`           | trou (publication supprimée), branche, page qui n'est pas un statut, ou fin non vérifiable                           |
| `unreconstructable` | aucune preuve structurelle                                                                                           |

Garde-fou : si aucune ligne n'est reconnue sur la page alors que la même personne publie juste en dessous, la fin est `unknown`. Si X change de DOM, on obtient donc un état « partiel », jamais un faux « complet ».

**Virtualisation et capture progressive.** X retire de la page les cellules qui sortent de l'écran. La `CaptureSession` du content script accumule tout ce qui a été affiché (graphe, faits). Le `Repository` refusionne le graphe stocké avec les nouvelles preuves. Une entrée existante qui partage des publications est **mise à jour**, jamais dupliquée. Le « suivi actif » renvoie automatiquement les nouvelles publications reliées pendant 10 minutes au plus.

## Modèle de données (IndexedDB `threadshelf`, schéma v2)

| Table                       | Clé / index                                                                      | Contenu                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tweets`                    | `id`, `authorKey`, `createdAt`, `lastSeenAt`                                     | publications (texte structuré, médias, citation, faits). Partagées entre entrées, dédupliquées par ID                                                                   |
| `entries`                   | `id`, `kind`, `focalTweetId`, `*tweetIds`, `savedAt`, `*tags`, `*collectionIds`… | éléments de la bibliothèque : ordre, contexte, références, complétude, état de lecture, favori, note, tags, collections, catégorie, état hors ligne, texte de recherche |
| `relations`                 | `id`, `parentId`, `childId`, `type`                                              | réponses (avec source et `gap`), citations, liens                                                                                                                       |
| `collections`, `categories` | `id`                                                                             | regroupements                                                                                                                                                           |
| `media`                     | `url`, `*tweetIds`, `status`                                                     | images en cache (`Blob`), état `cached`/`remote`/`failed`/`too-large`                                                                                                   |
| `meta`                      | `key`                                                                            | réservé                                                                                                                                                                 |

Les migrations sont déclarées dans `storage/db.ts` (`SCHEMA_VERSIONS`). La v2 ajoute le cache média et complète les entrées v1, ce qui est testé. Chaque écriture multi-tables est une transaction Dexie. La suppression d'une entrée nettoie les publications, relations et médias qui ne sont plus utilisés.

Les **préférences** sont dans `chrome.storage.local`, pas dans IndexedDB : le content script doit les lire et être notifié des changements, ce que `storage.onChanged` permet. Elles sont incluses dans la sauvegarde JSON.

## Interface

- **Dans X** : la barre sous la publication ouverte et les boutons par publication sont de petits éléments vanilla, chacun dans son propre Shadow DOM. Ils sont ajoutés à la fin de la ligne d'actions de X, sans rien remplacer. Le panneau et les notifications sont une racine React montée à la demande dans un unique `threadshelf-root` (Shadow DOM, CSS Tailwind isolé, preflight désactivé). Le thème suit celui de X.
- **Observer** : un seul `MutationObserver` (`childList`, `subtree`) dont le traitement est limité à une analyse toutes les 250 ms (`requestIdleCallback`). Il ignore les mutations causées par ThreadShelf, se met en pause quand l'onglet est caché et se déconnecte à la désactivation. Le cache d'extraction est indexé par élément avec une signature. La double injection est empêchée par un drapeau global et la vérification des hôtes existants.
- **Navigation SPA** : détectée par les mutations, `popstate` et la Navigation API (`currententrychange`).
- **Pages** : React 19, Tailwind 3, Radix (Dialog, AlertDialog, DropdownMenu, Popover, Tooltip), cmdk pour la palette ⌘K, lucide-react. Le thème passe par des variables CSS HSL et la classe `.dark`. `prefers-reduced-motion` est respecté et des limites d'erreur sont en place sur chaque page.

## Synchronisation entre PC (GitHub)

```
PC A ──┐  lire library.json ─► fusion (mode « sync ») ─► export déterministe ─► écrire si différent  ┌── PC B
       └────────────────────────── dépôt GitHub privé (1 fichier, 1 commit par envoi) ──────────────┘
```

- **Connexion** : OAuth **Device Flow**.
  - `POST github.com/login/device/code` renvoie un code utilisateur, affiché et copié ; la page github.com/login/device s'ouvre.
  - La page des paramètres interroge le service worker toutes les `interval` secondes. Le service worker appelle `POST github.com/login/oauth/access_token` et respecte `authorization_pending` et `slow_down`. L'état en attente est gardé dans `chrome.storage.session`, ce qui survit à l'arrêt du service worker.
  - Pas de _client secret_, pas d'URI de redirection, pas de permission `identity`.
  - Ensuite, `GET /user` puis recherche ou création (`POST /user/repos`, `private: true`, `auto_init: true`) du dépôt `<login>/threadshelf-data`.
- **Stockage distant** : `threadshelf/library.json`, lu et écrit avec l'API Contents (`Authorization: Bearer`). Au-delà de 1 Mo, le contenu est relu via le type `application/vnd.github.raw+json`.
- **Fusion** : `importLibrary(…, { strategy: 'sync' })`.
  - Par entrée, la version dont `updatedAt` est le plus récent gagne entièrement (un tag retiré reste retiré).
  - Les collections et catégories suivent la même règle.
  - Le même contenu enregistré sur deux PC converge vers un seul identifiant (le plus petit).
- **Suppressions** : marqueurs `entry:<id>`, `collection:<id>`, `category:<id>` avec date, stockés dans la table `meta` et transportés dans le fichier. Un élément est supprimé si un marqueur est au moins aussi récent que sa dernière modification. Une restauration manuelle (import JSON) ravive les éléments avec une date neuve.
- **Envoi** : JSON à clés triées, sans `searchText` ni médias. Le hash SHA-256 de la partie données est comparé au fichier distant ; si rien n'a changé, rien n'est envoyé (pas d'aller-retour entre PC).
- **Concurrence** : `PUT` avec le `sha` lu. Si un autre PC a écrit entre-temps (409, ou 422 sur `sha`), le cycle lecture-fusion-écriture recommence, jusqu'à 3 fois.
- **Chiffrement facultatif** : enveloppe `threadshelf.encrypted` (AES-GCM 256, PBKDF2-SHA-256 à 310 000 itérations, sel et IV aléatoires).
- **Déclencheurs** : `chrome.alarms` (périodique, 15 min par défaut), `Dexie.on('storagemutated')` (environ 1 min après une modification), démarrage du navigateur, bouton « Synchroniser maintenant ». Une seule synchronisation à la fois. L'état est conservé dans `chrome.storage.local`.
- **Permissions** : `https://github.com/*` et `https://api.github.com/*` sont des permissions d'hôte **facultatives**, demandées au clic de connexion.

## Compilation

`scripts/build.mjs` lance trois builds Vite :

1. les pages (multi-pages, modules ES) ;
2. le service worker (un module ES) ;
3. le content script, en IIFE classique (un content script MV3 ne peut pas être un module), avec la CSS injectée via `?inline`.

Le script écrit ensuite `manifest.json` (généré par `src/manifest.mjs`) et les icônes. `scripts/validate-build.mjs` vérifie le résultat.

## Choix techniques

| Choix                                                                          | Raison                                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Pas de dépendance à `chrome.sidePanel`                                         | Arc ne l'affiche pas ; popup, panneau injecté et onglets fonctionnent partout                                    |
| Tailwind 3 plutôt que 4                                                        | Tailwind 4 s'appuie sur `@property`, ignoré dans un Shadow DOM                                                   |
| Primitives Radix directement (style shadcn/ui) plutôt que le générateur shadcn | Contrôle total, pas de code généré à maintenir                                                                   |
| zod en mode `jitless`                                                          | La CSP des extensions interdit `new Function`                                                                    |
| Pas de permission `downloads` ni `tabs`                                        | Les exports se font par lien `blob:` depuis les pages de l'extension ; l'onglet actif est accessible sans `tabs` |
| Les vidéos ne sont jamais téléchargées                                         | Flux MSE non stockables, et respect des conditions de X ; on garde le poster et un lien                          |
| Interface en français, sans framework i18n                                     | Utilisateur francophone ; les libellés sont centralisés dans les composants                                      |
