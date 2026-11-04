# Distribuer TheardX / ThreadShelf et publier les mises à jour

**Statut actuel :** la PWA est accessible sur le Web, mais le téléchargement de l'extension proposé sur le site est un **ZIP à installer manuellement**. Ne présentez pas ce ZIP comme une extension déjà distribuée par le Chrome Web Store : **il ne se met pas à jour automatiquement**. La publication au Store reste un chantier à valider.

Une fois publiée et approuvée sur le **Chrome Web Store**, l'extension pourra être installée depuis sa fiche et recevoir les mises à jour du Store. Le même Store fournit des extensions Chromium compatibles avec Arc, Chrome, Brave et Edge (à confirmer par un test de chaque navigateur avant diffusion).

**Mise à jour manuelle avant publication Store :** télécharger un nouveau ZIP, remplacer les fichiers dans **le même dossier extrait**, recharger l'extension depuis le gestionnaire d'extensions, puis actualiser les onglets X/Reddit. Un nouveau dossier peut correspondre à une autre identité d'extension et ne pas retrouver les données du profil précédent ; exporter une sauvegarde avant migration.

> Pourquoi le Chrome Web Store ? Chrome (Windows et macOS) bloque l’installation d’extensions hébergées ailleurs pour le grand public. Un fichier `.crx` envoyé par e-mail ou un lien de mise à jour sur votre propre serveur ne fonctionnent pas chez vos clients.

## Publication initiale (une fois)

1. **Compte développeur** : <https://chrome.google.com/webstore/devconsole>. Frais uniques de 5 $ ; vérification de l’adresse e-mail et, selon le pays, de l’identité. Indiquez un nom d’éditeur (votre société par exemple).
2. **Licence et politique de confidentialité** : choisir la licence du projet avec son propriétaire, vérifier les déclarations de données de l'extension et de la PWA, compléter les coordonnées du responsable dans `PRIVACY.md` puis publier ce document. Plusieurs options :
   - un _gist_ public sur <https://gist.github.com> (coller le contenu, puis « Create public gist ») ;
   - une page de votre site ;
   - GitHub Pages.

   Gardez l’URL.

3. **Paquet** : `npm run release -- patch` ou `-- minor` selon la nature de la version. Vérifier le nouveau numéro dans `package.json`, le CHANGELOG, les tests et le fichier `artifacts/threadshelf-<version>.zip`. Ne pas utiliser un numéro d'exemple comme version réelle.
4. **Images** : `npm run store:assets` produit `artifacts/store/` : captures 1280×800, vignette 440×280, icône. Remplacez si possible `screenshot-1.png` par une vraie capture de x.com avec le menu ThreadShelf ouvert.
5. **Nouvel élément** dans la console : téléversez le zip.
6. **Fiche** : copiez les textes de `docs/store-listing.md` (nom, descriptions FR/EN, catégorie, images).
7. **Pratiques de confidentialité** : objectif unique, justification de chaque permission, données utilisées, certifications et URL de la politique. Tout est dans `docs/store-listing.md`.
8. **Visibilité** :
   - **Publique** : trouvable dans le Store ;
   - **Non répertoriée** : installable uniquement avec le lien, idéal pour des clients ;
   - **Privée** : réservée à une liste d’e-mails ou à un domaine Google Workspace.
9. **Envoyer pour examen**. Comptez en général de quelques heures à quelques jours. Une fois approuvée, l’extension reçoit son **identifiant définitif** et un lien `https://chromewebstore.google.com/detail/…` à donner à vos clients.

### Ce que voient vos clients

1. Ils ouvrent le lien du Store et cliquent **Ajouter à Chrome** (dans Arc, le bouton est le même).
2. Ils épinglent ThreadShelf (icône puzzle).
3. Sur x.com : bouton ThreadShelf sur chaque publication.
4. Synchronisation (facultative) : Paramètres → **Se connecter avec GitHub**. Chaque client utilise **son** compte GitHub et **son** dépôt privé. Vous n’avez jamais accès à leurs données.

## Mises à jour (à chaque nouvelle version)

1. Décrivez les changements sous `## Non publié` dans `CHANGELOG.md`.
2. Lancez `npm run release -- patch` (correctifs) ou `-- minor` (nouvelles fonctions) : nouvelle version, tests, zip.
3. Committez et créez le tag correspondant à la version réellement construite : `git tag vX.Y.Z`.
4. Dans la console du Store, ouvrez l’élément, onglet **Package**, puis **Importer un nouveau package**, et envoyez le zip pour examen.
5. Après approbation, le Store distribue normalement la mise à jour à ses installations. Tester d'abord les migrations IndexedDB et le maintien de la bibliothèque entre deux versions ; aucune garantie ne s'applique aux installations ZIP manuelles.

La version du zip doit toujours être **supérieure** à celle déjà publiée : le script s’en charge.

## Publication automatique (facultatif)

Le workflow `.github/workflows/publish.yml` publie tout seul quand vous poussez un tag `v*` vers GitHub : tests, zip, envoi au Store.

1. Mettez le projet dans un dépôt GitHub (privé), puis `git push` avec les tags.
2. Créez des identifiants de l’API Chrome Web Store, en suivant le guide de `chrome-webstore-upload` : <https://github.com/fregante/chrome-webstore-upload-keys>. Vous obtenez `CLIENT_ID`, `CLIENT_SECRET` et `REFRESH_TOKEN`.
3. Dans le dépôt GitHub, sous _Settings → Secrets and variables → Actions_, ajoutez :
   - `CWS_EXTENSION_ID` (identifiant attribué par le Store) ;
   - `CWS_PUBLISHER_ID` (console → Compte) ;
   - `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.
4. Ensuite : `npm run release -- patch`, commit, `git tag vX.Y.Z`, `git push --follow-tags`. La version part en examen toute seule.

## Points d’attention

- **Votre bibliothèque actuelle** : la version du Store a un autre identifiant que votre version de développement (`dist`), donc un autre stockage. Pour retrouver vos données, faites l’une des deux opérations :
  - connectez la synchronisation GitHub dans les deux versions ;
  - Paramètres → Données → **Exporter (JSON)** dans l’ancienne version, puis **Importer** dans la nouvelle.
- **Application GitHub « ThreadShelf »** : l’application OAuth (Client ID `Ov23liLkMRkSELNiYB2U`) est rattachée à votre compte GitHub ; c’est son nom que vos clients voient en autorisant la connexion. Vous pouvez la transférer plus tard à une organisation GitHub, sans changer le Client ID. Ajoutez-y l’URL de votre politique de confidentialité et un logo (_Settings → Developer settings → OAuth Apps_).
- **Microsoft Edge** : Edge installe depuis le Chrome Web Store. Une fiche sur le store Edge Add-ons est facultative.
- **Nom et marque** : la fiche précise « non affilié à X Corp. ». N’utilisez pas le logo de X dans les images.
- **Licence** : aucune licence n’est encore incluse dans le dépôt. Le propriétaire doit choisir explicitement une licence avant de présenter le code comme open source. Les conditions de distribution doivent être examinées séparément.
- **Validation bêta** : suivre [BETA-RELEASE-CHECKLIST.md](BETA-RELEASE-CHECKLIST.md) avant tout test externe et ne pas considérer ce document comme une autorisation de production.
