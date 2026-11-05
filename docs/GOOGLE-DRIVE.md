# TheardX — Google OAuth + Google Drive (branche de développement)

> **Ne pas déployer ni fusionner automatiquement.** Cette intégration nécessite des
> identifiants Google Cloud, des essais réels sur les navigateurs visés et une revue
> de sécurité avant sa mise en production. GitHub reste intact.

## Fonctionnement

- Connexion Web : OAuth 2.0 Google avec `state`, PKCE S256, `access_type=offline`,
  identité vérifiée via `userinfo` (`sub` stable). Les cookies sont HttpOnly,
  chiffrés AES-GCM, `Secure` en HTTPS, `SameSite=Lax` et renouvelés si nécessaire.
- Stockage : un dossier **TheardX** visible dans le Drive de chaque utilisateur.
  Seul le périmètre `drive.file` est demandé : l'application ne peut pas parcourir
  arbitrairement le Drive. Elle retrouve ses propres dossiers et sauvegardes.
- Synchronisation : chaque appareil publie une **nouvelle révision immuable**.
  Toutes les révisions sont réconciliées avec les règles existantes de fusion
  (entrées, tweets, catégories, annotations, suppressions/tombstones). Aucune
  écriture ne remplace directement la dernière version d'un autre appareil.
- Confidentialité : **au premier accès Google Drive, le Web demande si l'utilisateur
  souhaite activer le chiffrement renforcé**. Par défaut, le mode standard ne
  demande pas de phrase secrète et stocke les données sur son Drive au format JSON
  lisible. Google protège le compte et les échanges HTTPS, mais Google et les
  fonctions Vercel peuvent lire cette sauvegarde : **ce n'est pas du chiffrement
  de bout en bout**. En mode renforcé, les contenus sont chiffrés dans le navigateur
  (AES-GCM + PBKDF2) avant envoi ; la phrase secrète n'est jamais envoyée au serveur.
- Choix conservé sur Drive : une génération de révisions contient le mode choisi.
  Un autre appareil retrouve automatiquement le mode standard, ou demande la phrase
  secrète si la génération est chiffrée. Le changement dans Paramètres crée une
  **nouvelle génération** après fusion de la bibliothèque, sans effacer les
  versions précédentes. L'activation ultérieure du chiffrement **ne chiffre pas
  rétroactivement** les copies historiques non chiffrées.
- Photos et préférences restent locales, comme avec la synchronisation GitHub.
- Identités : `google:<sub>` et `github:<login>` sont isolées. Une autre identité
  dans le même profil navigateur est bloquée pour éviter les mélanges involontaires.

## Préparer Google Cloud (site Web)

1. Créer ou sélectionner un projet Google Cloud, activer **Google Drive API**.
2. Configurer l'écran de consentement OAuth pour TheardX, ses utilisateurs de
   test et les scopes `openid`, `email`, `profile`, `drive.file`.
3. Créer un client OAuth de type **Application Web**. Dans les _Authorized
   redirect URIs_, déclarer exactement :

   - En local (si le serveur de fonctions tourne) :
     `http://localhost:3000/api/auth/google/callback`.
   - En prévisualisation avec domaine canonique distinct :
     `https://VOTRE-PREVIEW/api/auth/google/callback`.
   - **Production, seulement après validation et sur demande explicite** :
     `https://theard-x.vercel.app/api/auth/google/callback`.

4. Pour l'environnement de **développement / preview uniquement**, définir :

   | Variable               | Valeur                                               |
   | ---------------------- | ---------------------------------------------------- |
   | `GOOGLE_CLIENT_ID`     | Identifiant OAuth Web Google (non secret)            |
   | `GOOGLE_CLIENT_SECRET` | Secret OAuth Web (variable secrète, jamais dans Git) |
   | `SESSION_SECRET`       | Clé de session déjà utilisée, au moins 32 caractères |
   | `WEB_ORIGIN`           | Domaine canonique exact de la prévisualisation       |

5. Mettre l'écran de consentement en production chez Google lorsque l'application
   sera prête à être ouverte aux autres utilisateurs. En statut _Testing_, les
   jetons de renouvellement peuvent expirer au bout de 7 jours. La vérification
   Google de l'application et de ses scopes doit être anticipée.

