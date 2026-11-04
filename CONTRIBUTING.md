# Contribuer à TheardX / Contributing

Bienvenue ! TheardX regroupe une extension Chromium (encore appelée ThreadShelf dans certaines parties du code) et une PWA de lecture. Les contributions utiles sont aussi les rapports de bugs, les tests sur X/Reddit et les retours d'accessibilité.

## Avant de contribuer

1. Consultez le [README](README.md), la [documentation web](docs/WEB-PWA.md), les [règles de sécurité](SECURITY.md) et les [limitations de test](TESTING.md).
2. Pour un bug, ouvrez une [issue « Bug »](https://github.com/lp460/TheardX/issues/new/choose) avec les étapes reproductibles, le navigateur et le résultat attendu.
3. Pour une nouvelle fonctionnalité, ouvrez d'abord une issue. Expliquez le besoin utilisateur, les compromis de confidentialité et la façon de vérifier son intérêt.
4. **Ne publiez jamais** de token GitHub, code OAuth, phrase secrète, cookies, archive de bibliothèque privée ou capture contenant des données personnelles. Utilisez des données fictives.

**Licence :** le propriétaire du dépôt n'a pas encore choisi de licence open source. Le code public n'est donc **pas** implicitement libre de réutilisation. La licence doit être validée avant d'encourager des contributions de code externes ; les issues et retours fonctionnels restent bienvenus.

## Développer localement

Prérequis : Node.js 22 et npm. Pour un environnement reproductible :

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate
npm run build:web
```

Le build web génère aussi le ZIP de l'extension dans `dist-web/downloads/threadshelf-extension.zip`. Les tests navigateur requièrent Playwright Chromium :

```bash
npx playwright install chromium
npm run test:e2e
npm run test:e2e:web
```

Les scénarios qui dépendent du vrai site X ou de comptes utilisateurs sont **manuels** ou conditionnels : ne jamais présenter une exécution sur fixtures comme une validation d'un site tiers en direct.

## Règles de contribution

- Travaillez sur une branche dédiée, à partir de `main`. Proposez une pull request : **ne déployez pas directement en production**.
- Ajoutez un test de non-régression pour une correction de synchronisation, extraction, import, confidentialité ou annotation.
- Conservez le comportement de l'extension existante lorsque vous modifiez les composants partagés avec la PWA.
- Les traductions de l'interface doivent rester cohérentes en français, anglais et espagnol.
- Si une évolution ajoute un transfert de données ou une permission navigateur, expliquez-le dans l'issue et mettez à jour `PRIVACY.md`, `SECURITY.md` et le guide d'installation.
- Une PR doit indiquer : le besoin, les fichiers modifiés, les commandes testées, les limites non testées et les captures d'écran **anonymisées** pour un changement visuel.

## Vérifier une version candidate

Suivez [la checklist de bêta](docs/BETA-RELEASE-CHECKLIST.md). Toute publication du ZIP ou de la PWA doit conserver le même niveau de sécurité et de confidentialité. Aucun test, PR ou preview ne constitue une autorisation de mise en production.

---

**English summary:** Open a bug report or feature proposal first. Use fictional data, never post OAuth codes or private libraries. Install with `npm ci`, run typecheck/lint/unit tests plus extension and web builds, and document browser test coverage. Work on a feature branch and submit a PR. A public open-source license has **not yet been selected**, so external code contributions should wait for that decision.
