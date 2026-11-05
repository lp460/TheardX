# TheardX — checklist de validation bêta

**Statut : préparation, non validée.** Cette checklist n'autorise **aucun déploiement de production**. Remplir les cases et consigner navigateur, date et résultat avant chaque diffusion à des bêta-testeurs.

## 1. Connexion et protection des données

- [ ] Sur Chrome et Safari, démarrer une connexion depuis `https://theard-x.vercel.app/` et revenir à la bibliothèque, sans réutiliser une URL `/api/auth/callback`.
- [ ] Refuser l'autorisation GitHub, puis relancer proprement ; tester un code expiré sans jamais recopier le code dans une issue.
- [ ] Se déconnecter puis se reconnecter ; vérifier que le contenu local n'est pas perdu et qu'un deuxième compte GitHub n'ouvre pas la bibliothèque du premier.
- [ ] Tester un dépôt GitHub privé chiffré et une mauvaise phrase secrète : aucune suppression, aucun envoi en clair.
- [ ] Tester un dépôt GitHub non chiffré en montrant clairement à l'utilisateur ce que cela implique.
- [ ] Se connecter avec Google sur le web et l'extension : confirmer le même compte, la création du dossier Drive `TheardX` et la synchronisation.
- [ ] Vérifier que les nouvelles sauvegardes Google Drive utilisent le mode standard par défaut, que le chiffrement est disponible dans les options avancées et qu'une sauvegarde déjà chiffrée n'est jamais déchiffrée automatiquement.

## 2. Synchronisation entre deux appareils

- [ ] Enregistrer un article sur l'extension de l'appareil A ; le retrouver dans la PWA de l'appareil B.
- [ ] Modifier tags, notes, collection et favori sur B ; retrouver les changements sur A.
- [ ] Surligner un passage, ajouter un commentaire, le modifier sur B, puis le retrouver sur A.
- [ ] Supprimer une annotation puis synchroniser les deux appareils : pas de réapparition.
- [ ] Modifier deux entrées différentes hors ligne sur A et B ; synchroniser ensuite sans perdre de données.
- [ ] Supprimer une entrée sur A pendant que B est hors ligne ; vérifier sa disparition après reconnexion.
- [ ] Provoquer deux écritures GitHub proches dans le temps ; vérifier la fusion/reprise et l'absence de doublon.

## 3. Capture et import

- [ ] X : un post, un thread complet, un thread incomplet, un Article long, plusieurs images et un lien externe.
- [ ] Reddit : post et commentaires imbriqués, commentaire isolé et réponses chargées au défilement.
- [ ] Import CSV/JSON/JS X et CSV Reddit : compter les éléments ajoutés/ignorés, réimporter le même fichier sans doublons.
- [ ] Pour un import ne contenant que des liens, ouvrir ensuite le contenu avec l'extension et vérifier son enrichissement.
- [ ] Tester une publication supprimée, inaccessible ou tronquée : afficher la limite sans inventer de texte.

## 4. Lecture, partage et mobile

- [ ] Surligner sur plusieurs paragraphes et langues ; vérifier les annotations quand la mise en page ou le texte extrait change.
- [ ] Partager volontairement un article : ouvrir le lien sans compte ; vérifier l'absence de notes, annotations, tags privés et jetons.
- [ ] Activer la collaboration sur un lien : vérifier que seul un compte connecté peut ajouter une note publique, que le texte source reste immuable et qu'aucun e-mail complet n'est exposé.
- [ ] Depuis un compte destinataire, enregistrer une copie personnelle puis vérifier qu'elle est indépendante du partage et apparaît dans sa bibliothèque.
- [ ] Révoquer un lien et vérifier l'accès refusé ; tester un lien expiré.
- [ ] Safari iPhone (375 px), petit écran (320 px), tablette (768 px), desktop : menus, actions, traductions et lisibilité.
- [ ] Installer la PWA, ouvrir un article hors ligne après une première visite, revenir en ligne et vérifier la synchronisation.
- [ ] Vérifier que la traduction distante nécessite un consentement explicite et conserve le texte original.

## 5. Installation et distribution

- [ ] Télécharger le ZIP depuis le site et vérifier qu'il contient `manifest.json` et les fonctions récemment ajoutées.
- [ ] Installer sur Chrome, Arc, Brave et Edge à partir du dossier extrait ; enregistrer une première publication.
- [ ] Mettre à jour **dans le même dossier**, recharger l'extension et les onglets X/Reddit ; vérifier que les données personnelles restent disponibles.
- [ ] Vérifier que les instructions indiquent clairement qu'un ZIP ne se met pas à jour automatiquement.
- [ ] Vérifier la cohérence de README, politique de confidentialité, fiche Store et autorisations manifest.
- [ ] Choisir la licence, compléter les coordonnées de contact et approuver la politique avant toute publication publique Store.

## Bilan de validation

À remplir à chaque cycle : version/commit, navigateurs, cas non testés, bugs ouverts, **GO/NO-GO bêta** et validateur humain. Ne jamais remplacer un test réel X/Reddit par un test sur fixtures sans le signaler.
