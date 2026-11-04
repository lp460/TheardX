# TheardX Web/PWA — Vercel

La version web partage **React 19, Vite, Dexie, le lecteur, les exports et le moteur de fusion** avec l'extension. Les sorties restent distinctes : `npm run build` continue de produire l'extension MV3 dans `dist/`, `npm run build:web` produit la PWA dans `dist-web/` et prépare en plus un ZIP de la même extension pour téléchargement.

## Interface web et distribution

- L'accueil présente TheardX et permet de choisir Français, English ou Español. Le choix de langue est mémorisé dans le navigateur et ne modifie pas les préférences de l'extension.
- Sur iPhone, la bibliothèque affiche des cartes sur toute la largeur et les filtres sont repliés derrière un bouton dédié. La navigation principale reste en bas de l'écran ; les collections et catégories sont dans le panneau « Menu ». Dans le lecteur, les actions secondaires (copie, export, impression) passent dans un menu compact.
- L'accueil reste disponible après connexion via le bouton « Accueil » en haut de la bibliothèque, puis « Accéder à ma bibliothèque » pour revenir à la lecture.
- Le bouton « Télécharger le ZIP » de l'accueil fournit `/downloads/threadshelf-extension.zip`, construit à partir de la même version de l'extension MV3 au cours de `npm run build:web`. **Ce n'est pas une installation automatique** : décompresser l'archive et charger son dossier en mode développeur sur un navigateur Chromium desktop (Chrome, Arc, Brave ou Edge).
- Sur iPhone/iPad, utiliser plutôt la PWA via Safari → Partager → Sur l'écran d'accueil. L'extension Chromium desktop n'est pas installable telle quelle sur Safari iOS.
- Les textes des posts et discussions ne sont pas traduits automatiquement quand on change la langue de l'interface.
- Dans le lecteur Safari, « Réglages de lecture » → « Traduction automatique sur Safari » active, **sur consentement explicite**, la traduction des posts et articles via Vercel AI Gateway. La langue cible reste celle du lecteur. Le texte est envoyé à Vercel et au fournisseur IA ; les traductions sont enregistrées dans Dexie, réutilisées hors ligne, et ne remplacent jamais les originaux. Le bouton manuel « Traduire » demande le même consentement la première fois. L'extension garde la traduction locale Chrome et ne contacte jamais cette API.

## Installation et déploiement

1. **Réutiliser l'application OAuth GitHub `ThreadShelf` de l'extension.** GitHub permet depuis août 2026 d'enregistrer plusieurs URL de callback sur une même OAuth App. Dans GitHub Developer Settings → OAuth Apps → ThreadShelf, **conserver** les URLs existantes et l'option « Enable Device Flow », puis **ajouter** les callbacks web :
   - Production : `https://theard-x.vercel.app/api/auth/callback`
   - Prévisualisation (branche dédiée) : `https://theard-x-git-feat-web-pwa-vercel-lp-9f5d.vercel.app/api/auth/callback`
   - Garder une correspondance exacte des URLs et désactiver le « wildcard matching » pour les nouvelles callbacks. Le Device Flow de l'extension ne dépend pas des callbacks web et reste inchangé.
   - Le site demandera le scope `repo`, requis par le stockage existant en dépôt privé. Pour une distribution à grande échelle, migrer ultérieurement vers une GitHub App à permissions limitées au dépôt sélectionné.
2. Lier le dépôt `lp460/TheardX` à Vercel, framework `Vite`, racine du dépôt, build `npm run build:web`, sortie `dist-web`.
3. Définir les variables d'environnement **côté serveur** dans Vercel :

   | Variable | Valeur |
   | --- | --- |
   | `WEB_ORIGIN` | URL HTTPS exacte (sans `/` final) |
   | `GITHUB_WEB_CLIENT_ID` | Client ID de l'OAuth App `ThreadShelf` existante (égal à celui de l'extension) |
   | `GITHUB_WEB_CLIENT_SECRET` | Client Secret de cette même OAuth App (à renseigner uniquement dans Vercel, jamais dans Git) |
   | `SESSION_SECRET` | Secret fort aléatoire, au moins 32 caractères |

4. Déployer d'abord une preview. La connexion OAuth requiert une callback configurée pour cette URL exacte ; utiliser l'alias stable de la branche, pas l'URL unique du build. Ne pas publier en production avant un test réel de connexion et de synchronisation.

