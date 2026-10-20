# Changelog

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
