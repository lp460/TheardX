# Politique de confidentialité — ThreadShelf

_Dernière mise à jour : 22 octobre 2026_

ThreadShelf est une extension de navigateur qui permet d’enregistrer, lire, copier et organiser des publications de X (x.com). Elle est conçue pour fonctionner **entièrement sur votre appareil**.

## Données traitées

- **Publications que vous enregistrez.** Quand vous cliquez sur un bouton ThreadShelf, l’extension lit le contenu affiché dans votre onglet X ou Reddit : texte, auteur, date, images, liens, Articles, commentaires. Elle l’enregistre dans le stockage local de votre navigateur (IndexedDB). Rien n’est enregistré sans votre action.
- **Vos annotations** : notes, tags, collections, catégories, états de lecture.
- **Vos préférences** : stockées localement (`chrome.storage.local`).

ThreadShelf ne lit ni vos messages privés, ni vos identifiants, ni vos cookies, ni vos jetons de session X ou Reddit. Il n’utilise pas les API de X ni de Reddit.

**Reddit est facultatif.** ThreadShelf n’accède à reddit.com qu’après votre accord, demandé par le navigateur quand vous activez Reddit dans les Paramètres. Vous pouvez retirer cet accès à tout moment en désactivant l’option.

## Ce qui quitte votre appareil

Par défaut, **rien**, à l’exception de :

1. **Images des publications enregistrées.** Elles sont téléchargées une fois depuis `pbs.twimg.com` (le serveur d’images de X) ou depuis les serveurs d’images de Reddit (`i.redd.it`, `preview.redd.it`…) pour la lecture hors ligne, sans cookies. C’est désactivable dans Paramètres → Hors ligne.
2. **Synchronisation GitHub (facultative, désactivée par défaut).** Si vous cliquez sur « Se connecter avec GitHub », votre bibliothèque est envoyée dans un dépôt **privé** `threadshelf-data` de **votre** compte GitHub, via l’API officielle de GitHub. Vous pouvez la chiffrer de bout en bout avec une phrase secrète (AES-256) ; GitHub ne voit alors qu’un contenu illisible. L’autorisation GitHub est conservée uniquement dans votre navigateur. « Se déconnecter » la supprime, et vous pouvez aussi la révoquer depuis les paramètres de GitHub.
3. **Traduction.** La traduction utilise le traducteur **intégré** de votre navigateur, sur l’appareil : aucun texte n’est envoyé. Si ce traducteur n’est pas disponible, un bouton « Ouvrir dans Google Traduction » peut ouvrir le texte sur translate.google.com, **uniquement si vous cliquez dessus**.

## Ce que nous ne faisons pas

- Aucune télémétrie, aucune statistique d’usage, aucun cookie publicitaire.
- Aucune vente, location ou transmission de données à des tiers.
- Aucun serveur ThreadShelf : l’éditeur de l’extension n’a accès à aucune de vos données.

## Conservation et suppression

Vos données restent dans votre navigateur tant que vous ne les supprimez pas. Vous pouvez supprimer une entrée, tout effacer (Paramètres → Données), ou désinstaller l’extension, ce qui efface son stockage local. Les données synchronisées se trouvent dans votre dépôt GitHub, que vous pouvez supprimer à tout moment.

## Contact

Pour toute question : [adresse de contact à compléter].

---

# Privacy policy — ThreadShelf (English)

ThreadShelf saves, reads, copies and organises X (x.com) posts and, optionally, Reddit discussions **on your device**. Reddit access is only requested when you turn Reddit on in the settings.

- **Saved posts** (text, author, date, images, links, Articles) are read from your X tab only when you click a ThreadShelf button, and stored locally (IndexedDB), together with your notes, tags, collections and preferences.
- **Leaves your device only:**
  - images of saved posts, downloaded once from `pbs.twimg.com` for offline reading (can be turned off);
  - optional **GitHub sync** to a **private** repository in **your own** GitHub account, optionally end-to-end encrypted;
  - **Google Translate** only if you click « Ouvrir dans Google Traduction ». Built-in translation runs on-device.
- **Never:** no analytics, no telemetry, no selling or sharing of data, no ThreadShelf server, no access to your X credentials, cookies or private messages.
- **Deletion:** delete entries, erase everything in Settings → Data, or uninstall the extension.

Contact: [contact address to fill in].