### Traduction web dans Safari (optionnelle)

- Le lecteur utilise `POST /api/translate` uniquement si le navigateur ne dispose pas du `Translator` local **et** après consentement. L'API exige le cookie de session GitHub et une origine identique à `WEB_ORIGIN` ; elle refuse les requêtes trop longues. Le jeton GitHub n'est pas envoyé à AI Gateway. Les réponses sont `no-store` et exclues du cache du service worker.
- Vercel fournit automatiquement `VERCEL_OIDC_TOKEN` à ses Functions, sans ajouter de variable secrète. `AI_GATEWAY_API_KEY` n'est qu'un repli facultatif pour le développement hors Vercel. Les quatre variables OAuth et session existantes restent inchangées.
- Le modèle configuré est `google/gemini-2.5-flash-lite` via l'hébergement Google Vertex (politique *no training* et *ZDR*). Les textes sont traités sur le service distant, **pas localement**. La traduction n'est jamais lancée par défaut. Les données GitHub ne sont pas envoyées à ce service.
- AI Gateway offre actuellement jusqu'à **5 $ de crédits par période de 30 jours** aux équipes éligibles, après validation du moyen de paiement. Les modèles admissibles et les plafonds peuvent évoluer. Configurer un **budget projet** dans AI Gateway pour bloquer les dépenses non souhaitées, laisser le rechargement automatique désactivé et contrôler les journaux d'utilisation. L'application limite chaque requête à 6 000 caractères et chaque article à 100 000 caractères ; ces limites ne remplacent pas un budget côté Vercel.
- Si le compte Vercel n'est pas vérifié, que les crédits sont épuisés, ou que le modèle n'est pas accessible, le lecteur affiche une erreur sans modifier les articles. Une traduction déjà enregistrée reste accessible hors ligne.

### Liens de partage (articles et collections)

- Dans la bibliothèque **web uniquement**, ouvrir le menu `…` d'une carte → « Partager cette publication ». Pour une collection, l'ouvrir dans le menu latéral → « Partager la collection ». **Aucune action de partage n'est ajoutée au plugin MV3.**
- Choisir une durée : **7 jours**, **30 jours** ou **sans expiration**. Le lien `/s/<identifiant>` affiche une copie de lecture seule, accessible sans compte GitHub, sur mobile et ordinateur, en FR/EN/ES pour l'interface. L'article et les publications associées sont présentés avec le texte extrait et la source originale (une extraction déjà tronquée reste signalée).
- Le partage est **explicite** : seuls les posts appartenant aux entrées sélectionnées sont envoyés par `POST /api/share`. Le modèle de publication autorise une liste blanche de champs. Notes, tags privés, favoris, catégories, progression de lecture, relations de synchronisation, tokens et phrase secrète **ne sont jamais envoyés**. Les images référencent leurs URL publiques originales et ne sont pas copiées dans Blob.
- Le serveur conserve un instantané JSON dans un **Vercel Blob privé**, indépendant de GitHub et de Dexie. Il ne publie que le contenu autorisé via `GET /api/share?id=<id>` ; les URLs Blob privées ne sont jamais exposées. La création/suppression exige le cookie GitHub et la vérification d'origine ; les pages invitées n'ont pas besoin de cookie. Un identifiant aléatoire de 144 bits protège la découverte fortuite, sans remplacer une authentification : **toute personne possédant le lien peut lire la copie**.
- La boîte « Mes liens de partage » répertorie les liens du compte et permet de les révoquer via `DELETE /api/share?id=<id>`. La révocation et l'expiration sont vérifiées côté serveur ; les réponses ne sont pas mises en cache. Elles n'effacent pas les copies que les destinataires ont déjà conservées.
- Limites applicatives : **50 liens par compte**, **50 entrées par collection**, **1 Mo par création**. La page de lecture partagée a besoin d'une connexion pour charger le contenu ; le mode hors ligne existant de la bibliothèque privée reste inchangé. Une modification ultérieure de l'article local ne met pas à jour le partage déjà créé.

**Configuration Vercel :** créer un store **Blob Private** et le connecter au projet `theard-x`. Vercel fournit `BLOB_STORE_ID` (OIDC) ou `BLOB_READ_WRITE_TOKEN` selon la connexion. Ne jamais exposer ces identifiants côté client. Pour l'installation actuelle, le store `theardx-shares` est créé en région `cdg1`. Le service renvoie un message explicite si le stockage n'est pas connecté. La connexion du store doit précéder le déploiement de la fonctionnalité ; les quatre variables OAuth/session existantes restent inchangées.

