# Préparation de la fusion : état du nettoyage

## Point de sauvegarde

Le commit local `3f2886c` sur `integration` conserve les protections de session des génériques, la navigation sans rechargement au retour dans un onglet, les textes français et les tests associés. Il n’a pas été poussé ni publié lors de ce nettoyage.

## Changements de nettoyage

- Les 49 scripts de `App/scratch/` sont archivés dans `Archive/generics-repair-scripts/`, sans modification de leur contenu. Aucune référence depuis le code actif n’a été trouvée.
- Les fichiers locaux de `scratch/cost-preview/` restent sur le poste et sont exclus de Git. Ils comprennent des données de catalogue et des analyses de coûts : ne pas les ajouter à une publication.
- Les aperçus de retrait mensuel et les caches Python restent sur le poste et sont exclus de Git. Les scripts de test ne sont pas exclus.
- La version du cache PWA est incrémentée pour accompagner les changements sous `App/`.
- Le fichier `_config.yml` exclut du futur site GitHub Pages les archives, les sources de données, les sauvegardes, les tests, les scripts locaux et la documentation interne. Les URL de l’application sous `/App/` sont préservées. Cette configuration reste locale tant qu’aucune publication n’est autorisée.

## Éléments conservés en attente

| Élément | Constat | Suite proposée |
| --- | --- | --- |
| Branche locale `codex/company-returns` | Aucun commit absent de `main` ; arbre de travail propre lors de la vérification | Retirer le worktree et la branche après validation de la version fusionnée et autorisation de suppression |
| Worktree `Company Returns - Test Branch` | Toujours associé à cette ancienne branche | Le conserver jusqu’à l’autorisation de retrait |
| `stash@{0}` — `Move GS1 parser fix to main` | Le parseur `parseBarcode` correspond à celui de `main` ; le stash comprend aussi une ancienne modification de version du cache | Ne pas réappliquer le stash ; le supprimer seulement après validation et autorisation |
| Branche `integration` | Contient encore les fonctionnalités à intégrer | La conserver jusqu’à la fusion, aux vérifications et à l’autorisation de suppression |

## Avant publication

Les paramètres GitHub Pages ont été vérifiés le 16 novembre 2026 : mode `legacy`, branche `main`, dossier `/`, dernière publication réussie au commit `91a56cc`. Le dépôt GitHub est public. L’exclusion d’`App/` n’est donc pas une propriété de l’hébergement actuel : les dossiers internes doivent être explicitement exclus de la publication.

Le dépôt suit déjà dix fichiers dans `Bases de données csv/` et `Fichiers de sauvegarde JSON/` : sept fichiers sources ou images et trois sauvegardes JSON datées de juillet 2026. Ils sont aussi présents dans `origin/main`, indépendamment des nouvelles fonctionnalités génériques. L’inspection locale des seules clés de premier niveau des sauvegardes indique des sections `products`, `config`, des dates et des paramètres de tournée ; elle ne constitue pas un audit complet de leur contenu. Aucun fichier source ni sauvegarde n’a été modifié, déplacé ou supprimé.

**Les exclusions Pages ne règlent pas l’accès au dépôt public et à son historique.** Préparer séparément, avec l’utilisateur, la conservation privée de ces fichiers, leur retrait éventuel du suivi Git et la nécessité d’un nettoyage de l’historique. Ajouter ces chemins à `.gitignore` ne retirerait pas les fichiers déjà suivis de Git ni de son historique. Ne pas réécrire l’historique, supprimer des fichiers ni changer la visibilité du dépôt sans autorisation.

Préserver les changements plus récents de `main` concernant les retours fabricants. Résoudre les conflits des consignes et du cache PWA, puis vérifier la version combinée. Après une publication autorisée, vérifier que les URL de l’application restent fonctionnelles et que les fichiers exclus ne sont plus servis par Pages. Le comportement d’`exclude` est documenté dans la [documentation officielle GitHub Pages](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll).

Aucune fusion, publication, suppression de données, suppression de branche ou suppression de stash n’est effectuée dans cette étape.
