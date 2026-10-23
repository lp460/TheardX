# Fiche Chrome Web Store — textes prêts à copier

## Identité

- **Nom** : `ThreadShelf — Enregistrez vos threads X`
- **Catégorie** : Productivité
- **Langue principale** : Français (ajouter l’anglais avec les textes plus bas)
- **Icône** : `artifacts/store/icon-128.png`
- **Vignette promotionnelle (440×280)** : `artifacts/store/promo-small.png`
- **Captures (1280×800)** : `artifacts/store/screenshot-2.png` à `screenshot-5.png`. Pour la première capture, prenez de préférence une vraie capture de x.com dans Arc avec le menu ThreadShelf ouvert, recadrée en 1280×800. `screenshot-1.png` montre ce menu sur une page de test.

## Description courte (132 caractères maximum)

> Enregistrez, lisez, copiez et organisez threads, posts et Articles X. Bibliothèque locale, mode lecture, exports, synchro GitHub.

## Description détaillée (FR)

> ThreadShelf transforme les threads de X en une bibliothèque personnelle agréable à lire.
>
> • Un bouton ThreadShelf sur chaque publication : enregistrer le thread entier, une publication, ou une sélection ; copier en Markdown ou en texte ; ouvrir dans le lecteur.
> • Reconstruction fiable des threads : seules les publications réellement reliées par l’auteur sont gardées, sans les réponses des autres. ThreadShelf indique si le thread est complet ou s’il faut faire défiler pour charger la suite, et complète l’entrée automatiquement pendant le défilement.
> • Articles X (publications longues) enregistrés en entier : intertitres, blocs de code, images.
> • Reddit (facultatif) : posts et discussions enregistrés avec leur arbre de commentaires.
> • Lecteur sans distraction : thèmes clair et sombre, police serif ou sans-serif, taille et largeur réglables, sommaire, raccourcis clavier, notes.
> • Traduction intégrée, sur votre appareil, sans envoyer vos données.
> • Bibliothèque : recherche instantanée, collections, catégories, tags, favoris, « À lire plus tard », actions groupées, détection des doublons.
> • Exports TXT, Markdown, HTML autonome, JSON et PDF. Images conservées pour la lecture hors ligne.
> • Synchronisation facultative entre vos ordinateurs via un dépôt GitHub privé, chiffrement de bout en bout possible.
>
> Respect de la vie privée : tout reste sur votre appareil. Aucun compte, aucun serveur ThreadShelf, aucune statistique d’usage.
>
> ThreadShelf est un outil indépendant, non affilié à X Corp.

## Description détaillée (EN)

> ThreadShelf turns X threads into a personal, beautifully readable library.
>
> • A ThreadShelf button on every post: save the whole thread, one post or a selection; copy as Markdown or text; open in the reader.
> • Reliable thread reconstruction: only the posts the author actually connected, never other people's replies. ThreadShelf shows whether a thread is complete or needs more scrolling, and fills the entry in as you scroll.
> • Long-form X Articles saved in full: headings, code blocks, images.
> • Reddit (optional): posts and discussions saved with their comment tree.
> • Distraction-free reader: light and dark themes, serif or sans-serif, adjustable size and width, table of contents, keyboard shortcuts, notes.
> • Built-in on-device translation; your data is not sent anywhere.
> • Library: instant search, collections, categories, tags, favourites, read later, bulk actions, duplicate detection.
> • Export to TXT, Markdown, standalone HTML, JSON and PDF. Images kept for offline reading.
> • Optional sync between your computers through a private GitHub repository, optionally end-to-end encrypted.
>
> Privacy first: everything stays on your device. No account, no ThreadShelf server, no analytics.
>
> ThreadShelf is an independent tool, not affiliated with X Corp.

## Onglet « Pratiques de confidentialité »

**Objectif unique** :

> Enregistrer, lire, copier et organiser les publications et threads de X.com que l’utilisateur choisit.

**Justification des permissions** :

| Permission                                       | Justification                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                        | Enregistrer les préférences de l’utilisateur.                                                                                                                       |
| `unlimitedStorage`                               | La bibliothèque et les images des publications enregistrées pour la lecture hors ligne sont stockées localement et peuvent dépasser le quota par défaut.            |
| `contextMenus`                                   | Menu clic droit « Enregistrer cette publication / ce thread dans ThreadShelf ».                                                                                     |
| `clipboardWrite`                                 | Copier un thread en Markdown ou en texte depuis la page X, y compris par raccourci clavier.                                                                         |
| `alarms`                                         | Synchronisation périodique facultative avec le dépôt GitHub de l’utilisateur.                                                                                       |
| `scripting`                                      | Activer le bouton ThreadShelf sur reddit.com, uniquement après que l’utilisateur a accordé l’accès facultatif à Reddit dans les paramètres.                         |
| Hôtes facultatifs Reddit (`reddit.com`, images)  | Demandés seulement si l’utilisateur active Reddit : lire la page Reddit affichée et télécharger les images des posts enregistrés pour la lecture hors ligne.        |
| Hôte `pbs.twimg.com`                             | Télécharger les images des publications que l’utilisateur a enregistrées, pour la lecture hors ligne.                                                               |
| Hôtes facultatifs `github.com`, `api.github.com` | Demandés seulement si l’utilisateur active la synchronisation GitHub : connexion (device flow) et lecture-écriture du fichier de bibliothèque dans son dépôt privé. |
| Script de contenu sur `x.com` et `twitter.com`   | Afficher le bouton ThreadShelf et lire le contenu des publications que l’utilisateur décide d’enregistrer.                                                          |

**Code distant** : Non, aucun code distant n’est utilisé.

**Données utilisées**, cases à cocher :

- _Contenu du site Web_ : oui (les publications X enregistrées par l’utilisateur, stockées localement).
- _Informations d’authentification_ : oui, uniquement si la synchronisation GitHub est activée (le jeton OAuth GitHub, stocké localement et jamais transmis à l’éditeur).
- Toutes les autres catégories : non.

**Certifications** :

- Les données ne sont pas vendues à des tiers.
- Les données ne sont pas utilisées à des fins sans rapport avec l’objectif unique.
- Les données ne sont pas utilisées pour évaluer la solvabilité ni pour des prêts.

**Politique de confidentialité (URL)** : publiez `PRIVACY.md` (voir docs/DISTRIBUTION.md, étape 2) et collez son URL.