## Utilisation

- Se connecter à GitHub avec **le même compte que dans l'extension**.
- La PWA lit/écrit le fichier existant `<login>/threadshelf-data`, chemin `threadshelf/library.json` ; elle n'en change ni le format ni la règle de fusion. L'extension doit avoir synchronisé ses données locales au moins une fois.
- Si la bibliothèque GitHub est chiffrée, la PWA demande la phrase secrète. Celle-ci reste en mémoire dans l'onglet ; aucune phrase secrète n'est envoyée au serveur Vercel. La PWA préserve le mode de chiffrement du fichier distant.
- Si le dépôt privé n'existe pas encore, connectez d'abord l'extension pour le créer, ou exportez/importe une sauvegarde JSON depuis les paramètres.
- Les textes et métadonnées synchronisés sont enregistrés dans IndexedDB. Les images sont mises en cache **sur chaque appareil** via un proxy Vercel authentifié à domaines strictement autorisés (8 Mo par image maximum) ; elles ne sont pas synchronisées via GitHub. Les vidéos restent des liens. Dans Paramètres → Synchronisation, un bouton permet de télécharger les images déjà enregistrées pour le mode hors ligne. Ces téléchargements consomment de la bande passante Vercel.
- L'interface et ses ressources statiques sont précachées par le service worker. Les modifications hors ligne sont écrites dans Dexie ; la synchronisation reprend au retour de la connexion, au focus et au plus tard lors de l'intervalle périodique dans un onglet ouvert. Elle n'est **pas** garantie pendant que la PWA est fermée.
- Une connexion Internet est nécessaire pour la toute première authentification. Les sessions expirées doivent être renouvelées en ligne.

## Sécurité et comptes

- Le jeton GitHub est scellé dans un cookie chiffré `HttpOnly`, `Secure` et `SameSite=Lax` (en HTTPS). Il n'est jamais exposé au JavaScript du navigateur. Le serveur limite les opérations au dépôt privé `<login>/threadshelf-data` et au fichier de bibliothèque existant.
- Les modifications sur `/api/sync` exigent une session et une vérification `Origin`. Les réponses API sont `no-store` et ne sont pas mises en cache par le service worker.
- Un navigateur avec une bibliothèque d'un autre compte GitHub est **bloqué**, sans suppression de ses données. Utiliser un profil distinct. La déconnexion conserve le cache local, mais bloque son affichage jusqu'à reconnexion.
- Les données du navigateur ne sont pas chiffrées au repos. Pour un appareil partagé, utiliser le mode privé ou effacer explicitement les données du site après avoir exporté sa sauvegarde.
- `SESSION_SECRET` doit rester stable entre les déploiements, sinon les sessions existantes seront invalidées.

## Développement

```bash
npm ci
npm run dev:web     # interface Vite, API proxy vers localhost:3000
npm run build:web   # sortie autonome avec sw.js, manifest et icônes
npm run typecheck
npm run lint
npm run test
npm run build       # contrôle que l'extension continue de compiler
```

Pour tester les fonctions Vercel en local, utiliser `vercel dev --listen 3000` avec les variables serveur configurées ; `npm run dev:web` ne fournit pas les fonctions `/api` à lui seul.

### Tests de validation requis avant production

1. Login GitHub, logout et expiration du cookie ; vérifier qu'aucun token ne se retrouve dans le HTML/JS ou les réponses API.
2. Importer les éléments depuis l'extension, lancer une synchronisation, puis vérifier la convergence sur deux appareils.
3. Sur un dépôt chiffré, tester phrase secrète correcte/incorrecte, et s'assurer que le fichier reste chiffré sur GitHub.
4. Sauvegarder un thread depuis l'extension et le retrouver dans la PWA ; modifier un favori hors ligne, rétablir le réseau et vérifier que l'extension reçoit le changement.
5. Installer sur Safari iOS, Chrome/Android et tester l'ouverture hors connexion après une première visite en ligne.
6. Vérifier le mode mobile 320/375/768 px et desktop, les exports, les lecteurs X/Reddit et les images absentes.

La PWA ne peut pas lire le DOM d'un onglet X.com ou Reddit ouvert dans un autre domaine : la capture continue de passer par l'extension navigateur.
