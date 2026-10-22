# Changelog

## Non publié

- **Traduction** dans le lecteur : traducteur intégré au navigateur, sur l’appareil, sans envoi de données ; détection de la langue ; blocs de code non traduits ; traductions mises en cache (hors ligne) ; copie et export de la traduction ; repli Google Traduction sur clic explicite. Raccourci `l`. Langue cible réglable.
- **Distribution** : script `npm run release`, images du Store (`npm run store:assets`), fiche et justifications des permissions, politique de confidentialité, publication automatique facultative sur le Chrome Web Store.
- Base de données v3 (table des traductions, migration automatique).

- **Articles X (publications longues)** : capture complète du titre, de la couverture, des intertitres, paragraphes (gras, italique, liens), listes, citations, blocs de code (avec langage), images et séparateurs. Rendu dans le lecteur, la copie, les exports, la recherche et le cache hors ligne. Un aperçu d’Article vu dans un fil est signalé comme partiel.

- **Synchronisation de la bibliothèque entre PC via un dépôt GitHub privé.**
  - « Se connecter avec GitHub » (OAuth Device Flow) : un code à coller sur GitHub, sans jeton ni secret. Le dépôt privé `threadshelf-data` est créé automatiquement puis retrouvé sur les autres PC.
  - Fusion la plus récente gagnante, suppressions propagées, détection des envois concurrents.
  - Chiffrement de bout en bout facultatif.
  - Synchronisation automatique (après modification, périodique, au démarrage) ou manuelle.
  - Historique versionné par les commits.
- Marqueurs de suppression (entrées, collections, catégories) dans le stockage et les sauvegardes ; une restauration manuelle l'emporte sur une suppression antérieure.
- Les renommages de catégories et de collections portent une date de modification.

- Menu d'actions complet sur chaque publication de X : enregistrer (thread, publication, références), sélection, copier (Markdown, publication, texte), lire, options, bibliothèque, supprimer.
- Bouton flottant « ThreadShelf » toujours visible sur X. Il cible la publication en cours de lecture, fonctionne aussi sur les fils d'actualité et peut être désactivé dans les paramètres.
- Bouton par publication plus visible (couleur ThreadShelf, pastille verte une fois enregistrée).
- Action « Copier un diagnostic de la page » : structure seulement, sans contenu, pour signaler une page non reconnue.

## 1.0.0 — 2026-10-20

Première version.

- Détection des publications sur x.com et twitter.com : mise en page actuelle de X (relevée en octobre 2026) et mise en page classique `data-testid`.
- Reconstruction des threads fondée sur des preuves : lignes de connexion et chaîne des parents. Quatre états de complétude ; contexte séparé ; publications supprimées signalées.
- Modes de capture : publication, thread de l'auteur, publication + références, sélection manuelle.
- Capture progressive pendant le défilement, résistante à la virtualisation de X, sans doublon.
- Interface dans X : barre sous la publication ouverte, bouton par publication, panneau flottant, notifications (Shadow DOM, thème de X).
- Popup, bibliothèque (recherche, filtres, tri, collections, catégories, tags, « À lire plus tard », favoris, sélection multiple, doublons, stockage), lecteur (thèmes, polices, taille, largeur, sommaire, raccourcis, note, sélection, impression).
- Copie Markdown et texte ; exports TXT, Markdown, HTML autonome, JSON et PDF (impression).
- IndexedDB versionné (v2, migration testée), cache d'images hors ligne, sauvegarde et import JSON validés et transactionnels.
- Paramètres : activation globale et par domaine, détection automatique, interface injectée, boutons par publication, notifications, lecture, copie, hors ligne.
- Raccourcis ⌥⇧T, ⌥⇧S, ⌥⇧C, ⌥⇧L et menus contextuels.
- Architecture prévue pour d'autres sites (`ContentAdapter`), pour l'IA (avec consentement obligatoire) et pour la synchronisation, sans implémentation.
