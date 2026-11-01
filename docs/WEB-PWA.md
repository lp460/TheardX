# TheardX Web/PWA — Vercel

La version web partage **React 19, Vite, Dexie, le lecteur, les exports et le moteur de fusion** avec l'extension. Les builds sont indépendants : `npm run build` continue de produire l'extension MV3 dans `dist/`, `npm run build:web` produit la PWA dans `dist-web/`.

## Installation et déploiement

1. Créer une **nouvelle application OAuth GitHub dédiée au web** depuis GitHub Developer Settings. Ne pas modifier l'OAuth App `ThreadShelf` existante, qui utilise le Device Flow dans l'extension.
   - Homepage URL : `https://<domaine-vercel>`
   - Authorization callback URL : `https://<domaine-vercel>/api/auth/callback`
   - Le site demandera le scope `repo`, requis par le stockage existant en dépôt privé. Pour une distribution à grande échelle, migrer ultérieurement vers une GitHub App à permissions limitées au dépôt sélectionné.
2. Lier le dépôt `lp460/TheardX` à Vercel, framework `Vite`, racine du dépôt, build `npm run build:web`, sortie `dist-web`.
3. Définir les variables d'environnement **côté serveur** dans Vercel :

   | Variable | Valeur |
   | --- | --- |
   | `WEB_ORIGIN` | URL HTTPS exacte (sans `/` final) |
   | `GITHUB_WEB_CLIENT_ID` | Client ID de la nouvelle OAuth App web |
   | `GITHUB_WEB_CLIENT_SECRET` | Secret de cette OAuth App (ne jamais committer) |
   | `SESSION_SECRET` | Secret fort aléatoire, au moins 32 caractères |

4. Déployer d'abord une preview. La connexion OAuth requiert une callback configurée pour cette URL exacte ; si les preview URLs changent, tester avec un domaine de staging stable. Ne pas publier en production avant un test réel de connexion et de synchronisation.

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
