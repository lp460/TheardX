# Sécurité et confidentialité

## Permissions (minimales)

| Permission                                            | Usage                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `storage`                                             | Préférences (`chrome.storage.local`)                                    |
| `unlimitedStorage`                                    | Bibliothèque et images hors ligne dans IndexedDB, sans quota arbitraire |
| `contextMenus`                                        | « Enregistrer cette publication / ce thread dans ThreadShelf »          |
| `clipboardWrite`                                      | Copie depuis la page X déclenchée par un raccourci                      |
| hôte `https://pbs.twimg.com/*`                        | Télécharger les images des publications **que vous avez enregistrées**  |
| content script sur `x.com`, `twitter.com`, `mobile.*` | Lecture du DOM affiché                                                  |

ThreadShelf ne demande pas les permissions `tabs`, `cookies`, `webRequest`, `scripting`, `downloads` ou `<all_urls>`. `npm run validate` échoue si l'une d'elles apparaît.

## Règles appliquées

- **Aucun code distant, aucun `eval`, aucun `new Function`.** CSP des pages : `script-src 'self'; object-src 'self'; base-uri 'none'`. zod tourne en mode `jitless`. Ces points sont vérifiés à chaque build.
- **Pas de HTML de X stocké ni réinjecté.** Le texte est converti en segments typés. L'affichage passe par React, qui échappe le contenu, et les exports HTML et Markdown échappent eux aussi le texte.
- **Liens sûrs.** Seules les URL `http(s)` deviennent des liens, toujours avec `rel="noopener noreferrer"`. Les paramètres de suivi (`utm_*`, `s`, `t`…) sont retirés. Les images ne sont acceptées que depuis `pbs.twimg.com`, `video.twimg.com` et `abs.twimg.com` en HTTPS.
- **Messages validés.** Chaque requête vers le service worker passe par un schéma zod strict, avec des tailles bornées et des champs inconnus refusés. L'expéditeur doit être l'extension elle-même, depuis une page de l'extension ou un onglet x.com / twitter.com. Le content script ignore les messages d'autres extensions.
- **Import sûr.** Le fichier est validé élément par élément : les éléments invalides sont ignorés et signalés, et l'intégrité référentielle est vérifiée. L'écriture se fait en **une transaction** : en cas d'échec, rien n'est modifié.
- **HTML exporté autonome** : pas de script, CSP `default-src 'none'` intégrée, `referrer` désactivé.
- **Isolation dans X** : Shadow DOM, aucun style global injecté, aucune commande native masquée, aucune modification du comportement de X.
- **Respect de X.** Pas d'API interne, pas de requête vers x.com, pas de lecture de cookies ou de jetons, pas de défilement ou de collecte automatisés. Le « suivi actif » ne fait que lire ce que _vous_ faites apparaître en défilant.

## Données

- Tout est stocké localement : IndexedDB et `chrome.storage.local` de l'extension.
- **Aucune télémétrie, aucun analytics, aucun service tiers.**
- Requêtes réseau émises par l'extension : uniquement les images des publications enregistrées, depuis `pbs.twimg.com` avec `credentials: 'omit'` et `referrerPolicy: 'no-referrer'`. Désactivable : Paramètres → Hors ligne.
- IA : non livrée. L'architecture (`src/ai/provider.ts`) exige activation **et** consentement explicite avant qu'un contenu quitte le navigateur.

## Signaler un problème

Ouvrez une issue privée sur le dépôt ou contactez le mainteneur. Merci de ne pas publier de détails exploitables avant correction.
