# Politique de confidentialité — TheardX (extension et web)

_Dernière mise à jour : 4 novembre 2026. Coordonnées du responsable à compléter avant publication au Chrome Web Store._

TheardX comprend une extension Chromium (appelée ThreadShelf dans certaines interfaces historiques) et une application web/PWA hébergée sur Vercel. **L'extension est principalement locale ; la version web utilise aussi des services distants.** Les traitements des deux versions sont décrits séparément ci-dessous.

## Données traitées

- **Publications que vous enregistrez.** Quand vous cliquez sur un bouton ThreadShelf, l’extension lit le contenu affiché dans votre onglet X ou Reddit : texte, auteur, date, images, liens, Articles, commentaires. Elle l’enregistre dans le stockage local de votre navigateur (IndexedDB). Rien n’est enregistré sans votre action.
- **Vos annotations** : notes, tags, collections, catégories, états de lecture.
- **Vos préférences** : stockées localement (`chrome.storage.local`).

ThreadShelf ne lit ni vos messages privés, ni vos identifiants, ni vos cookies, ni vos jetons de session X ou Reddit. Il n’utilise pas les API de X ni de Reddit.

**Reddit est facultatif.** ThreadShelf n’accède à reddit.com qu’après votre accord, demandé par le navigateur quand vous activez Reddit dans les Paramètres. Vous pouvez retirer cet accès à tout moment en désactivant l’option.

## Ce qui quitte votre appareil

**Dans l'extension**, par défaut aucun contenu de bibliothèque n'est envoyé à notre serveur. Les exceptions et fonctionnalités facultatives sont :