La route `GET /api/auth/providers` indique seulement quels fournisseurs sont
configurés, **sans publier leurs secrets**. Tant que Google n'est pas configuré,
le site n'affiche que le bouton GitHub historique.

## Préparer l'extension Chromium

L'extension prend en charge deux connexions Google, avec le même périmètre
`drive.file` :

- **Chrome** : `chrome.identity.getAuthToken()` utilise le client OAuth
  « Extension Chrome ». Le navigateur gère les jetons, aucun _refresh token_
  Google n'est sauvegardé par TheardX.
- **Arc / Brave** : `chrome.identity.launchWebAuthFlow()` démarre un code flow
  Google avec `state` aléatoire et PKCE S256. Le client OAuth Web **public**
  existant est intégré dans l'extension, mais **son secret reste uniquement
  dans Vercel**. Une fonction API échange ou renouvelle les jetons. Dans ce
  mode, le _refresh token_ est stocké localement dans `chrome.storage.local`,
  jamais dans les sauvegardes. La déconnexion l'efface du navigateur.

Pour autoriser ces fonctions :

1. L'**ID permanent de l'extension** est
   `finnpgeglikfoejkedoobkigbfgmbglf`, calculé à partir de la clé publique
   versionnée dans `src/extension-identity.mjs`. La propriété `manifest.key`
   est présente dans tous les ZIP de développement afin que l'ID ne dépende
   ni du chemin du dossier ni du poste où l'extension est installée.
2. Dans **le même projet Google Cloud que le site Web**, créer un **second
   client OAuth « Chrome Extension »** associé à cet ID. Les autorisations
   `drive.file` doivent appartenir à la même application Google ; ne pas
   réutiliser le secret du client OAuth Web.
3. Copier le **Client ID** public du client Chrome OAuth nouvellement créé dans
   `CHROME_OAUTH_CLIENT_ID` de `src/extension-identity.mjs` ; le manifeste inclut
   alors l'objet `oauth2` requis. Aucun secret ni variable Vercel supplémentaire
   ne sont nécessaires pour cette étape.
