# Vérification manuelle dans Arc (5 minutes)

Arc ne peut pas être piloté automatiquement depuis cet environnement : aucun port de débogage n'est exposé, et un second profil Arc partagerait des fichiers avec le profil personnel. Voici les vérifications à faire à la main après le chargement :

1. `arc://extensions` → Mode développeur → **Charger l'extension non empaquetée** → dossier `dist/`. ThreadShelf 1.0.0 apparaît, sans erreur sur sa carte.
2. Épingler ThreadShelf (icône puzzle de la barre latérale), puis cliquer dessus : la popup s'ouvre.
3. Ouvrir un thread sur x.com : la barre **ThreadShelf · Enregistrer | Copier | Lire | •••** apparaît sous la publication ouverte et indique le nombre de publications.
4. **Enregistrer** : une notification « Thread enregistré — N publications » apparaît en bas à droite (ou « … potentiellement incomplet »). Faire défiler : si le thread était incomplet, la notification « Thread mis à jour — N publications » arrive.
5. **Copier** puis coller dans Notes : le Markdown commence par `# …`, `Auteur : …`, `## 1 / N`.
6. **Lire** : le lecteur s'ouvre dans un onglet. Tester le thème (`t`), la taille (`+`/`−`) et l'impression (`p`, puis « Enregistrer au format PDF »).
7. ⌥⇧L : la bibliothèque s'ouvre. Rechercher un mot du thread, ajouter aux favoris, créer une collection.
8. Quitter et relancer Arc : la bibliothèque est intacte.
9. Popup → décocher « Activé sur X » : la barre et les boutons disparaissent de X.
10. Clic droit sur une page de publication → « Enregistrer le thread dans ThreadShelf ».

En cas d'anomalie : `arc://extensions` → ThreadShelf → **Inspecter les vues : service worker** (console), ainsi que la console de l'onglet X (messages `[ThreadShelf]`).