1. **Images des publications enregistrées.** Elles sont téléchargées une fois depuis `pbs.twimg.com` (le serveur d’images de X) ou depuis les serveurs d’images de Reddit (`i.redd.it`, `preview.redd.it`…) pour la lecture hors ligne, sans cookies. C’est désactivable dans Paramètres → Hors ligne.
2. **Synchronisation GitHub (facultative, désactivée par défaut dans l'extension).** Si vous cliquez sur « Se connecter avec GitHub », votre bibliothèque est envoyée dans un dépôt **privé** `threadshelf-data` de **votre** compte GitHub. Vous pouvez la chiffrer de bout en bout avec une phrase secrète (AES-256). **Sans chiffrement, GitHub héberge le contenu lisible de votre bibliothèque dans ce dépôt privé.** Le jeton d'accès est conservé dans le stockage de l'extension, hors des exports. Vous pouvez révoquer l'autorisation depuis GitHub.
3. **Traduction.** La traduction utilise le traducteur **intégré** de votre navigateur, sur l’appareil : aucun texte n’est envoyé. Si ce traducteur n’est pas disponible, un bouton « Ouvrir dans Google Traduction » peut ouvrir le texte sur translate.google.com, **uniquement si vous cliquez dessus**.

## Application web / PWA

- Les démonstrations sont accessibles sans connexion. Pour accéder à une bibliothèque personnelle synchronisée, la connexion GitHub est nécessaire. La bibliothèque, y compris les annotations et notes personnelles, est conservée dans IndexedDB et synchronisée avec **votre dépôt GitHub privé**.
- La connexion GitHub sur le web utilise un cookie de session chiffré `HttpOnly`, `Secure` et `SameSite=Lax` en HTTPS. Le jeton n'est pas communiqué au JavaScript du navigateur. Le serveur utilise l'API GitHub pour les opérations limitées à `threadshelf-data`.
- **Autorisation GitHub :** le scope OAuth `repo` donne potentiellement accès à l'ensemble de vos dépôts privés, même si TheardX limite ses opérations à `threadshelf-data`. Vous pouvez révoquer cet accès dans les paramètres GitHub.
- Pour télécharger des images en mode hors ligne, la PWA peut utiliser un proxy sur Vercel vers les hôtes d'images autorisés.
- **Traduction distante sur accord :** si le navigateur ne peut pas traduire localement, vous pouvez accepter d'envoyer le texte choisi à Vercel AI Gateway et au fournisseur IA configuré. Rien n'est envoyé à ce service sans cette action de consentement. Les traductions sont enregistrées localement.

## Partage par lien

Un lien de partage est créé **uniquement à votre demande**. Une copie de lecture seule de l'article ou de la collection choisie est enregistrée dans Vercel Blob et accessible à **toute personne possédant le lien**, sans connexion GitHub. Les notes, annotations, surlignages privés, favoris, tags et jetons ne figurent pas dans cette copie. Les liens peuvent expirer ou être révoqués, mais leur destinataire a pu conserver une copie du contenu.

## Ce que nous ne faisons pas

- Aucun outil de statistiques comportementales ou de publicité n'est intégré au projet.
- Aucune vente de bibliothèque à des tiers. Les transferts **déclenchés par l'utilisateur** (GitHub, partage, traduction distante) sont décrits ci-dessus. L'hébergeur et les fournisseurs peuvent traiter des données techniques nécessaires au service.
- L'extension ne collecte pas les identifiants, cookies ni messages privés X/Reddit.

## Conservation et suppression

Les données locales restent dans votre navigateur jusqu'à suppression. Vous pouvez exporter votre bibliothèque avant d'effacer des données non synchronisées. **Se déconnecter ne supprime pas le dépôt GitHub privé** : vous pouvez le supprimer depuis GitHub. Un lien de partage révoqué devient inaccessible depuis TheardX, sans effacer les copies déjà téléchargées par les destinataires.

## Contact

Pour toute question ou anomalie : [ouvrir une issue TheardX](https://github.com/lp460/TheardX/issues/new/choose). **Ne publiez jamais de code OAuth, jeton GitHub, phrase secrète ou données personnelles dans une issue publique.** L'adresse de contact et l'identité du responsable restent à renseigner avant une diffusion publique dans un Store.

---

# Privacy policy — TheardX (browser extension and web app)

_Updated November 4, 2026. Add the project owner's contact details before a public store release._

TheardX includes a mostly local Chromium extension (historically called ThreadShelf) and a Vercel-hosted web/PWA. **The web version uses additional server-side services.** Reddit access in the extension is opt-in.

- **Saved posts** (text, author, date, images, links, Articles) are read from your X tab only when you click a ThreadShelf button, and stored locally (IndexedDB), together with your notes, tags, collections and preferences.
- **In the extension, data leaves your device only for optional features:**
  - images of saved posts, downloaded once from `pbs.twimg.com` for offline reading (can be turned off);
  - optional **GitHub sync** to a **private** repository in **your own** GitHub account, optionally end-to-end encrypted;
  - **Google Translate** only if you click « Ouvrir dans Google Traduction ». Built-in translation runs on-device.
- **Web/PWA:** signing in with GitHub is required to access the synced private library. Articles, personal notes and highlights are kept in local storage and synced to **your private** `threadshelf-data` repository. The server keeps the GitHub access token in an encrypted `HttpOnly` cookie, not browser JavaScript. GitHub's `repo` OAuth scope can grant access to all private repositories, even though TheardX limits operations to `threadshelf-data`.
- **Web image downloads** may use a Vercel server proxy. **Cloud translation** sends user-approved text to Vercel AI Gateway and its configured provider only after consent if local translation is unavailable.
- **Public sharing:** when you explicitly create a share link, a read-only snapshot is stored in Vercel Blob and readable by anyone with the link. Personal notes, highlights, comments and tokens are excluded. Revoking or expiring a link does not erase copies recipients saved earlier.
- **No behavioural analytics or advertising** are built into TheardX. Providers may process operational data under their own terms. The extension does not access your X/Reddit credentials, cookies or private messages.
- **Deletion:** delete local items or browser data after exporting unsynced changes. A GitHub-synced copy remains until you remove it from GitHub; signing out does not delete it.

Contact and bug reports: [TheardX issues](https://github.com/lp460/TheardX/issues/new/choose). Do not post OAuth codes, tokens, passphrases or private content in public issues. Project owner contact details must be added before public store release.