4. Pour **Arc / Brave**, ouvrir le client OAuth **Application Web** déjà
   utilisé par la Preview dans [Google Cloud → Clients OAuth](https://console.cloud.google.com/auth/clients?project=theardx).
   Ajouter **sans remplacer les URL existantes** cette adresse dans
   « URI de redirection autorisés » :

   `https://finnpgeglikfoejkedoobkigbfgmbglf.chromiumapp.org/google`

   Cette adresse est créée par `chrome.identity.getRedirectURL('google')`.
   Elle est différente du callback Web Vercel. L'ID Chrome reste inchangé.
   Aucune nouvelle variable d'environnement ni aucun nouveau secret ne sont
   nécessaires sur Vercel.

5. Installer l'extension, aller dans Paramètres → Synchronisation → Google,
   choisir **Google (Chrome)** ou **Google (Arc / Brave)** et autoriser les
   domaines demandés. La méthode Arc / Brave demande également l'accès
   au domaine API de la Preview, puisque l'échange du code se fait côté
   serveur. Se connecter sur **le même compte Google** que le Web.
   L'extension inspecte le Drive avant toute sauvegarde.
   Sur un Drive neuf, elle propose « Non, sans phrase secrète » ou « Oui,
   chiffrer ma bibliothèque ». Sur un Drive déjà configuré, le mode existant
   est respecté : en mode standard, aucun secret supplémentaire ; en mode
   renforcé, la même phrase secrète (8 caractères min.) que sur le Web.
6. Une fois connecté, le changement de protection est **explicite** dans les
   paramètres. Il fusionne d'abord les données, puis crée une nouvelle
   génération de sauvegardes. Les anciennes versions ne sont pas effacées.
   La synchronisation GitHub de l'extension reste indépendante.

Sans identifiant OAuth public au build, le bouton correspondant reste
désactivé, tandis que GitHub continue de fonctionner. La compatibilité
Arc / Brave / Edge doit être validée sur chaque navigateur. Le flux avec
fonction API n'a pas besoin du compte Google connecté au profil Chrome.
Le backend du ZIP **Preview** pointe vers le domaine Vercel Preview ; il
faudra définir un backend de production lors de la publication, après
validation. Si la Preview exige une connexion Vercel, l'accès API du plugin
peut être bloqué : ce cas doit être testé avant toute mise en production.

**Migration de l'ancienne extension :** la première installation sous l'ID
permanent peut apparaître comme une nouvelle extension et ne pas retrouver la
bibliothèque locale de l'ancien ID. Avant de supprimer l'ancienne extension,
exporter une sauvegarde JSON de la bibliothèque, installer le nouveau ZIP,
importer la sauvegarde dans le nouveau profil et comparer les entrées.
Une future publication sur le Chrome Web Store exige de vérifier l'ID attribué
par le Store afin de ne pas annoncer à tort une continuité des installations.

## Migration volontaire depuis GitHub

Il n'y a **aucune migration automatique** ni suppression du dépôt GitHub.

1. Dans le profil GitHub actuel, exporter une sauvegarde JSON complète.
2. Dans un **profil navigateur distinct**, se connecter avec Google.
3. Choisir le mode de protection au premier accès (aucune phrase secrète en mode
   standard ; phrase secrète requise en mode renforcé) et attendre le premier
   état de synchronisation.
4. Importer explicitement la sauvegarde JSON avec le mode **Fusionner**.
5. Déclencher une nouvelle synchronisation, vérifier les comptes et comparer
   les nombres d'entrées, tags, notes, collections et suppressions.
6. Répéter sur l'extension liée au même compte Google.

En mode chiffré, la phrase secrète est indispensable à la restauration. Ni
Google ni TheardX ne peuvent la récupérer. Une mauvaise phrase secrète bloque
la lecture et empêche l'envoi d'une nouvelle sauvegarde dans ce cycle. En mode
standard, seul l'accès au compte Google est nécessaire.

## Contrôles de sécurité et limites à lever avant production

- **Pas de test OAuth réel** sans identifiants de développement Google Cloud.
  Les tests automatisés utilisent des réponses simulées.
- **Pas de test Arc/Brave/Edge** sans navigateur/configuration OAuth stable.
- **Nouvelle route OAuth Arc/Brave** : contrôler son accessibilité effective depuis
  Arc avec la protection de déploiement Vercel. L'accès CORS est restreint à
  `chrome-extension://finnpgeglikfoejkedoobkigbfgmbglf`, mais l'en-tête
  `Origin` n'est pas une authentification en soi : seul Google valide le
  code unique PKCE ou le _refresh token_. Vérifier les quotas et appliquer
  un contrôle de débit avant ouverture au public.
- Pour éviter une suppression accidentelle, les anciennes révisions ne sont
  **jamais supprimées automatiquement**. Les sauvegardes successives consomment
  de la place Drive. Le code bloque au-delà de **300 versions** (maximum 3 Mio
  par fichier) ; une politique sûre de rétention et de restauration doit être
  conçue et testée avant une utilisation soutenue.
- Les deux clients Google (Web/extension) utilisent le même nom de dossier et
  nommage de fichiers, et reconnaissent les modes standard et renforcé.
  Les modifications concurrentes au sein d'une génération sont fusionnées au
  prochain cycle (pas d'écrasement direct d'un fichier partagé). Des changements
  de mode simultanés sur plusieurs appareils demandent une vérification manuelle.
- Le mode hors connexion garde la bibliothèque locale. En mode renforcé, le
  serveur ne reçoit aucun texte déchiffré ; en mode standard, il traite le JSON
  en clair. Les anciennes copies ne sont jamais effacées automatiquement.
- Une session Web expirée nécessite une reconnexion ; la révocation Google doit
  être testée (erreurs 401/403, suppression du consentement, compte supprimé).
- Pour un lancement public : tests d'intégration réels, tests de charge et de
  reprise, documentation de confidentialité et consentement, contrôle de
  taille/quota, auditer la compatibilité RGPD et la politique de sauvegarde.

## Commandes de contrôle en développement

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm run build:web
```

**Ne pas lancer de déploiement Vercel ni fusionner dans `main` sans validation.**
