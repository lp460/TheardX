# Rapport de validation — ThreadShelf 1.0.0 (20 octobre 2026)

## Environnement

macOS 27.0.1 (arm64) · Arc 1.167.1 (Chromium 154) · Google Chrome 155 · Node 22.19 · npm 10.9 · Playwright 1.64 (Chromium) · Vitest 5.

## Résultats

| Étape | Commande | Résultat |
| --- | --- | --- |
| Types | `npm run typecheck` | ✅ 0 erreur (strict, `noUncheckedIndexedAccess`) |
| Lint | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| Unitaires et intégration | `npm run test` | ✅ **131 / 131** (8 fichiers) |
| Build | `npm run build` | ✅ `dist/` |
| Validation du build | `npm run validate` | ✅ MV3, permissions minimales, CSP stricte, ni eval ni code distant |
| End-to-end (Chromium, fixtures) | `npm run test:e2e` | ✅ **30 / 30** |
| x.com en direct (Chromium, non connecté) | `HEADED=1 npm run test:real` | ✅ 1 / 1 — 2 publications réelles |
| Arc | manuel | ⚠️ **non vérifié par l'agent** (voir plus bas) |

Total exécuté : 162 tests, 162 réussis, 0 échec.

## x.com en direct

- Mise en page détectée : `xds`, la mise en page actuelle servie aux visiteurs non connectés.
- Publication ouverte, auteur, nom, badge certifié, date (lue dans la page), texte avec retours à la ligne : corrects.
- La réponse de @mattpocockuk est enregistrée avec la publication de @karpathy en **contexte**, sans mélange avec le thread. Le texte tronqué de @karpathy (« Voir plus ») est marqué comme tronqué.
- Barre ThreadShelf visible sous la publication, boutons ajoutés en fin de barre d'actions, commandes natives intactes (capture `artifacts/screenshots/live-x-mattpocockuk.png`).
- En mode headless, X renvoie une erreur HTTP. Ce blocage n'a pas été contourné : le test se lance en fenêtre visible.
- Les vues des utilisateurs **connectés** n'ont pas pu être observées (aucune session disponible, aucun identifiant demandé).

## Arc

- Arc n'expose pas de port CDP. Lancer une seconde instance avec un autre `--user-data-dir` aurait partagé des fichiers d'état (`StorableSidebar.json`) avec le profil personnel : écarté.
- Le chargement d'une extension non empaquetée ne peut pas être automatisé.
- L'accès en lecture seule à l'écran d'Arc a été refusé pendant la session. Aucun contrôle visuel n'a donc été fait dans Arc.
- Compatibilité prévue : l'interface ne dépend d'aucune API absente d'Arc (pas de `sidePanel`) et les capacités sont détectées à l'exécution. Arc 1.167 repose sur Chromium 154, la même famille que le Chromium testé.
- **Liste de contrôle manuelle** : [ARC-CHECKLIST.md](ARC-CHECKLIST.md).

## Performances (page fixture : 30 publications du thread + 20 réponses)

| Mesure | Valeur |
| --- | --- |
| Tas JS supplémentaire dû à l'extension sur la page X | ≈ 2,3 Mo (3,8 Mo contre 1,48 Mo sans extension) |
| Ré-analyse complète + aller-retour de message | ≈ 3 ms |
| Analyses déclenchées par 300 mutations DOM en rafale | < 15 (limitées à 250 ms) |
| `content.js` | 405 Ko minifié (React, zod, moteur) |
| Paquet `artifacts/threadshelf-1.0.0.zip` | 450 Ko |

## Captures d'écran

`artifacts/screenshots/` : barre dans X, panneau, notification, bibliothèque (cartes, liste, palette ⌘K), paramètres, lecteur (haut, médias), popup, en thème clair et sombre, plus deux captures de x.com en direct.
